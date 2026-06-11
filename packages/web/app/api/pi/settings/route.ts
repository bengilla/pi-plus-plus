import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, access } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const PI_GLOBAL_DIR = join(homedir(), ".pi", "agent");
const PI_GLOBAL_SETTINGS = join(PI_GLOBAL_DIR, "settings.json");
const PI_GLOBAL_AUTH = join(PI_GLOBAL_DIR, "auth.json");
const PI_GLOBAL_TRUST = join(PI_GLOBAL_DIR, "trust.json");

function getProjectSettingsPath(workspace: string): string {
  return join(workspace, ".pi", "settings.json");
}

async function readJSON(filePath: string): Promise<Record<string, unknown>> {
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeJSON(filePath: string, data: Record<string, unknown>): Promise<void> {
  await writeFile(filePath, JSON.stringify(data, null, 4), "utf-8");
}

// GET /api/pi/settings?workspace=X
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspace = searchParams.get("workspace") || "";

    const [globalSettings, globalAuth, globalTrust] = await Promise.all([
      readJSON(PI_GLOBAL_SETTINGS),
      readJSON(PI_GLOBAL_AUTH),
      readJSON(PI_GLOBAL_TRUST),
    ]);

    // Read project-level settings if they exist
    let projectSettings: Record<string, unknown> = {};
    if (workspace) {
      projectSettings = await readJSON(getProjectSettingsPath(workspace));
    }

    // Sanitize auth - mask API keys
    const sanitizedAuth: Record<string, { type: string; configured: boolean }> = {};
    for (const [provider, config] of Object.entries(globalAuth)) {
      const cfg = config as { type?: string; key?: string };
      sanitizedAuth[provider] = {
        type: cfg.type ?? "unknown",
        configured: !!cfg.key || !!(config as Record<string, unknown>)?.access,
      };
    }

    return NextResponse.json({
      global: globalSettings,
      project: projectSettings,
      auth: sanitizedAuth,
      trust: globalTrust,
      paths: {
        globalSettings: PI_GLOBAL_SETTINGS,
        globalAuth: PI_GLOBAL_AUTH,
        globalTrust: PI_GLOBAL_TRUST,
        projectSettings: workspace ? getProjectSettingsPath(workspace) : null,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to read settings" },
      { status: 500 },
    );
  }
}

// POST /api/pi/settings — update settings
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { scope, updates, workspace } = body as {
      scope: "global" | "project";
      updates: Record<string, unknown>;
      workspace?: string;
    };

    const targetPath = scope === "project" && workspace
      ? getProjectSettingsPath(workspace)
      : PI_GLOBAL_SETTINGS;

    const current = await readJSON(targetPath);
    const merged = { ...current, ...updates };
    await writeJSON(targetPath, merged);

    return NextResponse.json({ ok: true, path: targetPath });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to update settings" },
      { status: 500 },
    );
  }
}
