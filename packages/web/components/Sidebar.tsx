"use client";

import { useState } from "react";
import { FileTree } from "./FileTree";

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

  const defaultWorkspaces = getDefaultWorkspaces();
  const isDefault = defaultWorkspaces.some((w) => w.path === workspace);
  const folderName = workspace.split("/").filter(Boolean).pop() || workspace;
  const options = workspace && !isDefault
    ? [...defaultWorkspaces, { label: `→ ${folderName}`, path: workspace }]
    : defaultWorkspaces;

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
            const m = a.version?.match(/(\d+\.\d+\.\d+)/);
            const ver = m ? m[1] : "";
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
                <span className="shrink-0 text-base">
                  {a.id === "claude-code" ? "🧠" : a.id === "codex" ? "🔮" : a.id === "pi" ? "⚡" : a.id === "openclaw" ? "🦞" : a.id === "hermes" ? "🕊️" : "🤖"}
                </span>
                <span className="flex-1 truncate font-medium">{a.name}</span>
                {ver && (
                  <span className="text-[10px] opacity-50 shrink-0" style={{ fontFamily: "var(--font-mono)" }}>{ver}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Explorer ──────────────────────────────────────── */}
      <div className="border-b shrink-0" style={{ borderColor: "var(--border)" }}>
        <button
          onClick={() => setExplorerOpen(!explorerOpen)}
          className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider hover:opacity-70 transition-opacity"
          style={{ color: "var(--text-tertiary)" }}
        >
          <span className="text-[8px]">{explorerOpen ? "▼" : "▶"}</span>
          Explorer
        </button>
        {explorerOpen && (
          <>
            <div className="px-3 pb-2">
              <div className="flex items-center gap-1">
                <select
                  value={workspace}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "__custom__") { setShowCustom(true); }
                    else if (val) { onWorkspaceChange(val); }
                  }}
                  className="flex-1 w-0 pl-2 pr-5 py-1 rounded-md cursor-pointer appearance-none truncate"
                  style={{
                    background: "var(--bg)", color: "var(--text)",
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
            <div className="max-h-64 overflow-y-auto px-1">
              <FileTree workspace={workspace} onNavigate={onWorkspaceChange} onFileClick={onFileClick} />
            </div>
          </>
        )}
      </div>

      {/* ── Conversations ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between px-3 py-1.5 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
          <button
            onClick={() => setConvOpen(!convOpen)}
            className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider hover:opacity-70 transition-opacity"
            style={{ color: "var(--text-tertiary)" }}
          >
            <span className="text-[8px]">{convOpen ? "▼" : "▶"}</span>
            Conversations
          </button>
          <button
            onClick={onNewConversation}
            className="px-2 py-0.5 rounded text-[10px] font-medium transition-opacity hover:opacity-80"
            style={{ color: "#fff", background: "var(--accent)" }}
          >
            NEW
          </button>
        </div>
        {convOpen && (
          <div className="flex-1 overflow-y-auto py-1 min-h-0">
            {conversations.length === 0 ? (
              <div className="px-3 py-4 text-[10px] text-center" style={{ color: "var(--text-tertiary)" }}>
                No conversations yet
              </div>
            ) : (
              conversations.map((c) => (
                <div key={c.id} className="group flex items-center gap-0.5 px-1.5 py-0.5">
                  <button
                    onClick={() => onSelectConversation(c.id)}
                    className="flex-1 text-left px-2 py-1 rounded text-xs truncate transition-colors"
                    style={{
                      color: c.id === activeConvId ? "var(--accent)" : "var(--text)",
                      background: c.id === activeConvId ? "var(--accent-dim)" : "transparent",
                    }}
                  >
                    {c.title}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(c); }}
                    className="shrink-0 px-1 py-0.5 rounded text-[14px] font-bold opacity-0 group-hover:opacity-100 transition-opacity"
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
