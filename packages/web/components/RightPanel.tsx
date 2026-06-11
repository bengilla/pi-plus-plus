"use client";

import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { SyntaxHighlighter, piDarkTheme } from "@/lib/utils/prism";
import type { AgentDefinition } from "@/lib/agents/types";
import { AgentIcon } from "./AgentIcon";

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
  language?: "en" | "zh";
}

// ── Helpers ──────────────────────────────────────────────────

const LANG_MAP: Record<string, { label: string; color: string; syntax?: string }> = {
  ".ts":   { label: "TypeScript", color: "oklch(62% 0.19 252)", syntax: "typescript" },
  ".tsx":  { label: "TSX",        color: "oklch(62% 0.19 252)", syntax: "tsx" },
  ".js":   { label: "JavaScript", color: "oklch(70% 0.17 85)", syntax: "javascript" },
  ".jsx":  { label: "JSX",        color: "oklch(70% 0.17 85)", syntax: "javascript" },
  ".json": { label: "JSON",       color: "oklch(65% 0.12 110)", syntax: "json" },
  ".py":   { label: "Python",     color: "oklch(62% 0.15 230)", syntax: "python" },
  ".css":  { label: "CSS",        color: "oklch(60% 0.15 290)", syntax: "css" },
  ".html": { label: "HTML",       color: "oklch(55% 0.18 25)", syntax: "html" },
  ".md":   { label: "Markdown",   color: "oklch(60% 0.08 260)", syntax: "markdown" },
  ".yaml": { label: "YAML",       color: "oklch(58% 0.16 190)", syntax: "yaml" },
  ".yml":  { label: "YAML",       color: "oklch(58% 0.16 190)", syntax: "yaml" },
  ".sh":   { label: "Shell",      color: "oklch(60% 0.12 140)", syntax: "bash" },
  ".bash": { label: "Shell",      color: "oklch(60% 0.12 140)", syntax: "bash" },
  ".zsh":  { label: "Shell",      color: "oklch(60% 0.12 140)", syntax: "bash" },
  ".rs":   { label: "Rust",       color: "oklch(58% 0.16 30)", syntax: "rust" },
  ".go":   { label: "Go",         color: "oklch(60% 0.16 200)", syntax: "go" },
  ".sql":  { label: "SQL",        color: "oklch(58% 0.14 190)", syntax: "sql" },
  ".java": { label: "Java",       color: "oklch(55% 0.18 15)" },
  ".kt":   { label: "Kotlin",     color: "oklch(58% 0.18 280)" },
  ".swift":{ label: "Swift",      color: "oklch(58% 0.18 30)" },
  ".c":    { label: "C",          color: "oklch(55% 0.14 210)" },
  ".cpp":  { label: "C++",        color: "oklch(58% 0.16 230)" },
  ".h":    { label: "C Header",   color: "oklch(55% 0.14 210)" },
  ".rb":   { label: "Ruby",       color: "oklch(55% 0.18 10)" },
  ".php":  { label: "PHP",        color: "oklch(58% 0.18 270)" },
  ".graphql":{ label: "GraphQL",  color: "oklch(60% 0.18 310)" },
  ".dockerfile":{ label: "Dockerfile", color: "oklch(58% 0.16 240)" },
  ".xml":  { label: "XML",        color: "oklch(55% 0.16 50)", syntax: "html" },
  ".svg":  { label: "SVG",        color: "oklch(60% 0.18 45)", syntax: "html" },
  ".env":  { label: "Env",        color: "oklch(55% 0.12 140)" },
  ".gitignore":{ label: "Gitignore", color: "oklch(55% 0.08 260)" },
  ".lock": { label: "Lockfile",   color: "oklch(55% 0.08 260)" },
  ".toml": { label: "TOML",       color: "oklch(55% 0.12 170)" },
};

function detectLanguage(filename: string): { label: string; color: string; syntax?: string } | null {
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

function PanelHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div
      className="flex h-[42px] shrink-0 items-center justify-between border-b px-3"
      style={{ borderColor: "var(--border)", background: "var(--bg-panel)" }}
    >
      <div className="min-w-0">
        <div
          className="font-semibold uppercase tracking-widest"
          style={{ color: "var(--text-tertiary)", fontSize: "var(--text-xs)" }}
        >
          {title}
        </div>
      </div>
      <button
        onClick={onClose}
        className="p-1.5 hover:opacity-70 transition-opacity"
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

function MetaCard({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
  return (
    <div
      className={`${compact ? "p-2.5" : "p-3"}`}
      style={{ background: "transparent", borderBottom: "1px solid var(--border-light)" }}
    >
      {children}
    </div>
  );
}

function MetaLabel({ children }: { children: ReactNode }) {
  return (
    <span
      className="font-semibold uppercase tracking-wider"
      style={{ color: "var(--text-tertiary)", fontSize: "var(--text-xs)" }}
    >
      {children}
    </span>
  );
}

function MetaRow({ label, value, mono, compact = false }: { label: string; value: string; mono?: boolean; compact?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 ${compact ? "py-0.5" : "py-1.5"}`}>
      <span className="shrink-0" style={{ color: "var(--text-tertiary)", fontSize: "var(--text-xs)" }}>
        {label}
      </span>
      <span
        className="truncate text-right font-medium"
        style={{
          color: "var(--text)",
          fontFamily: mono ? "var(--font-mono)" : undefined,
          fontSize: "var(--text-sm)",
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
      className="inline-flex items-center gap-1.5 px-2.5 py-1 font-medium transition-colors"
      style={{
        color: active ? "var(--success)" : "var(--text-tertiary)",
        background: active ? "oklch(62% 0.19 160 / 0.1)" : "var(--bg-panel)",
        border: `1px solid ${active ? "oklch(62% 0.19 160 / 0.2)" : "var(--border)"}`,
        fontSize: "var(--text-xs)",
      }}
    >
      <span className="text-[10px]">{active ? "●" : "○"}</span>
      {label}
    </span>
  );
}

// ── Main component ───────────────────────────────────────────

export function RightPanel({ view, filePath, agent, agentDefinition, workspace, onClose, language = "en" }: Props) {
  const zh = language === "zh";
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
  const showRelativePath = relativeFilePath && relativeFilePath !== fileName;
  const lang = detectLanguage(fileName);

  return (
    <div className="flex flex-col h-full min-h-0" style={{ background: "var(--bg-elevated)" }}>
      <PanelHeader title={zh ? "检查器" : "Inspector"} onClose={onClose} />

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-hidden p-2.5">
        {/* ── Empty state ─────────────────────────────────── */}
        {!view && (
          <div className="flex items-center justify-center h-full">
            <div className="px-4 w-full max-w-[240px]">
              <div className="mb-3 h-px w-10" style={{ background: "var(--border)" }} />
              <div className="font-medium mb-1" style={{ color: "var(--text)", fontSize: "var(--text-base)" }}>
                {zh ? "检查器" : "Inspector"}
              </div>
              <div className="leading-relaxed text-left" style={{ color: "var(--text-tertiary)", fontSize: "var(--text-xs)" }}>
                {zh ? "点击文件或智能体查看详情。" : "Click a file in the explorer or an agent to see details here."}
              </div>
            </div>
          </div>
        )}

        {/* ── File Preview ────────────────────────────────── */}
        {view === "file" && (
          <div className="flex h-full min-h-0 flex-col">
            {loading && (
              <div className="flex items-center gap-2 py-6 justify-center">
                <span style={{ color: "var(--text-secondary)", fontSize: "var(--text-xs)" }}>{zh ? "加载中..." : "Loading..."}</span>
              </div>
            )}
            {error && (
              <MetaCard>
                <div className="flex items-center gap-2" style={{ color: "var(--error)", fontSize: "var(--text-sm)" }}>
                  <span>⚠️</span> {error}
                </div>
              </MetaCard>
            )}

            {!loading && !error && content !== null && (
              <div className="flex min-h-0 flex-1 flex-col">
                {/* File identity + properties */}
                <MetaCard compact>
                  <div className="flex items-start gap-2.5">
                    <span
                      className="mt-0.5 h-7 w-7 shrink-0"
                      style={{ background: lang?.color ?? "var(--text-tertiary)", opacity: 0.85 }}
                      aria-hidden="true"
                    >
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <div
                          className="min-w-0 flex-1 truncate font-semibold"
                          style={{ color: "var(--text)", fontSize: "var(--text-base)" }}
                        >
                          {fileName}
                        </div>
                        {lang && (
                          <span
                            className="shrink-0 px-2 py-px font-medium"
                            style={{ color: lang.color, background: "var(--bg-hover)", fontSize: "var(--text-xs)" }}
                          >
                            {lang.label}
                          </span>
                        )}
                      </div>
                      {showRelativePath && (
                        <div
                          className="mt-0.5 truncate"
                          title={relativeFilePath}
                          style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)" }}
                        >
                          {relativeFilePath}
                        </div>
                      )}
                      {meta && (
                        <div
                          className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1"
                          style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)" }}
                        >
                          <span style={{ color: "oklch(72% 0.13 252)" }}>{meta.lines} lines</span>
                          <span style={{ color: "oklch(74% 0.12 145)" }}>{formatBytes(meta.size)}</span>
                          <span style={{ color: "oklch(76% 0.11 65)" }}>{formatModified(meta.modified)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </MetaCard>

                {/* Content preview */}
                <div className="flex min-h-0 flex-1 flex-col pt-2">
                  <div className="mb-2 flex items-center justify-between">
                    <MetaLabel>{zh ? "内容" : "Content"}</MetaLabel>
                      <button
                        onClick={() => navigator.clipboard.writeText(content).catch(() => {})}
                        className="inline-flex h-6 w-6 items-center justify-center transition-colors hover:bg-[var(--bg-hover)]"
                        style={{ color: "oklch(68% 0.15 55)" }}
                        title={zh ? "复制" : "Copy"}
                        aria-label={zh ? "复制" : "Copy"}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      </button>
                  </div>
                  <div
                    className="min-h-0 flex-1 overflow-hidden"
                    style={{
                      background: "var(--bg)",
                      border: "1px solid var(--border-light)",
                    }}
                  >
                    <SyntaxHighlighter
                      language={lang?.syntax ?? "text"}
                      style={piDarkTheme}
                      PreTag="div"
                      wrapLongLines
                      customStyle={{
                        height: "100%",
                        margin: 0,
                        padding: "14px",
                        overflow: "auto",
                        background: "transparent",
                        fontFamily: "var(--font-mono)",
                        fontSize: "var(--text-sm)",
                        lineHeight: 1.65,
                      }}
                      codeTagProps={{
                        style: {
                          fontFamily: "var(--font-mono)",
                        },
                      }}
                    >
                      {content || " "}
                    </SyntaxHighlighter>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Agent Info ───────────────────────────────────── */}
        {view === "agent" && agent && (
          <div className="h-full min-h-0 overflow-y-auto">
            {/* Identity card */}
            <MetaCard>
              <div className="flex items-start gap-3">
                <span
                  className="mt-0.5 inline-flex shrink-0 items-center justify-center"
                  style={{ width: 28, height: 28, background: "var(--bg-panel)", border: "1px solid var(--border)" }}
                >
                  <AgentIcon agentId={agent.id} size={22} />
                </span>
                <div className="min-w-0">
                  <div className="font-semibold" style={{ color: "var(--text)", fontSize: "var(--text-base)" }}>
                    {agent.name}
                  </div>
                  <div className="mt-1 leading-relaxed" style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
                    {agent.id === "pi" && language === "zh"
                      ? "Earendil Pi 编码智能体 — 多模型支持，RPC 模式"
                      : agent.description}
                  </div>
                </div>
              </div>
            </MetaCard>

            {/* Capabilities */}
            {agentDefinition?.capabilities && (
              <MetaCard>
                <MetaLabel>{zh ? "能力" : "Capabilities"}</MetaLabel>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <CapabilityBadge active={agentDefinition.capabilities.skills} label={zh ? "技能" : "Skills"} />
                  <CapabilityBadge active={agentDefinition.capabilities.fileOps} label={zh ? "文件操作" : "File Ops"} />
                  <CapabilityBadge active={agentDefinition.capabilities.imageGen} label={zh ? "图像生成" : "Image Gen"} />
                </div>
                <div className="mt-3 pt-2 border-t" style={{ borderColor: "var(--border-light)" }}>
                  <MetaRow
                    label={zh ? "最大上下文" : "Max Context"}
                    value={formatContext(agentDefinition.capabilities.maxContext)}
                    mono
                  />
                </div>
              </MetaCard>
            )}

            {/* Thinking levels */}
            {agentDefinition && agentDefinition.thinkingLevels.length > 0 && (
              <MetaCard>
                <MetaLabel>{zh ? "思考级别" : "Thinking Levels"}</MetaLabel>
                <div className="mt-2 flex flex-wrap gap-1">
                  {agentDefinition.thinkingLevels.map((tl) => (
                    <span
                      key={tl.value}
                      className="px-2 py-0.5 font-medium"
                      style={{
                        color: "var(--text-secondary)",
                        background: "var(--bg-hover)",
                        border: "1px solid var(--border-light)",
                        fontSize: "var(--text-xs)",
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
          </div>
        )}
      </div>
    </div>
  );
}
