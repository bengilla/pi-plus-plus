import type { AgentDefinition } from "./types";

// ── Known agent registry ──────────────────────────────────
// Pi-only: single agent, no multi-agent switching needed.

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
    id: "pi",
    name: "Pi",
    description: "Earendil Pi coding agent — multi-provider, RPC mode",
    binary: "pi",
    fallbackPaths: ["/opt/homebrew/bin/pi", "/usr/local/bin/pi"],
    packageName: "@earendil-works/pi-coding-agent",
    spawnArgs: (_workspace, prompt, thinkingLevel, model, sessionId) => {
      const args = [
        "--mode", "json",
        "-p",
      ];
      if (sessionId) {
        args.push("--session", sessionId);
      }
      if (thinkingLevel && thinkingLevel !== "auto") {
        args.push("--thinking", thinkingLevel);
      }
      if (model) {
        args.push("--model", model);
      }
      args.push(prompt);
      return args;
    },
    capabilities: { skills: true, imageGen: false, fileOps: true, maxContext: 200_000 },
    thinkingLevels: PI_THINKING_LEVELS,
  },
];

// ── Lookup helpers ─────────────────────────────────────────
const byId = new Map(KNOWN_AGENTS.map((a) => [a.id, a]));

export function getDefinition(id: string): AgentDefinition | undefined {
  return byId.get(id);
}

/** Always returns the Pi agent definition (single-agent mode). */
export function getPiDefinition(): AgentDefinition {
  return KNOWN_AGENTS[0];
}

export function getAllDefinitions(): AgentDefinition[] {
  return KNOWN_AGENTS;
}
