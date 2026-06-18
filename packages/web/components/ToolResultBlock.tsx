"use client";

import { useState, memo, useCallback } from "react";

interface Props {
  toolOutput: string;
  images?: { data: string; mimeType: string }[];
}

const MUTED_TEXT = "oklch(75% 0 0)";

export const ToolResultBlock = memo(function ToolResultBlock({ toolOutput, images }: Props) {
  const [expanded, setExpanded] = useState(false);
  const output = toolOutput.trim();

  if (!output && (!images || images.length === 0)) return null;

  const preview = output.split("\n")[0].slice(0, 100);

  const handleDownload = useCallback((img: { data: string; mimeType: string }, index: number) => {
    const ext = img.mimeType.split("/")[1] ?? "png";
    const link = document.createElement("a");
    link.download = `generated-${index + 1}.${ext}`;
    link.href = `data:${img.mimeType};base64,${img.data}`;
    link.click();
  }, []);

  return (
    <div
      className="my-2 ml-4 overflow-hidden"
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
        <span className="shrink-0 tabular-nums" style={{ opacity: 0.65 }}>{output.length} chars{images && images.length > 0 ? ` · ${images.length} img` : ""}</span>
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
      {images && images.length > 0 && (
        <div className="px-3 py-2 flex flex-wrap gap-2">
          {images.map((img, i) => {
            const src = `data:${img.mimeType};base64,${img.data}`;
            const ext = img.mimeType.split("/")[1] ?? "png";
            const filename = `generated-${i + 1}.${ext}`;
            return (
              <div key={i} className="relative group">
                <img
                  src={src}
                  alt={`Generated image ${i + 1}`}
                  className="max-w-full h-auto"
                  style={{ maxHeight: "320px", border: "1px solid var(--color-border)" }}
                />
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
                  <a
                    href={src}
                    download={filename}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[10px] rounded shadow"
                    style={{ background: "var(--bg-elevated)", color: "var(--text)", border: "1px solid var(--border)" }}
                    onClick={(e) => {
                      e.preventDefault();
                      handleDownload(img, i);
                    }}
                    title={`Download ${filename}`}
                  >
                    ↓ {filename}
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});
