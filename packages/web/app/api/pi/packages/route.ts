import { NextResponse, NextRequest } from "next/server";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";
import { homedir } from "node:os";
import { execFileSync } from "node:child_process";

// ── Types ────────────────────────────────────────────────────

interface PackageInfo {
  source: string;
  name: string;
  version: string;
  description: string;
  type: "npm" | "git" | "path";
  path: string;
  resources: {
    extensions: number;
    skills: number;
    prompts: number;
    themes: number;
  };
}

interface SettingsJson {
  packages?: string[];
  [key: string]: unknown;
}

// ── Helpers ──────────────────────────────────────────────────

function getSettingsPath(): string {
  return join(homedir(), ".pi", "agent", "settings.json");
}

function readSettings(): SettingsJson {
  try {
    return JSON.parse(readFileSync(getSettingsPath(), "utf-8"));
  } catch {
    return {};
  }
}

function detectSourceType(source: string): "npm" | "git" | "path" {
  if (source.startsWith("npm:") || source.startsWith("npm@")) return "npm";
  if (source.startsWith("git:") || source.startsWith("https://") || source.startsWith("http://") || source.startsWith("ssh://")) return "git";
  return "path";
}

function discoverPackage(source: string): PackageInfo | null {
  try {
    const settings = readSettings();
    const packages = settings.packages ?? [];

    // Find the source in settings
    let resolvedSource = source;
    if (!packages.includes(source)) {
      // Try to find by name match
      const match = packages.find((p: string) => {
        const name = p.replace(/^npm:/, "").split("@")[0];
        return name === source || p === source;
      });
      if (match) resolvedSource = match;
      else return null;
    }

    const type = detectSourceType(resolvedSource);
    let pkgPath = "";
    let pkgJsonPath = "";

    if (type === "npm") {
      const pkgName = resolvedSource.replace(/^npm:/, "").split("@")[0];
      const npmDir = join(homedir(), ".pi", "agent", "npm", "node_modules", pkgName);
      if (existsSync(npmDir)) {
        pkgPath = npmDir;
        pkgJsonPath = join(npmDir, "package.json");
      }
      // Also check project-local
      const localDir = join(process.cwd(), ".pi", "npm", "node_modules", pkgName);
      if (!pkgPath && existsSync(localDir)) {
        pkgPath = localDir;
        pkgJsonPath = join(localDir, "package.json");
      }
    } else if (type === "git") {
      // Git repos are stored under ~/.pi/agent/git/
      const gitDir = join(homedir(), ".pi", "agent", "git");
      if (existsSync(gitDir)) {
        const repos = readdirSync(gitDir);
        for (const host of repos) {
          const hostDir = join(gitDir, host);
          if (existsSync(hostDir)) {
            const projects = readdirSync(hostDir);
            for (const project of projects) {
              const candidate = join(hostDir, project);
              const pj = join(candidate, "package.json");
              if (existsSync(pj)) {
                try {
                  const meta = JSON.parse(readFileSync(pj, "utf-8"));
                  if (resolvedSource.includes(meta.name) || resolvedSource.includes(project)) {
                    pkgPath = candidate;
                    pkgJsonPath = pj;
                    break;
                  }
                } catch { /* skip */ }
              }
            }
          }
        }
      }
    }

    if (!pkgPath || !existsSync(pkgJsonPath)) {
      return null;
    }

    const meta = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));
    const piManifest = meta.pi || {};

    // Count resources
    const countDir = (dirs: string | string[] | undefined): number => {
      if (!dirs) return 0;
      const list = Array.isArray(dirs) ? dirs : [dirs];
      let count = 0;
      for (const d of list) {
        const fullPath = join(pkgPath, d);
        if (existsSync(fullPath)) {
          try {
            count += readdirSync(fullPath).length;
          } catch { count += 1; }
        }
      }
      return count;
    };

    return {
      source: resolvedSource,
      name: meta.name || basename(pkgPath),
      version: meta.version || "0.0.0",
      description: meta.description || "",
      type,
      path: pkgPath,
      resources: {
        extensions: countDir(piManifest.extensions),
        skills: countDir(piManifest.skills),
        prompts: countDir(piManifest.prompts),
        themes: countDir(piManifest.themes),
      },
    };
  } catch {
    return null;
  }
}

// ── GET ──────────────────────────────────────────────────────

// GET /api/pi/packages — list installed packages
export async function GET() {
  try {
    const settings = readSettings();
    const packageSources = settings.packages ?? [];

    const packages: PackageInfo[] = [];
    for (const source of packageSources) {
      const info = discoverPackage(source);
      if (info) packages.push(info);
    }

    // Also scan npm and git directories for packages not in settings
    const scanDirs = [
      join(homedir(), ".pi", "agent", "npm", "node_modules"),
      join(homedir(), ".pi", "agent", "git"),
    ];

    for (const scanDir of scanDirs) {
      if (!existsSync(scanDir)) continue;
      try {
        const items = readdirSync(scanDir);
        for (const item of items) {
          const pj = join(scanDir, item, "package.json");
          if (existsSync(pj) && !packages.some((p) => p.name === item)) {
            try {
              const meta = JSON.parse(readFileSync(pj, "utf-8"));
              if (meta.pi || meta.keywords?.includes("pi-package")) {
                packages.push({
                  source: `npm:${meta.name}`,
                  name: meta.name || item,
                  version: meta.version || "0.0.0",
                  description: meta.description || "",
                  type: "npm",
                  path: join(scanDir, item),
                  resources: {
                    extensions: 0,
                    skills: 0,
                    prompts: 0,
                    themes: 0,
                  },
                });
              }
            } catch { /* skip */ }
          }
        }
      } catch { /* skip */ }
    }

    return NextResponse.json({ packages });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to list packages" },
      { status: 500 },
    );
  }
}

// ── POST ─────────────────────────────────────────────────────

// POST /api/pi/packages — install, remove, or update packages
// Body: { action: "install" | "remove" | "update", source?: string, local?: boolean }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, source, local } = body;

    if (!action) {
      return NextResponse.json({ error: "action required" }, { status: 400 });
    }

    let cmdArgs: string[];
    switch (action) {
      case "install":
        if (!source) return NextResponse.json({ error: "source required for install" }, { status: 400 });
        cmdArgs = ["install", source];
        if (local) cmdArgs.push("-l");
        break;
      case "remove":
        if (!source) return NextResponse.json({ error: "source required for remove" }, { status: 400 });
        cmdArgs = ["remove", source];
        if (local) cmdArgs.push("-l");
        break;
      case "update":
        cmdArgs = source ? ["update", "--extension", source] : ["update", "--extensions"];
        break;
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    const result = execFileSync("pi", cmdArgs, {
      encoding: "utf-8",
      timeout: 60000,
      maxBuffer: 1024 * 1024,
    });

    return NextResponse.json({ ok: true, output: result.trim() });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Package operation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
