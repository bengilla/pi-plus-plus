export type AgentName = "pi" | "claude-code" | "codex";

export interface ChatOptions {
  model?: string;
  maxTokens?: number;
  streaming?: boolean;
}

export interface AgentEvent {
  type: "text" | "tool_use" | "tool_result" | "error" | "done";
  text?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolOutput?: string;
  error?: string;
}

export interface Session {
  id: string;
  workspace: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface AgentCapabilities {
  skills: boolean;
  imageGen: boolean;
  fileOps: boolean;
  maxContext: number;
}

export interface AgentAdapter {
  readonly name: AgentName;
  readonly capabilities: AgentCapabilities;

  chat(
    workspace: string,
    prompt: string,
    options?: ChatOptions,
  ): AsyncIterable<AgentEvent>;

  listSessions(workspace: string): Promise<Session[]>;
  interrupt(sessionId: string): Promise<void>;
}
