import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { expandHome } from "./utils";
import type { DetectedAgent, DiscoveredAgent } from "./types";
import { KNOWN_AGENTS } from "./registry";

// ── Discovery ──────────────────────────────────────────────
// Scans PATH and fallback locations for known agent binaries.
// Returns only what's actually installed on this device.

const COMMON_BIN_DIRS = [
  "~/.local/bin",
  "~/.npm-global/bin",
  "~/.bun/bin",
  "~/.cargo/bin",
  "~/Library/pnpm",
  "/opt/homebrew/bin",
  "/usr/local/bin",
  "/usr/bin",
  "/bin",
];

const DETECTABLE_AGENTS: { id: string; name: string; binary: string; description: string }[] = [
  { id: "opencode", name: "OpenCode", binary: "opencode", description: "OpenCode CLI agent" },
  { id: "gemini", name: "Gemini", binary: "gemini", description: "Google Gemini CLI agent" },
  { id: "aider", name: "Aider", binary: "aider", description: "Aider coding assistant" },
  { id: "cursor-agent", name: "Cursor Agent", binary: "cursor-agent", description: "Cursor command-line agent" },
];

let cached: DiscoveredAgent[] | null = null;

export function discoverAgents(options: { refresh?: boolean } = {}): DiscoveredAgent[] {
  if (cached && !options.refresh) return cached;

  const found: DiscoveredAgent[] = [];

  for (const def of KNOWN_AGENTS) {
    const resolved = resolveBinary(def.binary, def.fallbackPaths);
    if (!resolved) continue;

    const version = tryGetVersion(resolved) || tryGetPackageVersion(resolved, def.packageName);

    found.push({
      id: def.id,
      name: def.name,
      description: def.description,
      path: resolved,
      version,
      capabilities: { ...def.capabilities },
    });
  }

  cached = found;
  return found;
}

export function detectInstalledAgents(options: { refresh?: boolean } = {}): DetectedAgent[] {
  const available = discoverAgents(options);
  const knownById = new Map(KNOWN_AGENTS.map((def) => [def.id, def]));
  const found = new Map<string, DetectedAgent>();

  for (const agent of available) {
    const def = knownById.get(agent.id);
    found.set(agent.id, {
      id: agent.id,
      name: agent.name,
      binary: def?.binary ?? agent.id,
      description: agent.description,
      path: agent.path,
      version: agent.version,
      installSource: inferInstallSource(agent.path),
      status: "available",
      upgradeSupported: Boolean(def?.packageName) || agent.id === "hermes",
    });
  }

  for (const candidate of DETECTABLE_AGENTS) {
    if (found.has(candidate.id) || knownById.has(candidate.id)) continue;
    const resolved = resolveBinary(candidate.binary, []);
    if (!resolved) continue;
    found.set(candidate.id, {
      ...candidate,
      path: resolved,
      version: tryGetVersion(resolved) || tryGetPackageVersion(resolved),
      installSource: inferInstallSource(resolved),
      status: "needs-adapter",
      upgradeSupported: false,
    });
  }

  return Array.from(found.values()).sort((a, b) => {
    if (a.status !== b.status) return a.status === "available" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

/** Clear discovery cache (e.g. after PATH change) */
export function clearDiscoveryCache(): void {
  cached = null;
}

// ── Binary resolution ─────────────────────────────────────
function resolveBinary(binary: string, fallbackPaths: string[]): string | null {
  const pathDirs = (process.env.PATH ?? "")
    .split(":")
    .map((p) => p.trim())
    .filter(Boolean);
  const candidates = [
    ...pathDirs.map((dir) => `${dir.replace(/\/$/, "")}/${binary}`),
    ...fallbackPaths,
    ...COMMON_BIN_DIRS.map((dir) => `${dir}/${binary}`),
  ];

  for (const fp of candidates) {
    const expanded = expandHome(fp);
    if (existsSync(expanded)) return expanded;
  }

  return null;
}

function tryGetVersion(binaryPath: string): string | undefined {
  try {
    const out = execFileSync(binaryPath, ["--version"], {
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    // Take first line, strip leading "v"
    const line = out.split("\n")[0].replace(/^v/, "").trim();
    if (!line) return undefined;
    return line.length < 50 ? line : line.slice(0, 47) + "...";
  } catch {
    return undefined;
  }
}

function tryGetPackageVersion(binaryPath: string, packageName?: string): string | undefined {
  const packageJson = findPackageJson(binaryPath, packageName);
  if (!packageJson) return undefined;
  try {
    const pkg = JSON.parse(readFileSync(packageJson, "utf-8")) as { version?: string };
    return pkg.version;
  } catch {
    return undefined;
  }
}

function findPackageJson(binaryPath: string, packageName?: string): string | null {
  let real = binaryPath;
  try {
    real = realpathSync(binaryPath);
  } catch {
    // keep original path
  }

  const candidates: string[] = [];
  if (packageName) {
    const marker = `/node_modules/${packageName}/`;
    const idx = real.indexOf(marker);
    if (idx !== -1) {
      candidates.push(join(real.slice(0, idx), "node_modules", packageName, "package.json"));
    }
  }

  let dir = dirname(real);
  for (let i = 0; i < 8; i++) {
    candidates.push(join(dir, "package.json"));
    const next = dirname(dir);
    if (next === dir) break;
    dir = next;
  }

  return candidates.find((p) => existsSync(p)) ?? null;
}

function inferInstallSource(path: string): string {
  try {
    const real = realpathSync(path);
    if (real.includes("/node_modules/")) return "npm";
  } catch {
    // keep path-based fallback
  }
  if (path.includes("/opt/homebrew/")) return "Homebrew";
  if (path.includes("/usr/local/")) return "Local";
  if (path.includes("/.bun/")) return "Bun";
  if (path.includes("/.cargo/")) return "Cargo";
  if (path.includes("/Library/pnpm/")) return "pnpm";
  if (path.includes("/.npm-global/") || path.includes("/node_modules/")) return "npm";
  if (path.includes("/.local/bin/")) return "Local bin";
  return "PATH";
}
