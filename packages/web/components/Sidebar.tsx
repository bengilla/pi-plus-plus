"use client";

import { useMemo, useState } from "react";
import { FileTree } from "./FileTree";
import { AgentIcon } from "./AgentIcon";

export interface ConvInfo {
  id: string;
  title: string;
  agentId: string;
  createdAt: number;
}

interface AgentInfo {
  id: string;
  name: string;
  description: string;
  version?: string;
}

interface Props {
  workspace: string;
  onWorkspaceChange: (path: string) => void;
  onOpenSettings: () => void;
  conversations: ConvInfo[];
  activeConvId: string | null;
  onNewConversation: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  agents: AgentInfo[];
  activeAgent: string;
  onAgentChange: (id: string) => void;
  onFileClick: (path: string) => void;
  onAgentInfoClick: () => void;
  onToggleSidebar: () => void;
}

function getDefaultWorkspaces(): { label: string; path: string }[] {
  const home = process.env.HOME || process.env.USERPROFILE || "/home/user";
  return [
    { label: "Desktop", path: `${home}/Desktop` },
    { label: "Documents", path: `${home}/Documents` },
    { label: "Downloads", path: `${home}/Downloads` },
    { label: "Home", path: home },
  ];
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.max(0, Math.floor(diff / 60_000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function Sidebar({
  workspace, onWorkspaceChange, onOpenSettings,
  conversations, activeConvId, onNewConversation, onSelectConversation, onDeleteConversation,
  agents, activeAgent, onAgentChange, onFileClick, onAgentInfoClick,
  onToggleSidebar,
}: Props) {
  const [customPath, setCustomPath] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [explorerOpen, setExplorerOpen] = useState(true);
  const [convOpen, setConvOpen] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<ConvInfo | null>(null);

  const defaultWorkspaces = useMemo(() => getDefaultWorkspaces(), []);
  const isDefault = defaultWorkspaces.some((w) => w.path === workspace);
  const folderName = workspace.split("/").filter(Boolean).pop() || workspace || "Select project";
  const options = useMemo(
    () => workspace && !isDefault
      ? [...defaultWorkspaces, { label: `→ ${folderName}`, path: workspace }]
      : defaultWorkspaces,
    [defaultWorkspaces, folderName, isDefault, workspace],
  );
  const agentNameById = useMemo(() => new Map(agents.map((a) => [a.id, a.name])), [agents]);

  return (
    <>
      {/* ── Agent Switcher ────────────────────────────────── */}
      <div className="px-2 py-2 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between mb-1.5 px-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
            Agents
          </span>
          <button
            onClick={onAgentInfoClick}
            className="text-[10px] px-1.5 py-0.5 rounded hover:opacity-70 transition-opacity"
            style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}
          >
            Info
          </button>
        </div>
        <div className="space-y-0.5">
          {agents.map((a) => {
            const isActive = a.id === activeAgent;
            return (
              <button
                key={a.id}
                onClick={() => onAgentChange(a.id)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-all"
                style={{
                  background: isActive ? "var(--bg-selected)" : "transparent",
                  color: isActive ? "var(--text)" : "var(--text-secondary)",
                  border: isActive ? "1px solid var(--border)" : "1px solid transparent",
                  fontSize: "var(--text-sm)",
                }}
              >
                <AgentIcon agentId={a.id} size={18} />
                <span className="flex-1 truncate font-medium">{a.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Explorer ──────────────────────────────────────── */}
      <div className="border-b shrink-0 px-2 py-2" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setExplorerOpen(!explorerOpen)}
            className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider hover:opacity-70 transition-opacity"
            style={{ color: "var(--text-tertiary)" }}
          >
            <span className="text-[8px]">{explorerOpen ? "▼" : "▶"}</span>
            Explorer
          </button>
          {workspace && (
            <span className="max-w-[120px] truncate text-[10px]" style={{ color: "var(--text-secondary)" }}>
              {folderName}
            </span>
          )}
        </div>
        {explorerOpen && (
          <div className="space-y-2">
            <div className="rounded-md p-2" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-[10px] font-medium" style={{ color: "var(--text-tertiary)" }}>
                  Current project
                </span>
                {workspace && (
                  <button
                    onClick={() => navigator.clipboard.writeText(workspace).catch(() => {})}
                    className="text-[10px] transition-opacity hover:opacity-70"
                    style={{ color: "oklch(68% 0.15 55)" }}
                  >
                    Copy path
                  </button>
                )}
              </div>
              <div className="mb-2 truncate text-sm font-medium" style={{ color: "var(--text)" }}>
                {folderName}
              </div>
              <div className="flex items-center gap-1">
                <select
                  value={workspace}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "__custom__") { setShowCustom(true); }
                    else if (val) { onWorkspaceChange(val); }
                  }}
                  className="flex-1 w-0 pl-2 pr-5 py-1.5 rounded-md cursor-pointer appearance-none truncate"
                  style={{
                    background: "var(--bg-panel)", color: "var(--text)",
                    border: "1px solid var(--border)", fontSize: "var(--text-xs)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  <option value="" disabled>Select workspace...</option>
                  {options.map((w) => (
                    <option key={w.path} value={w.path}>{w.label}</option>
                  ))}
                  <option value="__custom__">+ Custom path...</option>
                </select>
              </div>
              {showCustom && (
                <div className="mt-1.5 flex gap-1">
                  <input type="text" value={customPath} onChange={(e) => setCustomPath(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && customPath.trim()) { onWorkspaceChange(customPath.trim()); setShowCustom(false); setCustomPath(""); }
                      if (e.key === "Escape") { setShowCustom(false); setCustomPath(""); }
                    }}
                    placeholder="/path/to/folder"
                    className="flex-1 px-2 py-1 rounded-sm outline-none"
                    style={{
                      background: "var(--bg)", color: "var(--text)",
                      border: "1px solid var(--border)", fontSize: "var(--text-xs)",
                      fontFamily: "var(--font-mono)",
                    }}
                    spellCheck={false} autoFocus
                  />
                  <button onClick={() => { setShowCustom(false); setCustomPath(""); }}
                    className="px-2 py-1 text-xs" style={{ color: "var(--text-secondary)" }}>✕</button>
                </div>
              )}
            </div>
            {workspace ? (
              <div
                className="max-h-[34vh] overflow-y-auto rounded-md"
                style={{ background: "var(--bg)", border: "1px solid var(--border)" }}
              >
                <FileTree workspace={workspace} onNavigate={onWorkspaceChange} onFileClick={onFileClick} />
              </div>
            ) : (
              <div
                className="rounded-md px-3 py-4 text-center text-xs"
                style={{ background: "var(--bg)", border: "1px dashed var(--border)", color: "var(--text-tertiary)" }}
              >
                Choose a project to browse files
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Conversations ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-2 py-2 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => setConvOpen(!convOpen)}
              className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider hover:opacity-70 transition-opacity"
              style={{ color: "var(--text-tertiary)" }}
            >
              <span className="text-[8px]">{convOpen ? "▼" : "▶"}</span>
              Conversations
              <span className="rounded px-1 py-px font-normal" style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}>
                {conversations.length}
              </span>
            </button>
            <button
              onClick={onNewConversation}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium transition-opacity hover:opacity-80"
              style={{ color: "#fff", background: "var(--accent)" }}
            >
              <span className="text-[12px] leading-none">+</span>
              New
            </button>
          </div>
        </div>
        {convOpen && (
          <div className="flex-1 overflow-y-auto px-2 py-2 min-h-0">
            {conversations.length === 0 ? (
              <div
                className="rounded-md px-3 py-4 text-center"
                style={{ background: "var(--bg)", border: "1px dashed var(--border)", color: "var(--text-tertiary)" }}
              >
                <div className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  No chats in this project
                </div>
                <button
                  onClick={onNewConversation}
                  className="mt-3 rounded px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
                  style={{ color: "#fff", background: "var(--accent)" }}
                >
                  Start chat
                </button>
              </div>
            ) : (
              conversations.map((c) => (
                <div key={c.id} className="group flex items-start gap-1 py-0.5">
                  <button
                    onClick={() => onSelectConversation(c.id)}
                    className="flex-1 min-w-0 text-left px-2.5 py-2 rounded-md transition-colors"
                    style={{
                      color: "var(--text)",
                      background: c.id === activeConvId ? "var(--accent-dim)" : "transparent",
                      border: c.id === activeConvId ? "1px solid oklch(66% 0.19 252 / 0.25)" : "1px solid transparent",
                    }}
                  >
                    <span className="block truncate text-xs font-medium">{c.title}</span>
                    <span className="mt-1 flex items-center gap-1.5 text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                      <span className="truncate">{agentNameById.get(c.agentId) ?? c.agentId}</span>
                      <span>·</span>
                      <span className="shrink-0">{formatRelativeTime(c.createdAt)}</span>
                    </span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(c); }}
                    className="mt-1 shrink-0 px-1.5 py-1 rounded text-[13px] font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: "var(--error)" }}
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ── Footer ────────────────────────────────────────── */}
      <div className="p-2 border-t shrink-0 flex items-center gap-1" style={{ borderColor: "var(--border)" }}>
        <button onClick={onOpenSettings}
          className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors hover:opacity-70"
          style={{ color: "var(--text-secondary)" }} title="Settings">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          Settings
        </button>
        <button
          onClick={onToggleSidebar}
          className="p-1.5 rounded-md text-xs transition-colors hover:opacity-70"
          style={{ color: "var(--text-tertiary)" }}
          title="Close sidebar"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M9 3v18" />
          </svg>
        </button>
      </div>

      {/* ── Delete confirmation ──────────────────────────────── */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="rounded-lg p-6 shadow-xl max-w-sm mx-4 text-center slide-in-left"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm mb-3" style={{ color: "var(--text)" }}>
              Delete "<span className="font-semibold">{deleteTarget.title}</span>"?
            </p>
            <p className="text-[11px] mb-5" style={{ color: "var(--text-secondary)" }}>
              This cannot be undone.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-1.5 text-xs rounded-md transition-opacity hover:opacity-80"
                style={{ color: "var(--text)", border: "1px solid var(--border)" }}
              >
                Cancel
              </button>
              <button
                onClick={() => { onDeleteConversation(deleteTarget.id); setDeleteTarget(null); }}
                className="px-4 py-1.5 text-xs rounded-md transition-opacity hover:opacity-80"
                style={{ background: "var(--error)", color: "#fff" }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
