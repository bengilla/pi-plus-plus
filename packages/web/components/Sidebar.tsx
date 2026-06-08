"use client";

import { useState } from "react";
import { FileTree } from "./FileTree";

export interface ConvInfo {
  id: string;
  title: string;
  agentId: string;
  createdAt: number;
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
}

// Default workspaces derived from HOME — server resolves ~ on API calls
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
    <aside
      className="w-72 shrink-0 border-r flex flex-col overflow-hidden min-h-0"
      style={{ borderColor: "var(--color-border)", background: "var(--color-surface-secondary)" }}
    >
      {/* Workspace dropdown */}
      <div className="px-4 py-2 border-b" style={{ borderColor: "var(--color-border)" }}>
        <div className="flex items-center gap-1.5">
          <select
            value={workspace}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "__custom__") { setShowCustom(true); }
              else if (val) { onWorkspaceChange(val); }
            }}
            className="flex-1 w-0 pl-2 pr-6 py-1 text-xs rounded-md cursor-pointer appearance-none truncate"
            style={{ background: "var(--color-surface)", color: "var(--color-text)", border: "1px solid var(--color-border)" }}
          >
            <option value="" disabled>Select workspace...</option>
            {options.map((w) => (
              <option key={w.path} value={w.path}>{w.label}</option>
            ))}
            <option value="__custom__">+ Custom path...</option>
          </select>
          <svg className="pointer-events-none -ml-5" width="10" height="6" viewBox="0 0 10 6" fill="none">
            <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ color: "var(--color-text-secondary)" }} />
          </svg>
        </div>
        {showCustom && (
          <div className="mt-1.5 flex gap-1">
            <input type="text" value={customPath} onChange={(e) => setCustomPath(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && customPath.trim()) { onWorkspaceChange(customPath.trim()); setShowCustom(false); setCustomPath(""); } if (e.key === "Escape") { setShowCustom(false); setCustomPath(""); } }}
              placeholder="/path/to/folder"
              className="flex-1 px-2 py-1 text-xs rounded-sm outline-none"
              style={{ background: "var(--color-surface)", color: "var(--color-text)", border: "1px solid var(--color-border)" }}
              spellCheck={false} autoFocus />
            <button onClick={() => { setShowCustom(false); setCustomPath(""); }}
              className="px-2 py-1 text-xs" style={{ color: "var(--color-text-secondary)" }}>✕</button>
          </div>
        )}
      </div>

      {/* Explorer section */}
      <div className="border-b" style={{ borderColor: "var(--color-border)" }}>
        <button
          onClick={() => setExplorerOpen(!explorerOpen)}
          className="w-full flex items-center justify-between px-3 py-1 text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--color-text-secondary)" }}
        >
          {explorerOpen ? "▾" : "▸"} Explorer
        </button>
        {explorerOpen && (
          <div className="max-h-72 overflow-auto">
            <FileTree workspace={workspace} onNavigate={onWorkspaceChange} />
          </div>
        )}
      </div>

      {/* Conversations section */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between px-3 py-1 border-b shrink-0" style={{ borderColor: "var(--color-border)" }}>
          <button
            onClick={() => setConvOpen(!convOpen)}
            className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {convOpen ? "▾" : "▸"} Conversations
          </button>
          <button
            onClick={onNewConversation}
            className="px-2 py-0.5 rounded text-[10px] hover:opacity-80"
            style={{ color: "#fff", background: "oklch(0.48 0.2 255)" }}
          >
            NEW
          </button>
        </div>
        {convOpen && (
          <div className="flex-1 overflow-y-auto py-1 min-h-0">
            {conversations.length === 0 ? (
              <div className="px-3 py-4 text-[10px] text-center" style={{ color: "var(--color-text-secondary)" }}>
                No conversations yet
              </div>
            ) : (
              conversations.map((c) => (
                <div key={c.id} className="group flex items-center gap-0.5 px-1 py-0.5">
                  <button
                    onClick={() => onSelectConversation(c.id)}
                    className="flex-1 text-left px-2 py-1 rounded text-xs truncate hover:opacity-80"
                    style={{
                      color: c.id === activeConvId ? "var(--color-accent)" : "var(--color-text)",
                      background: c.id === activeConvId ? "var(--color-accent-dim)" : "transparent",
                    }}
                  >
                    💬 {c.title}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(c); }}
                    className="shrink-0 px-1 py-0.5 rounded text-[14px] font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: "oklch(0.55 0.22 20)" }}
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

      {/* Bottom bar — settings */}
      <div className="p-2 border-t shrink-0" style={{ borderColor: "var(--color-border)" }}>
        <button onClick={onOpenSettings}
          className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-md transition-colors hover:opacity-80"
          style={{ color: "var(--color-text-secondary)" }} title="Settings">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          Settings
        </button>
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="rounded-lg p-6 shadow-xl max-w-sm mx-4 text-center"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm mb-3" style={{ color: "var(--color-text)" }}>
              Delete "<span className="font-semibold">{deleteTarget.title}</span>"?
            </p>
            <p className="text-[11px] mb-5" style={{ color: "var(--color-text-secondary)" }}>
              This cannot be undone.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-1.5 text-xs rounded-md transition-opacity hover:opacity-80"
                style={{ color: "var(--color-text)", border: "1px solid var(--color-border)" }}
              >
                Cancel
              </button>
              <button
                onClick={() => { onDeleteConversation(deleteTarget.id); setDeleteTarget(null); }}
                className="px-4 py-1.5 text-xs rounded-md transition-opacity hover:opacity-80"
                style={{ background: "oklch(0.55 0.22 20)", color: "#fff" }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
