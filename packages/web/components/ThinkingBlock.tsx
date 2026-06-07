"use client";

import { useState, useEffect } from "react";

interface Props {
  content: string;
  duration?: number;
  defaultOpen?: boolean;
}

export function ThinkingBlock({ content, duration, defaultOpen = true }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  // Auto-collapse after streaming completes
  useEffect(() => {
    if (!defaultOpen) setOpen(false);
  }, [defaultOpen]);

  if (!content.trim()) return null;

  return (
    <div
      className="my-2 rounded-md overflow-hidden"
      style={{ border: "1px solid var(--color-border)" }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] font-medium cursor-pointer hover:opacity-80 transition-opacity"
        style={{
          background: "var(--color-surface-secondary)",
          color: "var(--color-text-secondary)",
        }}
      >
        <span className="text-[10px]">{open ? "▾" : "▸"}</span>
        <span>Thinking</span>
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
            fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
            color: "var(--color-text-secondary)",
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
