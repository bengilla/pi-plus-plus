"use client";

import { useState, useEffect } from "react";
import type { ReactNode } from "react";

interface AgentInfo {
  id: string;
  name: string;
  description: string;
  version?: string;
}

interface Props {
  view: "file" | "agent" | null;
  filePath: string | null;
  agent?: AgentInfo;
  workspace: string;
  onClose: () => void;
}

function InspectorCard({ children }: { children: ReactNode }) {
  return (
    <div
      className="rounded-md p-3"
      style={{ background: "var(--bg)", border: "1px solid var(--border)" }}
    >
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
      {children}
    </span>
  );
}

export function RightPanel({ view, filePath, agent, workspace, onClose }: Props) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (view !== "file" || !filePath) {
      setContent(null);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`/api/files?path=${encodeURIComponent(filePath)}&workspace=${encodeURIComponent(workspace)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setContent(data.content ?? "");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [view, filePath, workspace]);

  const fileName = filePath?.split("/").pop() ?? "";
  const relativeFilePath = filePath && workspace
    ? filePath.replace(workspace.replace(/\/$/, "") + "/", "")
    : filePath;

  return (
    <div className="flex flex-col h-full min-h-0" style={{ background: "var(--bg-elevated)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-[54px] border-b shrink-0"
        style={{ borderColor: "var(--border)", background: "var(--bg-panel)" }}>
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
            Inspector
          </div>
          <div className="truncate text-sm font-medium" style={{ color: "var(--text)" }}>
            {view === "file" && filePath
              ? fileName
              : view === "agent" && agent
              ? agent.name
              : "Details"}
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:opacity-70 transition-opacity"
          style={{ color: "var(--text-secondary)" }}
          title="Close panel"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto min-h-0 p-3">
        {/* Empty state */}
        {!view && (
          <div className="flex items-center justify-center h-full">
            <div
              className="w-full rounded-md px-4 py-8 text-center"
              style={{ background: "var(--bg)", border: "1px dashed var(--border)" }}
            >
              <div className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                No selection
              </div>
            </div>
          </div>
        )}

        {/* File Preview */}
        {view === "file" && (
          <div className="space-y-3">
            {loading && (
              <div className="text-xs" style={{ color: "var(--text-secondary)" }}>Loading...</div>
            )}
            {error && (
              <div className="text-xs" style={{ color: "var(--error)" }}>Error: {error}</div>
            )}
            {!loading && !error && content !== null && (
              <>
                <InspectorCard>
                  <SectionLabel>File</SectionLabel>
                  <div className="mt-1 truncate text-sm font-medium" style={{ color: "var(--text)" }}>
                    {fileName}
                  </div>
                  {relativeFilePath && (
                    <div className="mt-1 break-all text-[11px]" style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                      {relativeFilePath}
                    </div>
                  )}
                </InspectorCard>
                <div className="flex items-center justify-between">
                  <SectionLabel>Contents</SectionLabel>
                  <button
                    onClick={() => navigator.clipboard.writeText(content).catch(() => {})}
                    className="text-[10px] px-2 py-0.5 rounded hover:opacity-70 transition-opacity"
                    style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                  >
                    📋 Copy
                  </button>
                </div>
                <pre
                  className="p-3 rounded-md overflow-x-auto text-xs leading-relaxed"
                  style={{
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                    fontFamily: "var(--font-mono)",
                    color: "var(--text)",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {content}
                </pre>
              </>
            )}
          </div>
        )}

        {/* Agent Info */}
        {view === "agent" && agent && (
          <div className="space-y-3">
            <InspectorCard>
              <SectionLabel>Agent</SectionLabel>
              <p className="text-sm font-medium mt-1" style={{ color: "var(--text)" }}>{agent.name}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{agent.description}</p>
            </InspectorCard>

            {agent.version && (
              <InspectorCard>
                <SectionLabel>Version</SectionLabel>
                <p className="text-xs mt-1" style={{ fontFamily: "var(--font-mono)", color: "var(--text)" }}>{agent.version}</p>
              </InspectorCard>
            )}

            <InspectorCard>
              <SectionLabel>ID</SectionLabel>
              <p className="text-xs mt-1" style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>{agent.id}</p>
            </InspectorCard>
          </div>
        )}
      </div>
    </div>
  );
}
