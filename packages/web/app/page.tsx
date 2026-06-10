"use client";

import { useState, useCallback, useEffect, type DragEvent, type MouseEvent as ReactMouseEvent } from "react";
import type { ConvInfo } from "@/components/Sidebar";
import { Sidebar } from "@/components/Sidebar";
import { getPiDefinition } from "@/lib/agents/registry";
import { ChatPanel, type ChatMessageSnapshot } from "@/components/ChatPanel";
import { RightPanel } from "@/components/RightPanel";
import { SettingsModal } from "@/components/SettingsModal";

interface AgentInfo {
  id: string;
  name: string;
  description: string;
  version?: string;
  path?: string;
}

interface ConvData {
  id: string;
  title: string;
  agentId: string;
  workspace?: string;
  messages: ChatMessageSnapshot[];
  createdAt: number;
  manualTitle?: boolean;
  piSessionId?: string;
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
const WORKSPACE_KEY = "agents-web-workspace";
const SIDEBAR_WIDTH_KEY = "agents-web-sidebar-width";
const RIGHT_PANEL_WIDTH_KEY = "agents-web-right-panel-width";

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function truncateTitle(text: string, maxLen = 36): string {
  // Use Array.from for proper CJK character counting
  const chars = Array.from(text);
  if (chars.length <= maxLen) return text;
  return chars.slice(0, maxLen).join("") + "…";
}

function loadConvs(defaultWorkspace = ""): ConvData[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as ConvData[];
    return parsed.map((c) => ({ ...c, workspace: c.workspace ?? defaultWorkspace }));
  }
  catch { return []; }
}

function saveConvs(convs: ConvData[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(convs));
}

function projectConvs(convs: ConvData[], workspace: string): ConvData[] {
  return convs.filter((c) => (c.workspace ?? "") === workspace);
}

function latestConversationId(convs: ConvData[], workspace: string, agentId?: string): string | null {
  return projectConvs(convs, workspace).find((c) => !agentId || c.agentId === agentId)?.id ?? null;
}

export default function Home() {
  const [workspace, setWorkspace] = useState("");
  const activeAgent = "pi"; // Pi-only mode — no agent switching
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [fontScale, setFontScale] = useState(1.1);
  const [language, setLanguage] = useState<"en" | "zh">("en");
  const [thinkingLevel, setThinkingLevel] = useState("auto");

  // Version check
  const [versionCheck, setVersionCheck] = useState<{ currentVersion?: string; latestVersion?: string; updateAvailable?: boolean } | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [modelVersion, setModelVersion] = useState(0);

  // Panel state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [rightPanelView, setRightPanelView] = useState<"file" | "agent" | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [rightPanelWidth, setRightPanelWidth] = useState(520);

  // Conversations
  const [convs, setConvs] = useState<ConvData[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);

  useEffect(() => {
    const t = document.documentElement.getAttribute("data-theme") as "light" | "dark" | null;
    setTheme(t === "light" ? "light" : "dark");
    const saved = localStorage.getItem(WORKSPACE_KEY);
    setConvs(loadConvs(saved ?? ""));
    if (saved) setWorkspace(saved);
    const fs = localStorage.getItem("fontScale");
    if (fs) setFontScale(parseFloat(fs));
    const savedLanguage = localStorage.getItem("language");
    if (savedLanguage === "en" || savedLanguage === "zh") {
      setLanguage(savedLanguage);
      document.documentElement.lang = savedLanguage === "zh" ? "zh-CN" : "en";
    }
    const savedSidebarWidth = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    if (savedSidebarWidth) setSidebarWidth(clamp(parseInt(savedSidebarWidth, 10), 220, 420));
    const savedRightPanelWidth = localStorage.getItem(RIGHT_PANEL_WIDTH_KEY);
    if (savedRightPanelWidth) setRightPanelWidth(clamp(parseInt(savedRightPanelWidth, 10), 320, 760));
  }, []);

  // ── Keyboard shortcuts ────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "b") { e.preventDefault(); setSidebarOpen((p) => !p); }
      if (e.key === "Escape") { setRightPanelOpen(false); setShowSettings(false); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    document.documentElement.style.background = next === "dark"
      ? "oklch(16% 0.006 260)"
      : "oklch(98% 0.002 260)";
    localStorage.setItem("theme", next);
    setTheme(next);
  };

  const handleLanguageChange = (next: "en" | "zh") => {
    setLanguage(next);
    document.documentElement.lang = next === "zh" ? "zh-CN" : "en";
    localStorage.setItem("language", next);
  };

  const refreshAgents = useCallback(async () => {
    const r = await fetch("/api/agents");
    const data = await r.json();
    const list: AgentInfo[] = data.agents ?? [];
    setAgents(list);
    return data as { agents?: AgentInfo[] };
  }, []);

  useEffect(() => {
    refreshAgents()
      .catch(() => { setAgents([]); })
      .finally(() => setAgentsLoading(false));
    // Check Pi version for updates
    fetch("/api/pi/version")
      .then((r) => r.json())
      .then((data) => {
        setVersionCheck(data);
        if (data.updateAvailable) setShowUpdateModal(true);
      })
      .catch(() => {});
  }, [refreshAgents]);

  // ── Conversations ──────────────────────────────────────────
  const currentProjectConvs = projectConvs(convs, workspace);
  const convList: ConvInfo[] = currentProjectConvs.map((c) => {
    const totalTokens = c.messages?.reduce((sum, m) => sum + (m.inputTokens || 0) + (m.outputTokens || 0), 0) || 0;
    return { id: c.id, title: c.title, agentId: c.agentId, createdAt: c.createdAt, totalTokens };
  });

  const newConversation = () => {
    const id = Date.now().toString();
    const c: ConvData = { id, title: "New conversation", agentId: activeAgent, workspace, messages: [], createdAt: Date.now() };
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

  const renameConversation = (id: string, title: string) => {
    const updated = convs.map((c) => c.id === id ? { ...c, title, manualTitle: true } : c);
    setConvs(updated);
    saveConvs(updated);
  };

  const onMessagesChange = useCallback(
    (messages: ChatMessageSnapshot[]) => {
      const firstUser = messages.find((m) => m.role === "user");
      const cid = activeConvId;

      if (cid) {
        setConvs((prev) => {
          const updated = prev.map((c) => {
            if (c.id !== cid) return c;
            return {
              ...c,
              workspace,
              messages,
              piSessionId: firstUser?.piSessionId || c.piSessionId,
              title: c.manualTitle ? c.title : (firstUser ? truncateTitle(firstUser.content) : c.title),
            };
          });
          saveConvs(updated);
          return updated;
        });
      } else if (messages.length > 0) {
        const newId = Date.now().toString();
        const newConv: ConvData = {
          id: newId,
          title: firstUser ? truncateTitle(firstUser.content) : "New conversation",
          agentId: activeAgent,
          workspace,
          messages,
          createdAt: Date.now(),
          piSessionId: firstUser?.piSessionId,
        };
        setConvs((prev) => {
          const updated = [newConv, ...prev];
          saveConvs(updated);
          return updated;
        });
        setActiveConvId(newId);
      }
    },
    [activeConvId, activeAgent, workspace],
  );

  const navigateTo = useCallback((newPath: string) => {
    setWorkspace(newPath);
    localStorage.setItem(WORKSPACE_KEY, newPath);
    setActiveConvId(latestConversationId(convs, newPath, activeAgent));
  }, [activeAgent, convs]);

  const handleFileClick = useCallback((filePath: string) => {
    setSelectedFilePath(filePath);
    setRightPanelView("file");
    setRightPanelOpen(true);
  }, []);

  const handleAgentInfoClick = useCallback(() => {
    setRightPanelView("agent");
    setRightPanelOpen(true);
  }, []);

  const closeRightPanel = useCallback(() => {
    setRightPanelOpen(false);
  }, []);

  const startSidebarResize = useCallback((e: ReactMouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;
    const onMove = (moveEvent: MouseEvent) => {
      const next = clamp(startWidth + moveEvent.clientX - startX, 220, 420);
      setSidebarWidth(next);
    };
    const onUp = (upEvent: MouseEvent) => {
      const next = clamp(startWidth + upEvent.clientX - startX, 220, 420);
      setSidebarWidth(next);
      localStorage.setItem(SIDEBAR_WIDTH_KEY, String(next));
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [sidebarWidth]);

  const startRightPanelResize = useCallback((e: ReactMouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = rightPanelWidth;
    const maxWidth = Math.min(760, Math.round(window.innerWidth * 0.58));
    const onMove = (moveEvent: MouseEvent) => {
      const next = clamp(startWidth + startX - moveEvent.clientX, 320, maxWidth);
      setRightPanelWidth(next);
    };
    const onUp = (upEvent: MouseEvent) => {
      const next = clamp(startWidth + startX - upEvent.clientX, 320, maxWidth);
      setRightPanelWidth(next);
      localStorage.setItem(RIGHT_PANEL_WIDTH_KEY, String(next));
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [rightPanelWidth]);

  const handleDragOver = useCallback((e: DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }, []);
  const handleDragLeave = useCallback((e: DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); }, []);
  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragOver(false);
    const path = getDroppedPath(e);
    if (path) { navigateTo(path); }
  }, [navigateTo]);

  const currentAgent = agents.find((a) => a.id === activeAgent);
  const currentAgentDefinition = getPiDefinition();
  const activeConv = currentProjectConvs.find((c) => c.id === activeConvId);

  useEffect(() => {
    const levels = currentAgentDefinition?.thinkingLevels ?? [];
    if (levels.length > 0 && !levels.some((level) => level.value === thinkingLevel)) {
      setThinkingLevel("auto");
    }
  }, [currentAgentDefinition, thinkingLevel]);

  // ── No agents state ────────────────────────────────────────
  if (!agentsLoading && agents.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-0" style={{ background: "var(--bg)" }}>
        <div className="text-center max-w-sm px-6 fade-in">
          <div className="text-5xl mb-4">🤖</div>
          <h1 className="text-lg font-semibold mb-2" style={{ color: "var(--text)" }}>Pi Workspace</h1>
          <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
            {language === "zh" ? "安装 Pi 编码智能体即可开始。" : "Install the Pi coding agent to get started."}
          </p>
          <div className="space-y-2 text-left" style={{ fontSize: "var(--text-xs)" }}>
            <div className="px-3 py-2" style={{ background: "var(--bg-panel)", border: "1px solid var(--border)" }}>
              <code style={{ fontSize: "var(--text-sm)", color: "var(--accent)", fontFamily: "var(--font-mono)" }}>npm install -g @earendil-works/pi-coding-agent</code>
              <div className="mt-0.5" style={{ color: "var(--text-secondary)", opacity: 0.7 }}>Earendil Pi coding agent</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Main layout: three-column ──────────────────────────────
  return (
    <div className="flex flex-1 min-h-0" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      {/* ── Left: Sidebar ─────────────────────────────────── */}
      <div className={`sidebar-panel shrink-0 border-r flex flex-col min-h-0 ${sidebarOpen ? "" : "collapsed"}`}
        style={{
          borderColor: "var(--border)",
          background: "var(--bg-panel)",
          width: sidebarOpen ? sidebarWidth : 0,
          minWidth: sidebarOpen ? sidebarWidth : 0,
        }}>
        <Sidebar
          workspace={workspace}
          onWorkspaceChange={navigateTo}
          onOpenSettings={() => setShowSettings(true)}
          conversations={convList}
          activeConvId={activeConvId}
          onNewConversation={newConversation}
          onSelectConversation={selectConversation}
          onDeleteConversation={deleteConversation}
          onRenameConversation={renameConversation}
          agents={agents}
          onFileClick={handleFileClick}
          onAgentInfoClick={handleAgentInfoClick}
          language={language}
        />
      </div>
      {sidebarOpen && (
        <div
          className="group relative z-10 w-1.5 shrink-0 cursor-col-resize"
          onMouseDown={startSidebarResize}
          title="Resize sidebar"
        >
          <div
            className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors group-hover:w-0.5"
            style={{ background: "var(--border)" }}
          />
        </div>
      )}

      {/* ── Center: Main ──────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Top bar */}
        <header className="flex items-center justify-between px-4 h-[42px] border-b shrink-0"
          style={{ borderColor: "var(--border)", background: "var(--bg-panel)" }}>
          <div className="flex items-center gap-3">
            {/* Sidebar toggle */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1 hover:opacity-70 transition-opacity"
              style={{ color: "var(--text-secondary)" }}
              title={language === "zh" ? (sidebarOpen ? "关闭侧栏" : "打开侧栏") : (sidebarOpen ? "Close sidebar" : "Open sidebar")}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 3v18" />
              </svg>
            </button>

            {agentsLoading && (
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{language === "zh" ? "扫描中..." : "Scanning..."}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} className="shrink-0 p-1 hover:opacity-70 transition-opacity"
              style={{ color: "var(--text)" }} title={language === "zh" ? (theme === "dark" ? "切换到浅色" : "切换到深色") : (theme === "dark" ? "Switch to light" : "Switch to dark")}>
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
          </div>
        </header>

        {/* Chat or welcome */}
        {activeAgent ? (
          <ChatPanel
            activeAgent={activeAgent}
            agentName={currentAgent ? currentAgent.name : activeAgent}
            agentDescription={currentAgent?.description}
            agentVersion={currentAgent?.version}
            conversationId={activeConvId}
            sessionId={activeConv?.piSessionId}
            workspace={workspace}
            initialMessages={activeConv?.messages}
            onMessagesChange={onMessagesChange}
            thinkingLevel={thinkingLevel}
            thinkingLevels={currentAgentDefinition?.thinkingLevels ?? []}
            onThinkingLevelChange={setThinkingLevel}
            language={language}
            modelVersion={modelVersion}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center min-h-0" style={{ background: "var(--bg)" }}>
            <div className="text-center fade-in">
              <div className="text-4xl mb-3">💬</div>
              <div className="text-sm" style={{ color: "var(--text-secondary)" }}>{language === "zh" ? "选择一个智能体开始" : "Select an agent to start"}</div>
            </div>
          </div>
        )}
      </div>

      {/* ── Right: Context Panel ───────────────────────────── */}
      {rightPanelOpen && (
        <div
          className="group relative z-10 w-1.5 shrink-0 cursor-col-resize"
          onMouseDown={startRightPanelResize}
          title="Resize inspector"
        >
          <div
            className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors group-hover:w-0.5"
            style={{ background: "var(--border)" }}
          />
        </div>
      )}
      <div className={`right-panel shrink-0 border-l flex flex-col min-h-0 ${rightPanelOpen ? "" : "collapsed"}`}
        style={{
          borderColor: "var(--border)",
          background: "var(--bg-panel)",
          width: rightPanelOpen ? rightPanelWidth : 0,
          minWidth: rightPanelOpen ? Math.min(320, rightPanelWidth) : 0,
        }}>
        <RightPanel
          view={rightPanelView}
          filePath={selectedFilePath}
          agent={currentAgent}
          agentDefinition={currentAgentDefinition}
          workspace={workspace}
          onClose={closeRightPanel}
          language={language}
        />
      </div>

      {/* Settings modal */}
      <SettingsModal
        open={showSettings}
        onClose={() => { setShowSettings(false); setModelVersion((v) => v + 1); }}
        agents={agents}
        onAgentsRefresh={refreshAgents}
        fontScale={fontScale}
        onFontScaleChange={(s: number) => {
          setFontScale(s);
          document.documentElement.style.setProperty("--font-scale", String(s));
          localStorage.setItem("fontScale", String(s));
        }}
        language={language}
        workspace={workspace}
        onLanguageChange={handleLanguageChange}
      />

      {/* Drag overlay */}
      {dragOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none fade-in"
          style={{ background: "oklch(66% 0.19 252 / 0.06)", backdropFilter: "blur(2px)" }}>
          <div className="px-8 py-6 text-center"
            style={{ background: "var(--bg-elevated)", border: "2px dashed var(--accent)", boxShadow: "var(--shadow-modal)" }}>
            <div className="text-3xl mb-2">📁</div>
            <div className="text-sm font-medium" style={{ color: "var(--text)" }}>Drop folder here</div>
          </div>
        </div>
      )}

      {/* Update available modal */}
      {showUpdateModal && versionCheck?.latestVersion && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}
          onClick={() => setShowUpdateModal(false)}
        >
          <div
            className="w-full max-w-sm p-6 shadow-xl fade-in"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-4">
              <div className="text-3xl mb-2">π</div>
              <div className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
                {language === "zh" ? "Pi 有新版本可用" : "Pi Update Available"}
              </div>
              <div className="mt-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                {versionCheck.currentVersion || "?"} → {versionCheck.latestVersion}
              </div>
            </div>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setShowUpdateModal(false)}
                className="px-4 py-1.5 text-xs transition-opacity hover:opacity-80"
                style={{ color: "var(--text-secondary)", border: "1px solid var(--border-light)" }}
              >
                {language === "zh" ? "稍后" : "Later"}
              </button>
              <button
                onClick={async () => {
                  setUpdating(true);
                  try {
                    await fetch("/api/agents/upgrade", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ agentId: "pi", action: "upgrade" }),
                    });
                  } catch { /* ignore */ }
                  setUpdating(false);
                  setShowUpdateModal(false);
                }}
                disabled={updating}
                className="px-4 py-1.5 text-xs transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ color: "var(--accent)", background: "transparent", border: "1px solid var(--accent)" }}
              >
                {updating ? (language === "zh" ? "更新中..." : "Updating...") : (language === "zh" ? "立即更新" : "Update Now")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
