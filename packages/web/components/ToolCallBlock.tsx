"use client";

import { useState, useEffect, memo } from "react";

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
  if (Object.keys(cleaned).length === 0 && obj.__partial != null) {
    return String(obj.__partial);
  }
  try {
    return JSON.stringify(cleaned, null, 2);
  } catch {
    return String(obj);
  }
}

const TOOL_META: Record<string, { label: string; accent: string }> = {
  bash: { label: "Bash", accent: "oklch(66% 0.15 145)" },
  shell: { label: "Shell", accent: "oklch(66% 0.15 145)" },
  read: { label: "Read", accent: "oklch(68% 0.14 252)" },
  write: { label: "Write", accent: "oklch(72% 0.15 65)" },
  edit: { label: "Edit", accent: "oklch(70% 0.16 25)" },
  grep: { label: "Search", accent: "oklch(70% 0.13 295)" },
  glob: { label: "Find files", accent: "oklch(70% 0.13 295)" },
  websearch: { label: "Web search", accent: "oklch(68% 0.13 210)" },
  webfetch: { label: "Web fetch", accent: "oklch(68% 0.13 210)" },
  task: { label: "Task", accent: "oklch(70% 0.1 80)" },
  ls: { label: "List", accent: "oklch(68% 0.12 290)" },
  todo_write: { label: "Todo", accent: "oklch(65% 0.12 85)" },
};

const MUTED_TEXT = "oklch(75% 0 0)";

function toolKey(toolName: string): string {
  return toolName.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function actionSummary(toolName: string, input: Record<string, unknown>): string {
  const key = toolKey(toolName);
  const command = asText(input.command) ?? asText(input.cmd) ?? asText(input.script);
  const path = asText(input.path) ?? asText(input.file_path) ?? asText(input.filePath) ?? asText(input.filename);
  const pattern = asText(input.pattern) ?? asText(input.query);
  const description = asText(input.description) ?? asText(input.prompt);
  const partial = asText(input.__partial);

  if ((key === "bash" || key === "shell") && command) return command;
  if ((key === "read" || key === "write" || key === "edit") && path) return path;
  if ((key === "grep" || key === "glob" || key === "websearch" || key === "webfetch") && pattern) return pattern;
  if (description) return description;
  if (partial) return "building arguments";
  return "running action";
}

export const ToolCallBlock = memo(function ToolCallBlock({ toolName, toolInput, status, result }: Props) {
  const [expanded, setExpanded] = useState(status === "running");
  const key = toolKey(toolName);
  const meta = TOOL_META[key] ?? { label: toolName || "Action", accent: "var(--color-accent)" };
  const summary = actionSummary(toolName, toolInput);

  // Preview line for collapsed state
  const preview = result?.trim()
    ? result.trim().split("\n")[0].slice(0, 80)
    : null;

  // Auto-expand when running, auto-collapse when done (after brief delay)
  useEffect(() => {
    if (status === "running") {
      setExpanded(true);
    } else if (status === "completed" || status === "error") {
      const t = setTimeout(() => setExpanded(false), 1200);
      return () => clearTimeout(t);
    }
  }, [status]);

  return (
    <div
      className="my-2 overflow-hidden"
      style={{
        border: "1px solid var(--color-border)",
        background: "var(--color-surface)",
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left transition-opacity hover:opacity-85"
        style={{
          background: "var(--color-surface-secondary)",
          color: MUTED_TEXT,
        }}
      >
        <span className="text-[10px]" style={{ color: MUTED_TEXT }}>{expanded ? "▾" : "▸"}</span>
        <span
          className="h-2 w-2 shrink-0"
          style={{
            background: status === "running" ? meta.accent : "transparent",
            border: `1px solid ${meta.accent}`,
            boxShadow: status === "running" ? `0 0 0 3px color-mix(in oklch, ${meta.accent} 18%, transparent)` : "none",
          }}
        />
        <span className="shrink-0 text-[11px] font-semibold">{meta.label}</span>
        {status === "running" ? (
          <span className="shrink-0 ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px]"
            style={{ background: "oklch(0.68 0.21 250 / 0.12)", color: "oklch(0.68 0.21 250)" }}>
            <svg className="animate-spin" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M21 12a9 9 0 1 1-3.2-6.9" />
            </svg>
            running
          </span>
        ) : (
          <span className="shrink-0 min-w-0 flex-1 truncate text-[11px] ml-1" style={{ color: MUTED_TEXT, fontFamily: "var(--font-mono)" }}>
            {summary}
          </span>
        )}
        {!expanded && preview && (
          <span className="shrink-0 ml-1 max-w-[200px] truncate text-[10px]" style={{ color: "var(--text-tertiary)", opacity: 0.7 }}>
            → {preview}
          </span>
        )}
      </button>
      {expanded && (
        <div
          className="overflow-auto px-3 py-2 text-[12px]"
          style={{
            fontFamily: "var(--font-mono)",
            color: MUTED_TEXT,
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
});
