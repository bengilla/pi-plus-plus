"use client";

import { useState, useEffect } from "react";
import { ModelsTab } from "./settings/ModelsTab";
import { AuthTab } from "./settings/AuthTab";
import { SessionsTab } from "./settings/SessionsTab";
import { SkillsTab } from "./settings/SkillsTab";
import { PackagesTab } from "./PackagesTab";
import { PiSettingsTab } from "./settings/PiSettingsTab";
import { GeneralTab } from "./settings/GeneralTab";
import { AppIcon } from "./AppIcon";

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

type Tab = "auth" | "models" | "sessions" | "skills" | "packages" | "config" | "general";

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
        className="w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden fade-in"
        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", boxShadow: "var(--shadow-modal)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b shrink-0" style={{ borderColor: "var(--color-border)" }}>
          <div className="flex items-center gap-3">
            <span style={{ color: "var(--color-text-secondary)" }}>
              <AppIcon name="settings" size={16} />
            </span>
            <span className="font-semibold text-sm" style={{ color: "var(--color-text)" }}>{zh ? "设置" : "Settings"}</span>
          </div>
          <button onClick={onClose} className="p-1 hover:opacity-70 transition-opacity" style={{ color: "var(--text-secondary)" }}>
            <AppIcon name="x" size={14} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 px-5 border-b shrink-0" style={{ borderColor: "var(--color-border)" }}>
          {(["auth", "models", "sessions", "skills", "packages", "config", "general"] as Tab[]).map((t) => (
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
                ? (t === "auth" ? "认证" : t === "models" ? "模型" : t === "sessions" ? "会话" : t === "skills" ? "技能" : t === "packages" ? "包" : t === "config" ? "配置" : "通用")
                : t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {tab === "auth" && <AuthTab language={language} />}
          {tab === "models" && <ModelsTab language={language} />}
          {tab === "sessions" && <SessionsTab language={language} workspace={workspace} onDeleteSession={onDeleteSession} />}
          {tab === "skills" && <SkillsTab language={language} workspace={workspace} />}
          {tab === "packages" && <PackagesTab language={language} />}
          {tab === "config" && <PiSettingsTab language={language} workspace={workspace} />}
          {tab === "general" && (
            <GeneralTab fontScale={fontScale} onFontScaleChange={onFontScaleChange} language={language} onLanguageChange={onLanguageChange} />
          )}
        </div>
      </div>
    </div>
  );
}
