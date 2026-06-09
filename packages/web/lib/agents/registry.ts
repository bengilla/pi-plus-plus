import type { AgentDefinition } from "./types";

// ── Known agent registry ──────────────────────────────────
// To add a new agent: add an entry here. That's it.
// Discovery scans PATH for the binary; no other code changes needed.

const CLAUDE_THINKING_LEVELS = [
  { value: "auto", label: "Auto" },
  { value: "disabled", label: "Off" },
  { value: "adaptive", label: "Adaptive" },
  { value: "enabled", label: "On" },
];

const CODEX_REASONING_LEVELS = [
  { value: "auto", label: "Auto" },
  { value: "minimal", label: "Minimal" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "xhigh", label: "X-High" },
];

const PI_THINKING_LEVELS = [
  { value: "auto", label: "Auto" },
  { value: "off", label: "Off" },
  { value: "minimal", label: "Minimal" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "xhigh", label: "X-High" },
];

export const KNOWN_AGENTS: AgentDefinition[] = [
  {
    id: "claude-code",
    name: "Claude",
    description: "Anthropic Claude — multi-agent coding CLI",
    binary: "claude",
    fallbackPaths: ["~/.local/bin/claude", "/opt/homebrew/bin/claude", "/usr/local/bin/claude"],
    packageName: "@anthropic-ai/claude-code",
    spawnArgs: (workspace, prompt, thinkingLevel) => {
      const args = [
        "-p", prompt,
        "--output-format", "stream-json",
        "--verbose",
        "--no-session-persistence",
        "--add-dir", workspace,
      ];
      // Claude rejects `--thinking disabled` when a saved reasoning_effort is set,
      // so Off means "do not override the user's Claude effort setting".
      if (thinkingLevel && thinkingLevel !== "auto" && thinkingLevel !== "disabled") {
        args.push("--thinking", thinkingLevel);
      }
      return args;
    },
    capabilities: { skills: true, imageGen: false, fileOps: true, maxContext: 200_000 },
    thinkingLevels: CLAUDE_THINKING_LEVELS,
  },
  {
    id: "codex",
    name: "Codex",
    description: "OpenAI Codex CLI — gpt-image2, sandboxed execution",
    binary: "codex",
    fallbackPaths: ["/opt/homebrew/bin/codex", "/usr/local/bin/codex"],
    packageName: "@openai/codex",
    spawnArgs: (workspace, prompt, thinkingLevel) => {
      const args = [
        "exec",
        "--json",
        "--color", "never",
        "--ephemeral",
        "-C", workspace,
      ];
      if (thinkingLevel && thinkingLevel !== "auto") {
        args.push("-c", `model_reasoning_effort="${thinkingLevel}"`);
      }
      args.push(prompt);
      return args;
    },
    capabilities: { skills: false, imageGen: true, fileOps: true, maxContext: 200_000 },
    thinkingLevels: CODEX_REASONING_LEVELS,
  },
  {
    id: "pi",
    name: "Pi",
    description: "Earendil Pi coding agent — multi-provider, RPC mode",
    binary: "pi",
    fallbackPaths: ["/opt/homebrew/bin/pi", "/usr/local/bin/pi"],
    packageName: "@earendil-works/pi-coding-agent",
    spawnArgs: (_workspace, prompt, thinkingLevel) => {
      const args = [
        "--mode", "json",
        "-p",
        "--no-session",
      ];
      if (thinkingLevel && thinkingLevel !== "auto") {
        args.push("--thinking", thinkingLevel);
      }
      args.push(prompt);
      return args;
    },
    capabilities: { skills: true, imageGen: false, fileOps: true, maxContext: 200_000 },
    thinkingLevels: PI_THINKING_LEVELS,
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
    thinkingLevels: [],
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
    thinkingLevels: [],
  },
  {
    id: "opencode",
    name: "OpenCode",
    description: "OpenCode CLI agent — terminal-native coding assistant",
    binary: "opencode",
    fallbackPaths: ["/opt/homebrew/bin/opencode", "/usr/local/bin/opencode", "~/.local/bin/opencode"],
    packageName: "opencode-ai",
    spawnArgs: (workspace, prompt) => [
      "run",
      "--format", "json",
      "--dir", workspace,
      "--dangerously-skip-permissions",
      prompt,
    ],
    capabilities: { skills: false, imageGen: false, fileOps: true, maxContext: 200_000 },
    thinkingLevels: [],
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
