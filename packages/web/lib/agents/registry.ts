import type { AgentDefinition } from "./types";

// ── Known agent registry ──────────────────────────────────
// To add a new agent: add an entry here. That's it.
// Discovery scans PATH for the binary; no other code changes needed.

export const KNOWN_AGENTS: AgentDefinition[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    description: "Anthropic Claude Code — multi-agent coding CLI",
    binary: "claude",
    fallbackPaths: ["~/.local/bin/claude", "/opt/homebrew/bin/claude", "/usr/local/bin/claude"],
    spawnArgs: (workspace, prompt) => [
      "-p", prompt,
      "--output-format", "stream-json",
      "--verbose",
      "--no-session-persistence",
      "--add-dir", workspace,
    ],
    capabilities: { skills: true, imageGen: false, fileOps: true, maxContext: 200_000 },
  },
  {
    id: "codex",
    name: "Codex",
    description: "OpenAI Codex CLI — gpt-image2, sandboxed execution",
    binary: "codex",
    fallbackPaths: ["/opt/homebrew/bin/codex", "/usr/local/bin/codex"],
    spawnArgs: (workspace, prompt) => [
      "exec",
      "--json",
      "--color", "never",
      "--ephemeral",
      "-C", workspace,
      prompt,
    ],
    capabilities: { skills: false, imageGen: true, fileOps: true, maxContext: 200_000 },
  },
  {
    id: "pi",
    name: "Pi",
    description: "Earendil Pi coding agent — multi-provider, RPC mode",
    binary: "pi",
    fallbackPaths: ["/opt/homebrew/bin/pi", "/usr/local/bin/pi"],
    spawnArgs: (_workspace, prompt) => [
      "--mode", "json",
      "-p",
      "--no-session",
      prompt,
    ],
    capabilities: { skills: true, imageGen: false, fileOps: true, maxContext: 200_000 },
  },
  {
    id: "openclaw",
    name: "OpenClaw",
    description: "OpenClaw agent — local-first, multi-channel",
    binary: "openclaw",
    fallbackPaths: ["/opt/homebrew/bin/openclaw", "/usr/local/bin/openclaw"],
    spawnArgs: (_workspace, prompt) => [
      "agent",
      "--message", prompt,
      "--json",
      "--local",
    ],
    capabilities: { skills: true, imageGen: false, fileOps: true, maxContext: 128_000 },
  },
  {
    id: "hermes",
    name: "Hermes",
    description: "Nous Research Hermes — open-source agent with MCP",
    binary: "hermes",
    fallbackPaths: ["/opt/homebrew/bin/hermes", "/usr/local/bin/hermes", "~/.local/bin/hermes"],
    spawnArgs: (_workspace, prompt) => [
      "chat",
      "-q", prompt,
      "-Q",
      "--yolo",
    ],
    capabilities: { skills: true, imageGen: false, fileOps: true, maxContext: 128_000 },
  },
];

// ── Lookup helpers ─────────────────────────────────────────
const byId = new Map(KNOWN_AGENTS.map((a) => [a.id, a]));

export function getDefinition(id: string): AgentDefinition | undefined {
  return byId.get(id);
}

export function getAllDefinitions(): AgentDefinition[] {
  return KNOWN_AGENTS;
}
