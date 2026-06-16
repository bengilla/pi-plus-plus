"use client";

import { useState, useEffect } from "react";
import { AppIcon, FileTypeIcon } from "../AppIcon";

interface ContextFile {
  path: string;
  name: string;
  scope: "global" | "project" | "parent" | "cwd";
}

export function ContextFilesSection({ workspace, onFileClick, language }: {
  workspace: string;
  onFileClick: (path: string) => void;
  language?: "en" | "zh";
}) {
  const zh = language === "zh";
  const [contextFiles, setContextFiles] = useState<ContextFile[]>([]);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/pi/context-files?workspace=${encodeURIComponent(workspace)}`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setContextFiles(data.files ?? []); })
      .catch((e: unknown) => { console.error("[pi++] Failed to load context files:", e); });
    return () => { cancelled = true; };
  }, [workspace]);

  if (contextFiles.length === 0 && workspace) return null;

  return (
    <div className="border-b shrink-0" style={{ borderColor: "var(--border)" }}>
      <div className="px-2 py-1.5">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider hover:opacity-70 transition-opacity"
          style={{ color: "var(--text-tertiary)" }}
        >
          <span className="inline-flex" style={{ color: "var(--accent)" }}>
            <AppIcon name={open ? "chevron-down" : "chevron-right"} size={11} />
          </span>
          {zh ? "上下文文件" : "Context Files"}
          <span className="px-1 py-px font-normal" style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}>{contextFiles.length}</span>
        </button>
      </div>
      {open && contextFiles.length > 0 && (
        <div className="px-2 pb-2 space-y-0.5">
          {contextFiles.map((f) => {
            const scopeLabel = f.scope === "global" ? (zh ? "全局" : "global")
              : f.scope === "project" ? ".pi/"
              : f.scope === "cwd" ? (zh ? "当前" : "cwd") : (zh ? "上级" : "parent");
            return (
              <button
                key={f.path}
                onClick={() => onFileClick(f.path)}
                className="w-full flex items-center gap-1.5 px-2 py-1 text-[10px] text-left transition-colors hover:bg-[var(--bg-hover)]"
                style={{ color: "var(--text-secondary)" }}
              >
                <FileTypeIcon name={f.name} size={14} />
                <span className="truncate flex-1" style={{ fontFamily: "var(--font-mono)" }}>{f.name}</span>
                <span className="shrink-0 text-[8px]" style={{ color: "var(--text-tertiary)" }}>{scopeLabel}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
