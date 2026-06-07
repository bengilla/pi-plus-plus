import { spawn, type ChildProcess } from "node:child_process";
import type { AgentEvent } from "./types";

// ── Spawn helper ───────────────────────────────────────────
// Spawns a CLI agent, reads stdout in raw chunks (not line-buffered),
// yields text as soon as the OS delivers data from the pipe.

export interface SpawnOptions {
  binary: string;
  args: string[];
  cwd: string;
  env?: Record<string, string>;
  timeout?: number; // ms, default 5 min
}

export interface SpawnSession {
  child: ChildProcess;
  chunks: AsyncIterable<string>;
  kill: () => void;
  /** Resolves when process exits: { code, stderr } */
  result: Promise<{ code: number | null; stderr: string }>;
}

export function spawnAgent(opts: SpawnOptions): SpawnSession {
  const child = spawn(opts.binary, opts.args, {
    cwd: opts.cwd,
    env: { ...process.env, ...opts.env },
    stdio: ["pipe", "pipe", "pipe"],
  });
  // Close stdin immediately — agents read from args, not stdin
  child.stdin?.end();

  let killed = false;

  const kill = () => {
    killed = true;
    child.kill("SIGTERM");
    // Force kill after 3s
    setTimeout(() => {
      if (!child.killed) child.kill("SIGKILL");
    }, 3000);
  };

  // Timeout
  const timeoutMs = opts.timeout ?? 300_000; // 5 min default
  const timer = setTimeout(() => {
    if (!killed) kill();
  }, timeoutMs);

  child.on("close", () => clearTimeout(timer));

  // Collect stderr for error reporting
  let stderr = "";
  child.stderr?.on("data", (d: Buffer) => {
    stderr += d.toString();
  });

  const result = new Promise<{ code: number | null; stderr: string }>((resolve) => {
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stderr });
    });
  });

  // Yield raw stdout chunks as they arrive — no readline buffering.
  // Uses double-check pattern to prevent race between push() and the promise.
  async function* chunks(): AsyncIterable<string> {
    const events: string[] = [];
    let resolveWait: (() => void) | null = null;
    let done = false;

    const push = (s: string) => {
      events.push(s);
      resolveWait?.();
    };
    const finish = () => {
      done = true;
      resolveWait?.();
    };

    const waitForNext = () => new Promise<void>((r) => {
      if (events.length > 0 || done) { r(); return; }
      resolveWait = () => { resolveWait = null; r(); };
      // Re-check: push() may have fired between first check and setting resolveWait
      if (events.length > 0 || done) {
        resolveWait = null;
        r();
      }
    });

    child.stdout!.on("data", (d: Buffer) => push(d.toString()));
    child.stdout!.on("end", finish);

    try {
      while (true) {
        if (events.length > 0) {
          if (killed) return;
          yield events.shift()!;
          continue;
        }
        if (done) break;
        await waitForNext();
      }
    } finally {
      child.stdout!.off("data", push);
      child.stdout!.off("end", finish);
      clearTimeout(timer);
    }
  }

  return { child, chunks: chunks(), kill, result };
}

// ── Common line-to-event parsers ──────────────────────────

/** Parse Claude Code output — handles both plain text and NDJSON stream modes */
export function parseClaudeLine(line: string): AgentEvent | null {
  if (!line.trim()) return null;

  // NDJSON mode (--output-format stream-json --verbose)
  if (line.startsWith("{")) {
    try {
      const msg = JSON.parse(line);

      // Filter out system messages (hooks, init, status, thinking_tokens)
      if (msg.type === "system") return null;

      // Stream event — Anthropic Message Stream format
      if (msg.type === "stream_event" && msg.event) {
        const evt = msg.event;

        // Text delta — actual response content
        if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
          return evt.delta.text ? { type: "text", text: evt.delta.text } : null;
        }

        // Thinking delta — show thinking progress in UI
        if (evt.type === "content_block_delta" && evt.delta?.type === "thinking_delta") {
          return evt.delta.text ? { type: "thinking", thinkingText: evt.delta.text } : null;
        }

        // Message start — capture input token count
        if (evt.type === "message_start" && evt.message?.usage) {
          return { type: "thinking", inputTokens: evt.message.usage.input_tokens ?? 0 };
        }

        // Message delta — capture real output token count
        if (evt.type === "message_delta" && evt.delta?.usage) {
          return { type: "thinking", outputTokens: evt.delta.usage.output_tokens ?? 0 };
        }

        // Tool use start — content_block_start with tool_use type
        if (evt.type === "content_block_start" && evt.content_block?.type === "tool_use") {
          return {
            type: "tool_use",
            toolId: evt.content_block.id,
            toolName: evt.content_block.name,
            toolInput: evt.content_block.input ?? {},
          };
        }

        // Tool input delta — incremental JSON
        if (evt.type === "content_block_delta" && evt.delta?.type === "input_json_delta") {
          return {
            type: "tool_use",
            toolInput: { __partial: evt.delta.partial_json },
          };
        }

        return null;
      }

      // Aggregated assistant message (bulk mode — entire message at once)
      if (msg.type === "assistant" && msg.message?.content) {
        for (const block of msg.message.content) {
          if (block.type === "text" && block.text) {
            return { type: "text", text: block.text };
          }
          if (block.type === "thinking" && block.thinking) {
            return { type: "thinking", thinkingText: block.thinking };
          }
          if (block.type === "tool_use") {
            return {
              type: "tool_use",
              toolId: block.id,
              toolName: block.name,
              toolInput: block.input ?? {},
            };
          }
        }
        return null;
      }

      // User message (tool results in multi-turn)
      if (msg.type === "user" && msg.message?.content) {
        for (const block of msg.message.content) {
          if (block.type === "tool_result") {
            return {
              type: "tool_result",
              toolId: block.tool_use_id,
              toolOutput: typeof block.content === "string"
                ? block.content
                : JSON.stringify(block.content),
            };
          }
        }
        return null;
      }

      // Final result — done with token counts
      if (msg.type === "result") {
        return {
          type: "done",
          inputTokens: msg.usage?.input_tokens,
          outputTokens: msg.usage?.output_tokens,
          cacheTokens: (msg.usage?.cache_read_input_tokens ?? 0) + (msg.usage?.cache_creation_input_tokens ?? 0) || undefined,
        };
      }

      // Error
      if (msg.type === "error") {
        return { type: "error", error: msg.error?.message ?? "Claude error" };
      }

      // Unknown JSON event type — skip silently (don't dump raw JSON as text)
      return null;
    } catch {
      // Invalid JSON — treat as text line
    }
  }

  // Plain text mode: each line is text content
  return { type: "text", text: line };
}

/** Parse Codex JSONL output (codex exec --json) */
export function parseCodexLine(line: string): AgentEvent | null {
  if (!line.trim()) return null;
  try {
    const evt = JSON.parse(line);

    // codex JSONL event types
    switch (evt.type) {
      case "item.completed": {
        const item = evt.item;
        if (!item) return null;
        // Agent text message
        if (item.type === "agent_message" && item.text) {
          return { type: "text", text: item.text };
        }
        // Tool call result
        if (item.type === "command_execution") {
          return {
            type: "tool_result",
            toolOutput: item.output ?? JSON.stringify(item),
          };
        }
        return null;
      }
      case "turn.completed":
      case "thread.completed": {
        return { type: "done" };
      }
      case "thread.started":
      case "turn.started":
      case "item.started": {
        return null; // lifecycle events
      }
      case "AgentMessage": {
        const text = evt.message?.content ?? evt.message;
        return typeof text === "string" ? { type: "text", text } : { type: "text", text: JSON.stringify(text) };
      }
      case "CommandExecution": {
        return {
          type: "tool_use",
          toolName: evt.command ?? evt.name ?? "exec",
          toolInput: evt as unknown as Record<string, unknown>,
        };
      }
      case "FileChange": {
        return { type: "tool_result", toolOutput: `File change: ${evt.path ?? evt.file ?? ""}` };
      }
      case "Error": {
        return { type: "error", error: evt.message ?? "Codex error" };
      }
      default: {
        // Catch-all
        const text = evt.text ?? evt.content ?? evt.message;
        if (typeof text === "string") return { type: "text", text };
        return null;
      }
    }
  } catch {
    return { type: "text", text: line };
  }
}

/** Parse Pi JSON Lines output (pi --mode json) */
export function parsePiLine(line: string): AgentEvent | null {
  if (!line.trim()) return null;
  try {
    const evt = JSON.parse(line);

    // Pi uses "message_update" events with nested assistantMessageEvent
    if (evt.type === "message_update" && evt.assistantMessageEvent) {
      const ame = evt.assistantMessageEvent;
      if (ame.type === "text_delta" && ame.delta) {
        return { type: "text", text: ame.delta };
      }
      // Skip thinking_delta, thinking_end, text_end
      return null;
    }

    // Skip session/agent lifecycle events (no user-visible content)
    if (
      evt.type === "session" ||
      evt.type === "agent_start" ||
      evt.type === "agent_end" ||
      evt.type === "turn_start" ||
      evt.type === "turn_end" ||
      evt.type === "message_start" ||
      evt.type === "message_end"
    ) {
      return null;
    }

    // Direct text events
    switch (evt.type) {
      case "text":
      case "content":
      case "delta": {
        return { type: "text", text: evt.text ?? evt.content ?? evt.delta ?? "" };
      }
      case "tool_call":
      case "tool_use": {
        return {
          type: "tool_use",
          toolName: evt.tool ?? evt.name ?? evt.tool_name ?? "",
          toolInput: (evt.input ?? evt.arguments ?? {}) as Record<string, unknown>,
        };
      }
      case "tool_result":
      case "tool_response": {
        return {
          type: "tool_result",
          toolOutput: typeof evt.output === "string" ? evt.output : JSON.stringify(evt.output ?? evt.result),
        };
      }
      case "error": {
        return { type: "error", error: evt.message ?? evt.error ?? "Pi error" };
      }
      case "done":
      case "complete": {
        return { type: "done" };
      }
    }

    // Unrecognized JSON — skip (don't dump raw JSON as text)
    return null;
  } catch {
    return { type: "text", text: line };
  }
}

/** Generic passthrough — treats each line as plain text */
export function parseGenericLine(line: string): AgentEvent | null {
  if (!line.trim()) return null;
  // Try JSON first
  try {
    const evt = JSON.parse(line);
    if (evt.type === "error" || evt.error) {
      return { type: "error", error: evt.error ?? evt.message ?? "Agent error" };
    }
    const text = evt.text ?? evt.content ?? evt.message ?? evt.delta;
    if (typeof text === "string") return { type: "text", text };
  } catch {
    // Plain text
  }
  return { type: "text", text: line };
}
