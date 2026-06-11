import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { detectInstalledAgents } from "@/lib/agents";
import { getDefinition } from "@/lib/agents/registry";

const execFileAsync = promisify(execFile);

interface UpgradeRequest {
  agentId?: string;
  action?: "check" | "upgrade";
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as UpgradeRequest;
  const agentId = body.agentId;
  const action = body.action ?? "check";
  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  const detected = detectInstalledAgents({ refresh: true }).find((agent) => agent.id === agentId);
  const definition = getDefinition(agentId);
  if (!detected || !definition?.packageName) {
    return NextResponse.json({ error: "Agent does not support upgrade checks yet" }, { status: 400 });
  }

  const packageName = definition?.packageName;
  if (!packageName) {
    return NextResponse.json({ error: "Agent does not support npm upgrades" }, { status: 400 });
  }
  const npmBin = npmForPath(detected.path);

  if (action === "check") {
    const latestVersion = await getLatestNpmVersion(npmBin, packageName);
    const currentVersion = normalizeVersion(detected.version);
    return NextResponse.json({
      agentId,
      currentVersion: detected.version,
      latestVersion,
      updateAvailable: Boolean(currentVersion && latestVersion && compareVersions(latestVersion, currentVersion) > 0),
      packageName,
      manager: "npm",
      command: `${npmBin} install -g ${packageName}@latest`,
    });
  }

  const { stdout, stderr } = await execFileAsync(npmBin, ["install", "-g", `${packageName}@latest`], {
    timeout: 180_000,
    maxBuffer: 1024 * 1024,
  });
  const refreshed = detectInstalledAgents({ refresh: true }).find((agent) => agent.id === agentId);

  return NextResponse.json({
    agentId,
    upgraded: true,
    version: refreshed?.version,
    stdout: stdout.slice(-4000),
    stderr: stderr.slice(-4000),
  });
}

async function getLatestNpmVersion(npmBin: string, packageName: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync(npmBin, ["view", packageName, "version"], {
      timeout: 30_000,
      maxBuffer: 256 * 1024,
    });
    return stdout.trim() || undefined;
  } catch {
    return undefined;
  }
}

function npmForPath(path: string): string {
  if (path.startsWith("/opt/homebrew/")) return "/opt/homebrew/bin/npm";
  return "npm";
}

function normalizeVersion(version?: string): string | undefined {
  return version?.match(/\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?/)?.[0];
}

function compareVersions(a: string, b: string): number {
  const aa = a.split(/[.-]/).map((part) => Number.parseInt(part, 10));
  const bb = b.split(/[.-]/).map((part) => Number.parseInt(part, 10));
  for (let i = 0; i < Math.max(aa.length, bb.length); i++) {
    const av = Number.isFinite(aa[i]) ? aa[i] : 0;
    const bv = Number.isFinite(bb[i]) ? bb[i] : 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}
