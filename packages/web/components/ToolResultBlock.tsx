"use client";

import { useState } from "react";

interface Props {
  toolOutput: string;
}

export function ToolResultBlock({ toolOutput }: Props) {
  const [expanded, setExpanded] = useState(false);
  const truncated = toolOutput.length > 500 && !expanded
    ? toolOutput.slice(0, 500) + "…"
    : toolOutput;

  return (
    <div className="my-1 ml-4 rounded-md px-3 py-1.5" style={{ borderLeft: "2px solid var(--color-border)" }}>
      <div
        className="text-[11px] whitespace-pre-wrap break-words"
        style={{
          fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
          color: "var(--color-text-secondary)",
          maxHeight: expanded ? "none" : "6rem",
          overflowY: expanded ? "visible" : "auto",
        }}
      >
        {truncated}
      </div>
      {toolOutput.length > 500 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[10px] mt-1 hover:opacity-70"
          style={{ color: "var(--color-accent)" }}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
