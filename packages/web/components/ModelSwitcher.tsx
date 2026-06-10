"use client";

import { useState, useEffect } from "react";

interface AgentInfo {
  id: string;
  name: string;
  description: string;
  version?: string;
}

function fmtVersion(v?: string): string {
  if (!v) return "";
  // Extract version number from strings like "2.1.162 (Claude Code)" or "codex-cli 0.136.0"
  const m = v.match(/(\d+\.\d+\.\d+)/);
  return m ? m[1] : "";
}

function displayLabel(a: AgentInfo): string {
  const ver = fmtVersion(a.version);
  return ver ? `${a.name} (${ver})` : a.name;
}

interface Props {
  value: string;
  onChange: (id: string) => void;
}

export function ModelSwitcher({ value, onChange }: Props) {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/agents")
      .then((r) => r.json())
      .then((data) => {
        const list = data.agents ?? [];
        setAgents(list);
        // If current value not in discovered agents, pick first
        if (list.length > 0 && !list.some((a: AgentInfo) => a.id === value)) {
          onChange(list[0].id);
        }
      })
      .catch(() => setAgents([]))
      .finally(() => setLoading(false));
  }, []); // Only fetch once on mount

  const current = agents.find((a) => a.id === value);

  // ── No agents installed ──────────────────────────────────
  if (!loading && agents.length === 0) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
          No agents found
        </span>
        <span
          className="text-[10px] px-1.5 py-0.5"
          style={{ background: "var(--color-accent-dim)", color: "var(--color-accent)" }}
        >
          Install one →
        </span>
      </div>
    );
  }

  // ── Loading ──────────────────────────────────────────────
  if (loading) {
    return (
      <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
        Scanning...
      </span>
    );
  }

  // ── Single agent — just show name + version, no dropdown ──
  if (agents.length === 1) {
    return (
      <span className="text-xs font-medium" style={{ color: "var(--color-text)" }}>
        {current ? displayLabel(current) : ""}
      </span>
    );
  }

  // ── Multiple agents — dropdown ───────────────────────────
  return (
    <div className="relative group">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none pl-2.5 pr-7 py-1 text-xs cursor-pointer transition-colors"
        style={{
          background: "var(--color-surface)",
          color: "var(--color-text)",
          border: "1px solid var(--color-border)",
        }}
      >
        {agents.map((a) => (
          <option key={a.id} value={a.id}>
            {displayLabel(a)}
          </option>
        ))}
      </select>
      <svg
        className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
        width="10" height="6" viewBox="0 0 10 6" fill="none"
      >
        <path
          d="M1 1l4 4 4-4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: "var(--color-text-secondary)" }}
        />
      </svg>
    </div>
  );
}
