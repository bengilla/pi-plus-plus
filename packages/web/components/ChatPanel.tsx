"use client";

import { useState, useRef, useEffect, useCallback, type DragEvent } from "react";
import type { ContentBlock } from "@/lib/agents/types";
import { MarkdownBody } from "./MarkdownBody";
import { ThinkingBlock } from "./ThinkingBlock";
import { ToolCallBlock } from "./ToolCallBlock";
import { ToolResultBlock } from "./ToolResultBlock";
import { WelcomeScreen } from "./WelcomeScreen";

interface Attachment {
  name: string;
  path: string;
  type: "file" | "image";
}

interface Message {
  role: "user" | "assistant" | "error";
  content: string;
  id: string;
  createdAt: number;
  attachments?: Attachment[];
  /** Rich content blocks from streaming (undefined = legacy plain-text message) */
  blocks?: ContentBlock[];
  inputTokens?: number;
  outputTokens?: number;
  cacheTokens?: number;
  durationSeconds?: number;
}

export interface ChatMessageSnapshot {
  role: string;
  content: string;
  id: string;
  createdAt?: number;
  attachments?: Attachment[];
  blocks?: ContentBlock[];
  inputTokens?: number;
  outputTokens?: number;
  cacheTokens?: number;
  durationSeconds?: number;
}

function flattenFiles(nodes: { name: string; path: string; type: string; children?: unknown[] }[]): { name: string; path: string }[] {
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

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hours = d.getHours().toString().padStart(2, "0");
  const mins = d.getMinutes().toString().padStart(2, "0");
  return `${month}月${day}日 ${hours}:${mins}`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60).toString().padStart(2, "0");
  return `${mins}m ${secs}s`;
}

interface BriefDraft {
  goal: string;
  plan: string;
  references: string;
  acceptance: string;
}

interface Props {
  activeAgent: string;
  agentName?: string;
  agentDescription?: string;
  conversationId?: string | null;
  workspace: string;
  initialMessages?: ChatMessageSnapshot[];
  onMessagesChange?: (messages: ChatMessageSnapshot[]) => void;
  thinkingLevel?: string;
  thinkingLevels?: { value: string; label: string }[];
  onThinkingLevelChange?: (level: string) => void;
  language?: "en" | "zh";
}

function toMessages(messages?: ChatMessageSnapshot[]): Message[] {
  return (messages ?? []).map((m) => ({
    role: m.role as "user" | "assistant" | "error",
    content: m.content,
    id: m.id,
    createdAt: m.createdAt ?? 0,
    attachments: m.attachments,
    blocks: m.blocks,
    inputTokens: m.inputTokens,
    outputTokens: m.outputTokens,
    cacheTokens: m.cacheTokens,
    durationSeconds: m.durationSeconds,
  }));
}

export function ChatPanel({
  activeAgent,
  agentName,
  agentDescription,
  conversationId,
  workspace,
  initialMessages,
  onMessagesChange,
  thinkingLevel = "auto",
  thinkingLevels = [],
  onThinkingLevelChange,
  language = "en",
}: Props) {
  const displayName = agentName ?? activeAgent;
  const zh = language === "zh";

  const [messages, setMessages] = useState<Message[]>(() => toMessages(initialMessages));
  const [input, setInput] = useState("");
  const [briefMode, setBriefMode] = useState(false);
  const [briefDraft, setBriefDraft] = useState<BriefDraft>({ goal: "", plan: "", references: "", acceptance: "" });
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionResults, setMentionResults] = useState<{ name: string; path: string }[]>([]);
  const [mentionSelected, setMentionSelected] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const streamStartRef = useRef(0);
  // Ref-backed to bypass React 18 batching — SSE loop writes ref, rAF polls it
  const streamContentRef = useRef("");
  const streamOutputTokensRef = useRef(0);
  const streamInputTokensRef = useRef(0);
  const streamCacheTokensRef = useRef(0);
  const streamTickRef = useRef(0);
  const [streamTick, setStreamTick] = useState(0);
  // Rich content blocks accumulated during streaming
  const streamBlocksRef = useRef<ContentBlock[]>([]);
  const streamThinkRef = useRef("");
  const streamThinkStartRef = useRef(0);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [inputDragOver, setInputDragOver] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setMessages(toMessages(initialMessages));
  }, [conversationId]);

  // Report messages back to parent for conversation persistence
  const onSaveRef = useRef(onMessagesChange);
  onSaveRef.current = onMessagesChange;
  useEffect(() => {
    onSaveRef.current?.(messages.map((m) => ({
      role: m.role,
      content: m.content,
      id: m.id,
      createdAt: m.createdAt,
      attachments: m.attachments,
      blocks: m.blocks,
      inputTokens: m.inputTokens,
      outputTokens: m.outputTokens,
      cacheTokens: m.cacheTokens,
      durationSeconds: m.durationSeconds,
    })));
  }, [messages]);

  // Elapsed timer during streaming
  useEffect(() => {
    if (!streaming) { setElapsed(0); return; }
    streamStartRef.current = Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.round((Date.now() - streamStartRef.current) / 1000));
    }, 200);
    return () => clearInterval(timer);
  }, [streaming]);

  // rAF sync: poll refs each frame and trigger re-render when content changes.
  useEffect(() => {
    if (!streaming) return;
    let running = true;
    const tick = () => {
      if (!running) return;
      // Trigger re-render if SSE loop wrote new data
      if (streamTickRef.current !== streamTick) {
        setStreamTick(streamTickRef.current);
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return () => { running = false; };
  }, [streaming]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamTick]);

  // Handle file selection from button
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.type.startsWith("image/")) {
        setAttachments((prev) => [...prev, { name: f.name, path: f.name, type: "image" }]);
      } else {
        setAttachments((prev) => [...prev, { name: f.name, path: f.name, type: "file" }]);
      }
    }
    e.target.value = "";
  }, []);

  // Handle drag-drop files onto input area
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

  const handleInputDrop = useCallback((e: DragEvent) => {
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
          return [...prev, { name: f.name, path: f.name, type: isImage ? "image" : "file" }];
        });
      }
    }
  }, []);

  // Remove attachment
  const removeAttachment = useCallback((name: string) => {
    setAttachments((prev) => prev.filter((a) => a.name !== name));
  }, []);

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
      lines.length > 0 ? lines.map((line, i) => `${i + 1}. ${line}`).join("\n") : "(No plan steps provided)",
    ];

    if (refs.length > 0) {
      sections.push("", "## References", refs.map((line) => `- ${line}`).join("\n"));
    }
    if (checks.length > 0) {
      sections.push("", "## Acceptance Criteria", checks.map((line) => `- ${line}`).join("\n"));
    }
    if (attachments.length > 0) {
      sections.push("", "## Attached Assets", attachments.map((a) => `- ${a.type === "image" ? "Image" : "File"}: ${a.name}`).join("\n"));
    }

    sections.push(
      "",
      "Please execute this brief step by step. If anything is ambiguous, make a reasonable product-minded assumption and continue. Keep the implementation aligned with the references and acceptance criteria.",
    );

    return sections.join("\n");
  }, [attachments, briefDraft]);

  const briefHasContent =
    briefDraft.goal.trim() ||
    briefDraft.plan.trim() ||
    briefDraft.references.trim() ||
    briefDraft.acceptance.trim();

  const handleStop = useCallback(() => {
    // Abort the fetch — stops reading the SSE stream
    abortRef.current?.abort();
    abortRef.current = null;
    // Tell the server to kill the agent process
    fetch("/api/agent/stop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent: activeAgent }),
    }).catch(() => {});
    setStreaming(false);
    streamContentRef.current = "";
    streamOutputTokensRef.current = 0;
    streamInputTokensRef.current = 0;
    streamCacheTokensRef.current = 0;
    streamTickRef.current = 0;
    streamBlocksRef.current = [];
    streamThinkRef.current = "";
    streamThinkStartRef.current = 0;
  }, [activeAgent]);

  const handleSend = async () => {
    const text = briefMode ? briefText().trim() : input.trim();
    if ((!text && attachments.length === 0) || streaming) return;

    const attList = [...attachments];
    const userMsg: Message = {
      role: "user",
      content: text || "(attachments)",
      id: Date.now().toString(),
      createdAt: Date.now(),
      attachments: attList.length > 0 ? attList : undefined,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    if (briefMode) {
      setBriefDraft({ goal: "", plan: "", references: "", acceptance: "" });
    }
    setAttachments([]);
    setStreaming(true);
    streamContentRef.current = "";
    streamOutputTokensRef.current = 0;
    streamInputTokensRef.current = 0;
    streamCacheTokensRef.current = 0;
    streamTickRef.current = 0;
    streamBlocksRef.current = [];
    streamThinkRef.current = "";
    streamThinkStartRef.current = 0;

    // Build prompt with attachment references
    let prompt = text;
    if (attList.length > 0) {
      const names = attList.map((a) => a.name).join(", ");
      prompt = text ? `${text}\n\n[Attached files: ${names}]` : `[Attached files: ${names}]`;
    }

    try {
      const responseStartedAt = Date.now();
      // Create fresh AbortController so handleStop can cancel the SSE stream
      const controller = new AbortController();
      abortRef.current = controller;

      const r = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent: activeAgent,
          prompt,
          workspace,
          thinkingLevel: thinkingLevel === "auto" ? undefined : thinkingLevel,
        }),
        signal: controller.signal,
      });

      if (!r.ok) {
        const errData = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
        throw new Error(errData.error ?? `HTTP ${r.status}`);
      }

      const reader = r.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let full = "";

      // Flush accumulated thinking text into a ThinkingBlock.
      // Skips if thinking content is essentially identical to the text that follows
      // (DeepSeek models include the full response in the thinking block).
      const flushThinking = (textContent = "") => {
        const t = streamThinkRef.current.trim();
        if (!t) return;
        // If the thinking content is just the text content repeated, skip it
        if (textContent.trim() && (t.includes(textContent.trim()) || textContent.trim().includes(t))) {
          streamThinkRef.current = "";
          streamThinkStartRef.current = 0;
          return;
        }
        const duration = streamThinkStartRef.current
          ? (Date.now() - streamThinkStartRef.current) / 1000
          : undefined;
        streamBlocksRef.current.push({
          type: "thinking",
          content: t,
          duration,
        });
        streamThinkRef.current = "";
        streamThinkStartRef.current = 0;
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === "error") {
                setMessages((prev) => [
                  ...prev,
                  { role: "error", content: parsed.error, id: Date.now().toString(), createdAt: Date.now() },
                ]);
                setStreaming(false);
                streamContentRef.current = "";
                streamOutputTokensRef.current = 0;
                streamInputTokensRef.current = 0;
                streamTickRef.current = 0;
                return;
              }
              if (parsed.type === "thinking") {
                // Accumulate thinking text for display
                if (parsed.thinkingText) {
                  if (!streamThinkRef.current) {
                    streamThinkStartRef.current = Date.now();
                  }
                  streamThinkRef.current += parsed.thinkingText;
                  streamTickRef.current++;
                }
                if (parsed.outputTokens != null) {
                  streamOutputTokensRef.current = parsed.outputTokens;
                  streamTickRef.current++;
                }
                if (parsed.inputTokens != null) {
                  streamInputTokensRef.current = parsed.inputTokens;
                  streamTickRef.current++;
                }
                continue;
              }
              if (parsed.type === "tool_use") {
                flushThinking();
                const id = parsed.toolId ?? `tool-${streamBlocksRef.current.length}`;
                // Pi toolcall_end: has both toolName and toolId — replace or create
                if (parsed.toolName && parsed.toolId) {
                  const existing = streamBlocksRef.current.find(
                    (b) => b.type === "tool_use" && b.id === id,
                  );
                  if (existing && existing.type === "tool_use") {
                    // Replace placeholder with full tool call
                    existing.toolName = parsed.toolName;
                    existing.toolInput = parsed.toolInput ?? {};
                  } else {
                    streamBlocksRef.current.push({
                      type: "tool_use",
                      id,
                      toolName: parsed.toolName,
                      toolInput: parsed.toolInput ?? {},
                      status: "running",
                    });
                  }
                } else if (parsed.toolInput?.__partial != null) {
                  // Partial JSON delta — append to matching tool_use block or last one
                  const target = parsed.toolId
                    ? streamBlocksRef.current.find((b) => b.type === "tool_use" && b.id === parsed.toolId)
                    : streamBlocksRef.current[streamBlocksRef.current.length - 1];
                  if (target?.type === "tool_use") {
                    const prev = (target.toolInput as Record<string, unknown>).__partial as string ?? "";
                    target.toolInput = {
                      ...target.toolInput,
                      __partial: prev + (parsed.toolInput.__partial as string),
                    };
                  } else {
                    // No existing block — create placeholder
                    streamBlocksRef.current.push({
                      type: "tool_use",
                      id,
                      toolName: "",
                      toolInput: { __partial: parsed.toolInput.__partial },
                      status: "running",
                    });
                  }
                } else {
                  // New tool call with no ID/name (pi tool_execution_start)
                  streamBlocksRef.current.push({
                    type: "tool_use",
                    id,
                    toolName: parsed.toolName ?? "",
                    toolInput: parsed.toolInput ?? {},
                    status: "running",
                  });
                }
                streamTickRef.current++;
                continue;
              }
              if (parsed.type === "tool_result") {
                flushThinking();
                const targetId = parsed.toolId;
                // Mark matching tool_use as completed
                for (let i = streamBlocksRef.current.length - 1; i >= 0; i--) {
                  const b = streamBlocksRef.current[i];
                  if (b.type === "tool_use" && b.id === targetId) {
                    b.status = "completed";
                    break;
                  }
                }
                // Check for existing tool_result with same id (partial update)
                const existing = streamBlocksRef.current.find(
                  (b) => b.type === "tool_result" && b.id === targetId,
                );
                if (existing && existing.type === "tool_result") {
                  // Update existing — accumulates partial output in place
                  existing.toolOutput = (existing.toolOutput ?? "") + (parsed.toolOutput ?? "");
                } else {
                  // New tool_result block
                  streamBlocksRef.current.push({
                    type: "tool_result",
                    id: targetId ?? `result-${streamBlocksRef.current.length}`,
                    toolOutput: parsed.toolOutput ?? "",
                  });
                }
                streamTickRef.current++;
                continue;
              }

              if (parsed.type === "done") {
                if (parsed.cacheTokens != null) {
                  streamCacheTokensRef.current = parsed.cacheTokens;
                  streamTickRef.current++;
                }
                if (parsed.inputTokens != null) streamInputTokensRef.current = parsed.inputTokens;
                if (parsed.outputTokens != null) streamOutputTokensRef.current = parsed.outputTokens;
                continue;
              }
              if (parsed.text) {
                // Flush pending thinking block before text, with dedup
                flushThinking(parsed.text);
                full += parsed.text;
                streamContentRef.current = full;
                streamTickRef.current++;
              }
            } catch {
              full += data;
              streamContentRef.current = full;
              streamTickRef.current++;
            }
          }
        }
      }

      // Flush any remaining thinking (dedup against final text)
      flushThinking(full);

      // Build blocks array: thinking blocks first, then final text block
      const blocks: ContentBlock[] = [...streamBlocksRef.current];
      if (full.trim()) {
        blocks.push({ type: "text", content: full });
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: full,
          id: Date.now().toString(),
          createdAt: Date.now(),
          blocks: blocks.length > 0 ? blocks : undefined,
          inputTokens: streamInputTokensRef.current || undefined,
          outputTokens: streamOutputTokensRef.current || undefined,
          cacheTokens: streamCacheTokensRef.current || undefined,
          durationSeconds: (Date.now() - responseStartedAt) / 1000,
        },
      ]);
    } catch (e: unknown) {
      // AbortError = user clicked Stop — not a real error
      if (e instanceof DOMException && e.name === "AbortError") return;
      const errMsg = e instanceof Error ? e.message : "Chat error";
      setMessages((prev) => [
        ...prev,
        { role: "error", content: errMsg, id: Date.now().toString(), createdAt: Date.now() },
      ]);
    } finally {
      abortRef.current = null;
      setStreaming(false);
      streamContentRef.current = "";
      streamOutputTokensRef.current = 0;
      streamInputTokensRef.current = 0;
      streamCacheTokensRef.current = 0;
      streamTickRef.current = 0;
      streamBlocksRef.current = [];
      streamThinkRef.current = "";
      streamThinkStartRef.current = 0;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const insertMention = () => {
    const ta = textareaRef.current;
    if (!ta || mentionResults.length === 0) return;
    const file = mentionResults[mentionSelected];
    const cursor = ta.selectionStart;
    const textBefore = input.slice(0, cursor);
    const atIdx = textBefore.lastIndexOf("@");
    if (atIdx === -1) return;
    const newInput = input.slice(0, atIdx) + file.path + " " + input.slice(cursor);
    setInput(newInput);
    setMentionOpen(false);
    // Restore cursor after inserted path
    setTimeout(() => {
      const pos = atIdx + file.path.length + 1;
      ta.setSelectionRange(pos, pos);
      ta.focus();
    }, 0);
  };

  const canSend = ((briefMode ? briefHasContent : input.trim()) || attachments.length > 0) && !streaming;

  return (
    <div className="flex flex-col flex-1 min-h-0" style={{ background: "var(--bg)" }}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="mx-auto flex w-full max-w-[880px] flex-col gap-5">
          {messages.length === 0 && !streaming && (
            <WelcomeScreen
              agentName={displayName}
              agentDescription={agentDescription}
              language={language}
              onStarterClick={(prompt) => {
                setInput(prompt);
              }}
            />
          )}

          {messages.map((msg, index) => {
            const startsTurn = msg.role === "user" && index > 0;
            return (
            <div
              key={msg.id}
              className={`fade-in flex w-full ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              style={{
                borderTop: startsTurn ? "1px solid oklch(75% 0 0 / 0.14)" : undefined,
                marginTop: startsTurn ? "10px" : undefined,
                paddingTop: startsTurn ? "22px" : undefined,
              }}
            >
              <div className={msg.role === "user" ? "group max-w-[76%]" : "w-full max-w-[820px]"}>
                {/* Attachments in user message */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="mb-1.5 flex flex-wrap justify-end gap-1">
                    {msg.attachments.map((a) => (
                      <span
                        key={a.name}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px]"
                        style={{ background: "var(--color-accent-dim)", color: "var(--color-accent)" }}
                      >
                        {a.type === "image" ? "🖼️" : "📎"} {a.name}
                      </span>
                    ))}
                  </div>
                )}
                <div
                  className="text-sm leading-relaxed break-words rounded-md px-3 py-2"
                  style={{
                    color: msg.role === "error" ? "var(--error)" : "var(--text)",
                    background: msg.role === "user"
                      ? "var(--user-bg)"
                      : msg.role === "error"
                      ? "oklch(55% 0.22 20 / 0.06)"
                      : "transparent",
                    border: msg.role === "user"
                      ? "1px solid var(--user-border)"
                      : msg.role === "error"
                      ? "1px solid oklch(55% 0.22 20 / 0.15)"
                      : "1px solid transparent",
                  }}
                >
                  {msg.role === "error" ? (
                    `⚠️ ${msg.content}`
                  ) : msg.role === "assistant" && msg.blocks ? (
                    msg.blocks.map((block, i) => {
                      switch (block.type) {
                        case "thinking":
                          return (
                            <ThinkingBlock
                              key={i}
                              content={block.content}
                              duration={block.duration}
                              defaultOpen={false}
                            />
                          );
                        case "tool_use":
                          return (
                            <ToolCallBlock
                              key={i}
                              toolName={block.toolName}
                              toolInput={block.toolInput}
                              status={block.status}
                            />
                          );
                        case "tool_result":
                          return (
                            <ToolResultBlock
                              key={i}
                              toolOutput={block.toolOutput}
                            />
                          );
                        case "text":
                          return <MarkdownBody key={i} content={block.content} />;
                        default:
                          return null;
                      }
                    })
                  ) : (
                    <MarkdownBody content={msg.content} />
                  )}
                </div>
                {/* Hover actions for user messages */}
                {msg.role === "user" && (
                  <div className="mt-1 flex items-center justify-end gap-2 px-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                    {msg.createdAt > 0 && (
                      <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                        {formatTime(msg.createdAt)}
                      </span>
                    )}
                    <button
                      onClick={() => navigator.clipboard.writeText(msg.content).catch(() => {})}
                      className="inline-flex h-5 w-5 items-center justify-center rounded hover:opacity-70 transition-opacity"
                      style={{ color: "oklch(68% 0.15 55)", border: "1px solid oklch(68% 0.15 55 / 0.3)", background: "transparent" }}
                      title="Copy"
                      aria-label="Copy message"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    </button>
                    <button
                      onClick={() => {
                        setInput(msg.content);
                        window.setTimeout(() => {
                          textareaRef.current?.focus();
                          const len = msg.content.length;
                          textareaRef.current?.setSelectionRange(len, len);
                        }, 0);
                      }}
                      className="inline-flex h-5 w-5 items-center justify-center rounded hover:opacity-70 transition-opacity"
                      style={{ color: "oklch(68% 0.15 55)", border: "1px solid oklch(68% 0.15 55 / 0.3)", background: "transparent" }}
                      title="Edit"
                      aria-label="Edit message"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                      </svg>
                    </button>
                  </div>
                )}
                {/* Per-message usage + copy + time for assistant messages */}
                {msg.role === "assistant" && (
                  <div className="flex items-center justify-between mt-1 gap-2 px-3">
                    <span className="text-[11px] inline-flex items-center gap-1 flex-wrap" style={{ color: "var(--text-secondary)" }}>
                      <span>{formatTokens(msg.inputTokens ?? Math.round(msg.content.length / 2))} in</span>
                      <span>·</span>
                      <span>{formatTokens(msg.outputTokens ?? Math.round(msg.content.length / 4))} out</span>
                      {msg.durationSeconds != null && (
                        <>
                          <span>·</span>
                          <span>{formatDuration(msg.durationSeconds)}</span>
                        </>
                      )}
                      {msg.cacheTokens != null && msg.cacheTokens > 0 && (
                        <>
                          <span>·</span>
                          <span>{formatTokens(msg.cacheTokens)} cache</span>
                        </>
                      )}
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => navigator.clipboard.writeText(msg.content).catch(() => {})}
                        className="inline-flex h-5 w-5 items-center justify-center rounded hover:opacity-70 transition-opacity"
                        style={{ color: "oklch(68% 0.15 55)", border: "1px solid oklch(68% 0.15 55 / 0.3)", background: "transparent" }}
                        title="Copy"
                        aria-label="Copy message"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      </button>
                      <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                        {formatTime(msg.createdAt)}
                      </span>
                    </span>
                  </div>
                )}
              </div>
            </div>
            );
          })}

          {/* Streaming */}
          {streaming && (
            <div className="fade-in flex justify-start">
              <div className="w-full max-w-[820px] px-3 py-2">
                {/* Real-time thinking blocks */}
                {streamThinkRef.current.trim() && (
                  <ThinkingBlock
                    content={streamThinkRef.current}
                    duration={
                      streamThinkStartRef.current
                        ? (Date.now() - streamThinkStartRef.current) / 1000
                        : undefined
                    }
                    defaultOpen={false}
                  />
                )}
                {/* Real-time thinking / tool call / tool result blocks */}
                {streamBlocksRef.current.map((block, i) => {
                  switch (block.type) {
                    case "thinking":
                      return (
                        <ThinkingBlock
                          key={`think-${i}`}
                          content={block.content}
                          duration={block.duration}
                          defaultOpen={false}
                        />
                      );
                    case "tool_use":
                      return (
                        <ToolCallBlock
                          key={`tool-${i}`}
                          toolName={block.toolName || "…"}
                          toolInput={block.toolInput}
                          status={block.status}
                        />
                      );
                    case "tool_result":
                      return (
                        <ToolResultBlock
                          key={`result-${i}`}
                          toolOutput={block.toolOutput}
                        />
                      );
                    default:
                      return null;
                  }
                })}
                {/* Streaming text */}
                {streamContentRef.current && (
                  <div
                    className="text-sm leading-relaxed break-words mb-1"
                    style={{ color: "var(--color-text)" }}
                  >
                    <MarkdownBody content={streamContentRef.current} />
                  </div>
                )}
                {/* Status bar */}
                <div className="flex items-center gap-1.5 text-[10px]" style={{ color: "var(--text-secondary)" }}>
                  <svg
                    className="animate-spin"
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <path d="M21 12a9 9 0 1 1-3.2-6.9" />
                  </svg>
                  <span className="tabular-nums">{elapsed}s</span>
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input area */}
      <div
        className="shrink-0 border-t px-5 py-3"
        style={{ borderColor: "var(--border)", background: "var(--bg-panel)" }}
        onDragOver={handleInputDragOver}
        onDragLeave={handleInputDragLeave}
        onDrop={handleInputDrop}
      >
        <div className="mx-auto w-full max-w-[880px]">
          {/* Attachment bar */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {attachments.map((a) => (
                <span
                  key={a.name}
                  className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-md text-xs"
                  style={{ background: "var(--color-accent-dim)", color: "var(--color-accent)" }}
                >
                  {a.type === "image" ? "🖼️" : "📎"} {a.name}
                  <button
                    onClick={() => removeAttachment(a.name)}
                    className="px-1 hover:opacity-70"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* @mention dropdown */}
          {mentionOpen && mentionResults.length > 0 && (
            <div className="mb-1 rounded-md border overflow-hidden"
              style={{ background: "var(--bg-elevated)", borderColor: "var(--border)", boxShadow: "var(--shadow-overlay)" }}>
              {mentionResults.map((f, i) => (
                <button
                  key={f.path}
                  onClick={() => { setMentionSelected(i); insertMention(); }}
                  onMouseEnter={() => setMentionSelected(i)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors"
                  style={{
                    color: "var(--text)",
                    background: i === mentionSelected ? "var(--bg-selected)" : "transparent",
                  }}
                >
                  <span className="shrink-0 opacity-50">{f.name.includes(".") ? "📄" : "📁"}</span>
                  <span className="truncate" style={{ fontFamily: "var(--font-mono)", fontSize: "11px" }}>{f.path}</span>
                </button>
              ))}
            </div>
          )}

          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="inline-flex overflow-hidden rounded-md p-0.5 text-xs" style={{ background: "var(--bg)", border: "1px solid var(--border-light)" }}>
              {[
                { value: false, label: zh ? "对话" : "Chat" },
                { value: true, label: zh ? "计划" : "Brief" },
              ].map((mode) => (
                <button
                  key={String(mode.value)}
                  onClick={() => setBriefMode(mode.value)}
                  className="rounded px-2.5 py-1 transition-colors"
                  style={{
                    background: briefMode === mode.value ? "var(--bg-selected)" : "transparent",
                    color: briefMode === mode.value ? "var(--text)" : "var(--text-secondary)",
                  }}
                  disabled={streaming}
                >
                  {mode.label}
                </button>
              ))}
            </div>
            {briefMode && (
              <span className="truncate text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                {zh ? "把想法、步骤、链接和素材整理后交给 agent 执行" : "Organize goals, steps, links, and assets before the agent starts"}
              </span>
            )}
          </div>

          {briefMode ? (
            <div
              className="grid gap-2 rounded-lg p-2.5"
              style={{
                background: inputDragOver ? "var(--color-accent-dim)" : "var(--color-surface)",
                border: `1px solid ${inputDragOver ? "var(--color-accent)" : "var(--color-border)"}`,
              }}
            >
              <input
                value={briefDraft.goal}
                onChange={(e) => setBriefDraft((prev) => ({ ...prev, goal: e.target.value }))}
                placeholder={zh ? "目标：你希望 agent 完成什么？" : "Goal: what should the agent accomplish?"}
                className="rounded-md px-2 py-1.5 text-sm outline-none"
                style={{ background: "var(--bg-input)", color: "var(--text)", border: "1px solid var(--border-light)" }}
                disabled={streaming}
              />
              <textarea
                value={briefDraft.plan}
                onChange={(e) => setBriefDraft((prev) => ({ ...prev, plan: e.target.value }))}
                placeholder={zh ? "计划步骤：一行一项，比如\n1. 调整页面布局\n2. 加入参考 logo\n3. 完成后构建验证" : "Plan steps: one item per line, for example\nAdjust the layout\nUse the attached logo reference\nBuild and verify"}
                rows={4}
                className="resize-none rounded-md px-2 py-1.5 text-sm outline-none"
                style={{ background: "var(--bg-input)", color: "var(--text)", border: "1px solid var(--border-light)" }}
                disabled={streaming}
              />
              <textarea
                value={briefDraft.references}
                onChange={(e) => setBriefDraft((prev) => ({ ...prev, references: e.target.value }))}
                placeholder={zh ? "参考链接 / LOGO / 图片说明：一行一个，可以贴网址或描述附件" : "References / logos / image notes: one per line, paste URLs or describe attachments"}
                rows={2}
                className="resize-none rounded-md px-2 py-1.5 text-sm outline-none"
                style={{ background: "var(--bg-input)", color: "var(--text)", border: "1px solid var(--border-light)" }}
                disabled={streaming}
              />
              <textarea
                value={briefDraft.acceptance}
                onChange={(e) => setBriefDraft((prev) => ({ ...prev, acceptance: e.target.value }))}
                placeholder={zh ? "验收标准：你希望最后满足哪些条件？一行一项" : "Acceptance criteria: what must be true at the end? One per line"}
                rows={2}
                className="resize-none rounded-md px-2 py-1.5 text-sm outline-none"
                style={{ background: "var(--bg-input)", color: "var(--text)", border: "1px solid var(--border-light)" }}
                disabled={streaming}
              />
            </div>
          ) : (
            <textarea
              value={input}
              ref={textareaRef}
              onChange={(e) => {
                setInput(e.target.value);
                // @mention detection
                const ta = e.target;
                const cursor = ta.selectionStart;
                const textBefore = e.target.value.slice(0, cursor);
                const atMatch = textBefore.match(/@(\S*)$/);
                if (atMatch) {
                  const q = atMatch[1].toLowerCase();
                  setMentionSelected(0);
                  // Fetch files lazily
                  if (workspace) {
                    fetch(`/api/files?path=.&workspace=${encodeURIComponent(workspace)}`)
                      .then(r => r.json()).then(d => {
                        const files = (d.files ?? []) as { name: string; path: string; type: string }[];
                        const flat = flattenFiles(files).filter(f => f.name.toLowerCase().includes(q));
                        setMentionResults(flat.slice(0, 8));
                        setMentionOpen(flat.length > 0);
                      }).catch(() => {});
                  }
                } else {
                  setMentionOpen(false);
                }
              }}
              onKeyDown={(e) => {
                if (mentionOpen) {
                  if (e.key === "ArrowDown") { e.preventDefault(); setMentionSelected(s => Math.min(s + 1, mentionResults.length - 1)); return; }
                  if (e.key === "ArrowUp") { e.preventDefault(); setMentionSelected(s => Math.max(s - 1, 0)); return; }
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); insertMention(); return; }
                  if (e.key === "Escape") { setMentionOpen(false); return; }
                }
                handleKeyDown(e);
              }}
              placeholder={zh ? `问 ${displayName}...` : `Ask ${displayName}...`}
              rows={3}
              className="w-full resize-none rounded-lg p-3 text-sm outline-none transition-colors"
              style={{
                background: inputDragOver ? "var(--color-accent-dim)" : "var(--bg-input)",
                color: "var(--color-text)",
                border: `1px solid ${inputDragOver ? "var(--color-accent)" : "var(--border-light)"}`,
              }}
              disabled={streaming}
            />
          )}

          {/* Bottom bar: attach button + hint + send */}
          <div className="flex justify-between items-center gap-3 mt-2">
            <div className="flex min-w-0 items-center gap-2">
              {/* Attach button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-[var(--bg-hover)]"
                style={{
                  color: "var(--color-text-secondary)",
                  border: "1px solid var(--border-light)",
                }}
                disabled={streaming}
                title={zh ? "添加附件" : "Attach"}
                aria-label={zh ? "添加附件" : "Attach"}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                </svg>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileSelect}
                accept="image/*,.md,.txt,.json,.ts,.tsx,.js,.jsx,.py,.css,.html,.yaml,.yml,.toml"
              />
              {thinkingLevels.length > 1 && onThinkingLevelChange && (
                <label className="flex min-w-0 items-center gap-1.5 text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                  <span className="shrink-0">{zh ? "思考" : "Thinking"}</span>
                  <select
                    value={thinkingLevel}
                    onChange={(e) => onThinkingLevelChange(e.target.value)}
                    className="max-w-[112px] rounded-md px-2 py-1 text-[11px] outline-none"
                    style={{
                      background: "var(--bg)",
                      color: "var(--text)",
                      border: "1px solid var(--border)",
                    }}
                    disabled={streaming}
                    title={zh ? "思考级别" : "Thinking level"}
                  >
                    {thinkingLevels.map((level) => (
                      <option key={level.value} value={level.value}>
                        {level.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            {streaming ? (
              <button
                onClick={handleStop}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:opacity-80"
                style={{ background: "var(--text)", color: "var(--bg)" }}
                title={zh ? "停止" : "Stop"}
                aria-label={zh ? "停止" : "Stop"}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <rect x="7" y="7" width="10" height="10" rx="1.5" />
                </svg>
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!canSend}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors"
                style={{
                  background: canSend ? "var(--text)" : "var(--border)",
                  color: canSend ? "var(--bg)" : "var(--color-text-secondary)",
                  opacity: canSend ? 1 : 0.5,
                }}
                title={briefMode ? (zh ? "开始执行" : "Start") : (zh ? "发送" : "Send")}
                aria-label={briefMode ? (zh ? "开始执行" : "Start") : (zh ? "发送" : "Send")}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 19V5" />
                  <path d="m5 12 7-7 7 7" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
