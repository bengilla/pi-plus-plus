"use client";

import { useState, useCallback, useEffect, type DragEvent } from "react";
import type { ConvInfo } from "@/components/Sidebar";
import { Sidebar } from "@/components/Sidebar";
import { getAllDefinitions } from "@/lib/agents/registry";

const DEFAULT_THINKING_LEVELS = [
  { value: "auto", label: "Auto" },
  { value: "off", label: "Off" },
];
import { ModelSwitcher } from "@/components/ModelSwitcher";
import { ChatPanel } from "@/components/ChatPanel";
import { SettingsModal } from "@/components/SettingsModal";

interface AgentInfo {
  id: string;
  name: string;
  description: string;
  version?: string;
}

interface ConvData {
  id: string;
  title: string;
  agentId: string;
  messages: { role: string; content: string; id: string }[];
  createdAt: number;
}

function agentLabel(a: AgentInfo): string {
  const m = a.version?.match(/(\d+\.\d+\.\d+)/);
  const ver = m ? m[1] : "";
  return ver ? `${a.name} (${ver})` : a.name;
}

function getDroppedPath(e: DragEvent): string | null {
  const uri = e.dataTransfer.getData("text/uri-list");
  if (uri) {
    const lines = uri.split("\n").filter((l) => l && !l.startsWith("#"));
    for (const line of lines) {
      let decoded = decodeURIComponent(line.trim());
      decoded = decoded.replace(/^file:\/\/[^/]*/, "");
      if (decoded.startsWith("/") && decoded.length > 2) return decoded;
    }
  }
  const plain = e.dataTransfer.getData("text/plain");
  if (plain && plain.startsWith("file://")) {
    let decoded = decodeURIComponent(plain.replace(/^file:\/\/[^/]*/, ""));
    if (decoded.startsWith("/") && decoded.length > 2) return decoded;
  }
  return null;
}

const STORAGE_KEY = "agents-web-conversations";

function loadConvs(): ConvData[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch { return []; }
}

function saveConvs(convs: ConvData[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(convs));
}

export default function Home() {
  const [workspace, setWorkspace] = useState("/Users/bengilla/Documents/DXP2800/github/agents-web");
  const [activeAgent, setActiveAgent] = useState("");
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [thinkingLevel, setThinkingLevel] = useState("auto");

  // Conversations
  const [convs, setConvs] = useState<ConvData[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);

  useEffect(() => {
    const t = document.documentElement.getAttribute("data-theme") as "light" | "dark" | null;
    setTheme(t === "dark" ? "dark" : "light");
    setConvs(loadConvs());
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    setTheme(next);
  };

  useEffect(() => {
    fetch("/api/agents")
      .then((r) => r.json())
      .then((data) => {
        const list: AgentInfo[] = data.agents ?? [];
        setAgents(list);
        if (list.length > 0) setActiveAgent((prev) => list.some((a) => a.id === prev) ? prev : list[0].id);
      })
      .catch(() => setAgents([]))
      .finally(() => setAgentsLoading(false));
  }, []);

  // ── Conversations ──────────────────────────────────────
  const convList: ConvInfo[] = convs.map((c) => ({
    id: c.id, title: c.title, agentId: c.agentId, createdAt: c.createdAt,
  }));

  const newConversation = () => {
    const id = Date.now().toString();
    const c: ConvData = { id, title: "New conversation", agentId: activeAgent, messages: [], createdAt: Date.now() };
    const updated = [c, ...convs];
    setConvs(updated); saveConvs(updated); setActiveConvId(id);
  };

  const selectConversation = (id: string) => {
    setActiveConvId(id);
  };

  const deleteConversation = (id: string) => {
    const updated = convs.filter((c) => c.id !== id);
    setConvs(updated); saveConvs(updated);
    if (activeConvId === id) setActiveConvId(null);
  };

  const onMessagesChange = useCallback(
    (messages: { role: string; content: string; id: string }[]) => {
      if (!activeConvId) return;
      setConvs((prev) => {
        const updated = prev.map((c) => {
          if (c.id !== activeConvId) return c;
          const firstUser = messages.find((m) => m.role === "user");
          return { ...c, messages, title: firstUser ? firstUser.content.slice(0, 40) : c.title };
        });
        saveConvs(updated);
        return updated;
      });
    },
    [activeConvId],
  );

  const navigateTo = useCallback((newPath: string) => setWorkspace(newPath), []);
  const handleDragOver = useCallback((e: DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }, []);
  const handleDragLeave = useCallback((e: DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); }, []);
  const handleDrop = useCallback((e: DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); const path = getDroppedPath(e); if (path) setWorkspace(path); }, []);

  const currentAgent = agents.find((a) => a.id === activeAgent);
  const activeConv = convs.find((c) => c.id === activeConvId);

  if (!agentsLoading && agents.length === 0) {
    return (
      <div className="flex h-full items-center justify-center" style={{ background: "var(--color-surface)" }}>
        <div className="text-center max-w-sm px-6">
          <div className="text-5xl mb-4">🤖</div>
          <h1 className="text-lg font-semibold mb-2" style={{ color: "var(--color-text)" }}>agents-web</h1>
          <p className="text-sm mb-6" style={{ color: "var(--color-text-secondary)" }}>Multi-agent web workspace. Install a CLI agent to get started.</p>
          <div className="space-y-2 text-left text-xs" style={{ color: "var(--color-text-secondary)" }}>
            <div className="px-3 py-2 rounded-md" style={{ background: "var(--color-surface-secondary)", border: "1px solid var(--color-border)" }}>
              <code className="text-sm" style={{ color: "var(--color-accent)" }}>npm install -g @anthropic-ai/claude-code</code>
              <div className="mt-0.5 opacity-60">Anthropic Claude Code</div>
            </div>
            <div className="px-3 py-2 rounded-md" style={{ background: "var(--color-surface-secondary)", border: "1px solid var(--color-border)" }}>
              <code className="text-sm" style={{ color: "var(--color-accent)" }}>npm install -g @openai/codex</code>
              <div className="mt-0.5 opacity-60">OpenAI Codex CLI</div>
            </div>
            <div className="px-3 py-2 rounded-md" style={{ background: "var(--color-surface-secondary)", border: "1px solid var(--color-border)" }}>
              <code className="text-sm" style={{ color: "var(--color-accent)" }}>npm install -g @earendil-works/pi-coding-agent</code>
              <div className="mt-0.5 opacity-60">Earendil Pi coding agent</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      <Sidebar
        workspace={workspace}
        onWorkspaceChange={navigateTo}
        onOpenSettings={() => setShowSettings(true)}
        conversations={convList}
        activeConvId={activeConvId}
        onNewConversation={newConversation}
        onSelectConversation={selectConversation}
        onDeleteConversation={deleteConversation}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between px-4 py-2 border-b shrink-0"
          style={{ borderColor: "var(--color-border)", background: "var(--color-surface-secondary)" }}>
          <div className="flex items-center gap-3">
            <span className="font-semibold text-sm tracking-tight">agents-web</span>
            {agentsLoading ? (
              <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>Scanning...</span>
            ) : (
              <>
                <ModelSwitcher value={activeAgent} onChange={(id) => { setActiveAgent(id); setThinkingLevel("auto"); }} />
                <select
                  value={thinkingLevel}
                  onChange={(e) => setThinkingLevel(e.target.value)}
                  className="text-[11px] px-2 py-0.5 rounded cursor-pointer"
                  style={{ background: "var(--color-surface)", color: "var(--color-text)", border: "1px solid var(--color-border)" }}
                  title="Thinking level"
                >
                  {(getAllDefinitions().find(d => d.id === activeAgent)?.thinkingLevels ?? DEFAULT_THINKING_LEVELS).map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </>
            )}
          </div>
          <button onClick={toggleTheme} className="shrink-0 p-1 rounded hover:opacity-70 transition-colors"
            style={{ color: "var(--color-text)" }} title={theme === "dark" ? "Switch to light" : "Switch to dark"}>
            {theme === "dark" ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>
        </header>

        {activeAgent ? (
          <ChatPanel
            key={activeConvId ?? "new"}
            activeAgent={activeAgent}
            agentName={currentAgent ? agentLabel(currentAgent) : activeAgent}
            workspace={workspace}
            fullPage
            initialMessages={activeConv?.messages}
            onMessagesChange={onMessagesChange}
            thinkingLevel={thinkingLevel === "auto" ? undefined : thinkingLevel}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center" style={{ color: "var(--color-text-secondary)" }}>
            <div className="text-center">
              <div className="text-4xl mb-3">💬</div>
              <div className="text-sm">Select an agent to start</div>
            </div>
          </div>
        )}
      </div>

      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} agents={agents} />

      {dragOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          style={{ background: "oklch(0.68 0.21 250 / 0.08)", backdropFilter: "blur(2px)" }}>
          <div className="px-8 py-6 rounded-xl text-center"
            style={{ background: "var(--color-surface)", border: "2px dashed var(--color-accent)", boxShadow: "0 16px 48px rgba(0,0,0,0.15)" }}>
            <div className="text-3xl mb-2">📁</div>
            <div className="text-sm font-medium">Drop folder here</div>
          </div>
        </div>
      )}
    </div>
  );
}
