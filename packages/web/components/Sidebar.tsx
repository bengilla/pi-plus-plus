"use client";

import { useCallback, useEffect, useState } from "react";
import { AgentIcon } from "./AgentIcon";
import { AppIcon, FileTypeIcon } from "./AppIcon";
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
}

interface AgentInfo {
  id: string;
  name: string;
  description: string;
  version?: string;
}

export interface ProjectInfo {
  workspace: string;
  name: string;
  count: number;
  lastActivityAt: number;
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
  onDeleteWorkspace: (ws: string) => void;
  agents: AgentInfo[];
  onFileClick: (path: string) => void;
  onAgentInfoClick: () => void;
  language?: "en" | "zh";
  projectWorkspaces: ProjectInfo[];
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
  projectWorkspaces,
  onDeleteWorkspace,
}: Props) {
  const [deleteTarget, setDeleteTarget] = useState<ConvInfo | null>(null);
  const [deleteProjectWs, setDeleteProjectWs] = useState<string | null>(null);
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [piVersion, setPiVersion] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/app/version")
      .then((r) => r.json())
      .then((d) => setAppVersion(d.version))
      .catch(() => {});
    fetch("/api/pi/version")
      .then((r) => r.json())
      .then((d: { currentVersion?: string }) => setPiVersion(d.currentVersion?.replace(/^v/, "") || null))
      .catch(() => {});
  }, []);

  // Auto-expand when workspace changes
  useEffect(() => {
    setExpandedProject(workspace || null);
  }, [workspace]);

  const zh = language === "zh";

  const openFolderPicker = useCallback(async () => {
    if (window.electronAPI?.openFolderDialog) {
      const folder = await window.electronAPI.openFolderDialog();
      if (folder) onWorkspaceChange(folder);
    } else {
      const result = prompt(zh ? "输入文件夹路径:" : "Enter folder path:", workspace || "");
      if (result && result.trim()) onWorkspaceChange(result.trim());
    }
  }, [onWorkspaceChange, workspace, zh]);

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
          <AgentIcon agentId="pi" size={26} />
          <span className="text-sm font-semibold leading-none" style={{ color: "var(--accent)" }}>Pi++</span>
        </div>
        <button
          onClick={onAgentInfoClick}
          className="ml-auto inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 transition-colors hover:bg-[var(--accent-dim)]"
          style={{ color: "var(--accent)", background: "transparent" }}
          title={zh ? "信息" : "Info"}
        >
          <AppIcon name="info" size={12} />
          {zh ? "信息" : "Info"}
        </button>
      </div>

      {/* ── Projects ──────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="shrink-0 px-2 pt-2 pb-1">
          <button
            onClick={openFolderPicker}
            className="w-full py-1.5 text-[11px] font-medium transition-colors hover:opacity-80"
            style={{ color: "var(--accent)", background: "transparent", border: "1px dashed var(--accent)" }}
          >
            <span className="inline-flex items-center justify-center gap-1.5">
              <AppIcon name="folder" size={13} />
              {zh ? "打开文件夹..." : "Open Folder..."}
            </span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-2 min-h-0">
          {projectWorkspaces.length > 0 ? (
            projectWorkspaces.map((p) => {
              const active = p.workspace === workspace;
              return (
                <div key={p.workspace} className="mb-0.5">
                  {/* Project header */}
                  <div
                    className="group flex items-center pr-1"
                    style={{
                      background: active ? "var(--bg-selected)" : undefined,
                      borderLeft: active ? "2px solid var(--accent)" : "2px solid transparent",
                    }}
                  >
                    <button
                      onClick={() => {
                        if (p.workspace === workspace) {
                          setExpandedProject(expandedProject === p.workspace ? null : p.workspace);
                        } else {
                          onWorkspaceChange(p.workspace);
                        }
                      }}
                      className="flex-1 text-left pl-2 py-1.5 transition-colors hover:bg-[var(--bg-hover)]"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex shrink-0" style={{ color: "var(--text-tertiary)" }}>
                          <AppIcon name={expandedProject === p.workspace ? "chevron-down" : "chevron-right"} size={11} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-1.5 truncate text-[13px] font-medium" style={{ color: active ? "var(--accent)" : "var(--text)" }}>
                            <FileTypeIcon name={p.name} type="directory" size={15} open={expandedProject === p.workspace} />
                            <span className="truncate">{p.name}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                    <div className="flex items-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (p.workspace === workspace) {
                            onNewConversation();
                          } else {
                            onWorkspaceChange(p.workspace);
                          }
                        }}
                        className="px-1 py-1.5 transition-colors hover:text-[var(--accent)]"
                        style={{ color: "var(--text-tertiary)" }}
                        title={zh ? "新建对话" : "New chat"}
                      >
                        <AppIcon name="message-plus" size={12} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteProjectWs(p.workspace); }}
                        className="px-1 py-1.5 transition-colors hover:text-red-400"
                        style={{ color: "var(--text-tertiary)" }}
                        title={zh ? "删除项目及所有对话" : "Delete project and all chats"}
                      >
                        <AppIcon name="trash" size={12} />
                      </button>
                    </div>
                  </div>
                  {/* Conversations under expanded project */}
                  {expandedProject === p.workspace && (
                    <div className="pl-3 pr-1">
                      {conversations.length === 0 ? (
                        <div className="px-2 py-3 text-center text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                          {zh ? "尚无对话" : "No chats yet"}
                        </div>
                      ) : (
                        conversations.map((c) => (
                          <div
                            key={c.id}
                            className="group cursor-pointer py-1.5 transition-colors hover:bg-[var(--bg-hover)]"
                            onClick={() => onSelectConversation(c.id)}
                            style={{
                              paddingLeft: c.id === activeConvId ? "8px" : "10px",
                              paddingRight: "2px",
                              borderLeft: c.id === activeConvId ? "2px solid var(--accent)" : "2px solid transparent",
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
                                className="block w-full px-1 py-0.5 text-[10px] font-medium outline-none"
                                style={{ background: "var(--bg)", color: "var(--accent)", border: "1px solid var(--accent)" }}
                                autoFocus
                                spellCheck={false}
                              />
                            ) : (
                              <div className="flex items-start gap-1.5">
                                <div className="min-w-0 flex-1">
                                  <div
                                    className="truncate text-xs"
                                    style={{ color: c.id === activeConvId ? "var(--accent)" : "var(--text-secondary)" }}
                                  >
                                    {c.title}
                                  </div>
                                </div>
                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); startConversationEdit(c); }}
                                    className="shrink-0 inline-flex h-4 w-4 items-center justify-center hover:opacity-70"
                                    style={{ color: "oklch(68% 0.13 250)" }}
                                    title={zh ? "编辑" : "Edit"}
                                  >
                                    <AppIcon name="edit" size={12} />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(c); }}
                                    className="shrink-0 inline-flex h-4 w-4 items-center justify-center hover:opacity-70"
                                    style={{ color: "var(--error)" }}
                                    title={zh ? "删除" : "Delete"}
                                  >
                                    <AppIcon name="trash" size={12} />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                      <button
                        onClick={onNewConversation}
                        className="w-full mt-0.5 text-center px-2 py-1 text-xs transition-colors hover:bg-[var(--accent-dim)]"
                        style={{ color: "var(--accent)", border: "1px dashed var(--accent)" }}
                      >
                        <span className="inline-flex items-center justify-center gap-1.5">
                          <AppIcon name="message-plus" size={12} />
                          {zh ? "新对话" : "New chat"}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="px-2 py-4 text-center text-[10px]" style={{ color: "var(--text-tertiary)" }}>
              {zh ? "打开文件夹开始" : "Open a folder to start"}
            </div>
          )}
        </div>
      </div>

      {/* ── Context Files ────────────────────────────────── */}
      {workspace && <ContextFilesSection workspace={workspace} onFileClick={onFileClick} language={language} />}

      {/* ── Info ──────────────────────────────────────────── */}
      {(appVersion || piVersion) && (
        <div className="px-2 py-1.5 border-t shrink-0 space-y-1" style={{ borderColor: "var(--border)" }}>
          {appVersion && (
            <div className="flex items-center justify-between text-[9px]" style={{ color: "var(--text-tertiary)" }}>
              <span>Pi++</span>
              <span style={{ fontFamily: "var(--font-mono)" }}>v{appVersion}</span>
            </div>
          )}
          {piVersion && (
            <>
              <div style={{ borderTop: "1px solid var(--border-light)" }} />
              <div className="flex items-center justify-between text-[9px]" style={{ color: "var(--text-tertiary)" }}>
                <span>Pi agent</span>
                <span style={{ fontFamily: "var(--font-mono)" }}>v{piVersion}</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Footer ────────────────────────────────────────── */}
      <div className="p-2 border-t shrink-0" style={{ borderColor: "var(--border)" }}>
        <button onClick={onOpenSettings}
          className="flex w-full items-center gap-2 px-2 py-1.5 text-xs transition-colors hover:opacity-70"
          style={{ color: "var(--text-secondary)" }} title="Settings">
          <AppIcon name="settings" size={14} />
          {zh ? "设置" : "Settings"}
        </button>
      </div>

      {/* ── Delete conversation confirmation ─────────── */}
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
              {zh ? "同时删除 pi++ 和 Pi CLI 两侧的对话记录" : "Deletes from both pi++ and Pi CLI"}
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

      {/* ── Delete project confirmation ──────────────── */}
      {deleteProjectWs && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)" }}
          onClick={() => setDeleteProjectWs(null)}
        >
          <div
            className="p-6 shadow-xl max-w-sm mx-4 text-center slide-in-left"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm mb-3" style={{ color: "var(--text)" }}>
              {zh ? "删除项目" : "Delete project"} "<span className="font-semibold">{deleteProjectWs.split("/").filter(Boolean).pop() || deleteProjectWs}</span>"?
            </p>
            <p className="text-[11px] mb-5" style={{ color: "var(--text-secondary)" }}>
              {zh ? `将删除该项目下的所有对话记录` : `All conversations in this project will be deleted`}
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setDeleteProjectWs(null)}
                className="px-4 py-1.5 text-xs transition-opacity hover:opacity-80"
                style={{ color: "var(--text)", border: "1px solid var(--border)" }}
              >
                {zh ? "取消" : "Cancel"}
              </button>
              <button
                onClick={() => {
                  const ws = deleteProjectWs;
                  onDeleteWorkspace(ws);
                  if (ws === workspace) onWorkspaceChange("");
                  setDeleteProjectWs(null);
                }}
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
