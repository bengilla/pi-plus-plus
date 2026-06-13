import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, access, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, dirname } from "node:path";

const AUTH_PATH = join(homedir(), ".pi", "agent", "auth.json");

interface ProviderAuth {
  type?: string;
  key?: string;
  baseURL?: string;
  [k: string]: unknown;
}

interface AuthFile {
  [provider: string]: ProviderAuth;
}

async function readAuth(): Promise<AuthFile> {
  try {
    const raw = await readFile(AUTH_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeAuth(data: AuthFile): Promise<void> {
  await mkdir(dirname(AUTH_PATH), { recursive: true });
  await writeFile(AUTH_PATH, JSON.stringify(data, null, 4) + "\n", "utf-8");
}

function maskKey(key: string): string {
  if (key.length <= 8) return "••••";
  return key.slice(0, 4) + "••••" + key.slice(-4);
}

// GET /api/pi/auth — list providers with masked keys
export async function GET() {
  try {
    const auth = await readAuth();
    const providers: Record<
      string,
      { type: string; configured: boolean; keyPreview?: string }
    > = {};

    for (const [name, cfg] of Object.entries(auth)) {
      providers[name] = {
        type: cfg.type ?? "api-key",
        configured: !!(cfg.key || cfg.access),
        keyPreview: cfg.key ? maskKey(String(cfg.key)) : undefined,
      };
    }

    return NextResponse.json({ providers });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to read auth" },
      { status: 500 },
    );
  }
}

// POST /api/pi/auth — save/update/delete provider API key
// Body: { provider: string, key: string, action?: "save" | "delete" }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      provider: string;
      key?: string;
      action?: "save" | "delete";
      baseURL?: string;
    };

    if (!body.provider) {
      return NextResponse.json(
        { error: "provider is required" },
        { status: 400 },
      );
    }

    const auth = await readAuth();

    if (body.action === "delete") {
      delete auth[body.provider];
      await writeAuth(auth);
      return NextResponse.json({ ok: true, deleted: body.provider });
    }

    // Save
    if (!body.key) {
      return NextResponse.json(
        { error: "key is required" },
        { status: 400 },
      );
    }

    auth[body.provider] = {
      ...auth[body.provider],
      type: auth[body.provider]?.type ?? "api-key",
      key: body.key,
      ...(body.baseURL ? { baseURL: body.baseURL } : {}),
    };

    await writeAuth(auth);
    return NextResponse.json({
      ok: true,
      provider: body.provider,
      keyPreview: maskKey(body.key),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to save" },
      { status: 500 },
    );
  }
}
