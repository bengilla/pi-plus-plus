"use client";

import { useState, useRef, useEffect, useCallback, type DragEvent } from "react";
import type { ContentBlock } from "@/lib/agents/types";
import { MarkdownBody } from "./MarkdownBody";
import { ThinkingBlock } from "./ThinkingBlock";
import { ToolCallBlock } from "./ToolCallBlock";
import { ToolResultBlock } from "./ToolResultBlock";

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
}

interface SimpleMessage {
  role: string;
  content: string;
  id: string;
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

// Approximate cost based on typical API pricing ($3/M in, $15/M out)
function estimateCost(inputTokens: number, outputTokens: number): string {
  const cost = (inputTokens / 1_000_000) * 3 + (outputTokens / 1_000_000) * 15;
  if (cost < 0.0001) return "$0.0001";
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

interface Props {
  activeAgent: string;
  agentName?: string;
  workspace: string;
  fullPage?: boolean;
  initialMessages?: SimpleMessage[];
  onMessagesChange?: (messages: SimpleMessage[]) => void;
}

export function ChatPanel({ activeAgent, agentName, workspace, fullPage, initialMessages, onMessagesChange }: Props) {
  const displayName = agentName ?? activeAgent;

  const [messages, setMessages] = useState<Message[]>(
    (initialMessages as Message[]) ?? []
  );
  const [input, setInput] = useState("");
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
  // Smooth animated token count — chases the real value each frame
  const [displayTokens, setDisplayTokens] = useState(0);
  // Rich content blocks accumulated during streaming
  const streamBlocksRef = useRef<ContentBlock[]>([]);
  const streamThinkRef = useRef("");
  const streamThinkStartRef = useRef(0);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [inputDragOver, setInputDragOver] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Report messages back to parent for conversation persistence
  const onSaveRef = useRef(onMessagesChange);
  onSaveRef.current = onMessagesChange;
  useEffect(() => {
    onSaveRef.current?.(messages.map((m) => ({ role: m.role, content: m.content, id: m.id })));
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

  // rAF sync: poll refs each frame, trigger re-render when content changes,
  // and smoothly animate the token counter toward the real value.
  useEffect(() => {
    if (!streaming) { setDisplayTokens(0); return; }
    let running = true;
    const tick = () => {
      if (!running) return;
      // Trigger re-render if SSE loop wrote new data
      if (streamTickRef.current !== streamTick) {
        setStreamTick(streamTickRef.current);
      }
      // Smooth token count — chase target with easing
      const target = streamOutputTokensRef.current > 0
        ? streamOutputTokensRef.current
        : Math.round(streamContentRef.current.length / 4);
      setDisplayTokens(prev => {
        if (prev >= target) return target;
        const step = Math.max(1, Math.ceil((target - prev) / 3));
        return prev + step > target ? target : prev + step;
      });
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
    const text = input.trim();
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
      // Create fresh AbortController so handleStop can cancel the SSE stream
      const controller = new AbortController();
      abortRef.current = controller;

      const r = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent: activeAgent, prompt, workspace }),
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
                flushThinking(); // no text arg — tool events don't carry text for dedup
                const id = parsed.toolId ?? `tool-${streamBlocksRef.current.length}`;
                if (parsed.toolName) {
                  // New tool call
                  streamBlocksRef.current.push({
                    type: "tool_use",
                    id,
                    toolName: parsed.toolName,
                    toolInput: parsed.toolInput ?? {},
                    status: "running",
                  });
                } else if (parsed.toolInput?.__partial != null) {
                  // Partial JSON delta — append to last tool_use block
                  const last = streamBlocksRef.current[streamBlocksRef.current.length - 1];
                  if (last?.type === "tool_use") {
                    last.toolInput = {
                      ...last.toolInput,
                      __partial: ((last.toolInput as Record<string, unknown>).__partial as string ?? "") + (parsed.toolInput.__partial as string),
                    };
                  }
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
                // Append tool_result block
                streamBlocksRef.current.push({
                  type: "tool_result",
                  id: targetId ?? `result-${streamBlocksRef.current.length}`,
                  toolOutput: parsed.toolOutput ?? "",
                });
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

  const canSend = (input.trim() || attachments.length > 0) && !streaming;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header — hidden in fullPage mode */}
      {!fullPage && (
        <div
          className="px-3 py-2.5 border-b text-xs font-medium tracking-wide shrink-0 flex items-center justify-between"
          style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}
        >
          <span>CHAT — {displayName}</span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && !streaming && (
          <div className="text-center py-12 text-xs" style={{ color: "var(--color-text-secondary)" }}>
            <div className="text-3xl mb-3">💬</div>
            <div>Ask {displayName} to help with your files</div>
            <div className="mt-1 opacity-60">Drop files or images to attach</div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className="fade-in">
            <div
              className="text-[10px] font-medium uppercase tracking-wider mb-0.5 flex items-center gap-2"
              style={{
                color: msg.role === "user" ? "var(--color-accent)"
                     : msg.role === "error" ? "oklch(0.55 0.2 30)"
                     : "var(--color-text-secondary)",
              }}
            >
              <span>{msg.role === "user" ? "You"
               : msg.role === "error" ? "Error"
               : displayName}</span>
            </div>
            {/* Attachments in user message */}
            {msg.attachments && msg.attachments.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-1.5">
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
                color: msg.role === "error" ? "oklch(0.55 0.2 30)" : "var(--color-text)",
                background: msg.role === "error" ? "oklch(0.55 0.2 30 / 0.08)" : "transparent",
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
            {/* Per-message usage + copy + time for assistant messages */}
            {msg.role === "assistant" && (
              <div className="flex items-center justify-between mt-1 gap-2">
                <span className="text-[10px] inline-flex items-center gap-1 flex-wrap" style={{ color: "var(--color-text-secondary)", opacity: 0.7 }}>
                  <span>{formatTokens(msg.inputTokens ?? Math.round(msg.content.length / 2))} in</span>
                  <span>·</span>
                  <span>{formatTokens(msg.outputTokens ?? Math.round(msg.content.length / 4))} out</span>
                  {msg.cacheTokens != null && msg.cacheTokens > 0 && (
                    <>
                      <span>·</span>
                      <span>{formatTokens(msg.cacheTokens)} cache</span>
                    </>
                  )}
                  <span>·</span>
                  <span>${estimateCost(msg.inputTokens ?? Math.round(msg.content.length / 2), msg.outputTokens ?? Math.round(msg.content.length / 4))}</span>
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => navigator.clipboard.writeText(msg.content).catch(() => {})}
                    className="text-[10px] px-2 py-0.5 rounded hover:opacity-70 transition-opacity"
                    style={{ color: "var(--color-text-secondary)", border: "1px solid var(--color-border)" }}
                  >
                    📋 Copy
                  </button>
                  <span className="text-[10px]" style={{ color: "var(--color-text-secondary)", opacity: 0.5 }}>
                    {formatTime(msg.createdAt)}
                  </span>
                </span>
              </div>
            )}
          </div>
        ))}

        {/* Streaming */}
        {streaming && (
          <div className="fade-in">
            <div
              className="text-[10px] font-medium uppercase tracking-wider mb-1"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {displayName}
            </div>
            <div
              className="text-sm leading-relaxed break-words mb-1"
              style={{ color: "var(--color-text)" }}
            >
              {streamContentRef.current ? (
                <MarkdownBody content={streamContentRef.current} />
              ) : null}
            </div>
            <div className="flex items-center gap-1 text-[10px]" style={{ color: "var(--color-text-secondary)", opacity: 0.7 }}>
              <span>Generating…</span>
              <span>(</span>
              <span className="tabular-nums">{elapsed}s</span>
              {displayTokens > 0 ? (
                <>
                  <span>·</span>
                  <span className="inline-flex items-center gap-0.5" style={{ color: "oklch(0.7 0.15 155)" }}>
                    ↓<span className="tabular-nums">{displayTokens}</span> tokens
                  </span>
                </>
              ) : (
                <>
                  <span>·</span>
                  <span className="animate-pulse">thinking</span>
                </>
              )}
              <span>)</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div
        className="p-4 border-t shrink-0"
        style={{ borderColor: "var(--color-border)" }}
        onDragOver={handleInputDragOver}
        onDragLeave={handleInputDragLeave}
        onDrop={handleInputDrop}
      >
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

        {/* Textarea */}
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Ask ${displayName}...`}
          rows={3}
          className="w-full resize-none p-2 text-sm rounded-md outline-none transition-colors"
          style={{
            background: inputDragOver ? "var(--color-accent-dim)" : "var(--color-surface)",
            color: "var(--color-text)",
            border: `1px solid ${inputDragOver ? "var(--color-accent)" : "var(--color-border)"}`,
          }}
          disabled={streaming}
        />

        {/* Bottom bar: attach button + hint + send */}
        <div className="flex justify-between items-center mt-2">
          <div className="flex items-center gap-2">
            {/* Attach button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors"
              style={{
                color: "var(--color-text-secondary)",
                border: "1px solid var(--color-border)",
              }}
              disabled={streaming}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
              </svg>
              Attach
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
              accept="image/*,.md,.txt,.json,.ts,.tsx,.js,.jsx,.py,.css,.html,.yaml,.yml,.toml"
            />
            <span className="text-[10px] hidden sm:inline" style={{ color: "var(--color-text-secondary)" }}>
              Enter to send · Shift+Enter for newline
            </span>
          </div>
          {streaming ? (
            <button
              onClick={handleStop}
              className="px-3 py-1 text-xs rounded-md transition-colors hover:opacity-80"
              style={{ background: "oklch(0.55 0.2 30)", color: "#fff" }}
            >
              Stop
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!canSend}
              className="px-3 py-1 text-xs rounded-md transition-colors"
              style={{
                background: canSend ? "var(--color-accent)" : "var(--color-border)",
                color: canSend ? "#fff" : "var(--color-text-secondary)",
                opacity: canSend ? 1 : 0.5,
              }}
            >
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
