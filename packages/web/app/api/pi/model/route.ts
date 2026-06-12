import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

interface PiSettings {
  defaultProvider?: string;
  defaultModel?: string;
}

// GET /api/pi/model — return Pi's current default model
// Returns "provider/model" format for UI comparison with model list IDs.
export async function GET() {
  try {
    const settingsPath = join(homedir(), ".pi", "agent", "settings.json");
    const raw = readFileSync(settingsPath, "utf-8");
    const settings: PiSettings = JSON.parse(raw);
    const m = settings.defaultModel;
    const p = settings.defaultProvider;
    // Build full "provider/model" ID so ChatPanel can match dropdown entries
    const modelId = m
      ? (m.includes("/") ? m : (p ? `${p}/${m}` : m))
      : null;
    return NextResponse.json({
      provider: p ?? null,
      model: modelId,
    });
  } catch {
    return NextResponse.json({ provider: null, model: null });
  }
}
