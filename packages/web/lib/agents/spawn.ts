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
    env: { ...process.env, PATH: `${process.env.HOME}/.local/bin:/opt/homebrew/bin:${process.env.PATH || ""}`, ...opts.env },
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

// ── Pi-specific parsers ─────────────────────────────────

/** Extract text from a Pi assistant message partial's content array */
function extractContentText(content: unknown): string {
  if (Array.isArray(content)) {
    return content
      .filter((b: { type?: string; text?: string }) => b.type === "text" && b.text)
      .map((b: { text: string }) => b.text)
      .join("");
  }
  return "";
}

/** Extract tool call info (id + name) from a partial.content array, if present */
function extractToolCallFromPartial(content: unknown): { id?: string; name?: string } | null {
  if (!Array.isArray(content)) return null;
  for (const item of content) {
    if (item?.type === "toolCall") {
      return { id: item.id, name: item.name };
    }
  }
  return null;
}

/** Parse Pi JSON Lines output (pi --mode json) */
export function parsePiLine(line: string): AgentEvent | null {
  if (!line.trim()) return null;
  try {
    const evt = JSON.parse(line);

    // ── message_update: streaming deltas from the LLM ────────
    if (evt.type === "message_update" && evt.assistantMessageEvent) {
      const ame = evt.assistantMessageEvent;
      switch (ame.type) {
        case "text_start":
        case "text_end":
          // Text lifecycle markers — no visible content to emit
          return null;
        case "text_delta":
          return ame.delta ? { type: "text", text: ame.delta } : null;
        case "thinking_start":
          // Emit empty thinking to initialize the thinking block on the client
          return { type: "thinking", thinkingText: "" };
        case "thinking_delta":
          return ame.delta ? { type: "thinking", thinkingText: ame.delta } : null;
        case "thinking_end":
          // Thinking block complete — no visible content to emit
          return null;
        case "toolcall_start": {
          // Tool call starting — try to extract actual name/id from partial.content
          const partialInfo = extractToolCallFromPartial(ame.partial?.content);
          return {
            type: "tool_use",
            toolId: partialInfo?.id ?? `call_${ame.contentIndex}`,
            toolName: partialInfo?.name ?? "",
            toolInput: {},
          };
        }
        case "toolcall_delta": {
          // Partial JSON arguments streamed token-by-token.
          // Extract real ID from partial.content too in case toolcall_start already
          // emitted with the real ID (so delta's ID matches).
          const partialInfo = extractToolCallFromPartial(ame.partial?.content);
          return {
            type: "tool_use",
            toolId: partialInfo?.id ?? `call_${ame.contentIndex}`,
            toolInput: { __partial: ame.delta },
          };
        }
        case "toolcall_end": {
          // Tool call complete — emit full tool_use with the **real** toolCall id,
          // which matches what tool_execution_start will use.
          const tc = ame.toolCall;
          if (!tc) return null;
          return {
            type: "tool_use",
            toolId: tc.id ?? `call_${ame.contentIndex}`,
            toolName: tc.name ?? "",
            toolInput: (tc.arguments ?? {}) as Record<string, unknown>,
          };
        }
        case "done": {
          // Message complete — extract usage from the message
          // Anthropic SDK uses snake_case (input_tokens, output_tokens).
          const msg = ame.message || evt.message;
          const usage = msg?.usage;
          return {
            type: "done",
            inputTokens: usage?.input_tokens ?? usage?.input,
            outputTokens: usage?.output_tokens ?? usage?.output,
            cacheTokens: (usage?.cache_read_input_tokens ?? usage?.cacheRead ?? 0) + (usage?.cache_creation_input_tokens ?? usage?.cacheWrite ?? 0) || undefined,
          };
        }
        case "error": {
          // Stream error
          return { type: "error", error: ame.error?.message ?? ame.reason ?? "Pi stream error" };
        }
        default:
          return null;
      }
    }

    // ── tool_execution_*: actual tool execution (bash, read, write, edit) ──
    if (evt.type === "tool_execution_start") {
      return {
        type: "tool_use",
        toolId: evt.toolCallId ?? "",
        toolName: evt.toolName ?? "",
        toolInput: (evt.args ?? {}) as Record<string, unknown>,
      };
    }
    if (evt.type === "tool_execution_update") {
      // Partial output — stream it as incremental tool result
      const partial = extractContentText(evt.partialResult?.content);
      return {
        type: "tool_result",
        toolId: evt.toolCallId ?? "",
        toolOutput: partial,
      };
    }
    if (evt.type === "tool_execution_end") {
      const output = extractContentText(evt.result?.content);
      return {
        type: "tool_result",
        toolId: evt.toolCallId ?? "",
        toolOutput: output || (evt.isError ? "Tool execution error" : ""),
      };
    }

    // ── message_end: extract final usage if not already captured ──
    if (evt.type === "message_end") {
      const msg = evt.message;
      const usage = msg?.usage;
      if (usage) {
        return {
          type: "done",
          // Pi's own message format uses input/output, Anthropic SDK uses input_tokens/output_tokens
          inputTokens: usage?.input ?? usage?.input_tokens,
          outputTokens: usage?.output ?? usage?.output_tokens,
          cacheTokens: (usage?.cacheRead ?? usage?.cache_read_input_tokens ?? 0) + (usage?.cacheWrite ?? usage?.cache_creation_input_tokens ?? 0) || undefined,
        };
      }
      return null;
    }

    // ── queue_update: pending steering / follow-up ──────
    if (evt.type === "queue_update") {
      const items: { type: "steering" | "followUp"; text: string }[] = [];
      const steering = evt.steering as { text?: string }[] | undefined;
      const followUp = evt.followUp as { text?: string }[] | undefined;
      if (Array.isArray(steering)) {
        for (const s of steering) {
          if (s.text) items.push({ type: "steering", text: s.text });
        }
      }
      if (Array.isArray(followUp)) {
        for (const f of followUp) {
          if (f.text) items.push({ type: "followUp", text: f.text });
        }
      }
      if (items.length > 0) {
        return { type: "queue_update", queueItems: items };
      }
      return null;
    }

    // ── compaction_start / compaction_end ───────────────
    if (evt.type === "compaction_start") {
      return {
        type: "compaction_start",
        compactionReason: evt.reason ?? "manual",
      };
    }
    if (evt.type === "compaction_end") {
      return {
        type: "compaction_end",
        compactionReason: evt.reason ?? "manual",
        compactionResult: evt.result ?? "",
      };
    }

    // ── session: capture session ID for resume ──────────
    if (evt.type === "session" && evt.id) {
      return { type: "thinking", thinkingText: "", sessionId: evt.id };
    }

    // ── message_start (assistant): extract model info ──────
    if (evt.type === "message_start" && evt.message?.role === "assistant") {
      const m = evt.message;
      if (m.model || m.provider) {
        return { type: "thinking", thinkingText: "", model: m.model, provider: m.provider };
      }
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
      evt.type === "auto_retry_start" ||
      evt.type === "auto_retry_end" ||
      evt.type === "session_info_changed" ||
      evt.type === "thinking_level_changed"
    ) {
      return null;
    }

    // Catch-all for unrecognized event types
    return null;
  } catch {
    return { type: "text", text: line };
  }
}

