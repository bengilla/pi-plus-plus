"use client";

import { useState, useEffect } from "react";
import { ModelsTab } from "./settings/ModelsTab";
import { SessionsTab } from "./settings/SessionsTab";
import { SkillsTab } from "./settings/SkillsTab";
import { PackagesTab } from "./PackagesTab";
import { ConfigTab } from "./settings/ConfigTab";
import { GeneralTab } from "./settings/GeneralTab";

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
  onDeleteSession?: (sessionId: string) => void;
}

type Tab = "models" | "sessions" | "skills" | "packages" | "config" | "general";

export function SettingsModal({ open, onClose, fontScale, onFontScaleChange, language = "en", onLanguageChange, workspace = "", onDeleteSession }: Props) {
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
        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", boxShadow: "var(--shadow-modal)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b shrink-0" style={{ borderColor: "var(--color-border)" }}>
          <div className="flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--color-text-secondary)" }}>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span className="font-semibold text-sm" style={{ color: "var(--color-text)" }}>{zh ? "设置" : "Settings"}</span>
          </div>
          <button onClick={onClose} className="p-1 hover:opacity-70 transition-opacity" style={{ color: "var(--text-secondary)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 px-5 border-b shrink-0" style={{ borderColor: "var(--color-border)" }}>
          {(["models", "sessions", "skills", "packages", "config", "general"] as Tab[]).map((t) => (
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
              {zh
                ? (t === "models" ? "模型" : t === "sessions" ? "会话" : t === "skills" ? "技能" : t === "packages" ? "包" : t === "config" ? "配置" : "通用")
                : t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {tab === "models" && <ModelsTab language={language} />}
          {tab === "sessions" && <SessionsTab language={language} workspace={workspace} onDeleteSession={onDeleteSession} />}
          {tab === "skills" && <SkillsTab language={language} />}
          {tab === "packages" && <PackagesTab language={language} />}
          {tab === "config" && <ConfigTab language={language} workspace={workspace} />}
          {tab === "general" && (
            <GeneralTab fontScale={fontScale} onFontScaleChange={onFontScaleChange} language={language} onLanguageChange={onLanguageChange} />
          )}
        </div>
      </div>
    </div>
  );
}
