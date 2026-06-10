"use client";

import { useState, useEffect } from "react";

interface Props {
  content: string;
  duration?: number;
  defaultOpen?: boolean;
  /** Current thinking level for color coding (auto = default) */
  level?: string;
}

const MUTED_TEXT = "oklch(75% 0 0)";

function levelColor(level?: string): string {
  switch (level) {
    case "off": return "oklch(55% 0.03 255)";
    case "minimal": return "oklch(68% 0.09 220)";
    case "low": return "oklch(68% 0.12 195)";
    case "medium": return "oklch(67% 0.13 175)";
    case "high": return "oklch(65% 0.15 155)";
    case "xhigh": return "oklch(62% 0.16 135)";
    default: return "var(--accent)";
  }
}

export function ThinkingBlock({ content, duration, defaultOpen = false, level }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const accent = levelColor(level);

  // Auto-collapse after streaming completes
  useEffect(() => {
    if (!defaultOpen) setOpen(false);
  }, [defaultOpen]);

  if (!content.trim()) return null;

  return (
    <div
      className="my-2 overflow-hidden"
      style={{
        border: "1px solid var(--color-border)",
        background: "var(--color-surface)",
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left transition-opacity hover:opacity-85"
        style={{
          background: "var(--color-surface-secondary)",
          color: MUTED_TEXT,
        }}
      >
        <span className="text-[10px]" style={{ color: MUTED_TEXT }}>{open ? "▾" : "▸"}</span>
        <span
          className="h-2 w-2 shrink-0"
          style={{
            background: open ? accent : "transparent",
            border: `1px solid ${accent}`,
            boxShadow: open ? `0 0 0 3px color-mix(in oklch, ${accent} 18%, transparent)` : "none",
          }}
        />
        <span className="text-[11px] font-semibold">Thinking</span>
        {duration != null && (
          <span className="tabular-nums ml-auto" style={{ fontSize: "10px", opacity: 0.6 }}>
            {duration >= 1
              ? `${duration.toFixed(1)}s`
              : `${Math.round(duration * 1000)}ms`}
          </span>
        )}
      </button>
      {open && (
        <div
          className="px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap break-words"
          style={{
            fontFamily: "var(--font-mono)",
            color: MUTED_TEXT,
            maxHeight: "16rem",
            overflowY: "auto",
          }}
        >
          {content}
        </div>
      )}
    </div>
  );
}
