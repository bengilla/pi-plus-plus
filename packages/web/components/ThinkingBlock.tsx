"use client";

import { useState, useEffect } from "react";

interface Props {
  content: string;
  duration?: number;
  defaultOpen?: boolean;
}

const MUTED_TEXT = "oklch(75% 0 0)";

export function ThinkingBlock({ content, duration, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  // Auto-collapse after streaming completes
  useEffect(() => {
    if (!defaultOpen) setOpen(false);
  }, [defaultOpen]);

  if (!content.trim()) return null;

  return (
    <div
      className="my-2 overflow-hidden rounded-md"
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
          className="h-2 w-2 shrink-0 rounded-full"
          style={{
            background: open ? "var(--color-accent)" : "transparent",
            border: "1px solid var(--color-accent)",
            boxShadow: open ? "0 0 0 3px color-mix(in oklch, var(--color-accent) 18%, transparent)" : "none",
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
