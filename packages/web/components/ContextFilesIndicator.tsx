"use client";

import { useState, useEffect, useCallback } from "react";

interface ContextFile {
  path: string;
  displayPath: string;
  size: number;
  exists: boolean;
  level: "global" | "project" | "parent";
  content?: string;
}

interface Props {
  workspace: string;
  language: "en" | "zh";
}

export function ContextFilesIndicator({ workspace, language }: Props) {
  const zh = language === "zh";
  const [files, setFiles] = useState<ContextFile[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState("");

  const loadFiles = useCallback(async () => {
    try {
      const r = await fetch(`/api/pi/context-files?workspace=${encodeURIComponent(workspace)}`);
      if (!r.ok) return;
      const data = await r.json();
      setFiles(data.files?.filter((f: ContextFile) => f.exists) ?? []);
    } catch { /* ignore */ }
  }, [workspace]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const loadPreview = async (path: string) => {
    try {
      const r = await fetch(
        `/api/pi/context-files?workspace=${encodeURIComponent(workspace)}&preview=${encodeURIComponent(path)}`,
      );
      if (!r.ok) return;
      const data = await r.json();
      const target = data.files?.find((f: ContextFile) => f.path === path || f.content);
      if (target?.content) {
        setPreviewContent(target.content);
        setPreviewFile(target.displayPath);
      }
    } catch { /* ignore */ }
  };

  const existing = files.filter((f) => f.exists);
  if (existing.length === 0) return null;

  const levelBadge = (level: string) => {
    const colors: Record<string, string> = {
      global: "oklch(60% 0.08 250)",
      project: "var(--accent)",
      parent: "oklch(65% 0.10 80)",
    };
    const labels: Record<string, string> = {
      global: zh ? "全局" : "global",
      project: zh ? "项目" : "project",
      parent: zh ? "父级" : "parent",
    };
    return (
      <span
        className="text-[8px] px-1 py-px shrink-0"
        style={{ color: colors[level] || "var(--text-tertiary)", border: `1px solid ${colors[level] || "var(--text-tertiary)"}40` }}
      >
        {labels[level] || level}
      </span>
    );
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  return (
    <div className="fade-in">
      {/* Compact toggle bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[11px] transition-colors hover:opacity-80"
        style={{
          color: "var(--text-tertiary)",
          borderBottom: "1px solid var(--border-subtle)",
          background: expanded ? "var(--bg-raised)" : "transparent",
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
        <span>
          {zh ? "上下文文件" : "Context files"} ({existing.length})
        </span>
        <svg
          width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", marginLeft: "auto" }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Expanded list */}
      {expanded && (
        <div className="px-2 py-1.5" style={{ borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-raised)" }}>
          {existing.map((f) => (
            <button
              key={f.path}
              onClick={() => loadPreview(f.path)}
              className="w-full flex items-center gap-1.5 px-1.5 py-1 text-[10px] transition-colors hover:opacity-80 text-left group"
              style={{ color: "var(--text-secondary)" }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span className="truncate flex-1">{f.displayPath}</span>
              {levelBadge(f.level)}
              <span className="text-[9px] shrink-0 opacity-50">{formatSize(f.size)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Preview modal */}
      {previewFile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => { setPreviewFile(null); setPreviewContent(""); }}
        >
          <div
            className="w-[640px] max-h-[80vh] flex flex-col"
            style={{ background: "var(--bg)", border: "1px solid var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <span className="text-xs font-medium" style={{ color: "var(--text)" }}>{previewFile}</span>
              <button
                onClick={() => { setPreviewFile(null); setPreviewContent(""); }}
                className="text-sm hover:opacity-70"
                style={{ color: "var(--text-tertiary)" }}
              >
                ✕
              </button>
            </div>
            <pre className="flex-1 overflow-auto p-3 text-[12px] leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono, monospace)" }}>
              {previewContent}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
