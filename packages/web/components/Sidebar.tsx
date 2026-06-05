"use client";

import { useState } from "react";
import { FileTree } from "./FileTree";

interface Props {
  workspace: string;
  onWorkspaceChange: (path: string) => void;
}

const DEFAULT_WORKSPACES = [
  { label: "Desktop", path: "/Users/bengilla/Desktop" },
  { label: "Documents", path: "/Users/bengilla/Documents" },
  { label: "Downloads", path: "/Users/bengilla/Downloads" },
  { label: "Home", path: "/Users/bengilla" },
];

export function Sidebar({ workspace, onWorkspaceChange }: Props) {
  const [customPath, setCustomPath] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  const isDefault = DEFAULT_WORKSPACES.some((w) => w.path === workspace);
  const folderName = workspace.split("/").filter(Boolean).pop() || workspace;
  const options = workspace && !isDefault
    ? [...DEFAULT_WORKSPACES, { label: `→ ${folderName}`, path: workspace }]
    : DEFAULT_WORKSPACES;

  return (
    <aside
      className="w-72 shrink-0 border-r flex flex-col"
      style={{ borderColor: "var(--color-border)", background: "var(--color-surface-secondary)" }}
    >
      {/* Workspace dropdown */}
      <div className="p-2 border-b" style={{ borderColor: "var(--color-border)" }}>
        <div className="flex items-center gap-1.5">
          <select
            value={workspace}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "__custom__") { setShowCustom(true); }
              else if (val) { onWorkspaceChange(val); }
            }}
            className="flex-1 w-0 pl-2 pr-6 py-1.5 text-xs rounded-md cursor-pointer appearance-none truncate"
            style={{
              background: "var(--color-surface)",
              color: "var(--color-text)",
              border: "1px solid var(--color-border)",
            }}
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
            <input
              type="text" value={customPath}
              onChange={(e) => setCustomPath(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && customPath.trim()) {
                  onWorkspaceChange(customPath.trim());
                  setShowCustom(false); setCustomPath("");
                }
                if (e.key === "Escape") { setShowCustom(false); setCustomPath(""); }
              }}
              placeholder="/path/to/folder"
              className="flex-1 px-2 py-1 text-xs rounded-sm outline-none"
              style={{ background: "var(--color-surface)", color: "var(--color-text)", border: "1px solid var(--color-border)" }}
              spellCheck={false} autoFocus
            />
            <button onClick={() => { setShowCustom(false); setCustomPath(""); }}
              className="px-2 py-1 text-xs" style={{ color: "var(--color-text-secondary)" }}>✕</button>
          </div>
        )}
      </div>

      {/* File tree — clicking a folder navigates into it */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <FileTree workspace={workspace} onNavigate={onWorkspaceChange} />
      </div>
    </aside>
  );
}
