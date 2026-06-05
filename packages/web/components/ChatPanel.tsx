"use client";

import { useState, useRef, useEffect, useCallback, type DragEvent } from "react";

interface Attachment {
  name: string;
  path: string;
  type: "file" | "image";
}

interface Message {
  role: "user" | "assistant";
  content: string;
  id: string;
  attachments?: Attachment[];
}

interface Props {
  activeAgent: string;
  workspace: string;
  fullPage?: boolean;
}

export function ChatPanel({ activeAgent, workspace, fullPage }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [inputDragOver, setInputDragOver] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clear messages when agent or workspace changes
  useEffect(() => {
    setMessages([]);
    setStreamContent("");
    setAttachments([]);
  }, [activeAgent, workspace]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamContent]);

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
    // Reset so same file can be selected again
    e.target.value = "";
  }, []);

  // Handle drag-drop files onto input area
  const handleInputDragOver = useCallback((e: DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setInputDragOver(true);
  }, []);

  const handleInputDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setInputDragOver(false);
  }, []);

  const handleInputDrop = useCallback((e: DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setInputDragOver(false);

    const files = e.dataTransfer.files;
    if (files) {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        // Try to get full path from drag data
        const isImage = f.type.startsWith("image/");
        setAttachments((prev) => {
          // Avoid duplicates
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

  const handleSend = async () => {
    const text = input.trim();
    if ((!text && attachments.length === 0) || streaming) return;

    const attList = [...attachments];
    const userMsg: Message = {
      role: "user",
      content: text || "(attachments)",
      id: Date.now().toString(),
      attachments: attList.length > 0 ? attList : undefined,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setAttachments([]);
    setStreaming(true);
    setStreamContent("");

    // Build prompt with attachment references
    let prompt = text;
    if (attList.length > 0) {
      const names = attList.map((a) => a.name).join(", ");
      prompt = text ? `${text}\n\n[Attached files: ${names}]` : `[Attached files: ${names}]`;
    }

    try {
      const r = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent: activeAgent, prompt, workspace }),
      });

      if (!r.ok) throw new Error(`HTTP ${r.status}`);

      const reader = r.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let full = "";

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
              if (parsed.text) full += parsed.text;
            } catch {
              full += data;
            }
          }
        }
        setStreamContent(full);
      }

      setMessages((prev) => [...prev, { role: "assistant", content: full, id: Date.now().toString() }]);
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : "Chat error";
      setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${errMsg}`, id: Date.now().toString() }]);
    } finally {
      setStreaming(false);
      setStreamContent("");
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
    <div className="flex flex-col h-full">
      {/* Header — hidden in fullPage mode */}
      {!fullPage && (
        <div className="px-3 py-2.5 border-b text-xs font-medium tracking-wide shrink-0"
          style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}>
          CHAT — {activeAgent}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {messages.length === 0 && !streaming && (
          <div className="text-center py-12 text-xs" style={{ color: "var(--color-text-secondary)" }}>
            <div className="text-3xl mb-3">💬</div>
            <div>Ask {activeAgent} to help with your files</div>
            <div className="mt-1 opacity-60">Drop files or images to attach</div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className="fade-in">
            <div className="text-[10px] font-medium uppercase tracking-wider mb-0.5"
              style={{ color: msg.role === "user" ? "var(--color-accent)" : "var(--color-text-secondary)" }}>
              {msg.role === "user" ? "You" : activeAgent}
            </div>
            {/* Attachments in user message */}
            {msg.attachments && msg.attachments.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-1.5">
                {msg.attachments.map((a) => (
                  <span key={a.name} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px]"
                    style={{ background: "var(--color-accent-dim)", color: "var(--color-accent)" }}>
                    {a.type === "image" ? "🖼️" : "📎"} {a.name}
                  </span>
                ))}
              </div>
            )}
            <div className="text-sm leading-relaxed whitespace-pre-wrap break-words"
              style={{ color: "var(--color-text)" }}>
              {msg.content}
            </div>
          </div>
        ))}

        {/* Streaming */}
        {streaming && (
          <div className="fade-in">
            <div className="text-[10px] font-medium uppercase tracking-wider mb-0.5"
              style={{ color: "var(--color-text-secondary)" }}>
              {activeAgent}
            </div>
            <div className="text-sm leading-relaxed whitespace-pre-wrap break-words"
              style={{ color: "var(--color-text)" }}>
              {streamContent || "..."}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="p-3 border-t shrink-0" style={{ borderColor: "var(--color-border)" }}
        onDragOver={handleInputDragOver}
        onDragLeave={handleInputDragLeave}
        onDrop={handleInputDrop}
      >
        {/* Attachment bar */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {attachments.map((a) => (
              <span key={a.name} className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-md text-xs"
                style={{ background: "var(--color-accent-dim)", color: "var(--color-accent)" }}>
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
          placeholder={`Ask ${activeAgent}...`}
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
            {streaming ? "..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
