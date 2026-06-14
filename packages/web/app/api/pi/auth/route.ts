import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { PROVIDER_ENV_VARS } from "@/lib/auth";

const AUTH_PATH = join(homedir(), ".pi", "agent", "auth.json");

const OAUTH_PROVIDERS: Record<string, string> = {
  "openai-codex": "OpenAI Codex (ChatGPT Plus/Pro)",
  "anthropic": "Anthropic (Claude Pro/Max)",
  "github-copilot": "GitHub Copilot",
};

const PROVIDER_BASE_URLS: Record<string, string> = {
  openai: "https://api.openai.com/v1", anthropic: "https://api.anthropic.com/v1",
  deepseek: "https://api.deepseek.com/v1", google: "https://generativelanguage.googleapis.com/v1beta",
  groq: "https://api.groq.com/openai/v1", openrouter: "https://openrouter.ai/api/v1",
  mistral: "https://api.mistral.ai/v1", xai: "https://api.x.ai/v1",
  fireworks: "https://api.fireworks.ai/inference/v1", together: "https://api.together.xyz/v1",
  cerebras: "https://api.cerebras.ai/v1", nvidia: "https://integrate.api.nvidia.com/v1",
  minimax: "https://api.minimax.chat/v1", "minimax-cn": "https://api.minimax.chat/v1",
  zai: "https://api.z.ai/api/paas/v4",
};

interface ProviderAuth { type?: string; key?: string; access?: string; [k: string]: unknown; }
interface AuthFile { [provider: string]: ProviderAuth; }

async function readAuth(): Promise<AuthFile> {
  try { return JSON.parse(await readFile(AUTH_PATH, "utf-8")); } catch { return {}; }
}
async function writeAuth(data: AuthFile): Promise<void> {
  await mkdir(dirname(AUTH_PATH), { recursive: true });
  await writeFile(AUTH_PATH, JSON.stringify(data, null, 4) + "\n", "utf-8");
}
function maskKey(key: string): string {
  return key.length <= 8 ? "••••" : key.slice(0, 4) + "••••" + key.slice(-4);
}

// ── GET ───────────────────────────────────────────────────────

export async function GET() {
  try {
    const auth = await readAuth();
    const providers: Record<string, { type: string; configured: boolean; keyPreview?: string; hasEnvVar?: boolean }> = {};

    // Auth.json entries
    for (const [name, cfg] of Object.entries(auth)) {
      providers[name] = {
        type: cfg.type ?? "api-key",
        configured: !!(cfg.key || cfg.access),
        keyPreview: cfg.key ? maskKey(String(cfg.key)) : undefined,
      };
    }

    // Also detect providers with env vars (even if not in auth.json)
    for (const [provider, envVar] of Object.entries(PROVIDER_ENV_VARS)) {
      if (process.env[envVar] && !providers[provider]) {
        providers[provider] = {
          type: "api-key",
          configured: true,
          hasEnvVar: true,
        };
      } else if (process.env[envVar] && providers[provider]) {
        providers[provider].hasEnvVar = true;
      }
    }

    return NextResponse.json({ providers });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { provider: string; key?: string; action?: string; baseURL?: string; };
    if (!body.provider) return NextResponse.json({ error: "provider required" }, { status: 400 });

    const auth = await readAuth();

    switch (body.action) {
      case "delete": return handleDelete(auth, body.provider);
      case "oauth-login": return handleOAuthLogin(body.provider);
      case "validate": return handleValidate(body.provider, body.key || "");
      default: return handleSave(auth, body.provider, body.key || "", body.baseURL);
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

// ── Actions ───────────────────────────────────────────────────

async function handleDelete(auth: AuthFile, provider: string) {
  const wasInAuth = provider in auth;
  delete auth[provider];
  await writeAuth(auth);

  // Check for env var that would keep the key alive
  const envVar = PROVIDER_ENV_VARS[provider];
  const envSet = envVar && process.env[envVar];

  return NextResponse.json({
    ok: true, deleted: provider,
    warning: envSet
      ? `Key also set via environment variable $${envVar}. Remove it from your shell profile (~/.zshrc, ~/.bash_profile, etc) and restart to fully revoke access.`
      : undefined,
  });
}

async function handleSave(auth: AuthFile, provider: string, key: string, baseURL?: string) {
  if (!key.trim()) return NextResponse.json({ error: "key required" }, { status: 400 });

  const validation = await validateKey(provider, key.trim(), baseURL);
  if (!validation.valid) return NextResponse.json({ error: validation.error }, { status: 400 });

  auth[provider] = { ...auth[provider], type: "api_key", key: key.trim(), ...(baseURL ? { baseURL } : {}) };
  await writeAuth(auth);

  return NextResponse.json({ ok: true, provider, keyPreview: maskKey(key.trim()), validated: true, message: validation.message });
}

async function handleValidate(provider: string, key: string) {
  if (!key.trim()) return NextResponse.json({ error: "key required" }, { status: 400 });
  return NextResponse.json(await validateKey(provider, key.trim()));
}

async function handleOAuthLogin(provider: string) {
  if (!OAUTH_PROVIDERS[provider]) return NextResponse.json({ error: `Not an OAuth provider: ${provider}` }, { status: 400 });

  // pi OAuth login requires interactive TUI — open Terminal, user types /login
  const label = OAUTH_PROVIDERS[provider];
  if (process.platform === "darwin") {
    const script = `tell app "Terminal" to do script "clear; echo 'Type /login and select ${label}'; echo ''; pi"`;
    spawn("osascript", ["-e", script], { stdio: "ignore", detached: true }).unref();
  } else {
    spawn("x-terminal-emulator", ["-e", `bash -c 'echo "Type /login and select ${label}"; pi'`], { stdio: "ignore", detached: true }).unref();
  }

  return NextResponse.json({ ok: true, message: "Terminal opened. Type /login → select provider → browser opens." });
}

// ── Key Validation ────────────────────────────────────────────

async function validateKey(provider: string, key: string, baseURL?: string): Promise<{ valid: boolean; error?: string; message?: string }> {
  const base = baseURL || PROVIDER_BASE_URLS[provider];
  if (!base) return { valid: true, message: "Saved (no validation endpoint)" };

  try {
    const url = base.endsWith("/models") ? base : `${base.replace(/\/$/, "")}/models`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (["openai", "deepseek", "groq", "openrouter", "mistral", "xai", "fireworks", "together", "cerebras", "nvidia", "minimax", "minimax-cn", "zai"].includes(provider)) {
      headers["Authorization"] = `Bearer ${key}`;
    } else if (provider === "google") {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`, { signal: controller.signal });
      clearTimeout(timeout);
      return resp.ok ? { valid: true, message: "Key validated" } : parseError(resp.status, await resp.json().catch(() => ({})));
    } else if (provider === "anthropic") {
      headers["x-api-key"] = key;
      headers["anthropic-version"] = "2023-06-01";
    }

    const resp = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timeout);
    return resp.ok ? { valid: true, message: "Key validated" } : parseError(resp.status, await resp.json().catch(() => ({})));
  } catch (e: unknown) {
    if (e instanceof DOMException && e.name === "AbortError") return { valid: false, error: "Connection timeout" };
    return { valid: false, error: `Connection failed: ${e instanceof Error ? e.message : "Unknown"}` };
  }
}

function parseError(status: number, body: Record<string, unknown>): { valid: false; error: string } {
  const detail = body.error as Record<string, unknown> | undefined;
  if (status === 401) return { valid: false, error: "Invalid API key" };
  if (status === 403) {
    const msg = detail?.message ? String(detail.message) : "";
    if (msg.includes("billing") || msg.includes("quota") || msg.includes("insufficient")) return { valid: false, error: "Billing issue — insufficient balance or quota exceeded" };
    if (msg.includes("region") || msg.includes("country")) return { valid: false, error: "Region restriction" };
    return { valid: false, error: "Access denied — check account permissions" };
  }
  if (status === 429) return { valid: false, error: "Rate limited — try again later" };
  return { valid: false, error: detail?.message ? String(detail.message) : `API error (${status})` };
}
