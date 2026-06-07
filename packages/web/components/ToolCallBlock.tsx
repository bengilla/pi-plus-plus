"use client";

import { useState } from "react";

interface Props {
  toolName: string;
  toolInput: Record<string, unknown>;
  status: "running" | "completed" | "error";
  result?: string;
}

function formatJson(obj: Record<string, unknown>): string {
  // Filter out internal __partial key
  const cleaned = { ...obj };
  delete cleaned.__partial;
  try {
    return JSON.stringify(cleaned, null, 2);
  } catch {
    return String(obj);
  }
}

const TOOL_ICONS: Record<string, string> = {
  Read: "📖",
  Write: "✏️",
  Edit: "✂️",
  Bash: "💻",
  Grep: "🔍",
  Glob: "📁",
  WebSearch: "🌐",
  WebFetch: "📄",
  Task: "📋",
};

export function ToolCallBlock({ toolName, toolInput, status, result }: Props) {
  const [expanded, setExpanded] = useState(status === "running");
  const icon = TOOL_ICONS[toolName] ?? "🔧";

  return (
    <div
      className="my-2 rounded-md overflow-hidden"
      style={{ border: "1px solid var(--color-border)" }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] font-medium cursor-pointer hover:opacity-80 transition-opacity"
        style={{
          background: "var(--color-surface-secondary)",
          color: "var(--color-text-secondary)",
        }}
      >
        <span className="text-[10px]">{expanded ? "▾" : "▸"}</span>
        <span>{icon}</span>
        <span>{toolName}</span>
        <span
          className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full"
          style={{
            background:
              status === "running"
                ? "oklch(0.68 0.21 250 / 0.15)"
                : status === "error"
                  ? "oklch(0.55 0.2 30 / 0.15)"
                  : "oklch(0.55 0.15 155 / 0.15)",
            color:
              status === "running"
                ? "var(--color-accent)"
                : status === "error"
                  ? "oklch(0.55 0.2 30)"
                  : "oklch(0.55 0.15 155)",
          }}
        >
          {status === "running" ? "running…" : status === "error" ? "error" : "done"}
        </span>
      </button>
      {expanded && (
        <div
          className="px-3 py-2 text-[12px] overflow-auto"
          style={{
            fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
            color: "var(--color-text-secondary)",
            maxHeight: "12rem",
            background: "var(--color-surface)",
          }}
        >
          <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {formatJson(toolInput)}
          </pre>
          {result != null && (
            <div className="mt-2 pt-2" style={{ borderTop: "1px solid var(--color-border)" }}>
              <div className="text-[10px] mb-1" style={{ opacity: 0.6 }}>
                Result:
              </div>
              <pre
                style={{
                  margin: 0,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  maxHeight: "6rem",
                  overflowY: "auto",
                }}
              >
                {result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
