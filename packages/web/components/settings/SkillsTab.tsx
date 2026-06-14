"use client";

import { useState, useEffect, useCallback } from "react";

interface SkillInfo {
  id: string;
  name: string;
  description: string;
  path: string;
  enabled: boolean;
  projectEnabled: boolean | null;
}

export function SkillsTab({ language, workspace }: { language: "en" | "zh"; workspace?: string }) {
  const zh = language === "zh";
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasProjectConfig, setHasProjectConfig] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlError, setUrlError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadSkills = useCallback(async () => {
    setLoading(true);
    try {
      const params = workspace ? `?workspace=${encodeURIComponent(workspace)}` : "";
      const r = await fetch(`/api/skills${params}`);
      const data = await r.json();
      setSkills(data.skills ?? []);
      setHasProjectConfig(data.hasProjectConfig ?? false);
    } catch {
      setSkills([]);
    } finally {
      setLoading(false);
    }
  }, [workspace]);

  useEffect(() => { loadSkills(); }, [loadSkills]);

  const installFromUrl = async () => {
    const url = urlInput.trim();
    if (!url) return;
    const match = url.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/);
    const skillId = match ? match[2] : url.split("/").filter(Boolean).pop() ?? "custom-skill";
    setUrlLoading(true);
    setUrlError("");
    try {
      const r = await fetch("/api/skills", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "install", skillId, source: url }) });
      const data = await r.json();
      if (r.ok) { setUrlInput(""); loadSkills(); }
      else setUrlError(data.error ?? "Install failed");
    } catch {
      setUrlError("Network error");
    } finally {
      setUrlLoading(false);
    }
  };

  return (
    <div className="p-5">
      <div className="mb-4">
        <div className="text-[10px] mb-1.5" style={{ color: "var(--text-secondary)" }}>
          {zh ? "从 GitHub 安装技能" : "Install from GitHub URL"}
        </div>
        <div className="flex gap-2">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => { setUrlInput(e.target.value); setUrlError(""); }}
            onKeyDown={(e) => e.key === "Enter" && installFromUrl()}
            placeholder="https://github.com/op7418/guizang-ppt-skill"
            className="flex-1 px-3 py-1.5 text-xs outline-none"
            style={{ background: "var(--color-surface-secondary)", color: "var(--color-text)", border: "1px solid var(--color-border)" }}
          />
          <button onClick={installFromUrl} disabled={urlLoading || !urlInput.trim()}
            className="px-3 py-1.5 text-xs transition-colors disabled:opacity-40"
            style={{ background: "transparent", color: "var(--accent)", border: "1px solid var(--accent)" }}
          >
            {urlLoading ? (zh ? "安装中…" : "Installing…") : (zh ? "安装" : "Install")}
          </button>
        </div>
        {urlError && <div className="text-[10px] mt-1" style={{ color: "var(--color-error, #ef4444)" }}>{urlError}</div>}
      </div>

      <div className="text-[10px] mb-2" style={{ color: "var(--color-text-secondary)" }}>
        {zh ? `已安装 ${skills.length} 个技能` : `${skills.length} skills installed`}
      </div>

      {loading && <div className="text-xs py-8 text-center" style={{ color: "var(--color-text-secondary)" }}>{zh ? "加载中..." : "Loading..."}</div>}

      <div className="space-y-1 max-h-96 overflow-y-auto">
        {skills.map((s) => (
          <div key={s.id} className="flex items-start gap-3 px-3 py-2 group"
            style={{ background: "var(--color-surface-secondary)", opacity: hasProjectConfig && s.projectEnabled === false ? 0.45 : 1 }}>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium" style={{ color: "var(--color-text)" }}>{s.name}</div>
              <div className="text-[10px] mt-0.5 truncate" style={{ color: "var(--color-text-secondary)" }}>{s.description.slice(0, 120)}</div>
            </div>

            <button onClick={async () => {
              setUpdatingId(s.id);
              try {
                const r = await fetch("/api/skills", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update", skillId: s.id }) });
                if (r.ok) loadSkills();
              } catch { /* ignore */ }
              setUpdatingId(null);
            }} disabled={updatingId === s.id}
              className="shrink-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{ color: "var(--text-secondary)" }} title={zh ? "更新" : "Update"}>
              {updatingId === s.id
                ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><circle cx="12" cy="12" r="10" strokeDasharray="31.4 31.4" strokeLinecap="round" /></svg>
                : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23,4 23,10 17,10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
              }
            </button>

            <button onClick={async () => {
              if (!confirm(zh ? `删除技能 "${s.name}"？不可撤销。` : `Delete "${s.name}"? Cannot undo.`)) return;
              setDeletingId(s.id);
              try {
                const r = await fetch("/api/skills", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", skillId: s.id }) });
                if (r.ok) setSkills((prev) => prev.filter((sk) => sk.id !== s.id));
                else { const d = await r.json().catch(() => ({})); alert(d.error ?? "Delete failed"); }
              } catch { alert("Network error"); }
              finally { setDeletingId(null); }
            }} disabled={deletingId === s.id}
              className="shrink-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400 disabled:opacity-50"
              style={{ color: "var(--text-secondary)" }} title={zh ? "删除" : "Delete"}>
              {deletingId === s.id
                ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><circle cx="12" cy="12" r="10" strokeDasharray="31.4 31.4" strokeLinecap="round" /></svg>
                : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3,6 5,6 21,6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
              }
            </button>
          </div>
        ))}
        {skills.length === 0 && !loading && (
          <div className="text-xs py-8 text-center" style={{ color: "var(--color-text-secondary)" }}>
            {zh ? "还没有安装技能 — 在上方粘贴 GitHub 链接安装" : "No skills installed — paste a GitHub URL above to install"}
          </div>
        )}
      </div>
    </div>
  );
}
