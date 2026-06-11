"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { ChatMessageSnapshot } from "@/components/ChatPanel";

// ── Types ────────────────────────────────────────────────────

export interface ConvData {
  id: string;
  title: string;
  agentId: string;
  workspace?: string;
  messages: ChatMessageSnapshot[];
  createdAt: number;
  manualTitle?: boolean;
  piSessionId?: string;
}

export interface ConvInfo {
  id: string;
  title: string;
  agentId: string;
  createdAt: number;
  totalTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  cacheTokens?: number;
}

const STORAGE_KEY = "agents-web-conversations";

// ── Persistence helpers ──────────────────────────────────────

function loadConvs(defaultWorkspace = ""): ConvData[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as ConvData[];
    return parsed.map((c) => ({ ...c, workspace: c.workspace ?? defaultWorkspace }));
  } catch {
    return [];
  }
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

function truncateTitle(text: string, maxLen = 36): string {
  const chars = Array.from(text);
  if (chars.length <= maxLen) return text;
  return chars.slice(0, maxLen).join("") + "…";
}

// ── Hook ─────────────────────────────────────────────────────

export function useConversations(workspace: string, activeAgent: string) {
  const [convs, setConvs] = useState<ConvData[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);

  // Load from localStorage on mount; reset activeConvId if not in new workspace
  useEffect(() => {
    const all = loadConvs(workspace);
    setConvs(all);
    setActiveConvId((prev) => {
      if (!prev) return null;
      const belongs = all.some((c) => c.id === prev && (c.workspace ?? "") === workspace);
      return belongs ? prev : null;
    });
  }, [workspace]);

  const currentProjectConvs = projectConvs(convs, workspace);
  const convList: ConvInfo[] = currentProjectConvs.map((c) => {
    let totalTokens = 0, inputTokens = 0, outputTokens = 0, cacheTokens = 0;
    for (const m of c.messages ?? []) {
      const inT = m.inputTokens ?? (m.role === "user" ? Math.round(m.content.length / 4) : 0);
      const outT = m.outputTokens ?? (m.role === "assistant" ? Math.round(m.content.length / 4) : 0);
      const cacheT = m.cacheTokens ?? 0;
      inputTokens += inT;
      outputTokens += outT;
      cacheTokens += cacheT;
      totalTokens += inT + outT;
    }
    return { id: c.id, title: c.title, agentId: c.agentId, createdAt: c.createdAt, totalTokens, inputTokens, outputTokens, cacheTokens };
  });

  const activeConv = currentProjectConvs.find((c) => c.id === activeConvId) ?? null;

  const newConversation = useCallback(() => {
    const id = Date.now().toString();
    const c: ConvData = {
      id,
      title: "New conversation",
      agentId: activeAgent,
      workspace,
      messages: [],
      createdAt: Date.now(),
    };
    setConvs((prev) => {
      const updated = [c, ...prev];
      saveConvs(updated);
      return updated;
    });
    setActiveConvId(id);
  }, [activeAgent, workspace]);

  const selectConversation = useCallback((id: string) => {
    setActiveConvId(id);
  }, []);

  const deleteConversation = useCallback((id: string) => {
    setConvs((prev) => {
      const updated = prev.filter((c) => c.id !== id);
      saveConvs(updated);
      return updated;
    });
    setActiveConvId((prev) => (prev === id ? null : prev));
  }, []);

  const renameConversation = useCallback((id: string, title: string) => {
    setConvs((prev) => {
      const updated = prev.map((c) =>
        c.id === id ? { ...c, title, manualTitle: true } : c,
      );
      saveConvs(updated);
      return updated;
    });
  }, []);

  const onMessagesChangeRef = useRef(true); // flag to prevent ghost convs
  onMessagesChangeRef.current = true;

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
              title: c.manualTitle
                ? c.title
                : firstUser
                  ? truncateTitle(firstUser.content)
                  : c.title,
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

  const deleteConversationsBySession = useCallback((sessionId: string) => {
    setConvs((prev) => {
      const updated = prev.filter((c) => c.piSessionId !== sessionId);
      if (updated.length !== prev.length) saveConvs(updated);
      return updated;
    });
  }, []);

  return {
    convs,
    activeConvId,
    activeConv,
    convList,
    newConversation,
    selectConversation,
    deleteConversation,
    renameConversation,
    onMessagesChange,
    deleteConversationsBySession,
  };
}
