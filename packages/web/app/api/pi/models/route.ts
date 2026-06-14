import { NextResponse } from "next/server";
import { readFileSync, writeFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { join } from "node:path";
import { homedir } from "node:os";
import { promisify } from "node:util";
import { providerHasAuth } from "@/lib/auth";

const execFileAsync = promisify(execFile);

interface SettingsConfig {
  defaultProvider?: string;
  defaultModel?: string;
  enabledModels?: string[];
}

const SETTINGS_PATH = join(homedir(), ".pi", "agent", "settings.json");

function readSettings(): SettingsConfig | null {
  try {
    return JSON.parse(readFileSync(SETTINGS_PATH, "utf-8"));
  } catch { return null; }
}

function writeSettings(settings: SettingsConfig): void {
  writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 4) + "\n", "utf-8");
}

interface Capability {
  key: string;
  label: string;
}

function parseCapabilities(cols: string[]): Capability[] {
  const caps: Capability[] = [{ key: "text", label: "Text" }];
  if (cols[4] === "yes") caps.push({ key: "thinking", label: "Reasoning" });
  if (cols[5] === "yes") caps.push({ key: "vision", label: "Vision" });
  return caps;
}

/** Build the full "provider/model" ID from settings for UI comparison */
function buildModelId(settings: SettingsConfig): string | null {
  const m = settings.defaultModel;
  if (!m) return null;
  if (m.includes("/")) return m;
  const p = settings.defaultProvider;
  return p ? `${p}/${m}` : m;
}

// GET /api/pi/models — all models with capabilities + scoped status
export async function GET() {
  const settings = readSettings();
  const enabledSet = new Set(settings?.enabledModels ?? []);
  const defaultModel = buildModelId(settings ?? {});
  const models: {
    id: string; name: string; provider: string;
    enabled: boolean; capabilities: Capability[];
  }[] = [];

  try {
    const { stdout } = await execFileAsync("pi", ["--list-models"], {
      timeout: 15_000,
      env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH || ""}` },
    });

    const lines = stdout.trim().split("\n");
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = line.split(/\s{2,}/);
      if (cols.length < 2) continue;
      const provider = cols[0];
      const modelName = cols[1];
      const id = `${provider}/${modelName}`;
      // Only include models from providers with valid auth (auth.json or env var)
      if (!providerHasAuth(provider)) continue;
      const caps = parseCapabilities(cols);
      models.push({
        id,
        name: modelName,
        provider,
        enabled: enabledSet.has(id),
        capabilities: caps,
      });
    }
  } catch {
    // pi --list-models failed
  }

  // Sort: enabled first, then by provider
  models.sort((a, b) => {
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
    return a.provider.localeCompare(b.provider) || a.name.localeCompare(b.name);
  });

  return NextResponse.json({ models, defaultModel });
}

// POST /api/pi/models — set default model or toggle scoped model
export async function POST(req: Request) {
  try {
    const body = await req.json() as { model?: string; enabled?: boolean };
    const settings = readSettings() || {};

    if (body.model && body.enabled !== undefined) {
      // Toggle scoped model
      const enabledModels = settings.enabledModels || [];
      const idx = enabledModels.indexOf(body.model);
      if (body.enabled && idx === -1) {
        enabledModels.push(body.model);
      } else if (!body.enabled && idx !== -1) {
        enabledModels.splice(idx, 1);
      }
      settings.enabledModels = enabledModels;
      writeSettings(settings);
      return NextResponse.json({ ok: true, enabledModels });
    }

    if (body.model) {
      // Set default model — pi CLI expects model name only in settings.json,
      // provider goes in defaultProvider.  The UI sends "provider/model" format.
      const slashIdx = body.model.indexOf("/");
      const provider = slashIdx !== -1 ? body.model.slice(0, slashIdx) : settings.defaultProvider || "";
      const modelName = slashIdx !== -1 ? body.model.slice(slashIdx + 1) : body.model;
      settings.defaultModel = modelName;
      settings.defaultProvider = provider;
      writeSettings(settings);
      return NextResponse.json({ ok: true, defaultModel: body.model, defaultProvider: provider });
    }

    return NextResponse.json({ error: "model required" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
