import type { AgentDefinition, AgentAdapter, AgentEvent } from "../types";
import { spawnAgent, parseClaudeLine, parseCodexLine, parsePiLine, parseGenericLine } from "../spawn";

// ── Adapter factory ───────────────────────────────────────
// Each agent adapter follows the same pattern:
// 1. Spawn the CLI binary with spawnArgs(workspace, prompt)
// 2. Read stdout line by line
// 3. Parse each line into AgentEvent via the agent-specific parser
// 4. Yield events; on process exit, yield { type: "done" }

type LineParser = (line: string) => AgentEvent | null;

const PARSERS: Record<string, LineParser> = {
  "claude-code": parseClaudeLine,
  codex: parseCodexLine,
  pi: parsePiLine,
};

export function createAdapter(definition: AgentDefinition, binaryPath: string): AgentAdapter {
  const parse = PARSERS[definition.id] ?? parseGenericLine;
  let child: ReturnType<typeof spawnAgent> | null = null;

  return {
    definition,
    path: binaryPath,

    async *chat(workspace: string, prompt: string): AsyncIterable<AgentEvent> {
      const args = definition.spawnArgs(workspace, prompt);
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
              if (event.type === "done") { yield event; return; }
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

        // Check exit code
        const { code, stderr } = await child.result;
        if (code !== 0 && code !== null) {
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
