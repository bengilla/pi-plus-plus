"use client";

/** pi++ logo */
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <img
      src="/logo-44.png"
      alt="pi++"
      title="pi++"
      className="inline-flex shrink-0 select-none"
      style={{ width: size, height: size }}
    />
  );
}
