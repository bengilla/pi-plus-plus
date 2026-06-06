"use client";

import { useState, useEffect, useCallback } from "react";

interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
}

interface Props {
  workspace: string;
  onNavigate: (newWorkspace: string) => void;
}

export function FileTree({ workspace, onNavigate }: Props) {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedPath, setExpandedPath] = useState(false);
  const [copied, setCopied] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [newFileName, setNewFileName] = useState("");
  const [showNewFile, setShowNewFile] = useState(false);
  const [newItemType, setNewItemType] = useState<"file" | "folder">("file");

  const loadTree = useCallback(() => {
    if (!workspace) { setTree([]); return; }
    setError(null);
    fetch(`/api/files?path=.&workspace=${encodeURIComponent(workspace)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setTree(data.files ?? []);
      })
      .catch((e) => setError(e.message));
  }, [workspace]);

  useEffect(() => { loadTree(); }, [loadTree]);

  const segments = workspace.split("/").filter(Boolean);
  const goUp = () => {
    const parent = workspace.split("/").slice(0, -1).join("/") || "/";
    onNavigate(parent);
  };

  const startNewItem = (type: "file" | "folder") => {
    setNewItemType(type);
    setNewFileName("");
    setShowNewFile(true);
  };

  const handleCreate = async () => {
    const name = newFileName.trim();
    if (!name) { setShowNewFile(false); return; }
    try {
      if (newItemType === "folder") {
        await fetch("/api/files/new-dir", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspace, name }),
        });
      } else {
        await fetch("/api/files", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: name, content: "" }),
        });
      }
      loadTree();
    } catch { alert("Create failed"); }
    setNewFileName("");
    setShowNewFile(false);
  };

  const handleRenameStart = (node: FileNode) => {
    setRenaming(node.path);
    setRenameValue(node.name);
  };

  const handleRenameSubmit = async (oldPath: string) => {
    if (!renameValue.trim() || renameValue === oldPath.split("/").pop()) {
      setRenaming(null); return;
    }
    try {
      await fetch("/api/files/rename", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: oldPath, name: renameValue.trim() }),
      });
      loadTree();
    } catch { alert("Rename failed"); }
    setRenaming(null);
  };

  const handleDelete = async (node: FileNode) => {
    if (!confirm(`Delete "${node.name}"?`)) return;
    try {
      await fetch(`/api/files?path=${encodeURIComponent(node.path)}&workspace=${encodeURIComponent(workspace)}`, { method: "DELETE" });
      loadTree();
    } catch { alert("Delete failed"); }
  };

  if (error) {
    return <div className="p-3 text-xs" style={{ color: "var(--color-text-secondary)" }}>Error: {error}</div>;
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b text-[11px]"
        style={{ borderColor: "var(--color-border)", overflowX: expandedPath ? "auto" : "hidden" }}>
        <button onClick={goUp} className="shrink-0 px-1 rounded hover:opacity-70"
          style={{ color: "var(--color-text-secondary)" }}>←</button>
        <button onClick={() => setExpandedPath(!expandedPath)} className="text-xs text-left min-w-0 select-all"
          style={{ color: "var(--color-text)", cursor: "pointer", whiteSpace: expandedPath ? "nowrap" : "normal", flex: expandedPath ? "1 0 auto" : "0 1 auto", overflow: "hidden" }}>
          {expandedPath ? workspace : `${segments.length > 2 ? ".../" : ""}${segments[segments.length - 1] || workspace}`}
        </button>
        {!expandedPath && (
          <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(workspace); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="shrink-0 px-1.5 py-0.5 rounded text-[10px] transition-all ml-auto"
            style={{ color: "#fff", background: copied ? "oklch(0.55 0.15 160)" : "oklch(0.48 0.2 255)" }}>
            {copied ? "COPIED!" : "COPY"}
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b" style={{ borderColor: "var(--color-border)" }}>
        <button onClick={() => startNewItem("file")} className="flex-1 px-2 py-1.5 rounded text-xs hover:opacity-80"
          style={{ color: "#fff", background: "oklch(0.48 0.2 255)" }}>📄 New File</button>
        <button onClick={() => startNewItem("folder")} className="flex-1 px-2 py-1.5 rounded text-xs hover:opacity-80"
          style={{ color: "#fff", background: "oklch(0.48 0.2 255)" }}>📁 New Folder</button>
      </div>

      {/* New item input */}
      {showNewFile && (
        <div className="flex items-center gap-1 px-2 py-1 text-xs border-b" style={{ borderColor: "var(--color-border)" }}>
          <span className="shrink-0">{newItemType === "folder" ? "📁" : "📄"}</span>
          <input value={newFileName} onChange={(e) => setNewFileName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setShowNewFile(false); }}
            placeholder={newItemType === "folder" ? "folder-name" : "filename.ts"}
            className="flex-1 px-1.5 py-0.5 rounded outline-none text-xs"
            style={{ background: "var(--color-surface)", color: "var(--color-text)", border: "1px solid var(--color-accent)" }}
            autoFocus spellCheck={false} />
          <button onClick={handleCreate} className="px-2 py-0.5 rounded text-[10px]"
            style={{ background: "oklch(0.48 0.2 255)", color: "#fff" }}>Create</button>
        </div>
      )}

      {/* File/dir list */}
      <div className="py-1">
        {tree.map((node) => (
          renaming === node.path ? (
            <div key={node.path} className="flex items-center gap-2 px-2 py-1">
              <span className="shrink-0 text-xs">{node.type === "directory" ? "📁" : fileIcon(node.name)}</span>
              <input value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleRenameSubmit(node.path); if (e.key === "Escape") setRenaming(null); }}
                onBlur={() => handleRenameSubmit(node.path)}
                className="flex-1 px-1 py-0 rounded outline-none text-xs"
                style={{ background: "var(--color-surface)", color: "var(--color-text)", border: "1px solid var(--color-accent)" }}
                autoFocus spellCheck={false} />
            </div>
          ) : (
            <div key={node.path} className="group flex items-center gap-0.5 px-1 py-0.5">
              <button onClick={() => { if (node.type === "directory") onNavigate(workspace.replace(/\/$/, "") + "/" + node.name); }}
                className="flex-1 text-left flex items-center gap-2 px-1 py-0.5 text-xs rounded-sm hover:opacity-80 min-w-0"
                style={{ color: node.type === "directory" ? "var(--color-text)" : "var(--color-text-secondary)" }}>
                <span className="shrink-0">{node.type === "directory" ? "📁" : fileIcon(node.name)}</span>
                <span className="truncate">{node.name}</span>
                {node.type === "directory" && <span className="ml-auto text-[10px]" style={{ color: "var(--color-text-secondary)", opacity: 0.4 }}>›</span>}
              </button>
              <button onClick={() => handleRenameStart(node)}
                className="shrink-0 px-1 py-0.5 rounded text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: "var(--color-text-secondary)" }} title="Rename">✏️</button>
              <button onClick={() => handleDelete(node)}
                className="shrink-0 px-1 py-0.5 rounded text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: "oklch(0.55 0.2 30)" }} title="Delete">🗑</button>
            </div>
          )
        ))}
        {tree.length === 0 && !showNewFile && (
          <div className="px-3 py-4 text-xs text-center" style={{ color: "var(--color-text-secondary)" }}>Empty folder</div>
        )}
      </div>
    </div>
  );
}

function fileIcon(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    md: "📝", mdx: "📝", ts: "🟦", tsx: "⚛️", js: "🟨", jsx: "⚛️",
    css: "🎨", json: "📋", yaml: "📋", yml: "📋", html: "🌐",
    py: "🐍", rs: "🦀", go: "🔷", java: "☕",
    png: "🖼️", jpg: "🖼️", jpeg: "🖼️", gif: "🖼️", svg: "🖼️", pdf: "📄",
    gitignore: "⚙️", env: "🔒",
  };
  return map[ext ?? ""] ?? "📄";
}
