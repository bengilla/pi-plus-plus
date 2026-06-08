"use client";

import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import type { AgentDefinition } from "@/lib/agents/types";

interface AgentInfo {
  id: string;
  name: string;
  description: string;
  version?: string;
  path?: string;
}

interface FileMeta {
  size: number;
  modified: number;
  lines: number;
}

interface Props {
  view: "file" | "agent" | null;
  filePath: string | null;
  agent?: AgentInfo;
  agentDefinition?: AgentDefinition;
  workspace: string;
  onClose: () => void;
}

// ── Helpers ──────────────────────────────────────────────────

const LANG_MAP: Record<string, { label: string; color: string }> = {
  ".ts":   { label: "TypeScript", color: "oklch(62% 0.19 252)" },
  ".tsx":  { label: "TSX",        color: "oklch(62% 0.19 252)" },
  ".js":   { label: "JavaScript", color: "oklch(70% 0.17 85)" },
  ".jsx":  { label: "JSX",        color: "oklch(70% 0.17 85)" },
  ".json": { label: "JSON",       color: "oklch(65% 0.12 110)" },
  ".py":   { label: "Python",     color: "oklch(62% 0.15 230)" },
  ".css":  { label: "CSS",        color: "oklch(60% 0.15 290)" },
  ".html": { label: "HTML",       color: "oklch(55% 0.18 25)" },
  ".md":   { label: "Markdown",   color: "oklch(60% 0.08 260)" },
  ".yaml": { label: "YAML",       color: "oklch(58% 0.16 190)" },
  ".yml":  { label: "YAML",       color: "oklch(58% 0.16 190)" },
  ".sh":   { label: "Shell",      color: "oklch(60% 0.12 140)" },
  ".bash": { label: "Shell",      color: "oklch(60% 0.12 140)" },
  ".zsh":  { label: "Shell",      color: "oklch(60% 0.12 140)" },
  ".rs":   { label: "Rust",       color: "oklch(58% 0.16 30)" },
  ".go":   { label: "Go",         color: "oklch(60% 0.16 200)" },
  ".java": { label: "Java",       color: "oklch(55% 0.18 15)" },
  ".kt":   { label: "Kotlin",     color: "oklch(58% 0.18 280)" },
  ".swift":{ label: "Swift",      color: "oklch(58% 0.18 30)" },
  ".c":    { label: "C",          color: "oklch(55% 0.14 210)" },
  ".cpp":  { label: "C++",        color: "oklch(58% 0.16 230)" },
  ".h":    { label: "C Header",   color: "oklch(55% 0.14 210)" },
  ".rb":   { label: "Ruby",       color: "oklch(55% 0.18 10)" },
  ".php":  { label: "PHP",        color: "oklch(58% 0.18 270)" },
  ".sql":  { label: "SQL",        color: "oklch(58% 0.14 190)" },
  ".graphql":{ label: "GraphQL",  color: "oklch(60% 0.18 310)" },
  ".dockerfile":{ label: "Dockerfile", color: "oklch(58% 0.16 240)" },
  ".xml":  { label: "XML",        color: "oklch(55% 0.16 50)" },
  ".svg":  { label: "SVG",        color: "oklch(60% 0.18 45)" },
  ".env":  { label: "Env",        color: "oklch(55% 0.12 140)" },
  ".gitignore":{ label: "Gitignore", color: "oklch(55% 0.08 260)" },
  ".lock": { label: "Lockfile",   color: "oklch(55% 0.08 260)" },
  ".toml": { label: "TOML",       color: "oklch(55% 0.12 170)" },
};

function detectLanguage(filename: string): { label: string; color: string } | null {
  const ext = filename.includes(".")
    ? filename.slice(filename.lastIndexOf(".")).toLowerCase()
    : "";
  if (LANG_MAP[ext]) return LANG_MAP[ext];
  // try full basename match (e.g. Dockerfile, .gitignore)
  const base = filename.toLowerCase();
  for (const [key, val] of Object.entries(LANG_MAP)) {
    if (base === key || base.endsWith(key)) return val;
  }
  return null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatModified(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatContext(n: number): string {
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
}

// ── Sub-components ───────────────────────────────────────────

function PanelHeader({ title, subtitle, onClose }: { title: string; subtitle?: string; onClose: () => void }) {
  return (
    <div
      className="flex items-center justify-between px-4 h-[50px] border-b shrink-0"
      style={{ borderColor: "var(--border)", background: "var(--bg-panel)" }}
    >
      <div className="min-w-0">
        <div
          className="text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: "var(--text-tertiary)" }}
        >
          {title}
        </div>
        {subtitle && (
          <div className="truncate text-[13px] font-medium mt-0.5" style={{ color: "var(--text)" }}>
            {subtitle}
          </div>
        )}
      </div>
      <button
        onClick={onClose}
        className="p-1.5 rounded-md hover:opacity-70 transition-opacity"
        style={{ color: "var(--text-secondary)" }}
        title="Close panel"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

function MetaCard({ children }: { children: ReactNode }) {
  return (
    <div
      className="rounded-lg p-3.5"
      style={{ background: "var(--bg)", border: "1px solid var(--border)" }}
    >
      {children}
    </div>
  );
}

function MetaLabel({ children }: { children: ReactNode }) {
  return (
    <span
      className="text-[10px] font-semibold uppercase tracking-wider"
      style={{ color: "var(--text-tertiary)" }}
    >
      {children}
    </span>
  );
}

function MetaRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 gap-3">
      <span className="text-[11px] shrink-0" style={{ color: "var(--text-tertiary)" }}>
        {label}
      </span>
      <span
        className="text-[12px] truncate text-right font-medium"
        style={{
          color: "var(--text)",
          fontFamily: mono ? "var(--font-mono)" : undefined,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function CapabilityBadge({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors"
      style={{
        color: active ? "var(--success)" : "var(--text-tertiary)",
        background: active ? "oklch(62% 0.19 160 / 0.1)" : "var(--bg-panel)",
        border: `1px solid ${active ? "oklch(62% 0.19 160 / 0.2)" : "var(--border)"}`,
      }}
    >
      <span className="text-[10px]">{active ? "●" : "○"}</span>
      {label}
    </span>
  );
}

// ── Main component ───────────────────────────────────────────

export function RightPanel({ view, filePath, agent, agentDefinition, workspace, onClose }: Props) {
  const [content, setContent] = useState<string | null>(null);
  const [meta, setMeta] = useState<FileMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (view !== "file" || !filePath) {
      setContent(null);
      setMeta(null);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`/api/files?path=${encodeURIComponent(filePath)}&workspace=${encodeURIComponent(workspace)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else {
          setContent(data.content ?? "");
          setMeta({
            size: data.size ?? 0,
            modified: data.modified ?? 0,
            lines: data.lines ?? 0,
          });
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [view, filePath, workspace]);

  const fileName = filePath?.split("/").pop() ?? "";
  const relativeFilePath = filePath && workspace
    ? filePath.replace(workspace.replace(/\/$/, "") + "/", "")
    : filePath;
  const lang = detectLanguage(fileName);

  // ── Panel title ──────────────────────────────────────────
  const panelSubtitle = view === "file" && filePath
    ? fileName
    : view === "agent" && agent
    ? agent.name
    : undefined;

  return (
    <div className="flex flex-col h-full min-h-0" style={{ background: "var(--bg-elevated)" }}>
      <PanelHeader title="Inspector" subtitle={panelSubtitle} onClose={onClose} />

      {/* Body */}
      <div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-3">
        {/* ── Empty state ─────────────────────────────────── */}
        {!view && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center px-4 w-full max-w-[220px]">
              <div className="text-[40px] mb-4 opacity-40">🔍</div>
              <div className="text-[13px] font-medium mb-1" style={{ color: "var(--text)" }}>
                Inspector
              </div>
              <div className="text-[11px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
                Click a file in the explorer or an agent to see details here.
              </div>
            </div>
          </div>
        )}

        {/* ── File Preview ────────────────────────────────── */}
        {view === "file" && (
          <>
            {loading && (
              <div className="flex items-center gap-2 py-6 justify-center">
                <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>Loading…</span>
              </div>
            )}
            {error && (
              <MetaCard>
                <div className="flex items-center gap-2 text-[12px]" style={{ color: "var(--error)" }}>
                  <span>⚠️</span> {error}
                </div>
              </MetaCard>
            )}

            {!loading && !error && content !== null && (
              <>
                {/* File identity card */}
                <MetaCard>
                  <div className="flex items-start gap-3">
                    <span className="text-[22px] shrink-0 leading-none mt-0.5 select-none">
                      {lang ? "📄" : "📝"}
                    </span>
                    <div className="min-w-0">
                      <div
                        className="text-[13px] font-semibold truncate"
                        style={{ color: "var(--text)" }}
                      >
                        {fileName}
                      </div>
                      {relativeFilePath && (
                        <div
                          className="mt-0.5 text-[11px] break-all leading-snug"
                          style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}
                        >
                          {relativeFilePath}
                        </div>
                      )}
                      {lang && (
                        <span
                          className="inline-block mt-1.5 px-2 py-px rounded-full text-[10px] font-medium"
                          style={{ color: lang.color, background: `${lang.color} / 0.12` }}
                        >
                          {lang.label}
                        </span>
                      )}
                    </div>
                  </div>
                </MetaCard>

                {/* File properties */}
                {meta && (
                  <MetaCard>
                    <MetaLabel>Properties</MetaLabel>
                    <div className="mt-1.5 divide-y" style={{ borderColor: "var(--border-light)" }}>
                      <MetaRow label="Lines" value={String(meta.lines)} mono />
                      <MetaRow label="Size" value={formatBytes(meta.size)} mono />
                      <MetaRow label="Modified" value={formatModified(meta.modified)} />
                      {lang && <MetaRow label="Language" value={lang.label} />}
                    </div>
                  </MetaCard>
                )}

                {/* Content preview */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <MetaLabel>Content</MetaLabel>
                    <div className="flex items-center gap-1.5">
                      {meta && (
                        <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                          {meta.lines} lines
                        </span>
                      )}
                      <button
                        onClick={() => navigator.clipboard.writeText(content).catch(() => {})}
                        className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded transition-opacity hover:opacity-70"
                        style={{ color: "oklch(68% 0.15 55)", border: "1px solid oklch(68% 0.15 55 / 0.25)" }}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                        Copy
                      </button>
                    </div>
                  </div>
                  <pre
                    className="p-3.5 rounded-lg overflow-x-auto text-xs leading-relaxed"
                    style={{
                      background: "var(--bg)",
                      border: "1px solid var(--border)",
                      fontFamily: "var(--font-mono)",
                      color: "var(--text)",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      maxHeight: "60vh",
                    }}
                  >
                    {content}
                  </pre>
                </div>
              </>
            )}
          </>
        )}

        {/* ── Agent Info ───────────────────────────────────── */}
        {view === "agent" && agent && (
          <>
            {/* Identity card */}
            <MetaCard>
              <div className="flex items-start gap-3">
                <span className="text-[22px] shrink-0 leading-none mt-0.5 select-none">🤖</span>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>
                    {agent.name}
                  </div>
                  <div className="mt-1 text-[12px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {agent.description}
                  </div>
                </div>
              </div>
            </MetaCard>

            {/* Capabilities */}
            {agentDefinition?.capabilities && (
              <MetaCard>
                <MetaLabel>Capabilities</MetaLabel>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <CapabilityBadge active={agentDefinition.capabilities.skills} label="Skills" />
                  <CapabilityBadge active={agentDefinition.capabilities.fileOps} label="File Ops" />
                  <CapabilityBadge active={agentDefinition.capabilities.imageGen} label="Image Gen" />
                </div>
                <div className="mt-3 pt-2 border-t" style={{ borderColor: "var(--border-light)" }}>
                  <MetaRow
                    label="Max Context"
                    value={formatContext(agentDefinition.capabilities.maxContext)}
                    mono
                  />
                </div>
              </MetaCard>
            )}

            {/* Thinking levels */}
            {agentDefinition && agentDefinition.thinkingLevels.length > 0 && (
              <MetaCard>
                <MetaLabel>Thinking Levels</MetaLabel>
                <div className="mt-2 flex flex-wrap gap-1">
                  {agentDefinition.thinkingLevels.map((tl) => (
                    <span
                      key={tl.value}
                      className="px-2 py-0.5 rounded text-[11px] font-medium"
                      style={{
                        color: "var(--text-secondary)",
                        background: "var(--bg-hover)",
                        border: "1px solid var(--border-light)",
                      }}
                    >
                      {tl.label}
                    </span>
                  ))}
                </div>
              </MetaCard>
            )}

            {/* Technical details */}
            <MetaCard>
              <MetaLabel>Technical</MetaLabel>
              <div className="mt-1.5 divide-y" style={{ borderColor: "var(--border-light)" }}>
                {agent.version && (
                  <MetaRow label="Version" value={agent.version} mono />
                )}
                {agent.path && (
                  <MetaRow label="Binary" value={agent.path} mono />
                )}
                {agentDefinition?.binary && (
                  <MetaRow label="CLI" value={agentDefinition.binary} mono />
                )}
                <MetaRow label="ID" value={agent.id} mono />
              </div>
            </MetaCard>
          </>
        )}
      </div>
    </div>
  );
}
