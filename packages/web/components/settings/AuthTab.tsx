"use client";

import { useState, useEffect } from "react";

interface ProviderInfo {
  type: string;
  configured: boolean;
  keyPreview?: string;
  hasEnvVar?: boolean;
}

const OAUTH_PROVIDERS = ["openai-codex", "anthropic", "github-copilot"] as const;

const KNOWN_PROVIDERS: { id: string; label: string; envVar: string; desc: string }[] = [
  { id: "openai-codex", label: "OpenAI Codex", envVar: "OAuth", desc: "ChatGPT Plus/Pro 订阅" },
  { id: "anthropic", label: "Anthropic", envVar: "OAuth", desc: "Claude Pro/Max 订阅" },
  { id: "github-copilot", label: "GitHub Copilot", envVar: "OAuth", desc: "GitHub Copilot 订阅" },
  { id: "openai", label: "OpenAI", envVar: "OPENAI_API_KEY", desc: "GPT models" },
  { id: "deepseek", label: "DeepSeek", envVar: "DEEPSEEK_API_KEY", desc: "DeepSeek models" },
  { id: "google", label: "Google", envVar: "GEMINI_API_KEY", desc: "Gemini models" },
  { id: "groq", label: "Groq", envVar: "GROQ_API_KEY", desc: "Fast inference" },
  { id: "openrouter", label: "OpenRouter", envVar: "OPENROUTER_API_KEY", desc: "Multi-provider gateway" },
  { id: "mistral", label: "Mistral", envVar: "MISTRAL_API_KEY", desc: "Mistral models" },
  { id: "xai", label: "xAI", envVar: "XAI_API_KEY", desc: "Grok models" },
  { id: "fireworks", label: "Fireworks", envVar: "FIREWORKS_API_KEY", desc: "Fast open models" },
  { id: "together", label: "Together AI", envVar: "TOGETHER_API_KEY", desc: "Open source models" },
  { id: "cerebras", label: "Cerebras", envVar: "CEREBRAS_API_KEY", desc: "Fast Llama inference" },
  { id: "nvidia", label: "NVIDIA NIM", envVar: "NVIDIA_API_KEY", desc: "NVIDIA models" },
  { id: "minimax", label: "MiniMax", envVar: "MINIMAX_API_KEY", desc: "MiniMax models" },
  { id: "minimax-cn", label: "MiniMax (CN)", envVar: "MINIMAX_CN_API_KEY", desc: "MiniMax 中国" },
  { id: "zai", label: "Z.AI", envVar: "ZAI_API_KEY", desc: "GLM models" },
  { id: "cloudflare", label: "Cloudflare", envVar: "CLOUDFLARE_API_KEY", desc: "Workers AI" },
];

export function AuthTab({ language }: { language: "en" | "zh" }) {
  const zh = language === "zh";
  const [providers, setProviders] = useState<Record<string, ProviderInfo>>({});
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [oauthLoggingIn, setOauthLoggingIn] = useState<string | null>(null);

  const loadAuth = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/pi/auth");
      const data = await r.json();
      setProviders(data.providers || {});
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { loadAuth(); }, []);

  const handleSave = async () => {
    if (!selectedProvider || !apiKey.trim()) return;
    setSaving(true);
    setValidating(true);
    setError(null);
    setSuccess(null);
    try {
      const r = await fetch("/api/pi/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: selectedProvider, key: apiKey.trim() }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error || "Save failed");
        return;
      }
      // Show warning if validation failed (e.g. network timeout), 
      // but the key was still saved — this is not a blocking error.
      if (data.warning) {
        setError(data.warning);
        setSuccess(data.message || (zh ? "已保存！" : "Saved!"));
      } else {
        setSuccess(data.message || (zh ? "已保存！" : "Saved!"));
      }
      setApiKey("");
      setShowAdd(false);
      await loadAuth();
      setTimeout(() => { setSuccess(null); setError(null); }, 6000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally { setSaving(false); setValidating(false); }
  };

  const handleDelete = async (provider: string) => {
    if (!confirm(zh ? `删除 ${provider} 的凭证？` : `Delete credentials for ${provider}?`)) return;
    try {
      const r = await fetch("/api/pi/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, action: "delete" }) });
      const data = await r.json();
      await loadAuth();
      if (data.warning) setError(data.warning);
    } catch { /* ignore */ }
  };

  const handleOAuthLogin = async (provider: string) => {
    setOauthLoggingIn(provider);
    setError(null);
    try {
      const r = await fetch("/api/pi/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, action: "oauth-login" }),
      });
      const data = await r.json();
      if (r.ok) {
        setSuccess(zh ? "请在浏览器中完成登录，完成后刷新" : "Complete login in browser, then refresh");
      } else {
        setError(data.error || "OAuth login failed");
      }
    } catch {
      setError("Network error");
    } finally { setOauthLoggingIn(null); }
  };

  const configuredIds = new Set(Object.keys(providers));
  const isOAuth = (id: string) => OAUTH_PROVIDERS.includes(id as typeof OAUTH_PROVIDERS[number]);

  if (loading) {
    return <div className="p-5 text-xs text-center" style={{ color: "var(--text-secondary)" }}>{zh ? "加载中..." : "Loading..."}</div>;
  }

  return (
    <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
      <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
        {zh
          ? "API key 和 OAuth 凭证存储在 ~/.pi/agent/auth.json，CLI 和 App 共享。保存 key 时会自动验证。"
          : "Keys and tokens stored in ~/.pi/agent/auth.json, shared with CLI. Keys are validated on save."}
      </div>

      {error && <div className="text-[10px] px-3 py-1.5" style={{ color: "var(--error)", background: "oklch(55% 0.22 20 / 0.06)", border: "1px solid oklch(55% 0.22 20 / 0.15)" }}>⚠ {error}</div>}
      {success && <div className="text-[10px] px-3 py-1.5" style={{ color: "oklch(65% 0.15 155)", background: "oklch(65% 0.15 155 / 0.06)", border: "1px solid oklch(65% 0.15 155 / 0.15)" }}>✓ {success}</div>}

      {/* Configured */}
      <div>
        <div className="text-xs font-medium mb-2" style={{ color: "var(--text)" }}>{zh ? "已配置" : "Configured"} ({configuredIds.size})</div>
        {configuredIds.size === 0 ? (
          <div className="px-3 py-3 text-xs text-center" style={{ color: "var(--text-tertiary)", border: "1px dashed var(--border)" }}>{zh ? "无" : "None"}</div>
        ) : (
          <div className="space-y-1">
            {KNOWN_PROVIDERS.filter((p) => configuredIds.has(p.id)).map((p) => {
              const cfg = providers[p.id];
              const oauth = isOAuth(p.id);
              return (
                <div key={p.id} className="flex items-center gap-3 px-3 py-2 text-xs" style={{ background: "var(--bg)", border: "1px solid var(--border-light)" }}>
                  <span className="px-1 py-0.5 text-[9px] font-medium shrink-0"
                    style={{ color: oauth ? "oklch(65% 0.15 250)" : "oklch(65% 0.15 155)", border: `1px solid ${oauth ? "oklch(65% 0.15 250 / 0.3)" : "oklch(65% 0.15 155 / 0.3)"}` }}>
                    {oauth ? "OAuth" : "Key"}
                  </span>
                  <div className="flex-1">
                    <div className="font-medium" style={{ color: "var(--text)" }}>{p.label}</div>
                    <div className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>{p.desc}</div>
                  </div>
                  <div className="px-1.5 py-0.5 text-[10px] font-mono" style={{ color: "var(--text-secondary)", background: "var(--bg-hover)" }}>
                    {oauth ? "token" : providers[p.id]?.keyPreview ?? "••••"}
                  </div>
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: "oklch(65% 0.15 155)" }} />
                  <button onClick={() => handleDelete(p.id)} className="ml-1 p-0.5 hover:opacity-70 text-[10px]" style={{ color: "var(--text-tertiary)" }}>✕</button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* OAuth */}
      <div className="border-t pt-4" style={{ borderColor: "var(--border)" }}>
        <div className="text-xs font-medium mb-2" style={{ color: "var(--text)" }}>{zh ? "OAuth 订阅登录" : "OAuth Subscription Login"}</div>
        <div className="space-y-1">
          {KNOWN_PROVIDERS.filter((p) => isOAuth(p.id) && !configuredIds.has(p.id)).map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-3 py-2 text-xs" style={{ background: "var(--bg)", border: "1px solid var(--border-light)" }}>
              <span className="px-1 py-0.5 text-[9px] font-medium shrink-0" style={{ color: "oklch(65% 0.15 250)", border: "1px solid oklch(65% 0.15 250 / 0.3)" }}>OAuth</span>
              <div className="flex-1">
                <div className="font-medium" style={{ color: "var(--text)" }}>{p.label}</div>
                <div className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                  {p.desc}{(providers[p.id]?.hasEnvVar) ? (zh ? " · 环境变量" : " · env var") : ""}
                </div>
              </div>
              <button onClick={() => handleOAuthLogin(p.id)} disabled={oauthLoggingIn === p.id}
                className="px-2 py-1 text-[10px] transition-colors hover:opacity-80 disabled:opacity-40"
                style={{ background: "transparent", color: "var(--accent)", border: "1px solid var(--accent)" }}>
                {oauthLoggingIn === p.id ? (zh ? "启动中…" : "Starting…") : (zh ? "登录" : "Login")}
              </button>
            </div>
          ))}
          {KNOWN_PROVIDERS.filter((p) => isOAuth(p.id) && !configuredIds.has(p.id)).length === 0 && configuredIds.size > 0 && (
            <div className="text-[10px] px-1" style={{ color: "var(--text-tertiary)" }}>{zh ? "所有 OAuth 提供商已配置" : "All OAuth providers configured"}</div>
          )}
        </div>
      </div>

      {/* API Key */}
      <div className="border-t pt-4" style={{ borderColor: "var(--border)" }}>
        <div className="text-xs font-medium mb-2" style={{ color: "var(--text)" }}>{zh ? "API Key" : "API Key"}</div>
        {!showAdd ? (
          <button onClick={() => setShowAdd(true)}
            className="w-full py-2 text-xs font-medium transition-colors hover:opacity-80"
            style={{ color: "var(--accent)", border: "1px solid var(--accent)", background: "transparent" }}>
            + {zh ? "添加 Provider" : "Add Provider"}
          </button>
        ) : (
          <div className="p-4 space-y-3" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
            <div>
              <div className="text-[10px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>{zh ? "选择 Provider" : "Select Provider"}</div>
              <select value={selectedProvider} onChange={(e) => setSelectedProvider(e.target.value)}
                className="w-full px-3 py-2 text-xs outline-none"
                style={{ background: "var(--bg-elevated)", color: "var(--text)", border: "1px solid var(--border-light)" }}>
                <option value="">{zh ? "— 选择一个 —" : "— Select —"}</option>
                {KNOWN_PROVIDERS.filter((p) => !configuredIds.has(p.id) && !isOAuth(p.id)).map((p) => (
                  <option key={p.id} value={p.id}>{p.label} — {p.desc}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-[10px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>API Key</div>
              <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                placeholder={zh ? "输入 API Key，保存时自动验证" : "Enter API key, validated on save"}
                className="w-full px-3 py-2 text-xs outline-none"
                style={{ background: "var(--bg-elevated)", color: "var(--text)", border: "1px solid var(--border-light)", fontFamily: "var(--font-mono)" }}
                onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }} />
            </div>
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={!selectedProvider || !apiKey.trim() || saving}
                className="flex-1 py-1.5 text-xs font-medium transition-colors disabled:opacity-40"
                style={{ color: "var(--accent)", border: "1px solid var(--accent)", background: "transparent" }}>
                {saving ? (validating ? (zh ? "验证中…" : "Validating…") : (zh ? "保存中..." : "Saving...")) : (zh ? "保存" : "Save")}
              </button>
              <button onClick={() => { setShowAdd(false); setApiKey(""); setSelectedProvider(""); setError(null); }}
                className="px-4 py-1.5 text-xs transition-colors"
                style={{ color: "var(--text-secondary)", border: "1px solid var(--border)", background: "transparent" }}>
                {zh ? "取消" : "Cancel"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
