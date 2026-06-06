// ── Agents module — public API ────────────────────────────
// Discovery: scans PATH for installed CLI agents
// Adapters: spawns CLI processes, parses output, yields SSE events

export type {
  AgentEvent,
  AgentCapabilities,
  AgentDefinition,
  DiscoveredAgent,
  AgentAdapter,
} from "./types";

export { KNOWN_AGENTS, getDefinition, getAllDefinitions } from "./registry";
export { discoverAgents, clearDiscoveryCache } from "./discovery";
export { createAdapter } from "./adapters/factory";

import { discoverAgents } from "./discovery";
import { createAdapter } from "./adapters/factory";
import { getDefinition } from "./registry";
import type { AgentEvent, AgentAdapter } from "./types";

// ── Runtime state ─────────────────────────────────────────
const adapters = new Map<string, AgentAdapter>();

/** Initialize: discover agents and create adapters for installed ones */
export function initAgents(): string[] {
  const discovered = discoverAgents();

  for (const d of discovered) {
    if (adapters.has(d.id)) continue;

    const def = getDefinition(d.id);
    if (!def) continue;

    adapters.set(d.id, createAdapter(def, d.path));
  }

  return discovered.map((d) => d.id);
}

/** Get an adapter by agent id */
export function getAdapter(id: string): AgentAdapter | undefined {
  return adapters.get(id);
}

/** Get all initialized agent ids */
export function getAvailableAgents(): string[] {
  return Array.from(adapters.keys());
}

/** Clear all adapters (re-initialize) */
export function resetAgents(): void {
  adapters.clear();
}

/** Chat: spawn agent and yield events */
export async function* chat(
  agent: string,
  workspace: string,
  prompt: string,
): AsyncIterable<AgentEvent> {
  const adapter = adapters.get(agent);
  if (!adapter) {
    yield { type: "error", error: `Agent not available: ${agent}` };
    yield { type: "done" };
    return;
  }
  yield* adapter.chat(workspace, prompt);
}

/** Interrupt a running agent session */
export function interrupt(agent: string): void {
  adapters.get(agent)?.interrupt();
}
