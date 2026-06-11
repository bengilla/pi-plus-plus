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

export function SkillsTab({ language }: { language: "en" | "zh" }) {
  const zh = language === "zh";
  const agentId = "pi";
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"installed" | "marketplace">("installed");
  const [marketSearch, setMarketSearch] = useState("");
  const [marketResults, setMarketResults] = useState<MarketplaceSkill[]>([]);

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
    } catch { /* ignore */ }
  };

  const installSkill = async (s: MarketplaceSkill) => {
    try {
      const r = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "install", agentId, skillId: s.id, name: s.name, description: s.description, source: s.source }),
      });
      if (r.ok) {
        setMarketResults((prev) => prev.filter((m) => m.id !== s.id));
        loadSkills(agentId);
      }
    } catch { /* ignore */ }
  };

  return (
    <div className="p-5">
      <div className="flex items-center gap-3 mb-4">
        <span className="px-2 py-1 text-xs font-medium" style={{ background: "transparent", color: "var(--accent)", border: "1px solid var(--accent)" }}>Pi</span>
        <div className="flex overflow-hidden text-xs" style={{ border: "1px solid var(--color-border)" }}>
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

      {filter === "marketplace" && (
        <input
          type="text"
          value={marketSearch}
          onChange={(e) => setMarketSearch(e.target.value)}
          placeholder={zh ? "搜索市场..." : "Search marketplace..."}
          className="w-full px-3 py-1.5 text-xs mb-3 outline-none"
          style={{ background: "var(--color-surface-secondary)", color: "var(--color-text)", border: "1px solid var(--color-border)" }}
        />
      )}

      <div className="text-[10px] mb-2" style={{ color: "var(--color-text-secondary)" }}>
        {filter === "installed"
          ? (zh ? `已安装 ${skills.length} 个技能` : `${skills.length} skills installed`)
          : (zh ? `${marketResults.length} 个可用` : `${marketResults.length} available`)}
      </div>

      {loading && (
        <div className="text-xs py-8 text-center" style={{ color: "var(--color-text-secondary)" }}>
          {zh ? "加载中..." : "Loading..."}
        </div>
      )}

      <div className="space-y-1 max-h-96 overflow-y-auto">
        {filter === "installed" && skills.map((s) => (
          <div key={s.id} className="flex items-start gap-3 px-3 py-2" style={{ background: "var(--color-surface-secondary)" }}>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium" style={{ color: "var(--color-text)" }}>{s.name}</div>
              <div className="text-[10px] mt-0.5 truncate" style={{ color: "var(--color-text-secondary)" }}>{s.description.slice(0, 120)}</div>
            </div>
            <button
              onClick={() => toggleSkill(s.id, !s.enabled)}
              className="shrink-0 w-8 h-5 relative transition-colors"
              style={{ background: s.enabled ? "var(--color-accent)" : "var(--color-border)" }}
            >
              <span className="absolute top-0.5 w-4 h-4 bg-white transition-transform shadow-sm" style={{ left: s.enabled ? "calc(100% - 18px)" : "2px" }} />
            </button>
          </div>
        ))}

        {filter === "marketplace" && marketResults.map((s) => (
          <div key={s.id} className="flex items-start gap-3 px-3 py-2" style={{ background: "var(--color-surface-secondary)" }}>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium" style={{ color: "var(--color-text)" }}>{s.name}</div>
              <div className="text-[10px] mt-0.5" style={{ color: "var(--color-text-secondary)" }}>{s.description.slice(0, 120)}</div>
              <div className="text-[9px] mt-1" style={{ color: "var(--color-text-secondary)", opacity: 0.6 }}>{s.source}</div>
            </div>
            <button
              onClick={() => installSkill(s)}
              className="shrink-0 px-2 py-0.5 text-[10px] transition-colors hover:opacity-80"
              style={{ background: "transparent", color: "var(--accent)", border: "1px solid var(--accent)" }}
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
