// ── Types ──────────────────────────────────────────────────
export type AgentName = "pi" | "claude-code" | "codex";

export interface AgentEvent {
  type: "text" | "tool_use" | "tool_result" | "error" | "done";
  text?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolOutput?: string;
  error?: string;
}

export interface AgentCapabilities {
  skills: boolean; imageGen: boolean; fileOps: boolean; maxContext: number;
}

export interface AgentAdapter {
  readonly name: AgentName;
  readonly capabilities: AgentCapabilities;
  chat(workspace: string, prompt: string): AsyncIterable<AgentEvent>;
}

// ── Registry ───────────────────────────────────────────────
const adapters = new Map<string, AgentAdapter>();

export function registerAdapter(adapter: AgentAdapter): void {
  adapters.set(adapter.name, adapter);
}

export async function* chat(
  agent: string, workspace: string, prompt: string,
): AsyncIterable<AgentEvent> {
  const adapter = adapters.get(agent);
  if (!adapter) { yield { type: "error", error: `Unknown: ${agent}` }; return; }
  yield* adapter.chat(workspace, prompt);
}

// ── Stub adapter factory (will be replaced with real CLI spawn in Phase 3) ──
function createStubAdapter(
  name: AgentName, skills: boolean, imageGen: boolean,
  stubMsg: string,
): AgentAdapter {
  return {
    name,
    capabilities: { skills, imageGen, fileOps: true, maxContext: 200_000 },
    async *chat(_w, _p) {
      yield { type: "text", text: stubMsg };
      yield { type: "done" };
    },
  };
}

export function createPiAdapter(): AgentAdapter {
  return createStubAdapter("pi", true, false,
    "[Pi] Ready.\n\nPi coding agent adapter (Phase 2 stub). Real CLI integration in Phase 3.\nInstall: npm install -g @earendil-works/pi-coding-agent");
}

export function createClaudeCodeAdapter(): AgentAdapter {
  return createStubAdapter("claude-code", true, false,
    "[Claude Code] Ready.\n\nClaude Code adapter (Phase 2 stub). Real CLI integration in Phase 3.\nInstall: npm install -g @anthropic-ai/claude-code");
}

export function createCodexAdapter(): AgentAdapter {
  return createStubAdapter("codex", false, true,
    "[Codex] Ready.\n\nCodex adapter (Phase 2 stub). Supports gpt-image2.\nInstall: npm install -g @anthropic-ai/codex");
}
