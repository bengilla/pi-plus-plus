"use client";

import { useState, useEffect } from "react";
import { SessionTreeView } from "../SessionTreeView";

export function SessionsTab({ language, workspace, onDeleteSession }: {
  language: "en" | "zh";
  workspace: string;
  onDeleteSession?: (id: string) => void;
}) {
  const zh = language === "zh";
  const [sessions, setSessions] = useState<{ id: string; timestamp: string; model?: string; provider?: string; messageCount: number; firstMessage?: string; size: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; firstMessage?: string } | null>(null);
  const [viewingTree, setViewingTree] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/pi/sessions?workspace=${encodeURIComponent(workspace)}`)
      .then((r) => r.json())
      .then((data: { sessions: typeof sessions }) => setSessions(data.sessions))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [workspace]);

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

  if (loading) {
    return <div className="p-5 text-xs text-center" style={{ color: "var(--text-secondary)" }}>{zh ? "加载中..." : "Loading..."}</div>;
  }

  // Show tree view for a specific session
  if (viewingTree) {
    return (
      <div className="flex flex-col min-h-0" style={{ height: "60vh" }}>
        <div className="flex items-center gap-2 px-4 py-2 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
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
        <div className="flex-1 overflow-hidden">
          <SessionTreeView sessionId={viewingTree} workspace={workspace} language={language} />
        </div>
      </div>
    );
  }

  return (
    <div className="p-5">
      <div className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
        {zh ? `当前项目的 Pi CLI 会话 (${sessions.length})` : `Pi CLI sessions for this project (${sessions.length})`}
      </div>
      {sessions.length === 0 ? (
        <div className="px-3 py-4 text-center text-xs" style={{ color: "var(--text-secondary)", border: "1px dashed var(--border)" }}>
          {zh ? "还没有 Pi 会话。运行 pi CLI 后这里会显示。" : "No Pi sessions yet. Run pi CLI to create sessions."}
        </div>
      ) : (
        <div className="space-y-1 max-h-[60vh] overflow-y-auto">
          {sessions.map((s) => (
            <div
              key={s.id}
              className="px-3 py-2 text-xs"
              style={{ background: "var(--bg)", border: "1px solid var(--border-light)" }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px]" style={{ color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
                  {formatDate(s.timestamp)}
                </span>
                <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                  {s.messageCount} msgs · {formatSize(s.size)}
                </span>
              </div>
              {s.firstMessage && (
                <div className="mt-1 truncate" style={{ color: "var(--text-secondary)" }}>
                  {s.firstMessage}
                </div>
              )}
              {(s.model || s.provider) && (
                <div className="mt-0.5 text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                  {s.provider && <span style={{ color: "var(--accent)" }}>{s.provider}</span>}
                  {s.provider && s.model && <span> / </span>}
                  {s.model && <span style={{ fontFamily: "var(--font-mono)" }}>{s.model}</span>}
                </div>
              )}
              <div className="mt-1 flex items-center gap-1">
                <button
                  className="px-2 py-0.5 text-[10px] transition-colors hover:opacity-70"
                  style={{ color: "var(--accent)", border: "1px solid var(--accent)", background: "transparent" }}
                  onClick={() => setViewingTree(s.id)}
                >
                  {zh ? "查看" : "View"}
                </button>
                <button
                  onClick={async () => {
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
                <div className="flex-1" />
                <button
                  onClick={() => setDeleteTarget({ id: s.id, firstMessage: s.firstMessage })}
                  className="px-2 py-0.5 text-[10px] transition-colors hover:opacity-70"
                  style={{ color: "var(--error)", border: "1px solid var(--error)", background: "transparent" }}
                  title={zh ? "删除会话" : "Delete session"}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(2px)" }}
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="w-full max-w-sm p-5 fade-in"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", boxShadow: "var(--shadow-modal)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-4">
              <div className="text-lg mb-2" style={{ color: "var(--error)" }}>⚠️</div>
              <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                {zh ? "删除会话" : "Delete session"}
              </div>
              {deleteTarget.firstMessage && (
                <div className="mt-2 text-xs truncate px-2" style={{ color: "var(--text-secondary)" }}>
                  "{deleteTarget.firstMessage}"
                </div>
              )}
              <div className="mt-3 text-xs" style={{ color: "var(--text-tertiary)" }}>
                {zh ? "此操作不可撤销。" : "This cannot be undone."}
              </div>
            </div>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-1.5 text-xs transition-opacity hover:opacity-80"
                style={{ color: "var(--text-secondary)", border: "1px solid var(--border-light)" }}
              >
                {zh ? "取消" : "Cancel"}
              </button>
              <button
                onClick={async () => {
                  await fetch(`/api/pi/sessions?id=${encodeURIComponent(deleteTarget.id)}&workspace=${encodeURIComponent(workspace)}`, { method: "DELETE" });
                  setSessions((prev) => prev.filter((x) => x.id !== deleteTarget.id));
                  onDeleteSession?.(deleteTarget.id);
                  setDeleteTarget(null);
                }}
                className="px-4 py-1.5 text-xs transition-opacity hover:opacity-80"
                style={{ color: "var(--error)", border: "1px solid var(--error)", background: "transparent" }}
              >
                {zh ? "删除" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
