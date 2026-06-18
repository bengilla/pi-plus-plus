"use client";

import { useState, useRef, useCallback, useEffect, type DragEvent } from "react";
import { flattenFiles } from "@/lib/utils/chat";
import { AppIcon, FileTypeIcon } from "./AppIcon";
import { LoopButton, type LoopState } from "./LoopButton";

// ── Types ────────────────────────────────────────────────────

interface Attachment {
  name: string;
  path: string;
  type: "file" | "image";
}

interface BriefDraft {
  goal: string;
  plan: string;
  references: string;
  acceptance: string;
}

interface Props {
  agentName: string;
  workspace: string;
  language: "en" | "zh";
  streaming: boolean;
  onSend: (text: string, attachments: Attachment[]) => void;
  onStop: () => void;
  /** Extra buttons to show in the bottom bar between attach and send/stop */
  footerExtras?: React.ReactNode;
  /** Called when pressing ArrowDown at the bottom of history (scroll messages to bottom) */
  onScrollToBottom?: () => void;
}

export function ChatInput({ agentName, workspace, language: lang, streaming, onSend, onStop, footerExtras, onScrollToBottom }: Props) {
  const zh = lang === "zh";

  const [loopState, setLoopState] = useState<LoopState>({ running: false, progress: null, report: null });

  const [input, setInput] = useState("");
  const [briefMode, setBriefMode] = useState(false);
  const [briefDraft, setBriefDraft] = useState<BriefDraft>({
    goal: "", plan: "", references: "", acceptance: "",
  });
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionResults, setMentionResults] = useState<
    { name: string; path: string }[]
  >([]);
  const [mentionSelected, setMentionSelected] = useState(0);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [inputDragOver, setInputDragOver] = useState(false);
  const [panelHeight, setPanelHeight] = useState<number | null>(null);

  // ── /skill command ──────────────────────────
  const [skillOpen, setSkillOpen] = useState(false);
  const [skillResults, setSkillResults] = useState<{ id: string; name: string; description: string }[]>([]);
  const [skillSelected, setSkillSelected] = useState(0);
  const [activeSkills, setActiveSkills] = useState<{ id: string; name: string }[]>([]);
  const [skillLoading, setSkillLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputHistoryRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const historyDraftRef = useRef("");
  const composingRef = useRef(false);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // ── Panel drag resize ────────────────────────────────────
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      e.preventDefault();
      // Invert: dragging UP (decreasing Y) should make panel taller
      const dh = dragRef.current.startY - e.clientY;
      const maxH = Math.round(window.innerHeight * 0.5);
      setPanelHeight(Math.max(180, Math.min(maxH, dragRef.current.startH + dh)));
    };
    const onMouseUp = () => { dragRef.current = null; };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const el = panelRef.current;
    if (!el) return;
    dragRef.current = { startY: e.clientY, startH: el.offsetHeight };
  }, []);

  // ── Helpers ─────────────────────────────────────────────────

  const briefHasContent =
    briefDraft.goal.trim().length > 0 ||
    briefDraft.plan.trim().length > 0 ||
    briefDraft.references.trim().length > 0 ||
    briefDraft.acceptance.trim().length > 0;

  const briefText = useCallback(() => {
    const lines = briefDraft.plan
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const refs = briefDraft.references
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const checks = briefDraft.acceptance
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const sections = [
      "# Task Brief",
      "",
      "## Goal",
      briefDraft.goal.trim() || "(No goal provided)",
      "",
      "## Plan",
      lines.length > 0
        ? lines.map((line, i) => `${i + 1}. ${line}`).join("\n")
        : "(No plan steps provided)",
    ];

    if (refs.length > 0) {
      sections.push(
        "",
        "## References",
        refs.map((line) => `- ${line}`).join("\n"),
      );
    }
    if (checks.length > 0) {
      sections.push(
        "",
        "## Acceptance Criteria",
        checks.map((line) => `- ${line}`).join("\n"),
      );
    }
    if (attachments.length > 0) {
      sections.push(
        "",
        "## Attached Assets",
        attachments
          .map((a) => `- ${a.type === "image" ? "Image" : "File"}: ${a.name}`)
          .join("\n"),
      );
    }

    sections.push(
      "",
      "Please execute this brief step by step. If anything is ambiguous, make a reasonable product-minded assumption and continue. Keep the implementation aligned with the references and acceptance criteria.",
    );

    return sections.join("\n");
  }, [attachments, briefDraft]);

  const insertMention = () => {
    const ta = textareaRef.current;
    if (!ta || mentionResults.length === 0) return;
    const file = mentionResults[mentionSelected];
    const cursor = ta.selectionStart;
    const textBefore = input.slice(0, cursor);
    const atIdx = textBefore.lastIndexOf("@");
    if (atIdx === -1) return;
    const newInput =
      input.slice(0, atIdx) + file.path + " " + input.slice(cursor);
    setInput(newInput);
    setMentionOpen(false);
    setTimeout(() => {
      const pos = atIdx + file.path.length + 1;
      ta.setSelectionRange(pos, pos);
      ta.focus();
    }, 0);
  };

  // ── /skill handlers ─────────────────────────
  const toggleSkillForProject = async (skillId: string, skillName: string) => {
    const isActive = activeSkills.some((s) => s.id === skillId);
    try {
      await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "project-toggle", skillId, workspace, enabled: !isActive }),
      });
    } catch { /* ignore */ }

    if (isActive) {
      setActiveSkills((prev) => prev.filter((s) => s.id !== skillId));
    } else {
      setActiveSkills((prev) => [...prev, { id: skillId, name: skillName }]);
    }
    setSkillOpen(false);
    const ta = textareaRef.current;
    if (!ta) return;
    const cursor = ta.selectionStart;
    const before = input.slice(0, cursor);
    const after = input.slice(cursor);
    const slashIdx = before.lastIndexOf("/skill");
    if (slashIdx !== -1) {
      const newInput = before.slice(0, slashIdx) + after;
      setInput(newInput);
      setTimeout(() => {
        ta.setSelectionRange(slashIdx, slashIdx);
        ta.focus();
      }, 0);
    }
  };

  const removeProjectSkill = async (skillId: string) => {
    try {
      await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "project-toggle", skillId, workspace, enabled: false }),
      });
    } catch { /* ignore */ }
    setActiveSkills((prev) => prev.filter((s) => s.id !== skillId));
  };

  useEffect(() => {
    if (!workspace || workspace === "~") return;
    fetch(`/api/skills?workspace=${encodeURIComponent(workspace)}`)
      .then((r) => r.json())
      .then((data) => {
        const enabled = (data.skills ?? []).filter((s: { projectEnabled: boolean }) => s.projectEnabled);
        setActiveSkills(enabled.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })));
      })
      .catch(() => {});
  }, [workspace]);

  // ── Handlers ────────────────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Don't handle arrow keys during IME composition (Chinese pinyin, Japanese, etc.)
    if (composingRef.current) return;
    // Input history: up/down arrows
    if (e.key === "ArrowUp" && !e.shiftKey) {
      const history = inputHistoryRef.current;
      if (history.length === 0) return;
      // Only navigate history when input is empty; otherwise let textarea handle cursor
      if (input.trim().length > 0) return;
      e.preventDefault();
      if (historyIndexRef.current === -1) {
        historyDraftRef.current = input;
      }
      const nextIdx = Math.min(historyIndexRef.current + 1, history.length - 1);
      historyIndexRef.current = nextIdx;
      setInput(history[nextIdx] ?? "");
      setTimeout(() => {
        const ta = textareaRef.current;
        if (ta) {
          const len = history[nextIdx]?.length ?? 0;
          ta.setSelectionRange(len, len);
        }
      }, 0);
      return;
    }
    if (e.key === "ArrowDown" && !e.shiftKey) {
      e.preventDefault();
      // Already at bottom (not navigating history): scroll to end of conversation
      if (historyIndexRef.current < 0) {
        onScrollToBottom?.();
        return;
      }
      // Returning from first history item back to saved draft
      if (historyIndexRef.current === 0) {
        historyIndexRef.current = -1;
        setInput(historyDraftRef.current);
        setTimeout(() => {
          const ta = textareaRef.current;
          if (ta) {
            const len = historyDraftRef.current.length;
            ta.setSelectionRange(len, len);
          }
        }, 0);
        return;
      }
      const nextIdx = historyIndexRef.current - 1;
      historyIndexRef.current = nextIdx;
      setInput(inputHistoryRef.current[nextIdx] ?? "");
      setTimeout(() => {
        const ta = textareaRef.current;
        if (ta) {
          const len = inputHistoryRef.current[nextIdx]?.length ?? 0;
          ta.setSelectionRange(len, len);
        }
      }, 0);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    const text = briefMode ? briefText().trim() : input.trim();
    if ((!text && attachments.length === 0) || streaming) return;

    const attList = [...attachments];

    // Save to input history
    if (text && text.length > 1) {
      inputHistoryRef.current = [text, ...inputHistoryRef.current.filter((h) => h !== text)].slice(0, 50);
    }
    historyIndexRef.current = -1;

    onSend(text, attList);

    setInput("");
    if (briefMode) {
      setBriefDraft({ goal: "", plan: "", references: "", acceptance: "" });
    }
    setAttachments([]);
  };

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setAttachments((prev) => {
          if (prev.some((a) => a.name === f.name)) return prev;
          return [
            ...prev,
            {
              name: f.name,
              path: f.name,
              type: f.type.startsWith("image/") ? "image" : "file",
            },
          ];
        });
      }
      e.target.value = "";
    },
    [],
  );

  const removeAttachment = useCallback((name: string) => {
    setAttachments((prev) => prev.filter((a) => a.name !== name));
  }, []);

  // ── Drag+drop on input area ─────────────────────────────────

  const handleInputDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setInputDragOver(true);
  }, []);

  const handleInputDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setInputDragOver(false);
  }, []);

  const handleInputDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setInputDragOver(false);

      const files = e.dataTransfer.files;
      if (files) {
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          const isImage = f.type.startsWith("image/");
          setAttachments((prev) => {
            if (prev.some((a) => a.name === f.name)) return prev;
            return [
              ...prev,
              { name: f.name, path: f.name, type: isImage ? "image" : "file" },
            ];
          });
        }
      }
    },
    [],
  );

  // ── Render ──────────────────────────────────────────────────

  const canSend =
    (briefMode ? briefHasContent : input.trim()) || attachments.length > 0;

  return (
    <div
      ref={panelRef}
      className="shrink-0 flex flex-col"
      style={{
        borderTop: "1px solid var(--border)",
        background: "var(--bg)",
        height: panelHeight ?? undefined,
      }}
    >
      {/* Drag handle */}
      <div
        onMouseDown={handleDragStart}
        className="shrink-0 cursor-row-resize"
        style={{
          height: "4px",
          background: "transparent",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: "1px 0",
            background: "var(--border)",
            opacity: 0.3,
            transition: "opacity 0.15s",
          }}
          className="hover:opacity-100"
        />
      </div>

      <div
        className="flex-1 min-h-0 overflow-y-auto px-5 py-3 flex flex-col"
        onDragOver={handleInputDragOver}
        onDragLeave={handleInputDragLeave}
        onDrop={handleInputDrop}
      >
        <div className="mx-auto w-full max-w-[880px] flex flex-col flex-1 min-h-0">
        {/* Attachment bar */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {attachments.map((a) => (
              <span
                key={a.name}
                className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 text-xs"
                style={{
                  background: "var(--color-accent-dim)",
                  color: "var(--color-accent)",
                }}
              >
                <FileTypeIcon name={a.name} size={14} /> {a.name}
                <button
                  onClick={() => removeAttachment(a.name)}
                  className="inline-flex h-4 w-4 items-center justify-center hover:opacity-70"
                  style={{ color: "var(--color-text-secondary)" }}
                  title={zh ? "移除" : "Remove"}
                  aria-label={zh ? "移除" : "Remove"}
                >
                  <AppIcon name="x" size={11} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* /skill dropdown */}
        {skillOpen && skillResults.length > 0 && (
          <div
            className="mb-1 border overflow-hidden"
            style={{
              background: "var(--bg-elevated)",
              borderColor: "var(--border)",
              boxShadow: "var(--shadow-overlay)",
            }}
          >
            {skillLoading && (
              <div className="px-3 py-1.5 text-[10px]" style={{ color: "var(--text-secondary)" }}>
                {zh ? "加载中..." : "Loading..."}
              </div>
            )}
            {skillResults.map((s, i) => {
              const isActive = activeSkills.some((a) => a.id === s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => toggleSkillForProject(s.id, s.name)}
                  onMouseEnter={() => setSkillSelected(i)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors"
                  style={{
                    color: "var(--text)",
                    background: i === skillSelected ? "var(--bg-selected)" : "transparent",
                  }}
                >
                  <span className="shrink-0" style={{ color: isActive ? "var(--success)" : "var(--accent)" }}>
                    <AppIcon name={isActive ? "check" : "plus"} size={13} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{s.name}</span>
                    <span className="ml-2 text-[10px] truncate" style={{ color: "var(--text-secondary)" }}>
                      {s.description.slice(0, 60)}
                    </span>
                  </div>
                  {isActive && (
                    <span className="text-[9px] px-1" style={{ color: "var(--accent)", border: "1px solid var(--accent)" }}>
                      {zh ? "已启用" : "active"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Active skills tags */}
        {activeSkills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {activeSkills.map((s) => (
              <span
                key={s.id}
                className="inline-flex items-center gap-1 pl-2 pr-1 py-1 text-xs"
                style={{ background: "var(--color-accent-dim)", color: "var(--color-accent)" }}
              >
                <AppIcon name="zap" size={12} /> {s.name}
                <button
                  onClick={() => removeProjectSkill(s.id)}
                  className="inline-flex h-4 w-4 items-center justify-center hover:opacity-70"
                  style={{ color: "var(--text-secondary)" }}
                  title={zh ? "移除" : "Remove"}
                  aria-label={zh ? "移除" : "Remove"}
                >
                  <AppIcon name="x" size={11} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* @mention dropdown */}
        {mentionOpen && mentionResults.length > 0 && (
          <div
            className="mb-1 border overflow-hidden"
            style={{
              background: "var(--bg-elevated)",
              borderColor: "var(--border)",
              boxShadow: "var(--shadow-overlay)",
            }}
          >
            {mentionResults.map((f, i) => (
              <button
                key={f.path}
                onClick={() => {
                  setMentionSelected(i);
                  insertMention();
                }}
                onMouseEnter={() => setMentionSelected(i)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors"
                style={{
                  color: "var(--text)",
                  background:
                    i === mentionSelected ? "var(--bg-selected)" : "transparent",
                }}
              >
                <FileTypeIcon name={f.name} type={f.name.includes(".") ? "file" : "directory"} size={14} className="opacity-80" />
                <span
                  className="truncate"
                  style={{ fontFamily: "var(--font-mono)", fontSize: "11px" }}
                >
                  {f.path}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Chat / Brief toggle + Loop */}
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div
              className="inline-flex overflow-hidden p-0.5 text-xs"
              style={{
                background: "var(--bg)",
                border: "1px solid var(--border-light)",
              }}
            >
              {[
                { value: false, label: zh ? "对话" : "Chat" },
                { value: true, label: zh ? "计划" : "Brief" },
              ].map((mode) => (
                <button
                  key={String(mode.value)}
                  onClick={() => setBriefMode(mode.value)}
                  className="px-2.5 py-1 transition-colors"
                  style={{
                    background:
                      briefMode === mode.value
                        ? "var(--bg-selected)"
                        : "transparent",
                    color:
                      briefMode === mode.value
                        ? "var(--text)"
                        : "var(--text-secondary)",
                  }}
                  disabled={streaming}
                >
                  {mode.label}
                </button>
              ))}
            </div>
            {briefMode && (
              <span className="truncate text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                {zh ? "整理目标、步骤、链接和素材" : "Organize goals, steps, links, and assets"}
              </span>
            )}
          </div>
          <LoopButton workspace={workspace} language={lang} onStateChange={setLoopState} />
        </div>

        {/* Loop progress bar */}
        {loopState.running && loopState.progress && (
          <div className="mb-2 flex items-center gap-3 px-3 py-1.5 text-[11px]"
            style={{
              background: "var(--bg)",
              border: "1px solid var(--accent)",
              color: "var(--text)",
            }}
          >
            <span className="inline-block w-2.5 h-2.5 rounded-full animate-spin"
              style={{
                border: "2px solid var(--accent)",
                borderTopColor: "transparent",
              }}
            />
            <span style={{ color: "var(--accent)" }}>
              {loopState.progress.phase}
            </span>
            {loopState.progress.turn > 0 && (
              <span style={{ color: "var(--text-tertiary)" }}>
                Turn {loopState.progress.turn}/{loopState.progress.maxTurns}
              </span>
            )}
            {loopState.progress.message && (
              <span style={{ color: "var(--text-secondary)" }}>
                {loopState.progress.message}
              </span>
            )}
            {loopState.progress.status === "pass" && <span style={{ color: "var(--accent)" }}><AppIcon name="check" size={13} /></span>}
            {loopState.progress.status === "fail" && <span style={{ color: "var(--error)" }}><AppIcon name="x" size={13} /></span>}
          </div>
        )}

        {/* Input: Brief mode */}
        {briefMode ? (
          <div
            className="grid gap-2 p-2.5"
            style={{
              background: inputDragOver
                ? "var(--color-accent-dim)"
                : "var(--color-surface)",
              border: `1px solid ${
                inputDragOver ? "var(--color-accent)" : "var(--color-border)"
              }`,
            }}
          >
            <input
              value={briefDraft.goal}
              onChange={(e) =>
                setBriefDraft((prev) => ({ ...prev, goal: e.target.value }))
              }
              placeholder={
                zh
                  ? "目标：你希望 agent 完成什么？"
                  : "Goal: what should the agent accomplish?"
              }
              className="px-2 py-1.5 text-sm outline-none"
              style={{
                background: "var(--bg-input)",
                color: "var(--text)",
                border: "1px solid var(--border-light)",
              }}
              disabled={streaming}
            />
            <textarea
              value={briefDraft.plan}
              onChange={(e) =>
                setBriefDraft((prev) => ({ ...prev, plan: e.target.value }))
              }
              placeholder={
                zh
                  ? "计划步骤：一行一项，比如\n1. 调整页面布局\n2. 加入参考 logo\n3. 完成后构建验证"
                  : "Plan steps: one item per line, for example\nAdjust the layout\nUse the attached logo reference\nBuild and verify"
              }
              rows={4}
              className="resize-none px-2 py-1.5 text-sm outline-none"
              style={{
                background: "var(--bg-input)",
                color: "var(--text)",
                border: "1px solid var(--border-light)",
              }}
              disabled={streaming}
            />
            <textarea
              value={briefDraft.references}
              onChange={(e) =>
                setBriefDraft((prev) => ({
                  ...prev,
                  references: e.target.value,
                }))
              }
              placeholder={
                zh
                  ? "参考链接 / LOGO / 图片说明：一行一个，可以贴网址或描述附件"
                  : "References / logos / image notes: one per line, paste URLs or describe attachments"
              }
              rows={2}
              className="resize-none px-2 py-1.5 text-sm outline-none"
              style={{
                background: "var(--bg-input)",
                color: "var(--text)",
                border: "1px solid var(--border-light)",
              }}
              disabled={streaming}
            />
            <textarea
              value={briefDraft.acceptance}
              onChange={(e) =>
                setBriefDraft((prev) => ({
                  ...prev,
                  acceptance: e.target.value,
                }))
              }
              placeholder={
                zh
                  ? "验收标准：你希望最后满足哪些条件？一行一项"
                  : "Acceptance criteria: what must be true at the end? One per line"
              }
              rows={2}
              className="resize-none px-2 py-1.5 text-sm outline-none"
              style={{
                background: "var(--bg-input)",
                color: "var(--text)",
                border: "1px solid var(--border-light)",
              }}
              disabled={streaming}
            />
          </div>
        ) : (
          <textarea
            value={input}
            ref={textareaRef}
            onChange={(e) => {
              setInput(e.target.value);
              historyIndexRef.current = -1;
              // @mention detection
              const ta = e.target;
              const cursor = ta.selectionStart;
              const textBefore = e.target.value.slice(0, cursor);
              const atMatch = textBefore.match(/@(\S*)$/);
              if (atMatch) {
                const q = atMatch[1].toLowerCase();
                setMentionSelected(0);
                if (workspace) {
                  fetch(
                    `/api/files?path=.&workspace=${encodeURIComponent(workspace)}`,
                  )
                    .then((r) => r.json())
                    .then((d) => {
                      const files = (d.files ??
                        []) as {
                        name: string;
                        path: string;
                        type: string;
                      }[];
                      const flat = flattenFiles(files).filter((f) =>
                        f.name.toLowerCase().includes(q),
                      );
                      setMentionResults(flat.slice(0, 8));
                      setMentionOpen(flat.length > 0);
                    })
                    .catch((e: unknown) => { console.error("[pi++] Mention file search failed:", e); });
                }
              } else {
                setMentionOpen(false);
              }

              // /skill detection — show all installed skills regardless of workspace
              const skillMatch = textBefore.match(/\/skill(\S*)$/);
              if (skillMatch) {
                const sq = skillMatch[1].toLowerCase();
                setSkillSelected(0);
                setSkillLoading(true);
                fetch(`/api/skills${workspace ? `?workspace=${encodeURIComponent(workspace)}` : ""}`)
                  .then((r) => r.json())
                  .then((data) => {
                    const list = (data.skills ?? []).filter(
                      (s: { enabled: boolean; name: string; id: string; description: string }) =>
                        s.enabled && (
                          s.name.toLowerCase().includes(sq) ||
                          s.id.toLowerCase().includes(sq)
                        )
                    );
                    setSkillResults(list);
                    setSkillOpen(list.length > 0);
                  })
                  .catch(() => {})
                  .finally(() => setSkillLoading(false));
              } else {
                setSkillOpen(false);
              }
            }}
            onCompositionStart={() => { composingRef.current = true; }}
            onCompositionEnd={() => { composingRef.current = false; }}
            onPaste={(e) => {
              const items = e.clipboardData?.items;
              if (!items) return;
              let handled = false;
              for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.type.startsWith("image/")) {
                  e.preventDefault();
                  const file = item.getAsFile();
                  if (file) {
                    setAttachments((prev) => {
                      if (prev.some((a) => a.name === file.name)) return prev;
                      return [
                        ...prev,
                        { name: file.name, path: file.name, type: "image" },
                      ];
                    });
                  }
                  handled = true;
                }
              }
              if (handled) return;
              setTimeout(() => {
                historyIndexRef.current = -1;
              }, 0);
            }}
            onKeyDown={(e) => {
              if (skillOpen) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setSkillSelected((s) => Math.min(s + 1, skillResults.length - 1));
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setSkillSelected((s) => Math.max(s - 1, 0));
                  return;
                }
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  const sel = skillResults[skillSelected];
                  if (sel) toggleSkillForProject(sel.id, sel.name);
                  return;
                }
                if (e.key === "Escape") {
                  setSkillOpen(false);
                  return;
                }
              }
              if (mentionOpen) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setMentionSelected((s) =>
                    Math.min(s + 1, mentionResults.length - 1),
                  );
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setMentionSelected((s) => Math.max(s - 1, 0));
                  return;
                }
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  insertMention();
                  return;
                }
                if (e.key === "Escape") {
                  setMentionOpen(false);
                  return;
                }
              }
              handleKeyDown(e);
            }}
            placeholder={zh ? `问 ${agentName}...` : `Ask ${agentName}...`}
            rows={3}
            className="w-full resize-none p-3 text-sm outline-none transition-colors"
            style={{
              flex: "1",
              background: inputDragOver
                ? "var(--color-accent-dim)"
                : "var(--bg-input)",
              color: "var(--color-text)",
              border: `1px solid ${
                inputDragOver ? "var(--color-accent)" : "var(--border-light)"
              }`,
            }}
            disabled={streaming}
          />
        )}

        {/* Bottom bar: attach + footerExtras + send/stop */}
        <div className="flex justify-between items-center gap-3 mt-2">
          <div className="flex min-w-0 items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex h-7 w-7 items-center justify-center transition-colors hover:bg-[var(--accent-dim)]"
              style={{ color: "var(--accent)", background: "transparent" }}
              disabled={streaming}
              title={zh ? "添加附件" : "Attach"}
              aria-label={zh ? "添加附件" : "Attach"}
            >
              <AppIcon name="paperclip" size={14} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
              accept="image/*,.md,.txt,.json,.ts,.tsx,.js,.jsx,.py,.css,.html,.yaml,.yml,.toml"
            />
            {footerExtras}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {streaming ? (
              <button
                onClick={onStop}
                className="inline-flex h-8 w-8 items-center justify-center transition-colors hover:opacity-80"
                style={{
                  background: "transparent",
                  color: "var(--accent)",
                  border: "1px solid var(--accent)",
                }}
                title={zh ? "停止" : "Stop"}
                aria-label={zh ? "停止" : "Stop"}
              >
                <AppIcon name="stop" size={12} />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!canSend}
                className="inline-flex h-8 w-8 items-center justify-center transition-colors"
                style={{
                  background: "transparent",
                  color: canSend ? "var(--accent)" : "var(--text-tertiary)",
                  border: canSend
                    ? "1px solid var(--accent)"
                    : "1px solid var(--border-light)",
                  opacity: canSend ? 1 : 0.4,
                }}
                title={briefMode ? (zh ? "开始执行" : "Start") : (zh ? "发送" : "Send")}
                aria-label={briefMode ? (zh ? "开始执行" : "Start") : (zh ? "发送" : "Send")}
              >
                <AppIcon name="arrow-up" size={14} strokeWidth={2.2} />
              </button>
            )}
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
