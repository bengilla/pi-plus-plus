"use client";

import { useState, useEffect, useCallback } from "react";
import { AppIcon, FileTypeIcon } from "./AppIcon";

interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
}

interface Props {
  workspace: string;
  onNavigate: (newWorkspace: string) => void;
  onFileClick?: (filePath: string) => void;
  language?: "en" | "zh";
}

export function FileTree({ workspace, onNavigate, onFileClick, language = "en" }: Props) {
  const zh = language === "zh";
  const [tree, setTree] = useState<FileNode[]>([]);
  const [error, setError] = useState<string | null>(null);
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

  // Auto-refresh file tree every 5s to pick up agent-created files
  useEffect(() => {
    const timer = setInterval(loadTree, 5000);
    return () => clearInterval(timer);
  }, [loadTree]);

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
        await fetch(`/api/files?workspace=${encodeURIComponent(workspace)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: name, content: "" }),
        });
      }
      loadTree();
    } catch { alert(zh ? "创建失败" : "Create failed"); }
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
      await fetch(`/api/files/rename?workspace=${encodeURIComponent(workspace)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: oldPath, name: renameValue.trim() }),
      });
      loadTree();
    } catch { alert(zh ? "重命名失败" : "Rename failed"); }
    setRenaming(null);
  };

  const handleDelete = async (node: FileNode) => {
    if (!confirm(zh ? `删除 "${node.name}"？` : `Delete "${node.name}"?`)) return;
    try {
      await fetch(`/api/files?path=${encodeURIComponent(node.path)}&workspace=${encodeURIComponent(workspace)}`, { method: "DELETE" });
      loadTree();
    } catch { alert(zh ? "删除失败" : "Delete failed"); }
  };

  if (error) {
    return <div className="p-3 text-xs" style={{ color: "var(--color-text-secondary)" }}>Error: {error}</div>;
  }

  return (
    <div className="flex flex-col">
      {/* File/dir list — scrollable */}
      <div className="overflow-y-auto" style={{ maxHeight: "28vh" }}>
        {tree.map((node) => (
          renaming === node.path ? (
            <div key={node.path} className="flex items-center gap-2 px-2 py-1">
              <FileTypeIcon name={node.name} type={node.type} size={16} />
              <input value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleRenameSubmit(node.path); if (e.key === "Escape") setRenaming(null); }}
                onBlur={() => handleRenameSubmit(node.path)}
                className="flex-1 px-1 py-0 outline-none text-xs"
                style={{ background: "var(--color-surface)", color: "var(--color-text)", border: "1px solid var(--color-accent)" }}
                autoFocus spellCheck={false} />
            </div>
          ) : (
            <div key={node.path} className="group flex items-center gap-0.5 px-1 py-0.5">
              <button onClick={() => { if (node.type === "directory") onNavigate(workspace.replace(/\/$/, "") + "/" + node.name); else onFileClick?.(workspace.replace(/\/$/, "") + "/" + node.name); }}
                className="flex-1 text-left flex items-center gap-2 px-1 py-0.5 text-xs hover:opacity-80 min-w-0"
                style={{ color: node.type === "directory" ? "var(--color-text)" : "var(--color-text-secondary)" }}>
                <FileTypeIcon name={node.name} type={node.type} size={16} />
                <span className="truncate">{node.name}</span>
                {node.type === "directory" && (
                  <span className="ml-auto inline-flex" style={{ color: "var(--color-text-secondary)", opacity: 0.45 }}>
                    <AppIcon name="chevron-right" size={12} />
                  </span>
                )}
              </button>
              <button onClick={() => handleRenameStart(node)}
                className="shrink-0 inline-flex h-5 w-5 items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--bg-hover)]"
                style={{ color: "var(--color-text-secondary)" }} title={zh ? "重命名" : "Rename"} aria-label={zh ? "重命名" : "Rename"}>
                <AppIcon name="edit" size={12} />
              </button>
              <button onClick={() => handleDelete(node)}
                className="shrink-0 inline-flex h-5 w-5 items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--bg-hover)]"
                style={{ color: "oklch(0.55 0.2 30)" }} title={zh ? "删除" : "Delete"} aria-label={zh ? "删除" : "Delete"}>
                <AppIcon name="trash" size={12} />
              </button>
            </div>
          )
        ))}
        {tree.length === 0 && !showNewFile && (
          <div className="px-3 py-4 text-xs text-center" style={{ color: "var(--color-text-secondary)" }}>{zh ? "空文件夹" : "Empty folder"}</div>
        )}
      </div>

      {/* New item input */}
      {showNewFile && (
        <div className="flex items-center gap-1 px-2 py-1 text-xs" style={{ borderTop: "1px solid var(--color-border)" }}>
          <FileTypeIcon name={newFileName || (newItemType === "folder" ? "folder" : "file")} type={newItemType === "folder" ? "directory" : "file"} size={16} />
          <input value={newFileName} onChange={(e) => setNewFileName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setShowNewFile(false); }}
            placeholder={newItemType === "folder" ? "folder-name" : "filename.ts"}
            className="flex-1 px-1.5 py-0.5 outline-none text-xs"
            style={{ background: "var(--color-surface)", color: "var(--color-text)", border: "1px solid var(--color-accent)" }}
            autoFocus spellCheck={false} />
          <button onClick={handleCreate} className="inline-flex h-6 w-6 items-center justify-center"
            style={{ color: "var(--accent)", background: "transparent", border: "1px solid var(--accent)" }} title={zh ? "创建" : "Create"} aria-label={zh ? "创建" : "Create"}>
            <AppIcon name="check" size={13} />
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5" style={{ borderTop: "1px solid var(--color-border)" }}>
        <button onClick={() => startNewItem("file")} className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs hover:opacity-80"
          style={{ color: "var(--accent)", background: "transparent", border: "1px solid var(--accent)" }}>
          <AppIcon name="file" size={13} />{zh ? "新文件" : "New"}
        </button>
        <button onClick={() => startNewItem("folder")} className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs hover:opacity-80"
          style={{ color: "var(--accent)", background: "transparent", border: "1px solid var(--accent)" }}>
          <AppIcon name="folder" size={13} />{zh ? "新文件夹" : "Folder"}
        </button>
      </div>
    </div>
  );
}
