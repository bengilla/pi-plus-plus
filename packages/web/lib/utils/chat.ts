// ── Chat utility functions ──────────────────────────────────

export function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function formatTime(ts: number): string {
  const d = new Date(ts);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hours = d.getHours().toString().padStart(2, "0");
  const mins = d.getMinutes().toString().padStart(2, "0");
  return `${month}月${day}日 ${hours}:${mins}`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60).toString().padStart(2, "0");
  return `${mins}m ${secs}s`;
}

export function flattenFiles(
  nodes: { name: string; path: string; type: string; children?: unknown[] }[],
): { name: string; path: string }[] {
  const out: { name: string; path: string }[] = [];
  const walk = (list: typeof nodes) => {
    for (const n of list) {
      out.push({ name: n.name, path: n.path });
      if (n.type === "directory" && n.children) walk(n.children as typeof nodes);
    }
  };
  walk(nodes);
  return out;
}
