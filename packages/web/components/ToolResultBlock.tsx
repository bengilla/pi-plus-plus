"use client";

import { useState, memo, useCallback, useEffect } from "react";

interface Props {
  toolOutput: string;
  images?: { data: string; mimeType: string }[];
}

interface DiskImage {
  src: string;
  filename: string;
  path: string;
}

const MUTED_TEXT = "oklch(75% 0 0)";

/** Extract saved image paths from tool output text */
function extractImagePaths(text: string): string[] {
  const re = /Saved image to:\s*(.+\.(?:png|jpe?g|webp|gif|svg))/gi;
  const paths: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    paths.push(m[1].trim());
  }
  return paths;
}

export const ToolResultBlock = memo(function ToolResultBlock({ toolOutput, images }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [diskImages, setDiskImages] = useState<DiskImage[] | null>(null);
  const [diskLoading, setDiskLoading] = useState(false);
  const output = toolOutput.trim();

  // When no inline images, try to load from disk paths in output
  useEffect(() => {
    if (images && images.length > 0) return;
    const paths = extractImagePaths(toolOutput);
    if (paths.length === 0) return;

    setDiskLoading(true);
    setDiskImages(null);

    const loaded: DiskImage[] = [];
    Promise.all(
      paths.map(async (path) => {
        try {
          const r = await fetch(`/api/files/serve?path=${encodeURIComponent(path)}`);
          if (r.ok) {
            loaded.push({ src: `/api/files/serve?path=${encodeURIComponent(path)}`, filename: path.split("/").pop() ?? "image.png", path });
          } else {
            loaded.push({ src: "", filename: path.split("/").pop() ?? "image.png", path });
          }
        } catch {
          loaded.push({ src: "", filename: path.split("/").pop() ?? "image.png", path });
        }
      })
    ).then(() => {
      setDiskImages(loaded);
      setDiskLoading(false);
    });
  }, [toolOutput, images]);

  if (!output && (!images || images.length === 0)) return null;

  const preview = output.split("\n")[0].slice(0, 100);
  const hasImages = (images && images.length > 0) || (diskImages && diskImages.length > 0);

  const handleDownload = useCallback((src: string, filename: string) => {
    const link = document.createElement("a");
    link.download = filename;
    link.href = src;
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
        <span className="shrink-0 tabular-nums" style={{ opacity: 0.65 }}>{output.length} chars{hasImages ? ` · ${(images?.length ?? 0) + (diskImages?.length ?? 0)} img` : ""}</span>
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

      {/* Inline images (streaming) */}
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
                  <button
                    onClick={() => handleDownload(src, filename)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[10px] rounded shadow"
                    style={{ background: "var(--bg-elevated)", color: "var(--text)", border: "1px solid var(--border)" }}
                    title={`Download ${filename}`}
                  >
                    ↓ {filename}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Disk images (history reload) */}
      {!images && diskLoading && (
        <div className="px-3 py-2 text-[10px]" style={{ color: "var(--text-tertiary)" }}>
          Loading image…
        </div>
      )}

      {!images && diskImages && diskImages.length > 0 && (
        <div className="px-3 py-2 flex flex-wrap gap-2">
          {diskImages.map((img, i) => (
            <div key={i} className="relative group">
              {img.src ? (
                <img
                  src={img.src}
                  alt={`Generated image ${i + 1}`}
                  className="max-w-full h-auto"
                  style={{ maxHeight: "320px", border: "1px solid var(--color-border)" }}
                />
              ) : (
                <div
                  className="flex items-center justify-center text-[10px]"
                  style={{
                    width: "200px",
                    height: "100px",
                    background: "var(--bg)",
                    border: "1px dashed var(--border)",
                    color: "var(--text-tertiary)",
                  }}
                >
                  图片已不存在
                </div>
              )}
              {img.src && (
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
                  <button
                    onClick={() => handleDownload(img.src, img.filename)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[10px] rounded shadow"
                    style={{ background: "var(--bg-elevated)", color: "var(--text)", border: "1px solid var(--border)" }}
                    title={`Download ${img.filename}`}
                  >
                    ↓ {img.filename}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
