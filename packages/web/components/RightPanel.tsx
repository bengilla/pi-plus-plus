"use client";

import { useState, useEffect } from "react";

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

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-[42px] border-b shrink-0"
        style={{ borderColor: "var(--border)" }}>
        <span className="text-xs font-medium truncate" style={{ color: "var(--text)" }}>
          {view === "file" && filePath
            ? `📄 ${filePath.split("/").pop()}`
            : view === "agent" && agent
            ? `🤖 ${agent.name}`
            : "Details"}
        </span>
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
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Empty state */}
        {!view && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center px-4">
              <div className="text-3xl mb-3">📋</div>
              <div className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                Select a file or agent for details
              </div>
            </div>
          </div>
        )}

        {/* File Preview */}
        {view === "file" && (
          <div className="p-3">
            {loading && (
              <div className="text-xs" style={{ color: "var(--text-secondary)" }}>Loading...</div>
            )}
            {error && (
              <div className="text-xs" style={{ color: "var(--error)" }}>Error: {error}</div>
            )}
            {!loading && !error && content !== null && (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                    Preview
                  </span>
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
          <div className="p-3 space-y-4">
            <div>
              <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                Agent
              </span>
              <p className="text-sm font-medium mt-1" style={{ color: "var(--text)" }}>{agent.name}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{agent.description}</p>
            </div>

            {agent.version && (
              <div>
                <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                  Version
                </span>
                <p className="text-xs mt-1" style={{ fontFamily: "var(--font-mono)", color: "var(--text)" }}>{agent.version}</p>
              </div>
            )}

            <div>
              <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                ID
              </span>
              <p className="text-xs mt-1" style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>{agent.id}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
