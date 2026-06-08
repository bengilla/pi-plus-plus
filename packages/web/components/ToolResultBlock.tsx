"use client";

import { useState } from "react";

interface Props {
  toolOutput: string;
}

export function ToolResultBlock({ toolOutput }: Props) {
  const [expanded, setExpanded] = useState(false);
  const output = toolOutput.trim();
  const truncated = output.length > 500 && !expanded
    ? toolOutput.slice(0, 500) + "…"
    : toolOutput;

  if (!output) return null;

  return (
    <div
      className="my-1 ml-4 overflow-hidden rounded-md"
      style={{
        border: "1px solid var(--color-border)",
        background: "var(--color-surface)",
      }}
    >
      <div
        className="flex items-center justify-between gap-2 px-3 py-1.5 text-[10px] font-medium"
        style={{
          color: "var(--color-text-secondary)",
          background: "var(--color-surface-secondary)",
        }}
      >
        <span>Output</span>
        <span className="tabular-nums" style={{ opacity: 0.65 }}>{output.length} chars</span>
      </div>
      <div
        className="whitespace-pre-wrap break-words px-3 py-2 text-[11px]"
        style={{
          fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
          color: "var(--color-text-secondary)",
          maxHeight: expanded ? "none" : "6rem",
          overflowY: expanded ? "visible" : "auto",
        }}
      >
        {truncated}
      </div>
      {output.length > 500 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="px-3 pb-2 text-[10px] hover:opacity-70"
          style={{ color: "var(--color-accent)" }}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
