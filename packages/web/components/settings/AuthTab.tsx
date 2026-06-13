"use client";

import { useState, useEffect } from "react";

interface ProviderInfo {
  type: string;
  configured: boolean;
  keyPreview?: string;
}

interface ProvidersData {
  providers: Record<string, ProviderInfo>;
}

// Known providers that pi supports with env var names
const KNOWN_PROVIDERS: { id: string; label: string; envVar: string; desc: string }[] = [
  { id: "anthropic", label: "Anthropic", envVar: "ANTHROPIC_API_KEY", desc: "Claude models" },
  { id: "openai", label: "OpenAI", envVar: "OPENAI_API_KEY", desc: "GPT models" },
  { id: "google", label: "Google", envVar: "GEMINI_API_KEY", desc: "Gemini models" },
  { id: "deepseek", label: "DeepSeek", envVar: "DEEPSEEK_API_KEY", desc: "DeepSeek models" },
  { id: "groq", label: "Groq", envVar: "GROQ_API_KEY", desc: "Fast inference" },
  { id: "openrouter", label: "OpenRouter", envVar: "OPENROUTER_API_KEY", desc: "Multi-provider gateway" },
  { id: "openai-codex", label: "OpenAI Codex", envVar: "OPENAI_API_KEY", desc: "Codex models" },
  { id: "dmxapi", label: "DMXAPI", envVar: "DMXAPI_API_KEY", desc: "Doubao models" },
  { id: "zai", label: "Z.AI", envVar: "ZAI_API_KEY", desc: "GLM models" },
  { id: "mistral", label: "Mistral", envVar: "MISTRAL_API_KEY", desc: "Mistral models" },
  { id: "xai", label: "xAI", envVar: "XAI_API_KEY", desc: "Grok models" },
  { id: "fireworks", label: "Fireworks", envVar: "FIREWORKS_API_KEY", desc: "Fast open models" },
  { id: "together", label: "Together AI", envVar: "TOGETHER_API_KEY", desc: "Open source models" },
  { id: "cerebras", label: "Cerebras", envVar: "CEREBRAS_API_KEY", desc: "Fast Llama inference" },
  { id: "nvidia", label: "NVIDIA NIM", envVar: "NVIDIA_API_KEY", desc: "NVIDIA models" },
  { id: "minimax", label: "MiniMax", envVar: "MINIMAX_API_KEY", desc: "MiniMax models" },
  { id: "moonshot", label: "Moonshot", envVar: "MOONSHOT_API_KEY", desc: "Kimi models" },
  { id: "cloudflare", label: "Cloudflare", envVar: "CLOUDFLARE_API_KEY", desc: "Workers AI" },
];

export function AuthTab({ language }: { language: "en" | "zh" }) {
  const zh = language === "zh";
  const [providers, setProviders] = useState<Record<string, ProviderInfo>>({});
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const loadAuth = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/pi/auth");
      const data: ProvidersData = await r.json();
      setProviders(data.providers || {});
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAuth(); }, []);

  const handleSave = async () => {
    if (!selectedProvider || !apiKey.trim()) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const r = await fetch("/api/pi/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: selectedProvider, key: apiKey.trim() }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error || "Save failed");
      }
      setSuccess(zh ? "已保存！" : "Saved!");
      setApiKey("");
      setShowAdd(false);
      await loadAuth();
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (provider: string) => {
    if (!confirm(zh ? `删除 ${provider} 的 API key？` : `Delete API key for ${provider}?`)) return;
    try {
      await fetch("/api/pi/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, action: "delete" }),
      });
      await loadAuth();
    } catch {
      // ignore
    }
  };

  // Merge known providers with configured ones
  const configuredIds = new Set(Object.keys(providers));
  interface ProviderEntry { id: string; configured: boolean; label: string; desc: string; keyPreview?: string }
  const allProviders: ProviderEntry[] = [
    ...Object.entries(providers).map(([id, cfg]) => ({
      id, configured: true,
      label: KNOWN_PROVIDERS.find((p) => p.id === id)?.label ?? id,
      desc: KNOWN_PROVIDERS.find((p) => p.id === id)?.desc ?? "",
      keyPreview: cfg.keyPreview,
    })),
    ...KNOWN_PROVIDERS.filter((p) => !configuredIds.has(p.id)).map((p) => ({
      id: p.id, configured: false, label: p.label, desc: p.desc,
    })),
  ];

  if (loading) {
    return (
      <div className="p-5 text-xs text-center" style={{ color: "var(--text-secondary)" }}>
        {zh ? "加载中..." : "Loading..."}
      </div>
    );
  }

  return (
    <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
      {/* Description */}
      <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
        {zh
          ? "添加 Provider 的 API key 后，Pi CLI 和 App 均可使用。Key 存储在 ~/.pi/agent/auth.json，与 CLI 共享。"
          : "After adding a provider API key, both Pi CLI and the app can use it. Keys are stored in ~/.pi/agent/auth.json, shared with the CLI."}
      </div>

      {/* Configured providers list */}
      <div>
        <div className="text-xs font-medium mb-2" style={{ color: "var(--text)" }}>
          {zh ? "已配置" : "Configured"} ({configuredIds.size})
        </div>
        {configuredIds.size === 0 ? (
          <div className="px-3 py-3 text-xs text-center" style={{ color: "var(--text-tertiary)", border: "1px dashed var(--border)" }}>
            {zh ? "还没有配置任何 Provider。点击下方添加。" : "No providers configured. Add one below."}
          </div>
        ) : (
          <div className="space-y-1">
            {allProviders.filter((p) => p.configured).map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 px-3 py-2 text-xs"
                style={{ background: "var(--bg)", border: "1px solid var(--border-light)" }}
              >
                <div className="flex-1">
                  <div className="font-medium" style={{ color: "var(--text)" }}>{p.label}</div>
                  <div className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>{p.id}</div>
                </div>
                <div
                  className="px-1.5 py-0.5 text-[10px] font-mono"
                  style={{ color: "var(--text-secondary)", background: "var(--bg-hover)" }}
                >
                  {p.keyPreview ?? "••••"}
                </div>
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: "oklch(65% 0.15 155)" }} />
                <button
                  onClick={() => handleDelete(p.id)}
                  className="ml-1 p-0.5 hover:opacity-70 text-[10px]"
                  style={{ color: "var(--text-tertiary)" }}
                  title={zh ? "删除" : "Delete"}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add provider */}
      {!showAdd ? (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full py-2 text-xs font-medium transition-colors hover:opacity-80"
          style={{
            color: "var(--accent)",
            border: "1px solid var(--accent)",
            background: "transparent",
          }}
        >
          + {zh ? "添加 Provider" : "Add Provider"}
        </button>
      ) : (
        <div
          className="p-4 space-y-3"
          style={{ background: "var(--bg)", border: "1px solid var(--border)" }}
        >
          {/* Provider selector */}
          <div>
            <div className="text-[10px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
              {zh ? "选择 Provider" : "Select Provider"}
            </div>
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              className="w-full px-3 py-2 text-xs outline-none"
              style={{
                background: "var(--bg-elevated)",
                color: "var(--text)",
                border: "1px solid var(--border-light)",
              }}
            >
              <option value="">{zh ? "— 选择一个 —" : "— Select —"}</option>
              {allProviders.filter((p) => !p.configured).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} ({p.id}) — {p.desc}
                </option>
              ))}
            </select>
          </div>

          {/* API key input */}
          <div>
            <div className="text-[10px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
              API Key
              {selectedProvider && (
                <span className="ml-2" style={{ color: "var(--text-tertiary)" }}>
                  ({KNOWN_PROVIDERS.find((p) => p.id === selectedProvider)?.envVar ?? ""})
                </span>
              )}
            </div>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={zh ? "输入 API Key..." : "Enter API key..."}
              className="w-full px-3 py-2 text-xs outline-none"
              style={{
                background: "var(--bg-elevated)",
                color: "var(--text)",
                border: "1px solid var(--border-light)",
                fontFamily: "var(--font-mono)",
              }}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
            />
          </div>

          {/* Error / Success */}
          {error && (
            <div className="text-[10px]" style={{ color: "var(--error)" }}>⚠ {error}</div>
          )}
          {success && (
            <div className="text-[10px]" style={{ color: "oklch(65% 0.15 155)" }}>✓ {success}</div>
          )}

          {/* Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!selectedProvider || !apiKey.trim() || saving}
              className="flex-1 py-1.5 text-xs font-medium transition-colors disabled:opacity-40"
              style={{
                color: "var(--accent)",
                border: "1px solid var(--accent)",
                background: "transparent",
              }}
            >
              {saving ? (zh ? "保存中..." : "Saving...") : (zh ? "保存" : "Save")}
            </button>
            <button
              onClick={() => { setShowAdd(false); setApiKey(""); setSelectedProvider(""); setError(null); }}
              className="px-4 py-1.5 text-xs transition-colors"
              style={{
                color: "var(--text-secondary)",
                border: "1px solid var(--border)",
                background: "transparent",
              }}
            >
              {zh ? "取消" : "Cancel"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
