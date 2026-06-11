"use client";

import { useState, useEffect, useCallback } from "react";

// ── Types ────────────────────────────────────────────────────

interface SessionEntry {
  type: string;
  id: string;
  parentId: string | null;
  timestamp: string;
  summary: string;
  role?: string;
  provider?: string;
  model?: string;
  children?: SessionEntry[];
  isLeaf: boolean;
}

interface SessionTree {
  id: string;
  filename: string;
  cwd: string;
  version: number;
  name?: string;
  entries: SessionEntry[];
  leafId: string | null;
}

interface Props {
  sessionId: string;
  workspace: string;
  language?: "en" | "zh";
  onClose?: () => void;
}

// ── Helpers ──────────────────────────────────────────────────

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return ts.slice(11, 16) || ts;
  }
}

function roleColor(role?: string): string {
  switch (role) {
    case "user": return "oklch(62% 0.19 252)";
    case "assistant": return "var(--accent)";
    case "toolResult": return "oklch(62% 0.19 160)";
    case "bashExecution": return "oklch(70% 0.17 85)";
    default: return "var(--text-tertiary)";
  }
}

function roleDot(role?: string): string {
  switch (role) {
    case "user": return "●";
    case "assistant": return "●";
    case "toolResult": return "●";
    case "bashExecution": return "$";
    default: return "·";
  }
}

// ── Tree Node Component ──────────────────────────────────────

function TreeNode({
  entry,
  depth,
  leafId,
  onBranch,
  language: lang,
}: {
  entry: SessionEntry;
  depth: number;
  leafId: string | null;
  onBranch: (entryId: string) => void;
  language: "en" | "zh";
}) {
  const [collapsed, setCollapsed] = useState(false);
  const hasChildren = entry.children && entry.children.length > 0;
  const isLeaf = entry.id === leafId;
  const zh = lang === "zh";
  return (
    <div>
      <div
        className="flex items-start gap-1.5 px-3 py-0.5 text-[11px] transition-colors hover:bg-[var(--bg-hover)] group"
        style={{
          background: isLeaf ? "var(--bg-selected)" : "transparent",
          borderLeft: isLeaf ? "2px solid var(--accent)" : "2px solid transparent",
        }}
      >
        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] shrink-0" style={{ color: roleColor(entry.role) }}>
              {roleDot(entry.role)}
            </span>
            <span
              className="truncate font-medium"
              style={{ color: entry.isLeaf ? "var(--accent)" : "var(--text)" }}
              title={entry.summary || `(${entry.type})`}
            >
              {entry.summary || `(${entry.type})`}
            </span>
            {entry.isLeaf && (
              <span className="shrink-0 text-[8px]" style={{ color: "var(--accent)" }}>
                ← {zh ? "当前" : "leaf"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 pl-[14px]">
            <span className="text-[8px] whitespace-nowrap" style={{ color: "var(--text-tertiary)" }}>
              {formatTimestamp(entry.timestamp)}
            </span>
          </div>
        </div>
        {/* Actions */}
        {!isLeaf && (
          <button
            onClick={() => onBranch(entry.id)}
            className="shrink-0 px-1 py-px text-[9px] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
            style={{ color: "var(--accent)", border: "1px solid var(--accent)", background: "transparent" }}
            title={zh ? "从此处分叉" : "Branch here"}
          >
            {zh ? "分叉" : "Branch"}
          </button>
        )}
      </div>
      {/* Children */}
      {hasChildren && !collapsed && (
        <div>
          {entry.children!.map((child) => (
            <TreeNode
              key={child.id}
              entry={child}
              depth={depth + 1}
              leafId={leafId}
              onBranch={onBranch}
              language={lang}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────

export function SessionTreeView({ sessionId, workspace, language = "en", onClose }: Props) {
  const zh = language === "zh";
  const [tree, setTree] = useState<SessionTree | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [branching, setBranching] = useState(false);

  const fetchTree = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(
        `/api/pi/session/tree?id=${encodeURIComponent(sessionId)}&workspace=${encodeURIComponent(workspace)}`,
      );
      const data = await r.json();
      if (data.error) {
        setError(data.error);
      } else {
        setTree(data.tree);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load session tree");
    } finally {
      setLoading(false);
    }
  }, [sessionId, workspace]);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  const handleBranch = useCallback(async (entryId: string) => {
    if (!tree) return;
    setBranching(true);
    try {
      const r = await fetch("/api/pi/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "branch",
          sessionId: tree.id,
          workspace,
          entryId,
          filename: tree.filename,
        }),
      });
      const data = await r.json();
      if (data.error) {
        setError(data.error);
      } else {
        // Refresh tree
        fetchTree();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Branch failed");
    } finally {
      setBranching(false);
    }
  }, [tree, workspace, fetchTree]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-xs" style={{ color: "var(--text-secondary)" }}>
        {zh ? "加载会话树..." : "Loading session tree..."}
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-4 text-xs" style={{ color: "var(--error)" }}>
        ⚠️ {error}
        <button onClick={fetchTree} className="ml-2 underline">{zh ? "重试" : "Retry"}</button>
      </div>
    );
  }

  if (!tree) {
    return (
      <div className="px-4 py-4 text-xs" style={{ color: "var(--text-secondary)" }}>
        {zh ? "未找到会话" : "Session not found"}
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold truncate" style={{ color: "var(--text)" }}>
              {tree.name || tree.id.slice(0, 8)}
            </span>
            <span className="text-[10px] px-1.5 py-0.5" style={{ color: "var(--text-tertiary)", background: "var(--bg-panel)", border: "1px solid var(--border-light)" }}>
              v{tree.version}
            </span>
          </div>
          <div className="text-[10px] mt-0.5 truncate" style={{ color: "var(--text-secondary)" }}>
            {tree.cwd || workspace}
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="shrink-0 ml-2 p-1 hover:opacity-70"
            style={{ color: "var(--text-secondary)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Tree */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="min-h-full px-3 py-2">
        {tree.entries.length === 0 ? (
          <div className="text-xs text-center" style={{ color: "var(--text-secondary)" }}>
            {zh ? "会话为空" : "Empty session"}
          </div>
        ) : (
          tree.entries.map((entry) => (
            <TreeNode
              key={entry.id}
              entry={entry}
              depth={0}
              leafId={tree.leafId}
              onBranch={handleBranch}
              language={language}
            />
          ))
        )}
        </div>
      </div>

      {/* Branching indicator */}
      {branching && (
        <div className="px-4 py-1.5 text-[10px] border-t shrink-0" style={{ borderColor: "var(--border)", color: "var(--accent)" }}>
          {zh ? "创建分叉中..." : "Branching..."}
        </div>
      )}
    </div>
  );
}
