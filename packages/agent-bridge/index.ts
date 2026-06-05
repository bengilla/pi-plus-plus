import type { AgentAdapter, AgentEvent, AgentName, ChatOptions, Session } from "./types";

export type { AgentAdapter, AgentEvent, AgentName, ChatOptions, Session } from "./types";
export { createPiAdapter } from "./adapters/pi";

// Registry of available adapters
const adapters = new Map<string, AgentAdapter>();

export function registerAdapter(adapter: AgentAdapter): void {
  adapters.set(adapter.name, adapter);
}

export function getAdapter(name: string): AgentAdapter | undefined {
  return adapters.get(name);
}

export function getAvailableAgents(): AgentName[] {
  return Array.from(adapters.keys()) as AgentName[];
}

export async function* chat(
  agent: string,
  workspace: string,
  prompt: string,
  options?: ChatOptions,
): AsyncIterable<AgentEvent> {
  const adapter = adapters.get(agent);
  if (!adapter) {
    yield { type: "error", error: `Unknown agent: ${agent}` };
    return;
  }
  yield* adapter.chat(workspace, prompt, options);
}

export async function listSessions(agent: string, workspace: string): Promise<Session[]> {
  const adapter = adapters.get(agent);
  if (!adapter) return [];
  return adapter.listSessions(workspace);
}

export async function interrupt(agent: string, sessionId: string): Promise<void> {
  const adapter = adapters.get(agent);
  if (adapter) await adapter.interrupt(sessionId);
}
