"use client";

/** Compact DSCII monogram for agents-web */
export function Logo() {
  // Single-line block-character logo
  const art = "▗▄▄▄▖▗▖ ▗▖";

  return (
    <span
      className="inline-block select-none shrink-0 animate-shimmer"
      style={{
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
        fontSize: "12px",
        lineHeight: 1,
        whiteSpace: "pre",
        color: "var(--color-accent)",
      }}
      title="agents-web"
    >
      {art}
    </span>
  );
}
