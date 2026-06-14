import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { homedir } from "node:os";

const execFileAsync = promisify(execFile);

// GET /api/pi/version — return current version + check for updates
export async function GET() {
  try {
    // Get installed version
    const piBin = process.env.PI_BIN || "pi";
    const { stdout: versionOut } = await execFileAsync(piBin, ["--version"], {
      timeout: 10_000,
      env: { ...process.env, PATH: `/opt/homebrew/bin:${homedir()}/.local/bin:${process.env.PATH || ""}` },
    });
    const currentVersion = versionOut.trim();

    // Check latest npm version
    let latestVersion: string | null = null;
    let updateAvailable = false;
    try {
      const { stdout: npmOut } = await execFileAsync(
        "npm",
        ["view", "@earendil-works/pi-coding-agent", "version"],
        { timeout: 15_000 },
      );
      latestVersion = npmOut.trim();
      updateAvailable = compareVersions(latestVersion, currentVersion) > 0;
    } catch {
      // npm check failed — offline or no network
    }

    return NextResponse.json({ currentVersion, latestVersion, updateAvailable });
  } catch (e) {
    console.error("[pi/version] Failed:", e);
    return NextResponse.json({ currentVersion: null, latestVersion: null, updateAvailable: false });
  }
}

function compareVersions(a: string, b: string): number {
  const parse = (v: string) => v.split(".").map(Number);
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
