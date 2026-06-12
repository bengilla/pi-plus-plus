"use client";

/** pi++ logo — π in a circle */
export function Logo() {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full shrink-0 select-none"
      style={{
        width: 22,
        height: 22,
        background: "var(--accent)",
        color: "var(--bg)",
        fontSize: 13,
        fontWeight: 600,
        lineHeight: 1,
      }}
      title="pi++"
    >
      π
    </span>
  );
}
