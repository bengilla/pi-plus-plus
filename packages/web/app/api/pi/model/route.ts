import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

interface PiSettings {
  defaultProvider?: string;
  defaultModel?: string;
}

// GET /api/pi/model — return Pi's current default model
export async function GET() {
  try {
    const settingsPath = join(homedir(), ".pi", "agent", "settings.json");
    const raw = readFileSync(settingsPath, "utf-8");
    const settings: PiSettings = JSON.parse(raw);
    return NextResponse.json({
      provider: settings.defaultProvider ?? null,
      model: settings.defaultModel ?? null,
    });
  } catch {
    return NextResponse.json({ provider: null, model: null });
  }
}
