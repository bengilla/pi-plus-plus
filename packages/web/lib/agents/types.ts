// ── Agent event (SSE stream) ──────────────────────────────
export interface AgentEvent {
  type: "text" | "tool_use" | "tool_result" | "error" | "done";
  text?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolOutput?: string;
  error?: string;
}

// ── Agent capabilities ────────────────────────────────────
export interface AgentCapabilities {
  skills: boolean;
  imageGen: boolean;
  fileOps: boolean;
  maxContext: number;
}

// ── Agent definition (known agent registry) ───────────────
export interface AgentDefinition {
  /** Unique key, e.g. "claude-code", "pi" */
  id: string;
  /** Display name, e.g. "Claude Code" */
  name: string;
  /** Description shown in UI */
  description: string;
  /** Binary name to detect, e.g. "claude" */
  binary: string;
  /** Extra PATH directories to check */
  fallbackPaths: string[];
  /** How to spawn: build args array from workspace + prompt */
  spawnArgs: (workspace: string, prompt: string) => string[];
  /** Capabilities */
  capabilities: AgentCapabilities;
}

// ── Discovered agent (result of scanning PATH) ────────────
export interface DiscoveredAgent {
  id: string;
  name: string;
  description: string;
  path: string;
  version?: string;
  capabilities: AgentCapabilities;
}

// ── Adapter: spawns a CLI and yields events ───────────────
export interface AgentAdapter {
  readonly definition: AgentDefinition;
  readonly path: string;
  chat(workspace: string, prompt: string): AsyncIterable<AgentEvent>;
  interrupt(): void;
}
