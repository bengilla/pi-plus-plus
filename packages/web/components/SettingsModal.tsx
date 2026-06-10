"use client";

import { useState, useEffect, useCallback } from "react";

interface SkillInfo {
  id: string;
  name: string;
  description: string;
  agentId: string;
  path: string;
  enabled: boolean;
}

interface MarketplaceSkill {
  id: string;
  name: string;
  description: string;
  source: string;
}

interface AgentInfo {
  id: string;
  name: string;
  version?: string;
}

interface DetectedAgentInfo {
  id: string;
  name: string;
  binary: string;
  description: string;
  path: string;
  version?: string;
  installSource?: string;
  status: "available" | "needs-adapter";
  upgradeSupported?: boolean;
}

interface AgentsResponse {
  agents?: AgentInfo[];
  detectedAgents?: DetectedAgentInfo[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  agents: AgentInfo[];
  onAgentsRefresh?: () => Promise<AgentsResponse>;
  fontScale?: number;
  onFontScaleChange?: (scale: number) => void;
  language?: "en" | "zh";
  onLanguageChange?: (language: "en" | "zh") => void;
  workspace?: string;
}

type Tab = "models" | "sessions" | "skills" | "general";

export function SettingsModal({ open, onClose, onAgentsRefresh, fontScale, onFontScaleChange, language = "en", onLanguageChange, workspace = "" }: Props) {
  const [tab, setTab] = useState<Tab>("models");
  const zh = language === "zh";

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden fade-in"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-modal)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3 border-b shrink-0"
          style={{ borderColor: "var(--color-border)" }}
        >
          <div className="flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ color: "var(--color-text-secondary)" }}>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span className="font-semibold text-sm" style={{ color: "var(--color-text)" }}>{zh ? "设置" : "Settings"}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:opacity-70 transition-opacity"
            style={{ color: "var(--text-secondary)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div
          className="flex gap-0 px-5 border-b shrink-0"
          style={{ borderColor: "var(--color-border)" }}
        >
          {(["models", "sessions", "skills", "general"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-3 py-2 text-xs font-medium transition-colors"
              style={{
                color: tab === t ? "var(--color-accent)" : "var(--color-text-secondary)",
                borderBottom: tab === t ? "2px solid var(--color-accent)" : "2px solid transparent",
                marginBottom: -1,
              }}
            >
              {zh ? (t === "models" ? "模型" : t === "sessions" ? "会话" : t === "skills" ? "技能" : "通用") : t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {tab === "models" && <ModelsTab language={language} />}
          {tab === "sessions" && <SessionsTab language={language} workspace={workspace} />}
          {tab === "skills" && <SkillsTab language={language} />}
          {tab === "general" && (
            <GeneralTab
              fontScale={fontScale}
              onFontScaleChange={onFontScaleChange}
              language={language}
              onLanguageChange={onLanguageChange}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Models Tab ─────────────────────────────────────────────

interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  enabled: boolean;
  capabilities: { key: string; label: string }[];
}

function ModelsTab({ language }: { language: "en" | "zh" }) {
  const zh = language === "zh";
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [defaultModel, setDefaultModel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/pi/models")
      .then((r) => r.json())
      .then((data: { models: ModelInfo[]; defaultModel: string | null }) => {
        setModels(data.models);
        setDefaultModel(data.defaultModel || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleModel = async (modelId: string, enabled: boolean) => {
    setToggling(modelId);
    try {
      await fetch("/api/pi/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelId, enabled }),
      });
      setModels((prev) => prev.map((m) => m.id === modelId ? { ...m, enabled } : m));
    } catch { /* ignore */ }
    setToggling(null);
  };

  const selectDefaultModel = async (modelId: string) => {
    setDefaultModel(modelId);
    try {
      await fetch("/api/pi/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelId }),
      });
    } catch { /* ignore */ }
  };

  const grouped = new Map<string, ModelInfo[]>();
  for (const m of models) {
    const list = grouped.get(m.provider) || [];
    list.push(m);
    grouped.set(m.provider, list);
  }

  const capColor = (key: string) => {
    switch (key) {
      case "thinking": return { color: "oklch(65% 0.15 155)", bg: "oklch(65% 0.15 155 / 0.1)" };
      case "vision": return { color: "oklch(68% 0.13 250)", bg: "oklch(68% 0.13 250 / 0.1)" };
      default: return { color: "var(--text-tertiary)", bg: "var(--bg-hover)" };
    }
  };

  if (loading) {
    return <div className="p-5 text-xs text-center" style={{ color: "var(--text-secondary)" }}>{zh ? "加载中..." : "Loading..."}</div>;
  }

  return (
    <div className="p-5">
      <div className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
        {zh ? "开启开关的模型会出现在对话框的模型选择中。" : "Toggle models on to make them available in the chat model selector."}
      </div>
      <div className="space-y-3 max-h-[60vh] overflow-y-auto">
        {[...grouped.entries()].map(([provider, providerModels]) => (
          <div key={provider}>
            <div className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 px-1" style={{ color: "var(--accent)" }}>
              {provider}
            </div>
            <div className="space-y-0.5">
              {providerModels.map((m) => {
                const isDefault = defaultModel === m.id;
                const isBusy = toggling === m.id;
                return (
                  <div
                    key={m.id}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs"
                    style={{
                      background: isDefault ? "var(--accent-dim)" : "var(--bg)",
                      border: isDefault ? "1px solid var(--accent)" : "1px solid var(--border-light)",
                    }}
                  >
                    <button
                      onClick={() => toggleModel(m.id, !m.enabled)}
                      disabled={isBusy}
                      className="relative h-4 w-8 shrink-0 transition-colors disabled:opacity-50"
                      style={{
                        background: m.enabled ? "var(--accent)" : "var(--bg-hover)",
                        border: `1px solid ${m.enabled ? "var(--accent)" : "var(--border-light)"}`,
                      }}
                    >
                      <span
                        className="absolute top-1/2 h-3 w-3 -translate-y-1/2 transition-all"
                        style={{
                          left: m.enabled ? "16px" : "2px",
                          background: m.enabled ? "#fff" : "var(--text-tertiary)",
                        }}
                      />
                    </button>
                    <span
                      className="flex-1 truncate font-medium cursor-pointer hover:opacity-70"
                      onClick={() => { if (!isDefault) selectDefaultModel(m.id); }}
                      style={{ color: "var(--text)" }}
                    >
                      {m.name}
                      {isDefault && <span className="ml-1 text-[9px]" style={{ color: "var(--accent)" }}>default</span>}
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      {m.capabilities.filter((c) => c.key !== "text").map((c) => (
                        <span
                          key={c.key}
                          className="text-[8px] px-1 py-0.5"
                          style={{ color: capColor(c.key).color, background: capColor(c.key).bg }}
                        >
                          {c.label}
                        </span>
                      ))}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Sessions Tab ───────────────────────────────────────────

function SessionsTab({ language, workspace }: { language: "en" | "zh"; workspace: string }) {
  const zh = language === "zh";
  const [sessions, setSessions] = useState<{ id: string; timestamp: string; model?: string; provider?: string; messageCount: number; firstMessage?: string; size: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/pi/sessions?workspace=${encodeURIComponent(workspace)}`)
      .then((r) => r.json())
      .then((data: { sessions: typeof sessions }) => setSessions(data.sessions))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [workspace]);

  const formatDate = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " " +
      d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  if (loading) {
    return <div className="p-5 text-xs text-center" style={{ color: "var(--text-secondary)" }}>{zh ? "加载中..." : "Loading..."}</div>;
  }

  return (
    <div className="p-5">
      <div className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
        {zh ? `当前项目的 Pi CLI 会话 (${sessions.length})` : `Pi CLI sessions for this project (${sessions.length})`}
      </div>
      {sessions.length === 0 ? (
        <div className="px-3 py-4 text-center text-xs" style={{ color: "var(--text-secondary)", border: "1px dashed var(--border)" }}>
          {zh ? "还没有 Pi 会话。运行 pi CLI 后这里会显示。" : "No Pi sessions yet. Run pi CLI to create sessions."}
        </div>
      ) : (
        <div className="space-y-1 max-h-[60vh] overflow-y-auto">
          {sessions.map((s) => (
            <div
              key={s.id}
              className="px-3 py-2 text-xs"
              style={{ background: "var(--bg)", border: "1px solid var(--border-light)" }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px]" style={{ color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
                  {formatDate(s.timestamp)}
                </span>
                <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                  {s.messageCount} msgs · {formatSize(s.size)}
                </span>
              </div>
              {s.firstMessage && (
                <div className="mt-1 truncate" style={{ color: "var(--text-secondary)" }}>
                  {s.firstMessage}
                </div>
              )}
              {(s.model || s.provider) && (
                <div className="mt-0.5 text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                  {s.provider && <span style={{ color: "var(--accent)" }}>{s.provider}</span>}
                  {s.provider && s.model && <span> / </span>}
                  {s.model && <span style={{ fontFamily: "var(--font-mono)" }}>{s.model}</span>}
                </div>
              )}
              <div className="mt-1 flex gap-1">
                <button
                  className="px-2 py-0.5 text-[10px] transition-colors hover:opacity-70"
                  style={{ color: "var(--accent)", border: "1px solid var(--accent)", background: "transparent" }}
                >
                  {zh ? "查看" : "View"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Skills Tab ─────────────────────────────────────────────

function SkillsTab({ language }: { language: "en" | "zh" }) {
  const zh = language === "zh";
  const agentId = "pi"; // Pi-only mode
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"installed" | "marketplace">("installed");
  const [marketSearch, setMarketSearch] = useState("");
  const [marketResults, setMarketResults] = useState<MarketplaceSkill[]>([]);

  // Load installed skills
  const loadSkills = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/skills?agent=${id}`);
      const data = await r.json();
      const agentSkills = data.results?.find((r: { agentId: string }) => r.agentId === id);
      setSkills(agentSkills?.skills ?? []);
    } catch {
      setSkills([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (agentId) loadSkills(agentId);
  }, [agentId, loadSkills]);

  // Load marketplace
  useEffect(() => {
    if (filter !== "marketplace") return;
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        if (marketSearch) params.set("q", marketSearch);
        if (agentId) params.set("agent", agentId);
        const r = await fetch(`/api/skills?${params}`);
        const data = await r.json();
        setMarketResults(data.marketplace ?? []);
      } catch {
        setMarketResults([]);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [filter, marketSearch, agentId]);

  // Toggle skill
  const toggleSkill = async (skillId: string, enabled: boolean) => {
    try {
      const r = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle", agentId, skillId, enabled }),
      });
      if (r.ok) {
        setSkills((prev) => prev.map((s) => (s.id === skillId ? { ...s, enabled } : s)));
      }
    } catch {
      // ignore
    }
  };

  // Install skill from marketplace
  const installSkill = async (s: MarketplaceSkill) => {
    try {
      const r = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "install",
          agentId,
          skillId: s.id,
          name: s.name,
          description: s.description,
          source: s.source,
        }),
      });
      if (r.ok) {
        // Remove from marketplace list, reload installed
        setMarketResults((prev) => prev.filter((m) => m.id !== s.id));
        loadSkills(agentId);
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="p-5">
      {/* Agent selector + filter */}
      <div className="flex items-center gap-3 mb-4">
        <span className="px-2 py-1 text-xs font-medium" style={{ background: "transparent", color: "var(--accent)", border: "1px solid var(--accent)" }}>Pi</span>

        <div className="flex overflow-hidden text-xs"
          style={{ border: "1px solid var(--color-border)" }}>
          {(["installed", "marketplace"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-2.5 py-1 transition-colors"
              style={{
                background: "transparent",
                color: filter === f ? "var(--accent)" : "var(--text-secondary)",
                border: filter === f ? "1px solid var(--accent)" : "1px solid transparent",
              }}
            >
              {zh ? (f === "installed" ? "已安装" : "市场") : f}
            </button>
          ))}
        </div>
      </div>

      {/* Marketplace search */}
      {filter === "marketplace" && (
        <input
          type="text"
          value={marketSearch}
          onChange={(e) => setMarketSearch(e.target.value)}
          placeholder={zh ? "搜索市场..." : "Search marketplace..."}
          className="w-full px-3 py-1.5 text-xs mb-3 outline-none"
          style={{
            background: "var(--color-surface-secondary)",
            color: "var(--color-text)",
            border: "1px solid var(--color-border)",
          }}
        />
      )}

      {/* Count */}
      <div className="text-[10px] mb-2" style={{ color: "var(--color-text-secondary)" }}>
        {filter === "installed"
          ? (zh ? `已安装 ${skills.length} 个技能` : `${skills.length} skills installed`)
          : (zh ? `${marketResults.length} 个可用` : `${marketResults.length} available`)}
      </div>

      {/* Skill list */}
      {loading && (
        <div className="text-xs py-8 text-center" style={{ color: "var(--color-text-secondary)" }}>
          {zh ? "加载中..." : "Loading..."}
        </div>
      )}

      <div className="space-y-1 max-h-96 overflow-y-auto">
        {filter === "installed" && skills.map((s) => (
          <div
            key={s.id}
            className="flex items-start gap-3 px-3 py-2"
            style={{ background: "var(--color-surface-secondary)" }}
          >
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium" style={{ color: "var(--color-text)" }}>{s.name}</div>
              <div className="text-[10px] mt-0.5 truncate" style={{ color: "var(--color-text-secondary)" }}>
                {s.description.slice(0, 120)}
              </div>
            </div>
            <button
              onClick={() => toggleSkill(s.id, !s.enabled)}
              className="shrink-0 w-8 h-5 relative transition-colors"
              style={{
                background: s.enabled ? "var(--color-accent)" : "var(--color-border)",
              }}
            >
              <span
                className="absolute top-0.5 w-4 h-4 bg-white transition-transform shadow-sm"
                style={{
                  left: s.enabled ? "calc(100% - 18px)" : "2px",
                }}
              />
            </button>
          </div>
        ))}

        {filter === "marketplace" && marketResults.map((s) => (
          <div
            key={s.id}
            className="flex items-start gap-3 px-3 py-2"
            style={{ background: "var(--color-surface-secondary)" }}
          >
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium" style={{ color: "var(--color-text)" }}>{s.name}</div>
              <div className="text-[10px] mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
                {s.description.slice(0, 120)}
              </div>
              <div className="text-[9px] mt-1" style={{ color: "var(--color-text-secondary)", opacity: 0.6 }}>
                {s.source}
              </div>
            </div>
            <button
              onClick={() => installSkill(s)}
              className="shrink-0 px-2 py-0.5 text-[10px] transition-colors hover:opacity-80"
              style={{
                background: "transparent",
                color: "var(--accent)",
                border: "1px solid var(--accent)",
              }}
            >
              {zh ? "安装" : "Install"}
            </button>
          </div>
        ))}

        {filter === "installed" && skills.length === 0 && !loading && (
          <div className="text-xs py-8 text-center" style={{ color: "var(--color-text-secondary)" }}>
            {zh ? "这个智能体还没有安装技能" : "No skills installed for this agent"}
          </div>
        )}
      </div>
    </div>
  );
}

// ── General Tab ─────────────────────────────────────────────

function GeneralTab({
  fontScale,
  onFontScaleChange,
  language,
  onLanguageChange,
}: {
  fontScale?: number;
  onFontScaleChange?: (s: number) => void;
  language: "en" | "zh";
  onLanguageChange?: (language: "en" | "zh") => void;
}) {
  const scale = fontScale ?? 1;

  return (
    <div className="p-5 space-y-5">
      {/* Language */}
      <div>
        <div className="text-xs font-medium mb-2" style={{ color: "var(--color-text)" }}>{language === "zh" ? "语言" : "Language"}</div>
        <div
          className="inline-flex overflow-hidden text-xs"
          style={{ border: "1px solid var(--color-border)" }}
        >
          {([
            { value: "en", label: "English" },
            { value: "zh", label: "中文" },
          ] as const).map((option) => (
            <button
              key={option.value}
              onClick={() => onLanguageChange?.(option.value)}
              className="px-3 py-1.5 transition-colors"
              style={{
                background: "transparent",
                color: language === option.value ? "var(--accent)" : "var(--text-secondary)",
                border: language === option.value ? "1px solid var(--accent)" : "1px solid transparent",
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Font scale */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium" style={{ color: "var(--color-text)" }}>{language === "zh" ? "字体大小" : "Font Size"}</span>
          <span className="text-[10px] tabular-nums" style={{ color: "var(--color-text-secondary)", fontFamily: "var(--font-mono)" }}>
            {Math.round(scale * 100)}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px]" style={{ color: "var(--color-text-secondary)" }}>80%</span>
          <input
            type="range"
            min="0.8"
            max="1.4"
            step="0.05"
            value={scale}
            onChange={(e) => onFontScaleChange?.(parseFloat(e.target.value))}
            className="flex-1 h-1.5 appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${((scale - 0.8) / 0.6) * 100}%, var(--border) ${((scale - 0.8) / 0.6) * 100}%, var(--border) 100%)`,
            }}
          />
          <span className="text-[10px]" style={{ color: "var(--color-text-secondary)" }}>140%</span>
        </div>
        <div className="flex justify-between mt-1">
          {[0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4].map((v) => (
            <button
              key={v}
              onClick={() => onFontScaleChange?.(v)}
              className="text-[9px] px-1 py-0.5 transition-colors hover:opacity-70"
              style={{
                color: scale === v ? "var(--accent)" : "var(--text-secondary)",
                background: "transparent",
                border: scale === v ? "1px solid var(--accent)" : "1px solid transparent",
              }}
            >
              {Math.round(v * 100)}%
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}
