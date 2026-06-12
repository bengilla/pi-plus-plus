"use client";

import { useMemo, useState } from "react";
import { FileTree } from "./FileTree";
import { ContextFilesSection } from "./sidebar/ContextFilesSection";

export interface ConvInfo {
  id: string;
  title: string;
  agentId: string;
  createdAt: number;
  lastActivityAt?: number;
  totalTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  cacheTokens?: number;
}

interface AgentInfo {
  id: string;
  name: string;
  description: string;
  version?: string;
}

interface Props {
  workspace: string;
  onWorkspaceChange: (path: string) => void;
  onOpenSettings: () => void;
  conversations: ConvInfo[];
  activeConvId: string | null;
  onNewConversation: () => void;
  onSelectConversation: (id: string) => void;

  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, title: string) => void;
  agents: AgentInfo[];
  onFileClick: (path: string) => void;
  onAgentInfoClick: () => void;
  language?: "en" | "zh";
}

function getDefaultWorkspaces(): { label: string; path: string }[] {
  const home = process.env.HOME || process.env.USERPROFILE || "/home/user";
  return [
    { label: "Desktop", path: `${home}/Desktop` },
    { label: "Documents", path: `${home}/Documents` },
    { label: "Downloads", path: `${home}/Downloads` },
    { label: "Home", path: home },
  ];
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.max(0, Math.floor(diff / 60_000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function Sidebar({
  workspace, onWorkspaceChange, onOpenSettings,
  conversations, activeConvId, onNewConversation, onSelectConversation, onDeleteConversation, onRenameConversation,
  agents, onFileClick, onAgentInfoClick,
  language = "en",
}: Props) {
  const [customPath, setCustomPath] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [explorerOpen, setExplorerOpen] = useState(true);
  const [convOpen, setConvOpen] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<ConvInfo | null>(null);
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const defaultWorkspaces = useMemo(() => getDefaultWorkspaces(), []);
  const isDefault = defaultWorkspaces.some((w) => w.path === workspace);
  const folderName = workspace.split("/").filter(Boolean).pop() || workspace || "Select project";
  const options = useMemo(
    () => {
      const none = { label: language === "zh" ? "- 不使用项目 -" : "- No Project -", path: "__none__" };
      return workspace && !isDefault
        ? [none, ...defaultWorkspaces, { label: `→ ${folderName}`, path: workspace }]
        : [none, ...defaultWorkspaces];
    },
    [defaultWorkspaces, folderName, isDefault, workspace, language],
  );
  const zh = language === "zh";

  const startConversationEdit = (conversation: ConvInfo) => {
    setEditingConvId(conversation.id);
    setEditingTitle(conversation.title);
  };

  const finishConversationEdit = () => {
    if (!editingConvId) return;
    const title = editingTitle.trim();
    if (title) onRenameConversation(editingConvId, title);
    setEditingConvId(null);
    setEditingTitle("");
  };

  return (
    <>
      {/* ── Pi header ───────────────────────────────────── */}
      <div className="flex items-center px-2 h-[42px] border-b shrink-0" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-1.5">
          <span className="text-lg leading-none -mt-0.5">π</span>
          <span className="text-xs font-semibold leading-none" style={{ color: "var(--accent)" }}>Pi</span>
        </div>
        <button
          onClick={onAgentInfoClick}
          className="ml-auto text-[10px] px-1.5 py-0.5 transition-colors hover:bg-[var(--accent-dim)]"
          style={{ color: "var(--accent)", background: "transparent" }}
        >
          {zh ? "信息" : "Info"}
        </button>
      </div>

      {/* ── Explorer ──────────────────────────────────────── */}
      <div className="border-b shrink-0 px-2 py-2" style={{ borderColor: "var(--border)" }}>
        {/* Project selector — always visible, not collapsible */}
        <div className="p-2 mb-2" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-[10px] font-medium" style={{ color: "var(--text-tertiary)" }}>
              {zh ? "当前项目" : "Current project"}
            </span>
            {workspace ? (
              <span className="truncate text-[10px]" style={{ color: "var(--text-secondary)" }}>
                {folderName}
              </span>
            ) : (
              <span className="truncate text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                {zh ? "无项目" : "No project"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <select
              value={workspace || "__none__"}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "__custom__") { setShowCustom(true); }
                else if (val === "__none__") { onWorkspaceChange(""); }
                else if (val) { onWorkspaceChange(val); }
              }}
              className="flex-1 w-0 pl-2 pr-5 py-1.5 cursor-pointer appearance-none truncate"
              style={{
                background: "var(--bg-panel)", color: "var(--text)",
                border: "1px solid var(--border)", fontSize: "var(--text-xs)",
                fontFamily: "var(--font-mono)",
              }}
            >
              <option value="" disabled>{zh ? "选择工作区..." : "Select workspace..."}</option>
              {options.map((w) => (
                <option key={w.path} value={w.path}>{w.label}</option>
              ))}
              <option value="__custom__">{zh ? "+ 自定义路径..." : "+ Custom path..."}</option>
            </select>
          </div>
          {showCustom && (
            <div className="mt-1.5 flex gap-1">
              <input type="text" value={customPath} onChange={(e) => setCustomPath(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customPath.trim()) { onWorkspaceChange(customPath.trim()); setShowCustom(false); setCustomPath(""); }
                  if (e.key === "Escape") { setShowCustom(false); setCustomPath(""); }
                }}
                placeholder="/path/to/folder"
                className="flex-1 px-2 py-1 outline-none"
                style={{
                  background: "var(--bg)", color: "var(--text)",
                  border: "1px solid var(--border)", fontSize: "var(--text-xs)",
                  fontFamily: "var(--font-mono)",
                }}
                spellCheck={false} autoFocus
              />
              <button onClick={() => { setShowCustom(false); setCustomPath(""); }}
                className="px-2 py-1 text-xs" style={{ color: "var(--text-secondary)" }}>✕</button>
            </div>
          )}
        </div>

        {/* File tree — collapsible */}
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setExplorerOpen(!explorerOpen)}
            className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider hover:opacity-70 transition-opacity"
            style={{ color: "var(--text-tertiary)" }}
          >
            <span className="text-[8px]" style={{ color: "var(--accent)" }}>{explorerOpen ? "▼" : "▶"}</span>
            {zh ? "文件" : "Files"}
          </button>
          {workspace && (() => {
            const parent = workspace.replace(/\/+$/, "").replace(/\/[^\/]+$/, "");
            if (!parent) return null;
            return (
              <button
                onClick={() => onWorkspaceChange(parent)}
                className="shrink-0 text-[11px] px-1 py-0.5 transition-colors hover:opacity-80"
                style={{ color: "var(--accent)", background: "transparent" }}
                title={zh ? "上级目录" : "Parent directory"}
              >
                ←
              </button>
            );
          })()}
        </div>
        {explorerOpen && (
          workspace ? (
            <div
              className="max-h-[34vh] overflow-y-auto"
              style={{ background: "var(--bg)", border: "1px solid var(--border)" }}
            >
              <FileTree workspace={workspace} onNavigate={onWorkspaceChange} onFileClick={onFileClick} language={language} />
            </div>
          ) : (
            <div
              className="px-3 py-4 text-center text-xs"
              style={{ background: "var(--bg)", border: "1px dashed var(--border)", color: "var(--text-tertiary)" }}
            >
              {zh ? "选择一个项目，或使用「不使用项目」模式。" : "Choose a project or use No Project mode."}
            </div>
          )
        )}
      </div>

      {/* ── Context Files ────────────────────────────────── */}
      {workspace && <ContextFilesSection workspace={workspace} onFileClick={onFileClick} language={language} />}

      {/* ── Conversations ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-2 py-2 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => setConvOpen(!convOpen)}
              className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider hover:opacity-70 transition-opacity"
              style={{ color: "var(--text-tertiary)" }}
            >
              <span className="text-[8px]" style={{ color: "var(--accent)" }}>{convOpen ? "▼" : "▶"}</span>
              {zh ? "对话" : "Conversations"}
              <span className="px-1 py-px font-normal" style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}>
                {conversations.length}
              </span>
            </button>
            <button
              onClick={onNewConversation}
              className="inline-flex h-6 items-center gap-1 px-2 text-[10px] font-medium transition-colors hover:bg-[var(--bg-hover)]"
              style={{ color: "var(--text-secondary)", border: "1px solid var(--border-light)", background: "transparent" }}
            >
              <span className="text-[12px] leading-none">+</span>
              {zh ? "新建" : "New"}
            </button>
          </div>
        </div>
        {convOpen && (
          <div className="flex-1 overflow-y-auto pl-2 pr-0 py-2 min-h-0">
            {conversations.length === 0 ? (
              <div
                className="px-3 py-4 text-center"
                style={{ background: "var(--bg)", border: "1px dashed var(--border)", color: "var(--text-tertiary)" }}
              >
                <div className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  {zh ? "这个项目还没有对话" : "No chats in this project"}
                </div>
                <button
                  onClick={onNewConversation}
                  className="mt-3 px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
                  style={{ color: "var(--accent)", background: "transparent", border: "1px solid var(--accent)" }}
                >
                  {zh ? "开始对话" : "Start chat"}
                </button>
              </div>
            ) : (
              conversations.map((c) => (
                <div
                  key={c.id}
                  className="group cursor-pointer py-2.5 transition-all duration-75 hover:bg-[var(--bg-hover)]"
                  onClick={() => onSelectConversation(c.id)}
                  style={{
                    paddingLeft: c.id === activeConvId ? "10px" : "12px",
                    paddingRight: "3px",
                    background: c.id === activeConvId ? "var(--bg-selected)" : undefined,
                    borderLeft: c.id === activeConvId ? "2px solid var(--accent)" : "none",
                  }}
                >
                  {editingConvId === c.id ? (
                    <input
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") finishConversationEdit();
                        if (e.key === "Escape") {
                          setEditingConvId(null);
                          setEditingTitle("");
                        }
                      }}
                      onBlur={finishConversationEdit}
                      className="block w-full px-1 py-0.5 text-xs font-medium outline-none"
                      style={{ background: "var(--bg)", color: "var(--accent)", border: "1px solid var(--accent)" }}
                      autoFocus
                      spellCheck={false}
                    />
                  ) : (
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div
                          className="truncate text-xs font-medium"
                          style={{ color: c.id === activeConvId ? "var(--accent)" : "var(--text)" }}
                        >
                          {c.title}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                          <span style={{ fontFamily: "var(--font-mono)" }}>
                            <span style={{ color: "var(--accent)" }}>↑</span>{((c.inputTokens ?? 0) >= 1000 ? `${((c.inputTokens ?? 0) / 1000).toFixed(1)}k` : (c.inputTokens ?? 0))}
                            {' '}<span style={{ color: "var(--accent)" }}>↓</span>{((c.outputTokens ?? 0) >= 1000 ? `${((c.outputTokens ?? 0) / 1000).toFixed(1)}k` : (c.outputTokens ?? 0))}
                            {(c.cacheTokens ?? 0) > 0 && <>
                              {' '}<span style={{ color: "var(--accent)" }}>⚡</span>{((c.cacheTokens ?? 0) >= 1000 ? `${((c.cacheTokens ?? 0) / 1000).toFixed(1)}k` : (c.cacheTokens ?? 0))}
                            </>}
                          </span>
                          <span>·</span>
                          <span className="shrink-0">{formatRelativeTime(c.createdAt)}</span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); startConversationEdit(c); }}
                        className="shrink-0 inline-flex h-5 w-5 items-center justify-center hover:opacity-70 transition-opacity"
                        style={{ color: "oklch(68% 0.13 250)" }}
                        title={zh ? "编辑" : "Edit"}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(c); }}
                        className="shrink-0 inline-flex h-5 w-5 items-center justify-center hover:opacity-70 transition-opacity"
                        style={{ color: "var(--error)" }}
                        title={zh ? "删除" : "Delete"}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ── Footer ────────────────────────────────────────── */}
      <div className="p-2 border-t shrink-0" style={{ borderColor: "var(--border)" }}>
        <button onClick={onOpenSettings}
          className="flex w-full items-center gap-2 px-2 py-1.5 text-xs transition-colors hover:opacity-70"
          style={{ color: "var(--text-secondary)" }} title="Settings">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          {zh ? "设置" : "Settings"}
        </button>
      </div>

      {/* ── Delete confirmation ──────────────────────── */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)" }}
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="p-6 shadow-xl max-w-sm mx-4 text-center slide-in-left"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm mb-3" style={{ color: "var(--text)" }}>
              {zh ? "删除" : "Delete"} "<span className="font-semibold">{deleteTarget.title}</span>"?
            </p>
            <p className="text-[11px] mb-5" style={{ color: "var(--text-secondary)" }}>
              {zh ? "同时删除两侧的对话记录" : "Deletes from both agents-web and Pi CLI"}
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-1.5 text-xs transition-opacity hover:opacity-80"
                style={{ color: "var(--text)", border: "1px solid var(--border)" }}
              >
                {zh ? "取消" : "Cancel"}
              </button>
              <button
                onClick={() => { onDeleteConversation(deleteTarget.id); setDeleteTarget(null); }}
                className="px-4 py-1.5 text-xs transition-opacity hover:opacity-80"
                style={{ background: "var(--error)", color: "#fff" }}
              >
                {zh ? "删除" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      </>
  );
}
