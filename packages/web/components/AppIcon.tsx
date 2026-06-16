"use client";

export type IconName =
  | "chevron-right"
  | "chevron-down"
  | "check"
  | "arrow-up"
  | "bug"
  | "compass"
  | "copy"
  | "download"
  | "edit"
  | "external"
  | "file"
  | "folder"
  | "info"
  | "message-plus"
  | "paperclip"
  | "plus"
  | "refresh"
  | "save"
  | "search"
  | "settings"
  | "stop"
  | "trash"
  | "x"
  | "zap";

interface IconProps {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function AppIcon({ name, size = 14, strokeWidth = 1.8, className }: IconProps) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {name === "chevron-right" && <path {...common} d="m9 18 6-6-6-6" />}
      {name === "chevron-down" && <path {...common} d="m6 9 6 6 6-6" />}
      {name === "check" && <path {...common} d="M20 6 9 17l-5-5" />}
      {name === "arrow-up" && (
        <>
          <path {...common} d="M12 19V5" />
          <path {...common} d="m5 12 7-7 7 7" />
        </>
      )}
      {name === "bug" && (
        <>
          <path {...common} d="M8 7.5A4 4 0 0 1 16 7.5V10H8V7.5Z" />
          <path {...common} d="M7 10h10v5.5a5 5 0 0 1-10 0V10Z" />
          <path {...common} d="M3 13h4M17 13h4M4.5 19 8 16.5M19.5 19 16 16.5M9 4 7 2M15 4l2-2" />
        </>
      )}
      {name === "compass" && (
        <>
          <circle {...common} cx="12" cy="12" r="8.5" />
          <path {...common} d="m15.5 8.5-2.2 5-4.8 2 2.2-5 4.8-2Z" />
        </>
      )}
      {name === "copy" && (
        <>
          <rect {...common} x="8" y="8" width="12" height="12" rx="2.5" />
          <path {...common} d="M16 8V6.8A2.8 2.8 0 0 0 13.2 4H6.8A2.8 2.8 0 0 0 4 6.8v6.4A2.8 2.8 0 0 0 6.8 16H8" />
        </>
      )}
      {name === "download" && (
        <>
          <path {...common} d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <path {...common} d="M7 10l5 5 5-5" />
          <path {...common} d="M12 15V3" />
        </>
      )}
      {name === "edit" && (
        <>
          <path {...common} d="M4 20h4.2L19.4 8.8a3 3 0 0 0-4.2-4.2L4 15.8V20Z" />
          <path {...common} d="m13.8 6.2 4 4" />
        </>
      )}
      {name === "external" && (
        <>
          <path {...common} d="M14 4h6v6" />
          <path {...common} d="M20 4 10 14" />
          <path {...common} d="M11 5H6.8A2.8 2.8 0 0 0 4 7.8v9.4A2.8 2.8 0 0 0 6.8 20h9.4a2.8 2.8 0 0 0 2.8-2.8V13" />
        </>
      )}
      {name === "file" && (
        <>
          <path {...common} d="M7 3.8h6.4L18 8.4v11.8H7V3.8Z" />
          <path {...common} d="M13 4v5h5" />
        </>
      )}
      {name === "folder" && (
        <path {...common} d="M3.5 6.8A2.8 2.8 0 0 1 6.3 4h4l2.1 2.3h5.3a2.8 2.8 0 0 1 2.8 2.8v7.8a3.1 3.1 0 0 1-3.1 3.1H6.6a3.1 3.1 0 0 1-3.1-3.1V6.8Z" />
      )}
      {name === "info" && (
        <>
          <circle {...common} cx="12" cy="12" r="8.5" />
          <path {...common} d="M12 11.5v5" />
          <path {...common} d="M12 7.8h.01" />
        </>
      )}
      {name === "message-plus" && (
        <>
          <path {...common} d="M5 5.8A3.8 3.8 0 0 1 8.8 2h6.4A3.8 3.8 0 0 1 19 5.8v5.6a3.8 3.8 0 0 1-3.8 3.8H10l-5 4v-4.7a3.8 3.8 0 0 1 0-3.1V5.8Z" />
          <path {...common} d="M12 6.7v5M9.5 9.2h5" />
        </>
      )}
      {name === "paperclip" && (
        <path {...common} d="m21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.1a2 2 0 0 1-2.8-2.8l8.5-8.5" />
      )}
      {name === "plus" && <path {...common} d="M12 5v14M5 12h14" />}
      {name === "refresh" && (
        <>
          <path {...common} d="M3 10a8 8 0 0 1 13.7-5.6L20 7.7" />
          <path {...common} d="M20 4v4h-4" />
          <path {...common} d="M21 14a8 8 0 0 1-13.7 5.6L4 16.3" />
          <path {...common} d="M4 20v-4h4" />
        </>
      )}
      {name === "save" && (
        <>
          <path {...common} d="M5 4h11l3 3v13H5V4Z" />
          <path {...common} d="M8 4v6h7V4" />
          <path {...common} d="M8 20v-6h8v6" />
        </>
      )}
      {name === "search" && (
        <>
          <circle {...common} cx="11" cy="11" r="6.5" />
          <path {...common} d="m16 16 4 4" />
        </>
      )}
      {name === "settings" && (
        <>
          <path {...common} d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
          <path {...common} d="M18.4 14.5c.12.3.3.56.54.78l.06.06a2 2 0 0 1-2.84 2.82l-.05-.05a1.9 1.9 0 0 0-2.02-.42 1.9 1.9 0 0 0-1.17 1.74v.08a2 2 0 0 1-4 0v-.08a1.9 1.9 0 0 0-1.16-1.74 1.9 1.9 0 0 0-2.03.42l-.05.05a2 2 0 1 1-2.83-2.82l.05-.06c.24-.22.42-.48.54-.78a1.9 1.9 0 0 0-.18-1.9A1.9 1.9 0 0 0 1.7 11.7h-.08a2 2 0 0 1 0-4h.08a1.9 1.9 0 0 0 1.56-.87 1.9 1.9 0 0 0 .18-1.9 2 2 0 0 0-.54-.78l-.05-.06a2 2 0 1 1 2.83-2.82l.05.05c.57.57 1.43.75 2.03.42A1.9 1.9 0 0 0 8.92.01V0h4v.01a1.9 1.9 0 0 0 1.17 1.73c.6.33 1.46.15 2.02-.42l.05-.05A2 2 0 1 1 19 4.09l-.06.06a2 2 0 0 0-.54.78 1.9 1.9 0 0 0 .18 1.9 1.9 1.9 0 0 0 1.56.87h.08a2 2 0 0 1 0 4h-.08a1.9 1.9 0 0 0-1.56.87 1.9 1.9 0 0 0-.18 1.9Z" transform="translate(1.08 2)" />
        </>
      )}
      {name === "stop" && <rect x="7" y="7" width="10" height="10" rx="1.8" fill="currentColor" />}
      {name === "trash" && (
        <>
          <path {...common} d="M4 7h16" />
          <path {...common} d="M18 7v12.2A2.8 2.8 0 0 1 15.2 22H8.8A2.8 2.8 0 0 1 6 19.2V7" />
          <path {...common} d="M9 7V4.8A2.8 2.8 0 0 1 11.8 2h.4A2.8 2.8 0 0 1 15 4.8V7" />
          <path {...common} d="M10 11v6M14 11v6" />
        </>
      )}
      {name === "x" && (
        <>
          <path {...common} d="M18 6 6 18" />
          <path {...common} d="m6 6 12 12" />
        </>
      )}
      {name === "zap" && <path {...common} d="M13 2 4.5 13h7L11 22l8.5-12h-7L13 2Z" />}
    </svg>
  );
}

const FILE_META: Record<string, { label: string; color: string; glyph: string }> = {
  ts: { label: "TS", color: "oklch(66% 0.18 252)", glyph: "T" },
  tsx: { label: "TSX", color: "oklch(66% 0.18 252)", glyph: "R" },
  js: { label: "JS", color: "oklch(78% 0.16 88)", glyph: "J" },
  jsx: { label: "JSX", color: "oklch(78% 0.16 88)", glyph: "R" },
  css: { label: "CSS", color: "oklch(68% 0.18 292)", glyph: "#" },
  html: { label: "HTML", color: "oklch(64% 0.19 32)", glyph: "<" },
  json: { label: "JSON", color: "oklch(72% 0.13 125)", glyph: "{}" },
  md: { label: "MD", color: "oklch(72% 0.08 245)", glyph: "M" },
  mdx: { label: "MDX", color: "oklch(72% 0.08 245)", glyph: "M" },
  py: { label: "PY", color: "oklch(67% 0.15 225)", glyph: "P" },
  rs: { label: "RS", color: "oklch(63% 0.18 38)", glyph: "R" },
  go: { label: "GO", color: "oklch(68% 0.16 205)", glyph: "G" },
  sh: { label: "SH", color: "oklch(70% 0.13 150)", glyph: "$" },
  svg: { label: "SVG", color: "oklch(72% 0.18 55)", glyph: "S" },
  png: { label: "IMG", color: "oklch(70% 0.16 320)", glyph: "I" },
  jpg: { label: "IMG", color: "oklch(70% 0.16 320)", glyph: "I" },
  jpeg: { label: "IMG", color: "oklch(70% 0.16 320)", glyph: "I" },
  gif: { label: "IMG", color: "oklch(70% 0.16 320)", glyph: "I" },
  pdf: { label: "PDF", color: "oklch(62% 0.19 28)", glyph: "P" },
  env: { label: "ENV", color: "oklch(70% 0.12 160)", glyph: "*" },
};

function getFileMeta(name: string) {
  const lower = name.toLowerCase();
  const ext = lower.includes(".") ? lower.slice(lower.lastIndexOf(".") + 1) : lower;
  if (lower === "dockerfile") return { label: "DOC", color: "oklch(66% 0.16 235)", glyph: "D" };
  if (lower === ".gitignore") return { label: "GIT", color: "oklch(68% 0.14 35)", glyph: "G" };
  return FILE_META[ext] ?? { label: "FILE", color: "var(--text-tertiary)", glyph: "" };
}

interface FileTypeIconProps {
  name: string;
  type?: "file" | "directory";
  size?: number;
  open?: boolean;
  className?: string;
}

export function FileTypeIcon({ name, type = "file", size = 16, open = false, className }: FileTypeIconProps) {
  if (type === "directory") {
    return (
      <span className={`inline-flex shrink-0 items-center justify-center ${className ?? ""}`} style={{ width: size, height: size, color: "oklch(72% 0.12 175)" }}>
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
          <path
            d={open ? "M3.5 8.2h17l-1.45 9.2A3 3 0 0 1 16.08 20H6.92a3 3 0 0 1-2.97-2.6L3.5 8.2Z" : "M3.5 6.8A2.8 2.8 0 0 1 6.3 4h4l2.1 2.3h5.3a2.8 2.8 0 0 1 2.8 2.8v7.8a3.1 3.1 0 0 1-3.1 3.1H6.6a3.1 3.1 0 0 1-3.1-3.1V6.8Z"}
            fill="oklch(72% 0.12 175 / 0.16)"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M6.2 8.2h14.3" stroke="oklch(88% 0.06 170)" strokeWidth="1.4" strokeLinecap="round" opacity=".75" />
        </svg>
      </span>
    );
  }

  const meta = getFileMeta(name);
  return (
    <span className={`inline-flex shrink-0 items-center justify-center ${className ?? ""}`} style={{ width: size, height: size, color: meta.color }}>
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6.5 3.5h7L18 8v12.5H6.5v-17Z" fill="currentColor" opacity=".16" />
        <path d="M6.5 3.5h7L18 8v12.5H6.5v-17Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M13.4 3.8v4.7H18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        {meta.glyph && (
          <text x="12.2" y="16.2" textAnchor="middle" fontSize={meta.glyph.length > 1 ? "5.1" : "7"} fontWeight="800" fill="currentColor" fontFamily="var(--font-mono)">
            {meta.glyph}
          </text>
        )}
      </svg>
    </span>
  );
}
