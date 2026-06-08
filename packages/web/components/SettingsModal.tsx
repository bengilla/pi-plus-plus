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

interface Props {
  open: boolean;
  onClose: () => void;
  agents: AgentInfo[];
  fontScale?: number;
  onFontScaleChange?: (scale: number) => void;
}

type Tab = "skills" | "general";

export function SettingsModal({ open, onClose, agents, fontScale, onFontScaleChange }: Props) {
  const [tab, setTab] = useState<Tab>("skills");

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
            <span className="font-semibold text-sm" style={{ color: "var(--color-text)" }}>Settings</span>
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
              className="px-3 py-2 text-xs font-medium transition-colors capitalize"
              style={{
                color: tab === t ? "var(--color-accent)" : "var(--color-text-secondary)",
                borderBottom: tab === t ? "2px solid var(--color-accent)" : "2px solid transparent",
                marginBottom: -1,
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {tab === "skills" && <SkillsTab agents={agents} />}
          {tab === "general" && <GeneralTab agents={agents} fontScale={fontScale} onFontScaleChange={onFontScaleChange} />}
        </div>
      </div>
    </div>
  );
}

// ── Skills Tab ─────────────────────────────────────────────

function SkillsTab({ agents }: { agents: AgentInfo[] }) {
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
              className="px-2.5 py-1 capitalize transition-colors"
              style={{
                background: filter === f ? "var(--color-accent)" : "var(--color-surface-secondary)",
                color: filter === f ? "#fff" : "var(--color-text-secondary)",
              }}
            >
              {f}
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
          placeholder="Search marketplace..."
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
          ? `${skills.length} skills installed`
          : `${marketResults.length} available`}
      </div>

      {/* Skill list */}
      {loading && (
        <div className="text-xs py-8 text-center" style={{ color: "var(--color-text-secondary)" }}>
          Loading...
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
              Install
            </button>
          </div>
        ))}

        {filter === "installed" && skills.length === 0 && !loading && (
          <div className="text-xs py-8 text-center" style={{ color: "var(--color-text-secondary)" }}>
            No skills installed for this agent
          </div>
        )}
      </div>
    </div>
  );
}

// ── General Tab ─────────────────────────────────────────────

function GeneralTab({ agents, fontScale, onFontScaleChange }: { agents: AgentInfo[]; fontScale?: number; onFontScaleChange?: (s: number) => void }) {
  const handleRefresh = async () => {
    await fetch("/api/agents");
    window.location.reload();
  };

  const scale = fontScale ?? 1;

  return (
    <div className="p-5 space-y-5">
      {/* Font scale */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium" style={{ color: "var(--color-text)" }}>Font Size</span>
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
        <div className="text-xs font-medium mb-2" style={{ color: "var(--color-text)" }}>Discovered Agents</div>
        <div className="space-y-1">
          {agents.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between px-3 py-2 rounded-md text-xs"
              style={{ background: "var(--color-surface-secondary)" }}
            >
              <span style={{ color: "var(--color-text)" }}>{a.name}</span>
              <span style={{ color: "var(--color-text-secondary)" }}>
                {a.version?.match(/(\d+\.\d+\.\d+)/)?.[1] ?? a.version?.split(" ")[0] ?? "—"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Refresh */}
      <div>
        <button
          onClick={handleRefresh}
          className="px-3 py-1.5 text-xs rounded-md transition-colors"
          style={{
            background: "var(--color-accent-dim)",
            color: "var(--color-accent)",
          }}
        >
          Refresh Agent Discovery
        </button>
      </div>
    </div>
  );
}
