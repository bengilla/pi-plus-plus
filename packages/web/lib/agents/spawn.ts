import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import type { AgentEvent } from "./types";

// ── Spawn helper ───────────────────────────────────────────
// Spawns a CLI agent, reads stdout line by line, yields raw
// lines so per-agent parsers can transform them into AgentEvents.

export interface SpawnOptions {
  binary: string;
  args: string[];
  cwd: string;
  env?: Record<string, string>;
  timeout?: number; // ms, default 5 min
}

export interface SpawnSession {
  child: ChildProcess;
  lines: AsyncIterable<string>;
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

  const rl = createInterface({ input: child.stdout! });
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

  async function* lines(): AsyncIterable<string> {
    try {
      for await (const line of rl) {
        if (killed) break;
        yield line;
      }
    } finally {
      clearTimeout(timer);
    }
  }

  return { child, lines: lines(), kill, result };
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
        if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
          return evt.delta.text ? { type: "text", text: evt.delta.text } : null;
        }
        // Skip thinking_delta, message_start, content_block_start/stop, etc.
        return null;
      }

      // Error
      if (msg.type === "error") {
        return { type: "error", error: msg.error?.message ?? "Claude error" };
      }
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
