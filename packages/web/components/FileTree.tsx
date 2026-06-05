"use client";

import { useState, useEffect } from "react";

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

  useEffect(() => {
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

  // Breadcrumb — split workspace path into segments
  const segments = workspace.split("/").filter(Boolean);

  const goToIndex = (idx: number) => {
    const newPath = "/" + segments.slice(0, idx + 1).join("/");
    onNavigate(newPath);
  };

  // Go up one level
  const goUp = () => {
    const parent = workspace.split("/").slice(0, -1).join("/") || "/";
    onNavigate(parent);
  };

  if (error) {
    return <div className="p-3 text-xs" style={{ color: "var(--color-text-secondary)" }}>Error: {error}</div>;
  }

  return (
    <div>
      {/* Breadcrumb navigation */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b text-[11px] overflow-x-auto"
        style={{ borderColor: "var(--color-border)" }}>
        {/* Back button */}
        <button
          onClick={goUp}
          className="shrink-0 px-1 rounded hover:opacity-70"
          style={{ color: "var(--color-text-secondary)" }}
          title="Go up"
        >
          ←
        </button>
        {/* Path segments */}
        <span className="shrink-0 text-xs" style={{ color: "var(--color-text-secondary)" }}>/</span>
        {segments.map((seg, i) => (
          <span key={i} className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={() => goToIndex(i)}
              className="px-0.5 rounded hover:underline truncate max-w-24"
              style={{ color: i === segments.length - 1 ? "var(--color-text)" : "var(--color-text-secondary)" }}
            >
              {seg}
            </button>
            {i < segments.length - 1 && (
              <span style={{ color: "var(--color-text-secondary)" }}>/</span>
            )}
          </span>
        ))}
      </div>

      {/* File/dir list — directories first, then files */}
      <div className="py-1">
        {tree.map((node) => (
          <button
            key={node.path}
            onClick={() => {
              if (node.type === "directory") {
                // Build absolute path: workspace dir + node name
                const absPath = workspace.replace(/\/$/, "") + "/" + node.name;
                onNavigate(absPath);
              }
            }}
            className="w-full text-left flex items-center gap-2 px-2 py-1 text-xs transition-colors rounded-sm hover:opacity-80"
            style={{
              color: node.type === "directory" ? "var(--color-text)" : "var(--color-text-secondary)",
            }}
          >
            <span className="shrink-0">
              {node.type === "directory" ? "📁" : fileIcon(node.name)}
            </span>
            <span className="truncate">{node.name}</span>
            {node.type === "directory" && (
              <span className="ml-auto text-[10px]" style={{ color: "var(--color-text-secondary)", opacity: 0.4 }}>
                ›
              </span>
            )}
          </button>
        ))}
        {tree.length === 0 && (
          <div className="px-3 py-4 text-xs text-center" style={{ color: "var(--color-text-secondary)" }}>
            Empty folder
          </div>
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
