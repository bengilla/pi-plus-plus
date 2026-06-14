import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const AUTH_PATH = join(homedir(), ".pi", "agent", "auth.json");

// Provider → env var mapping
export const PROVIDER_ENV_VARS: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY", openai: "OPENAI_API_KEY",
  deepseek: "DEEPSEEK_API_KEY", google: "GEMINI_API_KEY",
  groq: "GROQ_API_KEY", openrouter: "OPENROUTER_API_KEY",
  mistral: "MISTRAL_API_KEY", xai: "XAI_API_KEY",
  fireworks: "FIREWORKS_API_KEY", together: "TOGETHER_API_KEY",
  cerebras: "CEREBRAS_API_KEY", nvidia: "NVIDIA_API_KEY",
  minimax: "MINIMAX_API_KEY", "minimax-cn": "MINIMAX_CN_API_KEY",
  zai: "ZAI_API_KEY",
};

/** Check if a provider has valid auth via auth.json or env var */
export function providerHasAuth(provider: string): boolean {
  const envVar = PROVIDER_ENV_VARS[provider];
  if (envVar && process.env[envVar]) return true;
  try {
    if (!existsSync(AUTH_PATH)) return false;
    const auth = JSON.parse(readFileSync(AUTH_PATH, "utf-8"));
    const cfg = auth[provider];
    return !!(cfg?.key || cfg?.access);
  } catch { return false; }
}
