// ── Content block types for rich message rendering ─────────
export type ContentBlock =
  | { type: "text"; content: string }
  | { type: "thinking"; content: string; duration?: number }
  | { type: "tool_use"; id: string; toolName: string; toolInput: Record<string, unknown>; status: "running" | "completed" | "error" }
  | { type: "tool_result"; id: string; toolOutput: string; images?: { data: string; mimeType: string }[] };

// ── Agent event (SSE stream) ──────────────────────────────
export interface AgentEvent {
  type: "text" | "tool_use" | "tool_result" | "tool_execution" | "error" | "done" | "thinking" | "compaction_start" | "compaction_end" | "queue_update";
  text?: string;
  thinkingText?: string;
  toolName?: string;
  toolId?: string;
  toolInput?: Record<string, unknown>;
  toolOutput?: string;
  /** Base64-encoded images from tool results (e.g. codex_generate_image) */
  images?: { data: string; mimeType: string }[];
  error?: string;
  /** When true, this error is a macOS/iCloud permission issue — show a modal, not a chat message */
  permissionError?: boolean;
  /** Actual token counts from provider usage (overrides length-based estimate) */
  inputTokens?: number;
  outputTokens?: number;
  cacheTokens?: number;
  /** For tool_execution events: partial streaming output from a running tool */
  partialOutput?: string;
  /** For tool_execution events: true when tool finishes with an error */
  isError?: boolean;
  /** Model info from the assistant message */
  model?: string;
  provider?: string;
  /** Pi session ID (for resuming sessions) */
  sessionId?: string;
  /** Compaction reason: manual, threshold, overflow */
  compactionReason?: string;
  /** Result description from compaction_end */
  compactionResult?: string;
  /** Queue update: pending steering/follow-up messages */
  queueItems?: QueueItem[];
}

/** A pending steering or follow-up action from a queue_update event */
export interface QueueItem {
  type: "steering" | "followUp";
  text: string;
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
  /** Unique key, e.g. "pi" */
  id: string;
  /** Display name, e.g. "Claude Code" */
  name: string;
  /** Description shown in UI */
  description: string;
  /** Binary name to detect, e.g. "pi" */
  binary: string;
  /** Extra PATH directories to check */
  fallbackPaths: string[];
  /** npm package name when the CLI is distributed as a global npm package */
  packageName?: string;
  /** How to spawn: build args array from workspace + prompt + thinking level + model */
  spawnArgs: (workspace: string, prompt: string, thinkingLevel?: string, model?: string, sessionId?: string) => string[];
  /** Capabilities */
  capabilities: AgentCapabilities;
  /** Supported thinking levels (if empty, thinking control is hidden for this agent) */
  thinkingLevels: { value: string; label: string }[];
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

export interface DetectedAgent {
  id: string;
  name: string;
  binary: string;
  description: string;
  path: string;
  version?: string;
  installSource?: string;
  status: "available" | "needs-adapter";
  upgradeSupported?: boolean;
}

// ── Adapter: spawns a CLI and yields events ───────────────
export interface AgentAdapter {
  readonly definition: AgentDefinition;
  readonly path: string;
  chat(workspace: string, prompt: string, thinkingLevel?: string, model?: string, sessionId?: string): AsyncIterable<AgentEvent>;
  interrupt(): void;
}
