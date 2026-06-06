import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { expandHome } from "./utils";
import type { DiscoveredAgent } from "./types";
import { KNOWN_AGENTS } from "./registry";

// ── Discovery ──────────────────────────────────────────────
// Scans PATH and fallback locations for known agent binaries.
// Returns only what's actually installed on this device.

let cached: DiscoveredAgent[] | null = null;

export function discoverAgents(): DiscoveredAgent[] {
  if (cached) return cached;

  const found: DiscoveredAgent[] = [];

  for (const def of KNOWN_AGENTS) {
    const resolved = resolveBinary(def.binary, def.fallbackPaths);
    if (!resolved) continue;

    const version = tryGetVersion(def.binary);

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

/** Clear discovery cache (e.g. after PATH change) */
export function clearDiscoveryCache(): void {
  cached = null;
}

// ── Binary resolution ─────────────────────────────────────
function resolveBinary(binary: string, fallbackPaths: string[]): string | null {
  // 1. Try `which` (respects PATH)
  try {
    const path = execSync(`which ${escapeShell(binary)} 2>&1`, {
      encoding: "utf-8",
      timeout: 2000,
    }).trim();
    if (path && existsSync(path)) return path;
  } catch {
    // which failed, continue to fallbacks
  }

  // 2. Try fallback paths (common install locations)
  for (const fp of fallbackPaths) {
    const expanded = expandHome(fp);
    if (existsSync(expanded)) return expanded;
  }

  return null;
}

function tryGetVersion(binary: string): string | undefined {
  try {
    const out = execSync(`${escapeShell(binary)} --version 2>&1`, {
      encoding: "utf-8",
      timeout: 5000,
    }).trim();
    // Take first line, strip leading "v"
    const line = out.split("\n")[0].replace(/^v/, "");
    return line.length < 50 ? line : line.slice(0, 47) + "...";
  } catch {
    return undefined;
  }
}

// ── Helpers ────────────────────────────────────────────────
function escapeShell(s: string): string {
  // Prevent command injection in which/version calls
  if (/[^a-zA-Z0-9._/-]/.test(s)) {
    return `"${s.replace(/"/g, '\\"')}"`;
  }
  return s;
}
