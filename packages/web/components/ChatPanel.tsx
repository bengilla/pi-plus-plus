"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type { ContentBlock } from "@/lib/agents/types";
import { formatTokens, formatTime, formatDuration } from "@/lib/utils/chat";
import { MarkdownBody } from "./MarkdownBody";
import { ThinkingBlock } from "./ThinkingBlock";
import { ToolCallBlock } from "./ToolCallBlock";
import { ToolResultBlock } from "./ToolResultBlock";
import { ChatInput } from "./ChatInput";
import { ContextFilesIndicator } from "./ContextFilesIndicator";
import { WelcomeScreen } from "./WelcomeScreen";
import { AppIcon, FileTypeIcon } from "./AppIcon";

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
  piSessionId?: string;
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
  piSessionId?: string;
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
  agentVersion?: string;
  conversationId?: string | null;
  workspace: string;
  initialMessages?: ChatMessageSnapshot[];
  onMessagesChange?: (messages: ChatMessageSnapshot[]) => void;
  // When the active conv is a Pi-synced one and messages haven't been loaded yet,
  // show a loading state and trigger a fetch.
  loadingMessages?: boolean;
  onRequestLoadMessages?: (convId: string) => Promise<ChatMessageSnapshot[]>;
  thinkingLevel?: string;
  thinkingLevels?: { value: string; label: string }[];
  onThinkingLevelChange?: (level: string) => void;
  language?: "en" | "zh";
  modelVersion?: number;
  sessionId?: string | null;
  /** Called when a permission error (e.g. iCloud Drive) requires user action */
  onPermissionNeeded?: () => void;
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
    piSessionId: m.piSessionId,
  }));
}

export function ChatPanel({
  activeAgent,
  agentName,
  agentDescription,
  agentVersion,
  conversationId,
  workspace,
  initialMessages,
  onMessagesChange,
  loadingMessages = false,
  onRequestLoadMessages,
  thinkingLevel = "auto",
  thinkingLevels = [],
  onThinkingLevelChange,
  language = "en",
  modelVersion,
  sessionId,
  onPermissionNeeded,
}: Props) {
  const displayName = agentName ?? activeAgent;
  const zh = language === "zh";

  const [messages, setMessages] = useState<Message[]>(() => toMessages(initialMessages));
  // Extract user message contents for ChatInput history (newest first)
  const userHistory = useMemo(
    () =>
      messages
        .filter((m) => m.role === "user" && m.content.trim().length > 1)
        .map((m) => m.content)
        .reverse(),
    [messages],
  );
  const [streaming, setStreaming] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const streamStartRef = useRef(0);
  const prevConvRef = useRef<string | null | undefined>(conversationId);
  // Track whether we've ever initialized messages from props
  const initializedConvRef = useRef<string | null | undefined>(undefined);
  // Ref-backed to bypass React 18 batching — SSE loop writes ref, rAF polls it
  const streamContentRef = useRef("");
  const streamOutputTokensRef = useRef(0);
  const streamInputTokensRef = useRef(0);
  const streamCacheTokensRef = useRef(0);
  const streamTickRef = useRef(0);
  const [streamTick, setStreamTick] = useState(0);
  // Compaction state
  const isCompactingRef = useRef(false);
  const compactionResultRef = useRef("");
  const [compactionActive, setCompactionActive] = useState(false);
  const [compactionMessage, setCompactionMessage] = useState("");
  // Message queue (steering / follow-up)
  const [queueItems, setQueueItems] = useState<{ type: "steering" | "followUp"; text: string }[]>([]);
  // Rich content blocks accumulated during streaming
  const streamBlocksRef = useRef<ContentBlock[]>([]);
  const streamThinkRef = useRef("");
  const streamThinkStartRef = useRef(0);
  const streamModelRef = useRef("");
  const streamProviderRef = useRef("");
  const streamSessionRef = useRef("");
  const [currentModel, setCurrentModel] = useState("");
  const [currentProvider, setCurrentProvider] = useState("");
  const [piSessionId, setPiSessionId] = useState<string | null>(sessionId || null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [availableModels, setAvailableModels] = useState<{ id: string; name: string; provider: string; thinking?: boolean }[]>([]);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [modelDropdownStyle, setModelDropdownStyle] = useState<React.CSSProperties>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const isNearBottomRef = useRef(true);
  const scrollThreshold = 150; // px from bottom to consider "near bottom"

  useEffect(() => {
    const prevConv = prevConvRef.current;
    prevConvRef.current = conversationId;

    // Determine if we should reset messages from initialMessages:
    // 1. First mount: always load
    // 2. Conversation change (not auto-create during streaming): load new conv
    // 3. Auto-create during streaming: skip — stream handler owns messages
    const isAutoCreate = !prevConv && conversationId && streaming;
    const isConvSwitch = prevConv !== conversationId && !streaming;
    const isFirstLoad = initializedConvRef.current === undefined;

    initializedConvRef.current = conversationId;

    if (isAutoCreate) return; // mid-stream auto-create, don't touch messages
    if (!isFirstLoad && !isConvSwitch) return; // same conv, no action needed

    setMessages(toMessages(initialMessages));
    setPiSessionId(sessionId || null);
    // If this conv has no initial messages but has a sessionId (Pi-synced) and
    // a loader is provided, request the full messages on demand.
    if (
      conversationId &&
      (!initialMessages || initialMessages.length === 0) &&
      sessionId &&
      onRequestLoadMessages
    ) {
      onRequestLoadMessages(conversationId).then((loaded) => {
        // Only apply if we're still on the same conv
        if (loaded && loaded.length > 0) {
          setMessages(toMessages(loaded));
        }
      });
    }
  }, [conversationId, sessionId]);

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
      piSessionId: m.piSessionId || piSessionId || undefined,
    })));
  }, [messages, piSessionId]);

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
      if (streamTickRef.current !== streamTick) {
        setStreamTick(streamTickRef.current);
      }
      if (streamModelRef.current && currentModel !== streamModelRef.current) {
        setCurrentModel(streamModelRef.current);
      }
      if (streamProviderRef.current && currentProvider !== streamProviderRef.current) {
        setCurrentProvider(streamProviderRef.current);
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return () => { running = false; };
  }, [streaming, currentModel, currentProvider]);

  // Track scroll position — user can scroll up freely during streaming
  const updateNearBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < scrollThreshold;
  }, []);

  // Only auto-scroll if user is already near bottom; always scroll when streaming ends
  useEffect(() => {
    if (!streaming && isNearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    if (isNearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, streamTick, streaming]);

  // Load Pi's default model on mount and when model changes in settings
  useEffect(() => {
    Promise.all([
      fetch("/api/pi/model").then((r) => r.json()),
      fetch("/api/pi/models").then((r) => r.json()),
    ])
      .then(([modelData, modelsData]: [
        { provider?: string; model?: string },
        { models: { id: string; name: string; provider: string; enabled: boolean; hasAuth?: boolean; thinking?: boolean }[]; defaultModel: string | null },
      ]) => {
        if (modelData.model) {
          setCurrentModel(modelData.model);
          setCurrentProvider(modelData.provider || "");
          setSelectedModel(modelData.model);
        }
        setAvailableModels(modelsData.models.filter((m) => m.enabled && m.hasAuth !== false));
      })
      .catch(() => {});
  }, [modelVersion]);

  // Cancel message editing when clicking outside the editor
  useEffect(() => {
    if (editingMsgId === null) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".editing-msg-container")) {
        setEditingMsgId(null);
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener("click", handleOutsideClick);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", handleOutsideClick);
    };
  }, [editingMsgId]);

  const handleStop = useCallback(() => {
    // Capture partial content BEFORE abort — abort triggers finally which clears refs
    const partialContent = streamContentRef.current;
    const partialBlocks = [...streamBlocksRef.current];
    const partialInputTokens = streamInputTokensRef.current;
    const partialOutputTokens = streamOutputTokensRef.current;
    const partialCacheTokens = streamCacheTokensRef.current;

    abortRef.current?.abort();
    abortRef.current = null;
    fetch("/api/agent/stop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent: activeAgent }),
    }).catch(() => {});

    setStreaming(false);
    if (partialContent.trim() || partialBlocks.length > 0) {
      const blocks: ContentBlock[] = [...partialBlocks];
      if (partialContent.trim()) {
        blocks.push({ type: "text", content: partialContent });
      }
      setMessages((prev) => {
        // Safety: ensure we're appending to existing messages, not replacing them
        if (prev.length === 0 && messages.length > 0) {
          console.warn("[pi++] handleStop: prev was empty but component had messages, using current state");
          return [...messages, {
            role: "assistant" as const,
            content: partialContent,
            id: Date.now().toString(),
            createdAt: Date.now(),
            blocks: blocks.length > 0 ? blocks : undefined,
            inputTokens: partialInputTokens || undefined,
            outputTokens: partialOutputTokens || undefined,
            cacheTokens: partialCacheTokens || undefined,
          }];
        }
        return [...prev, {
          role: "assistant" as const,
          content: partialContent,
          id: Date.now().toString(),
          createdAt: Date.now(),
          blocks: blocks.length > 0 ? blocks : undefined,
          inputTokens: partialInputTokens || undefined,
          outputTokens: partialOutputTokens || undefined,
          cacheTokens: partialCacheTokens || undefined,
        }];
      });
    }

    streamContentRef.current = "";
    streamOutputTokensRef.current = 0;
    streamInputTokensRef.current = 0;
    streamCacheTokensRef.current = 0;
    streamTickRef.current = 0;
    streamBlocksRef.current = [];
    streamThinkRef.current = "";
    streamThinkStartRef.current = 0;
    streamModelRef.current = "";
    streamProviderRef.current = "";
    streamSessionRef.current = "";
  }, [activeAgent, setMessages]);

  const handleSend = useCallback(async (text: string, attachments: Attachment[], opts?: { skipUserMsg?: boolean }) => {
    // Build prompt with attachment references
    let prompt = text;
    const attList = [...attachments];
    if (attList.length > 0) {
      const names = attList.map((a) => a.name).join(", ");
      prompt = text ? `${text}\n\n[Attached files: ${names}]` : `[Attached files: ${names}]`;
    }

    const userMsg: Message = {
      role: "user",
      content: text || "(attachments)",
      id: Date.now().toString(),
      createdAt: Date.now(),
      attachments: attList.length > 0 ? attList : undefined,
    };
    if (!opts?.skipUserMsg) {
      setMessages((prev) => [...prev, userMsg]);
    }
    setStreaming(true);
    setQueueItems([]);
    streamContentRef.current = "";
    streamOutputTokensRef.current = 0;
    streamInputTokensRef.current = 0;
    streamCacheTokensRef.current = 0;
    streamTickRef.current = 0;
    streamBlocksRef.current = [];
    streamThinkRef.current = "";
    streamThinkStartRef.current = 0;
    streamModelRef.current = "";
    streamProviderRef.current = "";

    try {
      const responseStartedAt = Date.now();
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
          model: selectedModel || undefined,
          sessionId: sessionId || undefined,
        }),
        signal: controller.signal,
      });

      if (!r.ok) {
        const errData = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
        if (errData.permissionError) {
          onPermissionNeeded?.();
          return;
        }
        throw new Error(errData.error ?? `HTTP ${r.status}`);
      }

      const reader = r.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let full = "";
      let lineBuffer = ""; // accumulates partial SSE lines across chunks

      // Flush accumulated thinking text into a ThinkingBlock.
      const flushThinking = (textContent = "") => {
        const t = streamThinkRef.current.trim();
        if (!t) return;
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
        lineBuffer += chunk;
        const lines = lineBuffer.split("\n");
        lineBuffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === "error") {
                if (parsed.permissionError) {
                  onPermissionNeeded?.();
                  setStreaming(false);
                  streamContentRef.current = "";
                  streamOutputTokensRef.current = 0;
                  streamInputTokensRef.current = 0;
                  streamTickRef.current = 0;
                  return;
                }
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
                if (parsed.sessionId && !streamSessionRef.current) {
                  streamSessionRef.current = parsed.sessionId;
                  setPiSessionId(parsed.sessionId);
                }
                if (parsed.model) streamModelRef.current = parsed.model;
                if (parsed.provider) streamProviderRef.current = parsed.provider;
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
                if (parsed.toolName && parsed.toolId) {
                  // Try exact toolId match first
                  let existing = streamBlocksRef.current.find(
                    (b) => b.type === "tool_use" && b.id === id,
                  );
                  // tool_execution_start may have a different ID than toolcall_end.
                  // Find the last incomplete tool_use with matching toolName.
                  if (!existing) {
                    for (let i = streamBlocksRef.current.length - 1; i >= 0; i--) {
                      const b = streamBlocksRef.current[i];
                      if (b.type === "tool_use" && b.toolName === parsed.toolName && b.status !== "completed") {
                        existing = b;
                        break;
                      }
                    }
                    // Update the block's id to match the execution event's id,
                    // so subsequent tool_result events can find it.
                    if (existing && existing.type === "tool_use") {
                      (existing as { id: string }).id = id;
                    }
                  }
                  if (existing && existing.type === "tool_use") {
                    existing.toolName = parsed.toolName;
                    existing.toolInput = parsed.toolInput ?? {};
                    existing.status = "running";
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
                    streamBlocksRef.current.push({
                      type: "tool_use",
                      id,
                      toolName: "",
                      toolInput: { __partial: parsed.toolInput.__partial },
                      status: "running",
                    });
                  }
                } else {
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
                let toolFound = false;
                for (let i = streamBlocksRef.current.length - 1; i >= 0; i--) {
                  const b = streamBlocksRef.current[i];
                  if (b.type === "tool_use" && b.id === targetId) {
                    b.status = "completed";
                    toolFound = true;
                    break;
                  }
                }
                // If no tool_use matched by ID, mark the most recent running tool as completed
                if (!toolFound) {
                  for (let i = streamBlocksRef.current.length - 1; i >= 0; i--) {
                    const b = streamBlocksRef.current[i];
                    if (b.type === "tool_use" && b.status === "running") {
                      b.status = "completed";
                      break;
                    }
                  }
                }
                const existing = streamBlocksRef.current.find(
                  (b) => b.type === "tool_result" && b.id === targetId,
                );
                if (existing && existing.type === "tool_result") {
                  existing.toolOutput = (existing.toolOutput ?? "") + (parsed.toolOutput ?? "");
                  if (parsed.images) existing.images = parsed.images;
                } else {
                  streamBlocksRef.current.push({
                    type: "tool_result",
                    id: targetId ?? `result-${streamBlocksRef.current.length}`,
                    toolOutput: parsed.toolOutput ?? "",
                    images: parsed.images,
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
              if (parsed.type === "compaction_start") {
                isCompactingRef.current = true;
                setCompactionActive(true);
                setCompactionMessage(zh ? "正在压缩上下文…" : "Compacting context…");
                continue;
              }
              if (parsed.type === "compaction_end") {
                isCompactingRef.current = false;
                setCompactionActive(false);
                const reason = parsed.compactionReason || "manual";
                const result = parsed.compactionResult || "";
                const reasonLabel = reason === "threshold" ? (zh ? "阈值" : "threshold") : reason === "overflow" ? (zh ? "溢出" : "overflow") : (zh ? "手动" : "manual");
                setCompactionMessage(
                  zh
                    ? `上下文已压缩 (${reasonLabel})${result ? `: ${result}` : ""}`
                    : `Context compacted (${reasonLabel})${result ? `: ${result}` : ""}`
                );
                setTimeout(() => setCompactionMessage(""), 6000);
                continue;
              }
              if (parsed.type === "queue_update" && parsed.queueItems) {
                setQueueItems(parsed.queueItems);
                streamTickRef.current++;
                continue;
              }
              if (parsed.text) {
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

      // Flush any remaining partial SSE line
      if (lineBuffer.trim() && lineBuffer.startsWith("data: ")) {
        const lastData = lineBuffer.slice(6);
        if (lastData !== "[DONE]") {
          try {
            const lastParsed = JSON.parse(lastData);
            if (lastParsed.type === "tool_result") {
              const targetId = lastParsed.toolId;
              const existing = streamBlocksRef.current.find((b) => b.type === "tool_result" && b.id === targetId);
              if (existing && existing.type === "tool_result") {
                existing.toolOutput = (existing.toolOutput ?? "") + (lastParsed.toolOutput ?? "");
                if (lastParsed.images) existing.images = lastParsed.images;
              } else {
                streamBlocksRef.current.push({
                  type: "tool_result",
                  id: targetId ?? `result-${streamBlocksRef.current.length}`,
                  toolOutput: lastParsed.toolOutput ?? "",
                  images: lastParsed.images,
                });
              }
              streamTickRef.current++;
            }
          } catch { /* incomplete JSON, skip */ }
        }
      }

      flushThinking(full);

      const blocks: ContentBlock[] = [...streamBlocksRef.current];
      if (full.trim()) {
        blocks.push({ type: "text", content: full });
      }

      // Capture token values BEFORE finally resets refs — setMessages callback
      // runs asynchronously in React 18, after the try/catch/finally block.
      const finalInputTokens = streamInputTokensRef.current != null ? streamInputTokensRef.current : undefined;
      const finalOutputTokens = streamOutputTokensRef.current != null ? streamOutputTokensRef.current : undefined;
      const finalCacheTokens = streamCacheTokensRef.current != null ? streamCacheTokensRef.current : undefined;

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: full,
          id: Date.now().toString(),
          createdAt: Date.now(),
          blocks: blocks.length > 0 ? blocks : undefined,
          inputTokens: finalInputTokens,
          outputTokens: finalOutputTokens,
          cacheTokens: finalCacheTokens,
          durationSeconds: (Date.now() - responseStartedAt) / 1000,
          piSessionId: piSessionId || undefined,
        },
      ]);
  } catch (e: unknown) {
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
      streamModelRef.current = "";
      streamProviderRef.current = "";
    }
  }, [activeAgent, workspace, thinkingLevel, selectedModel, sessionId]);

  const handleExport = useCallback(async () => {
    if (!piSessionId) return;
    try {
      const r = await fetch(`/api/pi/session/export?id=${encodeURIComponent(piSessionId)}&workspace=${encodeURIComponent(workspace)}`);
      if (!r.ok) return;
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `session-${piSessionId.slice(0, 8)}.html`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  }, [piSessionId, workspace]);

  // ── Model selector footer extras ───────────────────────────

  const modelSelector = (
    <>
      {thinkingLevels.length > 1 && onThinkingLevelChange && (
        <div className="flex items-center gap-1.5">
          <span className="pr-1 text-[10px] shrink-0" style={{ color: "var(--accent)", borderBottom: "1px solid var(--accent)" }}>
            {zh ? "思考" : "Think"}
          </span>
          {thinkingLevels.map((level) => {
            const isActive = thinkingLevel === level.value;
            const abbr = level.label.length > 4 ? level.label.slice(0, 4) : level.label;
            return (
              <button
                key={level.value}
                onClick={() => { onThinkingLevelChange(level.value); fetch("/api/pi/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope: "global", updates: { defaultThinkingLevel: level.value } }) }).catch((e: unknown) => { console.error("[pi++] Failed to save thinking level:", e); }); }}
                disabled={streaming}
                className="px-1.5 py-0.5 text-[10px] font-medium transition-colors disabled:opacity-50"
                style={{
                  color: isActive ? "var(--accent)" : "var(--text-tertiary)",
                  border: isActive ? "1px solid var(--accent)" : "1px solid transparent",
                }}
                title={level.label}
              >
                {abbr}
              </button>
            );
          })}
        </div>
      )}
      {currentModel && (
        <>
          <span className="shrink-0 w-px h-3 mx-1" style={{ background: "var(--accent)" }} />
          <div className="relative">
            <button
              onClick={(e) => {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setModelDropdownStyle({ bottom: window.innerHeight - rect.top + 4 + "px", left: rect.left + "px" });
                setModelDropdownOpen(!modelDropdownOpen);
              }}
              disabled={streaming}
              className="shrink-0 text-[10px] max-w-[140px] px-1 py-0.5 transition-colors hover:opacity-70 disabled:opacity-50 flex items-center"
              style={{ color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}
              title={`${currentProvider}/${currentModel}`}
            >
              <span className="truncate">
                {(selectedModel || currentModel).includes("/")
                  ? (selectedModel || currentModel).split("/").pop()
                  : (selectedModel || currentModel)}
              </span>
              <span className="ml-1.5 shrink-0" style={{ color: "var(--accent)" }}>
                <AppIcon name={modelDropdownOpen ? "chevron-down" : "chevron-right"} size={10} />
              </span>
            </button>
            {modelDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setModelDropdownOpen(false)} />
                <div
                  className="fixed z-[100] min-w-[200px] max-h-[280px] overflow-y-auto p-1"
                  style={{ ...modelDropdownStyle, background: "var(--bg-elevated)", border: "1px solid var(--border)", boxShadow: "var(--shadow-modal)" }}
                >
                  {(() => {
                    const grouped = new Map<string, typeof availableModels>();
                    for (const m of availableModels) {
                      const list = grouped.get(m.provider) || [];
                      list.push(m);
                      grouped.set(m.provider, list);
                    }
                    return [...grouped.entries()].map(([provider, providerModels]) => (
                      <div key={provider}>
                        <div
                          className="text-[9px] px-2 py-1 font-semibold uppercase tracking-wider"
                          style={{
                            color: "var(--accent)",
                            background: "color-mix(in oklch, var(--accent) 8%, transparent)",
                            borderBottom: "1px solid color-mix(in oklch, var(--accent) 20%, transparent)",
                          }}
                        >
                          {provider}
                        </div>
                        {providerModels.map((m) => {
                          const isActive = (selectedModel || currentModel) === m.id;
                          return (
                            <button
                              key={m.id}
                              onClick={() => {
                                setSelectedModel(m.id);
                                setCurrentModel(m.id);
                                setCurrentProvider(m.provider);
                                setModelDropdownOpen(false);
                                fetch("/api/pi/models", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ model: m.id }),
                                }).catch((e: unknown) => { console.error("[pi++] Failed to save model:", e); });
                              }}
                              className="w-full text-left py-1 text-[10px] transition-colors flex items-center gap-1.5"
                              style={{
                                color: isActive ? "var(--accent)" : "var(--text-secondary)",
                                fontFamily: "var(--font-mono)",
                                fontWeight: isActive ? 600 : 400,
                                background: isActive ? "color-mix(in oklch, var(--accent) 12%, transparent)" : "transparent",
                                borderLeft: isActive ? "2px solid var(--accent)" : "2px solid transparent",
                                paddingLeft: "8px",
                                paddingRight: "8px",
                              }}
                              onMouseEnter={(e) => {
                                  if (!isActive) e.currentTarget.style.background = "var(--bg-hover)";
                              }}
                              onMouseLeave={(e) => {
                                  if (!isActive) e.currentTarget.style.background = "transparent";
                              }}
                            >
                              <span className="w-2.5 text-center shrink-0" style={{ color: "var(--accent)" }}>
                                {isActive ? <AppIcon name="check" size={11} /> : ""}
                              </span>
                              <span className="flex-1 truncate">{m.name}</span>
                              {m.thinking && <span className="shrink-0" style={{ color: "var(--text-tertiary)" }}><AppIcon name="zap" size={10} /></span>}
                            </button>
                          );
                        })}
                      </div>
                    ));
                  })()}
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* Export button — shows when session has Pi session ID */}
      {!streaming && piSessionId && (
        <>
          <span className="shrink-0 w-px h-3 mx-1" style={{ background: "oklch(68% 0.13 250 / 0.4)" }} />
          <button
            onClick={handleExport}
            className="shrink-0 text-[10px] px-1 py-0.5 transition-colors hover:opacity-70 inline-flex items-center gap-1"
            style={{ color: "oklch(68% 0.13 250)" }}
            title={zh ? "导出 HTML" : "Export HTML"}
          >
            <AppIcon name="download" size={11} />
            {zh ? "导出" : "Export"}
          </button>
        </>
      )}
    </>
  );

  // ── Render ──────────────────────────────────────────────────

  return (
    <div className="flex flex-col flex-1 min-h-0" style={{ background: "var(--bg)" }}>
      {/* Context files indicator */}
      <ContextFilesIndicator workspace={workspace} language={language} />
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto" onScroll={updateNearBottom} style={{ background: "var(--bg)" }}>
        <div className="mx-auto flex min-h-full w-full max-w-[880px] flex-col gap-5 px-5 py-5">
          {messages.length === 0 && !streaming && (
            loadingMessages ? (
              <div className="flex flex-1 items-center justify-center py-12 text-xs" style={{ color: "var(--text-tertiary)" }}>
                <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-r-transparent" />
                {language === "zh" ? "加载会话中…" : "Loading conversation…"}
              </div>
            ) : (
              <WelcomeScreen
                agentName={displayName}
                agentDescription={agentDescription}
                agentVersion={agentVersion}
                language={language}
                onStarterClick={() => {}}
              />
            )
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
              <div className={msg.role === "user" ? (editingMsgId === msg.id ? "group w-full" : "group max-w-[76%]") : "w-full"}>
                {/* Attachments in user message */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="mb-1.5 flex flex-wrap justify-end gap-1">
                    {msg.attachments.map((a) => (
                      <span
                        key={a.name}
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px]"
                        style={{ background: "var(--color-accent-dim)", color: "var(--color-accent)" }}
                      >
                        <FileTypeIcon name={a.name} size={13} /> {a.name}
                      </span>
                    ))}
                  </div>
                )}
                <div
                  className="text-sm leading-relaxed break-words px-3 py-2"
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
                    <span className="inline-flex items-start gap-2"><AppIcon name="info" size={14} /> <span>{msg.content}</span></span>
                  ) : msg.role === "assistant" && msg.blocks ? (
                    (() => {
                      const groups: { type: "tool" | "text" | "think"; items: typeof msg.blocks }[] = [];
                      for (const block of msg.blocks) {
                        const isTool = block.type === "tool_use" || block.type === "tool_result";
                        const category = isTool ? "tool" : block.type === "thinking" ? "think" : "text";
                        const last = groups[groups.length - 1];
                        if (last && last.type === category) {
                          last.items.push(block);
                        } else {
                          groups.push({ type: category, items: [block] });
                        }
                      }
                      return groups.map((group, gi) => {
                        if (group.type === "tool") {
                          return (
                            <div
                              key={`tool-group-${gi}`}
                              className="my-1"
                              style={{ border: "1px solid var(--border-light)", background: "var(--bg)" }}
                            >
                              {group.items.map((block, i) => {
                                switch (block.type) {
                                  case "tool_use":
                                    return <ToolCallBlock key={i} toolName={block.toolName} toolInput={block.toolInput} status={block.status} />;
                                  case "tool_result":
                                    return <ToolResultBlock key={i} toolOutput={block.toolOutput} images={block.images} />;
                                  default:
                                    return null;
                                }
                              })}
                            </div>
                          );
                        }
                        if (group.type === "think") {
                          return group.items.map((block, i) => (
                            <ThinkingBlock
                              key={`think-${gi}-${i}`}
                              content={block.type === "thinking" ? block.content : ""}
                              duration={block.type === "thinking" ? block.duration : undefined}
                              defaultOpen={false}
                              level={thinkingLevel}
                            />
                          ));
                        }
                        return group.items.map((block, i) => (
                          block.type === "text" ? <MarkdownBody key={`text-${gi}-${i}`} content={block.content} /> : null
                        ));
                      });
                    })()
                  ) : editingMsgId === msg.id ? (
                    <div className="editing-msg-container flex flex-col gap-2 w-full">
                      <textarea
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            const newText = editingText.trim();
                            if (!newText || streaming) return;
                            setEditingMsgId(null);
                            // Truncate messages after this one, update this message
                            setMessages((prev) => {
                              const idx = prev.findIndex((m) => m.id === msg.id);
                              if (idx === -1) return prev;
                              const updated = [...prev];
                              updated[idx] = { ...prev[idx], content: newText };
                              return updated.slice(0, idx + 1);
                            });
                            // Resend the edited message
                            handleSend(newText, [], { skipUserMsg: true });
                          }
                          if (e.key === "Escape") {
                            setEditingMsgId(null);
                          }
                        }}
                        className="w-full resize-none p-2 text-sm outline-none"
                        rows={Math.max(3, editingText.split("\n").length)}
                        style={{
                          background: "var(--bg-input)",
                          color: "var(--text)",
                          border: "1px solid var(--accent)",
                          minHeight: 60,
                        }}
                        autoFocus
                      />
                      <div className="flex justify-end gap-2 text-[11px]">
                        <button
                          onClick={() => {
                            const newText = editingText.trim();
                            if (!newText || streaming) return;
                            setEditingMsgId(null);
                            setMessages((prev) => {
                              const idx = prev.findIndex((m) => m.id === msg.id);
                              if (idx === -1) return prev;
                              const updated = [...prev];
                              updated[idx] = { ...prev[idx], content: newText };
                              return updated.slice(0, idx + 1);
                            });
                            handleSend(newText, [], { skipUserMsg: true });
                          }}
                          disabled={streaming || !editingText.trim()}
                          className="px-2.5 py-0.5 border transition-colors hover:opacity-85"
                          style={{
                            borderColor: "var(--accent)",
                            color: "var(--accent)",
                            background: "transparent",
                            borderRadius: "0px",
                          }}
                        >
                          {zh ? "保存并重新发送" : "Save & Resend"}
                        </button>
                        <button
                          onClick={() => setEditingMsgId(null)}
                          className="px-2.5 py-0.5 border transition-colors hover:opacity-85"
                          style={{
                            borderColor: "var(--border-light)",
                            color: "var(--text-secondary)",
                            background: "transparent",
                            borderRadius: "0px",
                          }}
                        >
                          {zh ? "取消" : "Cancel"}
                        </button>
                      </div>
                    </div>
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
                      className="inline-flex h-5 w-5 items-center justify-center active:scale-90 transition-opacity duration-150 opacity-50 hover:opacity-100"
                      style={{ color: "var(--accent)", background: "transparent", border: "none" }}
                      title="Copy"
                      aria-label="Copy message"
                    >
                      <AppIcon name="copy" size={11} />
                    </button>
                    <button
                      onClick={() => { setEditingMsgId(msg.id); setEditingText(msg.content); }}
                      className="inline-flex h-5 w-5 items-center justify-center hover:opacity-70 hover:shadow-[0_0_6px_var(--accent)] active:opacity-100 active:scale-90 active:shadow-[0_0_0_1px_var(--accent),0_0_6px_var(--accent)] transition-all duration-75"
                      style={{ color: "oklch(68% 0.13 250)", background: "transparent", border: "none", opacity: 0.6 }}
                      title="Edit"
                      aria-label="Edit message"
                    >
                      <AppIcon name="edit" size={11} />
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
                      {msg.cacheTokens != null && msg.cacheTokens > 0 && (
                        <>
                          <span>·</span>
                          <span style={{ textDecoration: "underline", textUnderlineOffset: "2px", opacity: 0.75 }}>{formatTokens(msg.cacheTokens)} cache</span>
                        </>
                      )}
                      {msg.durationSeconds != null && (
                        <>
                          <span>·</span>
                          <span style={{ color: "var(--accent)" }}>{formatDuration(msg.durationSeconds)}</span>
                        </>
                      )}
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => navigator.clipboard.writeText(msg.content).catch(() => {})}
                        className="inline-flex h-5 w-5 items-center justify-center active:scale-90 transition-opacity duration-150 opacity-50 hover:opacity-100"
                        style={{ color: "var(--accent)", background: "transparent", border: "none" }}
                        title="Copy"
                        aria-label="Copy message"
                      >
                        <AppIcon name="copy" size={11} />
                      </button>
                      {msg.createdAt > 0 && (
                        <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                          {formatTime(msg.createdAt)}
                        </span>
                      )}
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
              <div className="w-full px-3 py-2">
                {streamThinkRef.current.trim() && (
                  <ThinkingBlock
                    content={streamThinkRef.current}
                    duration={
                      streamThinkStartRef.current
                        ? (Date.now() - streamThinkStartRef.current) / 1000
                        : undefined
                    }
                    defaultOpen={false}
                    level={thinkingLevel}
                  />
                )}
                {(() => {
                  const blocks = streamBlocksRef.current;
                  const groups: { type: "tool" | "think"; items: typeof blocks }[] = [];
                  for (const block of blocks) {
                    const isTool = block.type === "tool_use" || block.type === "tool_result";
                    const category = isTool ? "tool" : "think";
                    const last = groups[groups.length - 1];
                    if (last && last.type === category) {
                      last.items.push(block);
                    } else {
                      groups.push({ type: category, items: [block] });
                    }
                  }
                  let blockSeq = 0;
                  return groups.map((group, gi) => {
                    if (group.type === "tool") {
                      return (
                        <div key={`tool-group-${gi}`} className="my-1" style={{ border: "1px solid var(--border-light)", background: "var(--bg)" }}>
                          {group.items.map((block) => {
                            const stableKey = block.type === "tool_use" && (block as { id?: string }).id
                              ? (block as { id: string }).id
                              : `block-${blockSeq++}`;
                            switch (block.type) {
                              case "tool_use":
                                return <ToolCallBlock key={stableKey} toolName={block.toolName || "…"} toolInput={block.toolInput} status={block.status} />;
                              case "tool_result":
                                return <ToolResultBlock key={stableKey} toolOutput={block.toolOutput} images={block.images} />;
                              default:
                                return null;
                            }
                          })}
                        </div>
                      );
                    }
                    return group.items.map((block) => {
                      const stableKey = block.type === "thinking"
                        ? `think-${gi}-${blockSeq++}`
                        : `block-${blockSeq++}`;
                      return block.type === "thinking" ? <ThinkingBlock key={stableKey} content={block.content} duration={block.duration} defaultOpen={false} level={thinkingLevel} /> : null;
                    });
                  });
                })()}
                {streamContentRef.current && (
                  <div className="text-sm leading-relaxed break-words mb-1" style={{ color: "var(--color-text)" }}>
                    <MarkdownBody content={streamContentRef.current} />
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-[10px]" style={{ color: "var(--text-secondary)" }}>
                  {compactionActive ? (
                    <>
                      <svg className="animate-spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                        <path d="M21 12a9 9 0 1 1-3.2-6.9" />
                      </svg>
                      <span style={{ color: "oklch(70% 0.12 175)" }}>{zh ? "压缩中…" : "Compacting…"}</span>
                    </>
                  ) : (
                    <>
                      <svg className="animate-spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                        <path d="M21 12a9 9 0 1 1-3.2-6.9" />
                      </svg>
                      <span className="tabular-nums">{elapsed}s</span>
                    </>
                  )}
                </div>
                {queueItems.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {queueItems.map((item, i) => (
                      <button
                        key={i}
                        onClick={() => { handleSend(item.text, []); setQueueItems([]); }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] transition-colors hover:opacity-80"
                        style={{
                          color: item.type === "steering" ? "oklch(68% 0.13 250)" : "var(--accent)",
                          border: `1px solid ${item.type === "steering" ? "oklch(68% 0.13 250 / 0.4)" : "var(--accent)"}`,
                          background: item.type === "steering" ? "oklch(68% 0.13 250 / 0.06)" : "oklch(72% 0.12 175 / 0.06)",
                        }}
                      >
                        <span className="text-[9px]">{item.type === "steering" ? "→" : "↳"}</span>
                        <span className="truncate max-w-[180px]">{item.text}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div ref={bottomRef} />

          {/* Queue items: steering / follow-up suggestions */}
          {queueItems.length > 0 && !streaming && (
            <div className="fade-in flex flex-wrap gap-1.5 px-1">
              {queueItems.map((item, i) => (
                <button
                  key={i}
                  onClick={() => { handleSend(item.text, []); setQueueItems([]); }}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] transition-colors hover:opacity-80"
                  style={{
                    color: item.type === "steering" ? "oklch(68% 0.13 250)" : "var(--accent)",
                    border: `1px solid ${item.type === "steering" ? "oklch(68% 0.13 250 / 0.4)" : "var(--accent)"}`,
                    background: item.type === "steering" ? "oklch(68% 0.13 250 / 0.06)" : "oklch(72% 0.12 175 / 0.06)",
                  }}
                >
                  <AppIcon name={item.type === "steering" ? "arrow-up" : "message-plus"} size={10} />
                  <span className="truncate max-w-[200px]">{item.text}</span>
                </button>
              ))}
              <button
                onClick={() => setQueueItems([])}
                className="px-1 text-[11px] hover:opacity-70"
                style={{ color: "var(--text-tertiary)" }}
                title={zh ? "关闭" : "Dismiss"}
              >
                <AppIcon name="x" size={12} />
              </button>
            </div>
          )}

          {/* Compaction notification (auto-dismissed) */}
          {compactionMessage && !streaming && (
            <div className="fade-in flex justify-start">
              <div className="flex items-center gap-2 px-3 py-2 text-xs" style={{ color: "var(--accent)", background: "oklch(72% 0.12 175 / 0.06)", border: "1px solid oklch(72% 0.12 175 / 0.15)" }}>
                <AppIcon name="zap" size={12} />
                <span>{compactionMessage}</span>
                <button
                  onClick={() => setCompactionMessage("")}
                  className="ml-1 hover:opacity-70"
                  style={{ color: "var(--accent)" }}
                >
                  <AppIcon name="x" size={11} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ChatInput */}
      <ChatInput
        agentName={displayName}
        workspace={workspace}
        language={language}
        streaming={streaming}
        onSend={handleSend}
        onStop={handleStop}
        footerExtras={modelSelector}
        initialHistory={userHistory}
        onScrollToBottom={() => {
          isNearBottomRef.current = true;
          bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        }}
      />
    </div>
  );
}
