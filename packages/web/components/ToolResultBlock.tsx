"use client";

import { useState } from "react";

interface Props {
  toolOutput: string;
}

const MUTED_TEXT = "oklch(75% 0 0)";

export function ToolResultBlock({ toolOutput }: Props) {
  const [expanded, setExpanded] = useState(false);
  const output = toolOutput.trim();

  if (!output) return null;

  return (
    <div
      className="my-1 ml-4 overflow-hidden rounded-md"
      style={{
        border: "1px solid var(--color-border)",
        background: "var(--color-surface)",
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between gap-2 px-3 py-1.5 text-[10px] font-medium"
        style={{
          color: MUTED_TEXT,
          background: "var(--color-surface-secondary)",
        }}
      >
        <span className="inline-flex items-center gap-2">
          <span>{expanded ? "▾" : "▸"}</span>
          <span>Output</span>
        </span>
        <span className="tabular-nums" style={{ opacity: 0.65 }}>{output.length} chars</span>
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
}
