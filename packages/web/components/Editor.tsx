"use client";

import { useState, useEffect } from "react";

interface Props {
  filePath: string | null;
  workspace: string;
}

export function Editor({ filePath, workspace }: Props) {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!filePath) {
      setContent("");
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    fetch("/api/files?path=" + encodeURIComponent(filePath) + "&workspace=" + encodeURIComponent(workspace))
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setContent(data.content ?? "");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [filePath]);

  const handleSave = async () => {
    if (!filePath) return;
    setSaving(true);
    try {
      const r = await fetch("/api/files", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: filePath, content }),
      });
      const data = await r.json();
      if (data.error) setError(data.error);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // Infer language from extension
  const ext = filePath?.split(".").pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx",
    py: "python", rs: "rust", go: "go", java: "java",
    md: "markdown", mdx: "mdx", css: "css", html: "html",
    json: "json", yaml: "yaml", yml: "yaml", toml: "toml",
    sh: "bash", bash: "bash", zsh: "bash",
  };
  const language = langMap[ext ?? ""] ?? "";

  // Keyboard shortcut: Cmd+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [filePath, content]);

  if (!filePath) {
    return (
      <div className="flex-1 flex items-center justify-center"
        style={{ color: "var(--color-text-secondary)" }}>
        <div className="text-center">
          <div className="text-4xl mb-3">👋</div>
          <div className="text-sm">Select a file to edit</div>
          <div className="text-xs mt-1" style={{ opacity: 0.6 }}>
            or toggle Chat to ask the AI
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm"
        style={{ color: "var(--color-text-secondary)" }}>
        Loading...
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* File header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b text-xs shrink-0"
        style={{ borderColor: "var(--color-border)", background: "var(--color-surface-secondary)" }}>
        <div className="flex items-center gap-2">
          <span style={{ color: "var(--color-text-secondary)" }}>
            {filePath.split("/").pop()}
          </span>
          {language && (
            <span className="px-1.5 py-0.5 rounded text-[10px]"
              style={{ background: "var(--color-accent-dim)", color: "var(--color-accent)" }}>
              {language}
            </span>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-2 py-0.5 rounded text-xs transition-colors"
          style={{
            background: saving ? "var(--color-border)" : "var(--color-accent-dim)",
            color: saving ? "var(--color-text-secondary)" : "var(--color-accent)",
          }}
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="px-3 py-1.5 text-xs shrink-0"
          style={{ background: "oklch(0.55 0.2 30 / 0.1)", color: "oklch(0.55 0.2 30)" }}>
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {/* Editor area */}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="flex-1 w-full resize-none p-4 text-sm font-mono leading-relaxed outline-none"
        style={{
          background: "var(--color-surface)",
          color: "var(--color-text)",
          border: "none",
          tabSize: 2,
        }}
        spellCheck={false}
        placeholder="// Start typing..."
      />
    </div>
  );
}
