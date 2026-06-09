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
  agents: string[];
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
  detectedAgents?: DetectedAgentInfo[];
  onAgentsRefresh?: () => Promise<AgentsResponse>;
  disabledAgentIds?: string[];
  onAgentEnabledChange?: (agentId: string, enabled: boolean) => void;
  fontScale?: number;
  onFontScaleChange?: (scale: number) => void;
  language?: "en" | "zh";
  onLanguageChange?: (language: "en" | "zh") => void;
}

type Tab = "skills" | "general";

export function SettingsModal({ open, onClose, agents, detectedAgents = [], onAgentsRefresh, disabledAgentIds = [], onAgentEnabledChange, fontScale, onFontScaleChange, language = "en", onLanguageChange }: Props) {
  const [tab, setTab] = useState<Tab>("skills");
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
        className="w-full max-w-2xl max-h-[80vh] rounded-xl flex flex-col overflow-hidden fade-in"
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
            className="p-1 rounded-md hover:opacity-70 transition-opacity"
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
          {(["skills", "general"] as Tab[]).map((t) => (
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
              {zh ? (t === "skills" ? "技能" : "通用") : t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {tab === "skills" && <SkillsTab agents={agents} language={language} />}
          {tab === "general" && (
            <GeneralTab
              agents={agents}
              detectedAgents={detectedAgents}
              onAgentsRefresh={onAgentsRefresh}
              disabledAgentIds={disabledAgentIds}
              onAgentEnabledChange={onAgentEnabledChange}
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

// ── Skills Tab ─────────────────────────────────────────────

function SkillsTab({ agents, language }: { agents: AgentInfo[]; language: "en" | "zh" }) {
  const zh = language === "zh";
  const skillAgents = agents.filter((a) => a.id === "claude-code" || a.id === "pi");
  const [agentId, setAgentId] = useState(skillAgents[0]?.id ?? "");
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
        <select
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          className="px-2 py-1 text-xs rounded-md"
          style={{
            background: "var(--color-surface-secondary)",
            color: "var(--color-text)",
            border: "1px solid var(--color-border)",
          }}
        >
          {skillAgents.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>

        <div className="flex rounded-md overflow-hidden text-xs"
          style={{ border: "1px solid var(--color-border)" }}>
          {(["installed", "marketplace"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-2.5 py-1 transition-colors"
              style={{
                background: filter === f ? "var(--color-accent)" : "var(--color-surface-secondary)",
                color: filter === f ? "#fff" : "var(--color-text-secondary)",
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
          className="w-full px-3 py-1.5 text-xs rounded-md mb-3 outline-none"
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
            className="flex items-start gap-3 px-3 py-2 rounded-md"
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
              className="shrink-0 w-8 h-5 rounded-full relative transition-colors"
              style={{
                background: s.enabled ? "var(--color-accent)" : "var(--color-border)",
              }}
            >
              <span
                className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm"
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
            className="flex items-start gap-3 px-3 py-2 rounded-md"
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
              className="shrink-0 px-2 py-0.5 rounded text-[10px] transition-colors hover:opacity-80"
              style={{
                background: "var(--color-accent)",
                color: "#fff",
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
  agents,
  detectedAgents,
  onAgentsRefresh,
  disabledAgentIds,
  onAgentEnabledChange,
  fontScale,
  onFontScaleChange,
  language,
  onLanguageChange,
}: {
  agents: AgentInfo[];
  detectedAgents: DetectedAgentInfo[];
  onAgentsRefresh?: () => Promise<AgentsResponse>;
  disabledAgentIds: string[];
  onAgentEnabledChange?: (agentId: string, enabled: boolean) => void;
  fontScale?: number;
  onFontScaleChange?: (s: number) => void;
  language: "en" | "zh";
  onLanguageChange?: (language: "en" | "zh") => void;
}) {
  const [upgradeState, setUpgradeState] = useState<Record<string, {
    checking?: boolean;
    upgrading?: boolean;
    latestVersion?: string;
    updateAvailable?: boolean;
    error?: string;
    settled?: boolean;
  }>>({});
  const [refreshingAgents, setRefreshingAgents] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState("");
  const [newAgentPrompt, setNewAgentPrompt] = useState<DetectedAgentInfo[] | null>(null);

  const handleRefresh = async () => {
    const before = new Set(detectedAgents.map((agent) => agent.id));
    setRefreshingAgents(true);
    setRefreshMessage("");
    setNewAgentPrompt(null);
    try {
      const data: AgentsResponse = onAgentsRefresh ? await onAgentsRefresh() : await fetch("/api/agents").then((r) => r.json());
      const nextDetected = data.detectedAgents ?? [];
      const added = nextDetected.filter((agent) => !before.has(agent.id));
      if (added.length > 0) {
        setNewAgentPrompt(added);
        setRefreshMessage("");
      } else {
        setRefreshMessage(language === "zh" ? "没有新的智能体" : "No new agents");
      }
    } catch {
      setRefreshMessage(language === "zh" ? "刷新失败" : "Refresh failed");
    } finally {
      setRefreshingAgents(false);
    }
  };

  const checkUpgrade = async (agentId: string) => {
    setUpgradeState((prev) => ({ ...prev, [agentId]: { ...prev[agentId], checking: true, error: undefined } }));
    try {
      const r = await fetch("/api/agents/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, action: "check" }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Check failed");
      setUpgradeState((prev) => ({
        ...prev,
        [agentId]: {
          checking: false,
          latestVersion: data.latestVersion,
          updateAvailable: data.updateAvailable,
          settled: !data.updateAvailable,
        },
      }));
      if (!data.updateAvailable) {
        window.setTimeout(() => {
          setUpgradeState((prev) => {
            const current = prev[agentId];
            if (!current?.settled) return prev;
            return {
              ...prev,
              [agentId]: {
                latestVersion: current.latestVersion,
                updateAvailable: false,
                settled: false,
              },
            };
          });
        }, 5000);
      }
    } catch (e) {
      setUpgradeState((prev) => ({
        ...prev,
        [agentId]: {
          ...prev[agentId],
          checking: false,
          error: e instanceof Error ? e.message : "Check failed",
        },
      }));
    }
  };

  const upgradeAgent = async (agentId: string) => {
    setUpgradeState((prev) => ({ ...prev, [agentId]: { ...prev[agentId], upgrading: true, error: undefined } }));
    try {
      const r = await fetch("/api/agents/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, action: "upgrade" }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Upgrade failed");
      setUpgradeState((prev) => ({
        ...prev,
        [agentId]: {
          ...prev[agentId],
          upgrading: false,
          updateAvailable: false,
          latestVersion: data.version ?? prev[agentId]?.latestVersion,
        },
      }));
      window.setTimeout(() => window.location.reload(), 400);
    } catch (e) {
      setUpgradeState((prev) => ({
        ...prev,
        [agentId]: {
          ...prev[agentId],
          upgrading: false,
          error: e instanceof Error ? e.message : "Upgrade failed",
        },
      }));
    }
  };

  const scale = fontScale ?? 1;

  return (
    <div className="p-5 space-y-5">
      {/* Language */}
      <div>
        <div className="text-xs font-medium mb-2" style={{ color: "var(--color-text)" }}>{language === "zh" ? "语言" : "Language"}</div>
        <div
          className="inline-flex rounded-md overflow-hidden text-xs"
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
                background: language === option.value ? "var(--color-accent)" : "var(--color-surface-secondary)",
                color: language === option.value ? "#fff" : "var(--color-text-secondary)",
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
            className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
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
              className="text-[9px] px-1 py-0.5 rounded transition-colors hover:opacity-70"
              style={{
                color: scale === v ? "var(--accent)" : "var(--text-secondary)",
                background: scale === v ? "var(--accent-dim)" : "transparent",
              }}
            >
              {Math.round(v * 100)}%
            </button>
          ))}
        </div>
      </div>

      {/* Agents */}
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-xs font-medium" style={{ color: "var(--color-text)" }}>{language === "zh" ? "智能体发现" : "Agent Discovery"}</div>
          <span className="text-[10px]" style={{ color: "var(--color-text-secondary)" }}>
            {detectedAgents.length} {language === "zh" ? "个已发现" : "detected"}
          </span>
        </div>
        <div className="space-y-1">
          {(detectedAgents.length > 0 ? detectedAgents : agents.map((a) => ({
            ...a,
            binary: a.id,
            description: "",
            path: "",
            installSource: undefined,
            status: "available" as const,
            upgradeSupported: true,
          }))).map((a) => {
            const state = upgradeState[a.id];
            const currentVersion = a.version?.match(/(\d+\.\d+\.\d+)/)?.[1] ?? a.version?.split(" ")[0] ?? "—";
            const enabled = !disabledAgentIds.includes(a.id);
            return (
            <div
              key={a.id}
              className="rounded-md px-3 py-2 text-xs"
              style={{ background: "var(--color-surface-secondary)" }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-medium" style={{ color: "var(--color-text)" }}>{a.name}</span>
                    <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px]" style={{ color: "var(--color-text-secondary)", background: "var(--bg-hover)", fontFamily: "var(--font-mono)" }}>
                      {currentVersion}
                    </span>
                    <span
                      className="shrink-0 rounded px-1.5 py-0.5 text-[10px]"
                      style={{
                        color: a.status === "available" ? "var(--success)" : "var(--warning)",
                        background: a.status === "available" ? "oklch(62% 0.19 160 / 0.1)" : "oklch(70% 0.17 85 / 0.1)",
                      }}
                    >
                      {a.status === "available"
                        ? (language === "zh" ? "可使用" : "available")
                        : (language === "zh" ? "需适配" : "needs adapter")}
                    </span>
                  </div>
                  <div className="mt-1 truncate" style={{ color: "var(--color-text-secondary)", fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)" }}>
                    {a.path || a.binary}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => onAgentEnabledChange?.(a.id, !enabled)}
                  className="relative h-5 w-9 rounded-full transition-colors"
                  style={{
                    background: enabled ? "var(--accent)" : "var(--bg-hover)",
                    border: `1px solid ${enabled ? "var(--accent)" : "var(--border-light)"}`,
                  }}
                  title={enabled ? (language === "zh" ? "关闭智能体" : "Disable agent") : (language === "zh" ? "启用智能体" : "Enable agent")}
                  aria-label={enabled ? (language === "zh" ? "关闭智能体" : "Disable agent") : (language === "zh" ? "启用智能体" : "Enable agent")}
                >
                  <span
                    className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full transition-all"
                    style={{
                      left: enabled ? "18px" : "2px",
                      background: enabled ? "#fff" : "var(--text-tertiary)",
                    }}
                  />
                </button>
                {a.upgradeSupported && (
                  <button
                    onClick={() => state?.updateAvailable ? upgradeAgent(a.id) : checkUpgrade(a.id)}
                    disabled={state?.checking || state?.upgrading || state?.settled}
                    className="min-w-[58px] rounded px-2 py-1 text-[10px] font-medium transition-opacity hover:opacity-75 disabled:opacity-60"
                    style={{
                      color: state?.updateAvailable ? "#fff" : "var(--color-text-secondary)",
                      background: state?.updateAvailable ? "var(--accent)" : state?.settled ? "var(--bg-hover)" : "transparent",
                      border: state?.updateAvailable || !state?.settled ? "1px solid var(--accent)" : "1px solid var(--border-light)",
                    }}
                  >
                    {state?.checking
                      ? (language === "zh" ? "检测中" : "Checking")
                      : state?.upgrading
                        ? (language === "zh" ? "更新中" : "Updating")
                        : state?.updateAvailable
                          ? (language === "zh" ? "更新" : "Update")
                          : state?.settled
                            ? (language === "zh" ? "已最新" : "Latest")
                            : (language === "zh" ? "检测" : "Check")}
                  </button>
                )}
                </div>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <div className="min-w-0 truncate text-[10px]" style={{ color: state?.error ? "var(--error)" : "var(--text-tertiary)" }}>
                  {!a.upgradeSupported
                    ? (language === "zh" ? "暂不支持网页升级" : "Web upgrade not supported yet")
                    : state?.error
                    ? state.error
                    : state?.latestVersion
                      ? `${language === "zh" ? "最新版本" : "Latest"} ${state.latestVersion}${state.updateAvailable ? ` · ${language === "zh" ? "可升级" : "update available"}` : ` · ${language === "zh" ? "已是最新" : "up to date"}`}`
                      : (language === "zh" ? "可检查是否有新版本" : "Check whether a newer version is available")}
                </div>
                <div className="shrink-0 text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                  {a.installSource ?? "PATH"}
                </div>
              </div>
            </div>
            );
          })}
          {detectedAgents.length === 0 && (
            <div className="rounded-md px-3 py-4 text-center text-xs" style={{ color: "var(--color-text-secondary)", border: "1px dashed var(--color-border)" }}>
              {language === "zh" ? "没有发现智能体" : "No agents detected"}
            </div>
          )}
        </div>
      </div>

      {/* Refresh */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleRefresh}
          disabled={refreshingAgents}
          className="px-3 py-1.5 text-xs rounded-md transition-colors disabled:opacity-60"
          style={{
            background: "var(--color-accent-dim)",
            color: "var(--color-accent)",
          }}
        >
          {refreshingAgents
            ? (language === "zh" ? "刷新中..." : "Refreshing...")
            : (language === "zh" ? "刷新智能体发现" : "Refresh Agent Discovery")}
        </button>
        {refreshMessage && (
          <span className="text-[11px]" style={{ color: refreshMessage.includes("失败") || refreshMessage.includes("failed") ? "var(--error)" : "var(--color-text-secondary)" }}>
            {refreshMessage}
          </span>
        )}
      </div>

      {newAgentPrompt && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.32)" }}
          onClick={() => setNewAgentPrompt(null)}
        >
          <div
            className="w-full max-w-sm rounded-lg p-4 shadow-xl"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
              {language === "zh" ? "发现新的智能体" : "New agents detected"}
            </div>
            <div className="mt-2 space-y-1">
              {newAgentPrompt.map((agent) => (
                <div key={agent.id} className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-xs" style={{ background: "var(--color-surface-secondary)" }}>
                  <span style={{ color: "var(--color-text)" }}>{agent.name}</span>
                  <span style={{ color: agent.status === "available" ? "var(--success)" : "var(--warning)" }}>
                    {agent.status === "available"
                      ? (language === "zh" ? "可使用" : "available")
                      : (language === "zh" ? "需适配" : "needs adapter")}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setNewAgentPrompt(null)}
                className="rounded-md px-3 py-1.5 text-xs"
                style={{ color: "var(--color-text-secondary)", border: "1px solid var(--border-light)" }}
              >
                {language === "zh" ? "不添加" : "Skip"}
              </button>
              <button
                onClick={() => {
                  setNewAgentPrompt(null);
                  setRefreshMessage(language === "zh" ? "已添加" : "Added");
                }}
                className="rounded-md px-3 py-1.5 text-xs"
                style={{ color: "#fff", background: "var(--accent)" }}
              >
                {language === "zh" ? "添加" : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
