"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { FileTypeIcon } from "../AppIcon";
import { SessionTreeView } from "../SessionTreeView";

export function SessionsTab({ language, workspace, onDeleteSession }: {
  language: "en" | "zh";
  workspace: string;
  onDeleteSession?: (id: string) => void;
}) {
  const zh = language === "zh";
  const [sessions, setSessions] = useState<{ id: string; timestamp: string; model?: string; provider?: string; messageCount: number; firstMessage?: string; size: number; name?: string; workspace?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingTree, setViewingTree] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const savedScrollTop = useRef(0);

  useEffect(() => {
    fetch(`/api/pi/sessions?workspace=${encodeURIComponent(workspace)}`)
      .then((r) => r.json())
      .then((data: { sessions: typeof sessions }) => setSessions(data.sessions))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [workspace]);

  // Restore scroll position when returning from tree view
  useEffect(() => {
    if (!viewingTree && savedScrollTop.current > 0 && sessions.length > 0) {
      const restore = () => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = savedScrollTop.current;
        }
      };
      // Multiple RAFs to wait for layout to settle
      requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(restore)));
    }
  }, [viewingTree, sessions.length]);

  const formatDate = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " " +
      d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  // Compute grouped session list
  const groupedSessions = useMemo(() => {
    const groups = new Map<string, typeof sessions>();
    for (const s of sessions) {
      const key = s.workspace || "__none__";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(s);
    }
    return [...groups.entries()].sort((a, b) => {
      const aMax = Math.max(...a[1].map(s => new Date(s.timestamp).getTime()));
      const bMax = Math.max(...b[1].map(s => new Date(s.timestamp).getTime()));
      return bMax - aMax;
    });
  }, [sessions]);

  if (loading) {
    return <div className="p-5 text-xs text-center" style={{ color: "var(--text-secondary)" }}>{zh ? "加载中..." : "Loading..."}</div>;
  }

  // Show tree view for a specific session
  if (viewingTree) {
    return (
      <div className="flex flex-col min-h-0" style={{ height: "75vh", maxHeight: "600px" }}>
        <div className="flex items-center gap-2 px-4 py-2 border-b shrink-0" style={{ borderColor: "var(--border)", background: "var(--bg)" }}>
          <button
            onClick={() => setViewingTree(null)}
            className="text-[10px] px-2 py-0.5 transition-colors hover:opacity-70"
            style={{ color: "var(--accent)", border: "1px solid var(--accent)", background: "transparent" }}
          >
            ← {zh ? "返回" : "Back"}
          </button>
          <span className="text-xs font-medium" style={{ color: "var(--text)" }}>
            {zh ? "会话树" : "Session Tree"}
          </span>
        </div>
        <div className="flex-1 min-h-0" style={{ background: "var(--bg)" }}>
          <SessionTreeView sessionId={viewingTree} workspace={workspace} language={language} />
        </div>
      </div>
    );
  }

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {zh ? `当前项目的 Pi CLI 会话 (${sessions.length})` : `Pi CLI sessions for this project (${sessions.length})`}
        </div>
      </div>
      {sessions.length === 0 ? (
        <div className="px-3 py-4 text-center text-xs" style={{ color: "var(--text-secondary)", border: "1px dashed var(--border)" }}>
          {zh ? "还没有 Pi 会话。运行 pi CLI 后这里会显示。" : "No Pi sessions yet. Run pi CLI to create sessions."}
        </div>
      ) : (
        <div ref={scrollRef} className="max-h-[60vh] overflow-y-auto">
          {groupedSessions.map(([ws, sessList]) => {
            const label = ws === "__none__" ? (zh ? "(不使用项目)" : "(No Project)") : (ws.split("/").filter(Boolean).pop() || ws);
            return (
              <div key={ws} className="mb-3">
                <div className="px-3 py-1.5 text-[10px] font-semibold truncate" style={{ color: "var(--text-tertiary)", background: "var(--bg)", borderBottom: "1px solid var(--border-light)" }}>
                  <span className="inline-flex items-center gap-1.5">
                    <FileTypeIcon name={label} type="directory" size={13} />
                    {label} · {sessList.length}
                  </span>
                </div>
                <div className="space-y-1 px-2 pt-1">
                  {sessList.map((s) => (
            <div
              key={s.id}
              className="px-3 py-2 text-xs cursor-pointer transition-colors hover:bg-[var(--bg-hover)]"
              style={{ background: "var(--bg)", border: "1px solid var(--border-light)" }}
              onClick={() => {
                savedScrollTop.current = scrollRef.current?.scrollTop ?? 0;
                // Switch workspace if needed
                if (s.workspace && s.workspace !== workspace) {
                  localStorage.setItem("pi-plus-plus-workspace", s.workspace || "");
                }
                location.reload();
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px]" style={{ color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
                  {formatDate(s.timestamp)}
                </span>
                <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                  {s.messageCount} msgs · {formatSize(s.size)}
                </span>
              </div>
              {s.name ? (
                <div className="mt-1 truncate text-xs font-medium" style={{ color: "var(--accent)" }}>
                  {s.name}
                </div>
              ) : s.firstMessage ? (
                <div className="mt-1 truncate" style={{ color: "var(--text-secondary)" }}>
                  {s.firstMessage}
                </div>
              ) : null}
              {(s.model || s.provider) && (
                <div className="mt-0.5 text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                  {s.provider && <span style={{ color: "var(--accent)" }}>{s.provider}</span>}
                  {s.provider && s.model && <span> / </span>}
                  {s.model && <span style={{ fontFamily: "var(--font-mono)" }}>{s.model}</span>}
                </div>
              )}
              <div className="mt-1 flex items-center gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); savedScrollTop.current = scrollRef.current?.scrollTop ?? 0; setViewingTree(s.id); }}
                  className="px-2 py-0.5 text-[10px] transition-colors hover:opacity-70"
                  style={{ color: "var(--accent)", border: "1px solid var(--accent)", background: "transparent" }}
                >
                  {zh ? "树" : "Tree"}
                </button>
                <button
                  onClick={async (e) => { e.stopPropagation();
                    const r = await fetch(`/api/pi/session/export?id=${encodeURIComponent(s.id)}&workspace=${encodeURIComponent(workspace)}`);
                    if (!r.ok) return;
                    const blob = await r.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `session-${s.id.slice(0, 8)}.html`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="px-2 py-0.5 text-[10px] transition-colors hover:opacity-70"
                  style={{ color: "oklch(68% 0.13 250)", border: "1px solid oklch(68% 0.13 250 / 0.4)", background: "transparent" }}
                  title={zh ? "导出 HTML" : "Export HTML"}
                >
                  {zh ? "导出" : "Export"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  })}
      </div>
      )}
    </div>
  );
}
