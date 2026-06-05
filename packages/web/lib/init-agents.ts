import { registerAdapter, createPiAdapter, createClaudeCodeAdapter, createCodexAdapter } from "@/lib/agent-bridge";

let initialized = false;

export function initAgents(): void {
  if (initialized) return;
  initialized = true;

  registerAdapter(createPiAdapter());
  registerAdapter(createClaudeCodeAdapter());
  registerAdapter(createCodexAdapter());

  console.log("[agents-web] Registered: Pi, Claude Code, Codex");
}
