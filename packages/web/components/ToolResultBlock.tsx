"use client";

import { useState, memo } from "react";

interface Props {
  toolOutput: string;
}

const MUTED_TEXT = "oklch(75% 0 0)";

export const ToolResultBlock = memo(function ToolResultBlock({ toolOutput }: Props) {
  const [expanded, setExpanded] = useState(false);
  const output = toolOutput.trim();

  if (!output) return null;

  const preview = output.split("\n")[0].slice(0, 100);

  return (
    <div
      className="my-1 ml-4 overflow-hidden"
      style={{
        border: "1px solid var(--color-border)",
        background: "var(--color-surface)",
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-[10px] font-medium text-left"
        style={{
          color: MUTED_TEXT,
          background: "var(--color-surface-secondary)",
        }}
      >
        <span className="inline-flex items-center gap-2 min-w-0 flex-1">
          <span className="shrink-0">{expanded ? "▾" : "▸"}</span>
          <span className="shrink-0">Output</span>
          {!expanded && preview && (
            <span className="truncate" style={{ opacity: 0.55, fontFamily: "var(--font-mono)", fontSize: "9px" }}>
              {preview}{preview.length < output.length ? "…" : ""}
            </span>
          )}
        </span>
        <span className="shrink-0 tabular-nums" style={{ opacity: 0.65 }}>{output.length} chars</span>
      </button>
      {expanded && (
        <div
          className="whitespace-pre-wrap break-words px-3 py-2 text-[11px]"
          style={{
            fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
            color: MUTED_TEXT,
            maxHeight: "12rem",
            overflowY: "auto",
          }}
        >
          {toolOutput}
        </div>
      )}
    </div>
  );
});
