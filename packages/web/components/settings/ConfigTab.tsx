"use client";

import { useState, useEffect, useCallback } from "react";
import { AppIcon } from "../AppIcon";

export function ConfigTab({ language, workspace }: { language: "en" | "zh"; workspace: string }) {
  const zh = language === "zh";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [settings, setSettings] = useState<{
    global: Record<string, unknown>;
    project: Record<string, unknown>;
    auth: Record<string, { type: string; configured: boolean }>;
    trust: Record<string, boolean>;
    paths?: {
      globalSettings?: string;
      globalAuth?: string;
      globalTrust?: string;
      projectSettings?: string | null;
    };
  } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editScope, setEditScope] = useState<"global" | "project">("global");

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/pi/settings?workspace=${encodeURIComponent(workspace)}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setSettings(data);
      setEditValue(JSON.stringify(data.global, null, 2));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, [workspace]);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      let parsed: Record<string, unknown>;
      try { parsed = JSON.parse(editValue); }
      catch { throw new Error(zh ? "JSON 格式错误" : "Invalid JSON"); }

      const r = await fetch("/api/pi/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: editScope, updates: parsed, workspace }),
      });
      if (!r.ok) {
        const errData = await r.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${r.status}`);
      }
      setSuccess(zh ? "已保存" : "Saved");
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-5 text-xs text-center" style={{ color: "var(--text-secondary)" }}>{zh ? "加载中..." : "Loading..."}</div>;
  }

  if (error && !settings) {
    return (
      <div className="p-5">
        <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--error)" }}><AppIcon name="info" size={13} />{error}</div>
        <button onClick={loadSettings} className="mt-2 px-3 py-1 text-xs transition-colors hover:opacity-80"
          style={{ color: "var(--accent)", border: "1px solid var(--accent)", background: "transparent" }}>
          {zh ? "重试" : "Retry"}
        </button>
      </div>
    );
  }

  const authProviders = settings?.auth ? Object.entries(settings.auth) : [];
  const trustDirs = settings?.trust ? Object.keys(settings.trust) : [];

  return (
    <div className="p-5 space-y-5 max-h-[65vh] overflow-y-auto">
      {/* Provider configuration */}
      <div>
        <div className="text-xs font-medium mb-2" style={{ color: "var(--text)" }}>
          {zh ? "已配置的 Provider" : "Configured Providers"}
        </div>
        {authProviders.length === 0 ? (
          <div className="px-3 py-2 text-xs" style={{ color: "var(--text-secondary)", border: "1px dashed var(--border)" }}>
            {zh ? "没有已配置的 Provider" : "No providers configured"}
          </div>
        ) : (
          <div className="space-y-1">
            {authProviders.map(([name, cfg]) => (
              <div key={name} className="flex items-center gap-3 px-3 py-2 text-xs"
                style={{ background: "var(--bg)", border: "1px solid var(--border-light)" }}>
                <span className="font-medium" style={{ color: "var(--text)" }}>{name}</span>
                <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>{cfg.type}</span>
                {cfg.configured ? (
                  <span className="ml-auto text-[10px]" style={{ color: "oklch(65% 0.15 155)" }}>✓ {zh ? "已配置" : "Configured"}</span>
                ) : (
                  <span className="ml-auto text-[10px]" style={{ color: "var(--text-tertiary)" }}>{zh ? "未配置" : "Not configured"}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Default provider & model */}
      {settings?.global && (
        <div>
          <div className="text-xs font-medium mb-2" style={{ color: "var(--text)" }}>{zh ? "默认配置" : "Default Settings"}</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              { key: "defaultProvider", label: zh ? "默认 Provider" : "Default Provider" },
              { key: "defaultModel", label: zh ? "默认模型" : "Default Model" },
              { key: "defaultThinkingLevel", label: zh ? "默认思考级别" : "Default Thinking" },
            ].map(({ key, label }) => (
              <div key={key} className="px-3 py-2" style={{ background: "var(--bg)", border: "1px solid var(--border-light)" }}>
                <div className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>{label}</div>
                <div className="mt-0.5 truncate" style={{ color: "var(--text)", fontFamily: "var(--font-mono)" }}>
                  {String(settings.global[key] ?? "—")}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-1 text-[10px]" style={{ color: "var(--text-tertiary)" }}>
            {zh ? "模型选择在「模型」标签页中配置。" : "Model selection is configured in the Models tab."}
          </div>
        </div>
      )}

      {/* Trusted directories */}
      <div>
        <div className="text-xs font-medium mb-2" style={{ color: "var(--text)" }}>{zh ? "受信任的目录" : "Trusted Directories"}</div>
        {trustDirs.length === 0 ? (
          <div className="px-3 py-2 text-xs" style={{ color: "var(--text-secondary)", border: "1px dashed var(--border)" }}>
            {zh ? "没有受信任的目录" : "No trusted directories"}
          </div>
        ) : (
          <div className="space-y-1">
            {trustDirs.map((dir) => (
              <div key={dir} className="flex items-center gap-2 px-3 py-1.5 text-xs"
                style={{ background: "var(--bg)", border: "1px solid var(--border-light)" }}>
                <span className="text-[10px]" style={{ color: "oklch(65% 0.15 155)" }}>✓</span>
                <span style={{ color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: "11px" }}>{dir}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Raw JSON editor */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium" style={{ color: "var(--text)" }}>{zh ? "设置 JSON" : "Settings JSON"}</span>
          <div className="flex items-center gap-2">
            <div className="inline-flex overflow-hidden text-[10px]" style={{ border: "1px solid var(--border)" }}>
              <button onClick={() => { setEditScope("global"); setEditValue(JSON.stringify(settings?.global ?? {}, null, 2)); }}
                className="px-2 py-0.5 transition-colors"
                style={{ color: editScope === "global" ? "var(--accent)" : "var(--text-secondary)", background: editScope === "global" ? "var(--accent-dim)" : "transparent" }}>
                {zh ? "全局" : "Global"}
              </button>
              <button onClick={() => { setEditScope("project"); setEditValue(JSON.stringify(settings?.project ?? {}, null, 2)); }}
                className="px-2 py-0.5 transition-colors"
                style={{ color: editScope === "project" ? "var(--accent)" : "var(--text-secondary)", background: editScope === "project" ? "var(--accent-dim)" : "transparent" }}>
                {zh ? "项目" : "Project"}
              </button>
            </div>
            <button onClick={handleSave} disabled={saving}
              className="px-2 py-0.5 text-[10px] transition-colors hover:opacity-80 disabled:opacity-50"
              style={{ color: "var(--accent)", border: "1px solid var(--accent)", background: "transparent" }}>
              {saving ? (zh ? "保存中..." : "Saving...") : (zh ? "保存" : "Save")}
            </button>
          </div>
        </div>
        <textarea value={editValue} onChange={(e) => setEditValue(e.target.value)}
          className="w-full font-mono text-xs p-3 outline-none resize-none"
          style={{ background: "var(--bg)", color: "var(--text)", border: "1px solid var(--border-light)", minHeight: "120px", fontFamily: "var(--font-mono)", fontSize: "11px", lineHeight: "1.5" }}
          spellCheck={false} />
        {error && <div className="mt-1 flex items-center gap-1 text-[10px]" style={{ color: "var(--error)" }}><AppIcon name="info" size={11} />{error}</div>}
        {success && <div className="mt-1 flex items-center gap-1 text-[10px]" style={{ color: "oklch(65% 0.15 155)" }}><AppIcon name="check" size={11} />{success}</div>}
      </div>

      {/* File paths */}
      <div className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
        <div className="font-medium mb-1" style={{ color: "var(--text-secondary)" }}>{zh ? "配置文件路径" : "Config File Paths"}</div>
        <div className="space-y-0.5">
          {[
            { label: zh ? "全局设置" : "Global Settings", path: settings?.paths?.globalSettings },
            { label: zh ? "全局认证" : "Global Auth", path: settings?.paths?.globalAuth },
            { label: zh ? "全局信任" : "Global Trust", path: settings?.paths?.globalTrust },
            { label: zh ? "项目设置" : "Project Settings", path: settings?.paths?.projectSettings },
          ].map(({ label, path }) => (
            <div key={label} className="flex items-center gap-1">
              <span>{label}:</span>
              <span style={{ fontFamily: "var(--font-mono)" }}>{path || "—"}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
