import type { AgentDefinition, AgentAdapter, AgentEvent } from "../types";
import { spawnAgent, parsePiLine } from "../spawn";

// ── Adapter factory ───────────────────────────────────────
// Spawns pi CLI, reads stdout line by line, parses into AgentEvent.

type LineParser = (line: string) => AgentEvent | null;

const PARSERS: Record<string, LineParser> = {
  pi: parsePiLine,
};

export function createAdapter(definition: AgentDefinition, binaryPath: string): AgentAdapter {
  const parse = PARSERS[definition.id] ?? parsePiLine;
  let child: ReturnType<typeof spawnAgent> | null = null;

  return {
    definition,
    path: binaryPath,

    async *chat(workspace: string, prompt: string, thinkingLevel?: string, model?: string, sessionId?: string): AsyncIterable<AgentEvent> {
      const args = definition.spawnArgs(workspace, prompt, thinkingLevel, model, sessionId);
      child = spawnAgent({ binary: binaryPath, args, cwd: workspace });

      try {
        let lineBuffer = "";
        for await (const chunk of child.chunks) {
          lineBuffer += chunk;
          const lines = lineBuffer.split("\n");
          // Last element may be incomplete — carry over to next chunk
          lineBuffer = lines.pop() ?? "";

          for (const line of lines) {
            const event = parse(line);
            if (event) {
              // Don't return on 'done' — tool execution events arrive after
              // the model's message is done. Keep reading until stdout closes.
              yield event;
            }
          }
        }

        // Flush any remaining content in the buffer
        if (lineBuffer.trim()) {
          const event = parse(lineBuffer);
          if (event) {
            if (event.type === "done") { yield event; return; }
            yield event;
          }
        }

        // Check exit code — 143 (128+SIGTERM) means user clicked Stop, not an error
        const { code, stderr } = await child.result;
        if (code !== 0 && code !== null && code !== 143) {
          const errMsg = stderr.trim() || `exited with code ${code}`;
          yield { type: "error", error: `${definition.name}: ${errMsg}` };
        }
        yield { type: "done" };
      } catch (err) {
        yield {
          type: "error",
          error: err instanceof Error ? err.message : `${definition.name} spawn error`,
        };
        yield { type: "done" };
      }
    },

    interrupt() {
      child?.kill();
      child = null;
    },
  };
}
