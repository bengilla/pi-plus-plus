"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import type { ChatMessageSnapshot } from "@/components/ChatPanel";

// ── Types ────────────────────────────────────────────────────

/**
 * Lightweight, persisted index of a conversation.
 * No `messages` field — that lives in `messagesCache` and is loaded on demand.
 */
export interface ConvIndex {
  id: string;
  title: string;
  agentId: string;
  workspace?: string;
  createdAt: number;
  lastActivityAt?: number;
  manualTitle?: boolean;
  piSessionId?: string;
  // Pi-derived summary fields (filled by /api/pi/sessions/sync when present)
  piMessageCount?: number;
  piTotalInputTokens?: number;
  piTotalOutputTokens?: number;
  piTotalCacheTokens?: number;
}

/**
 * Full conversation with messages loaded. Used internally + returned as `activeConv`.
 */
export interface ConvData extends ConvIndex {
  messages: ChatMessageSnapshot[];
}

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

const STORAGE_KEY = "pi-plus-plus-conversations";
const OLD_STORAGE_KEY = "agents-web-conversations";

// ── Persistence helpers ──────────────────────────────────────

function loadConvs(defaultWorkspace = ""): ConvIndex[] {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    // Migration: if new key is empty but old key has data, copy it over
    if (!raw) {
      const old = localStorage.getItem(OLD_STORAGE_KEY);
      if (old) {
        localStorage.setItem(STORAGE_KEY, old);
        raw = old;
      }
    }
    const parsed = JSON.parse(raw || "[]") as ConvIndex[];
    return parsed.map((c) => ({
      ...c,
      workspace: c.workspace ?? defaultWorkspace,
      lastActivityAt: c.lastActivityAt ?? c.createdAt,
    }));
  } catch {
    return [];
  }
}

function saveConvs(convs: ConvIndex[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(convs));
}

function projectConvs(convs: ConvIndex[], workspace: string): ConvIndex[] {
  return convs.filter((c) => (c.workspace ?? "") === workspace);
}

function truncateTitle(text: string, maxLen = 36): string {
  const chars = Array.from(text);
  if (chars.length <= maxLen) return text;
  return chars.slice(0, maxLen).join("") + "…";
}

// ── Hook ─────────────────────────────────────────────────────

export function useConversations(workspace: string, activeAgent: string) {
  const [indexes, setIndexes] = useState<ConvIndex[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  // messagesCache: in-memory only, NOT persisted. Lost on browser close.
  // Track session IDs being deleted to prevent sync from re-adding them
  const deletingSessionIds = useRef<Set<string>>(new Set());
  const [messagesCache, setMessagesCache] = useState<Map<string, ChatMessageSnapshot[]>>(() => new Map());
  const [loadingConvId, setLoadingConvId] = useState<string | null>(null);

  // Load indexes from localStorage on mount; reset activeConvId if not in new workspace
  useEffect(() => {
    const all = loadConvs(workspace);
    setIndexes(all);
    setActiveConvId((prev) => {
      if (!prev) return null;
      const belongs = all.some((c) => c.id === prev && (c.workspace ?? "") === workspace);
      return belongs ? prev : null;
    });
  }, [workspace]);

  // Derive project list from all conversation indexes
  const projectWorkspaces = useMemo(() => {
    const map = new Map<string, { name: string; count: number; lastActivityAt: number }>();
    for (const c of indexes) {
      const ws = c.workspace || "";
      if (!ws) continue;
      const existing = map.get(ws);
      const ts = c.lastActivityAt ?? c.createdAt;
      if (existing) {
        existing.count++;
        if (ts > existing.lastActivityAt) existing.lastActivityAt = ts;
      } else {
        map.set(ws, {
          name: ws.split("/").filter(Boolean).pop() || ws,
          count: 1,
          lastActivityAt: ts,
        });
      }
    }
    return Array.from(map.entries())
      .map(([workspace, info]) => ({ workspace, ...info }))
      .sort((a, b) => b.lastActivityAt - a.lastActivityAt);
  }, [indexes]);

  // Standalone conversations: workspace is empty string
  const standaloneConvs = projectConvs(indexes, "")
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt);

  const currentProjectConvs = projectConvs(indexes, workspace)
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt);

  // Build convList from standalone + current project conversations
  function buildConvInfoList(convs: ConvIndex[]): ConvInfo[] {
    return convs.map((c) => {
      const cached = messagesCache.get(c.id);
      let totalTokens = 0, inputTokens = 0, outputTokens = 0, cacheTokens = 0;
      if (cached) {
        for (const m of cached) {
          const inT = m.inputTokens ?? (m.role === "user" ? Math.round(m.content.length / 4) : 0);
          const outT = m.outputTokens ?? (m.role === "assistant" ? Math.round(m.content.length / 4) : 0);
          const cacheT = m.cacheTokens ?? 0;
          inputTokens += inT;
          outputTokens += outT;
          cacheTokens += cacheT;
          totalTokens += inT + outT;
        }
      } else {
        inputTokens = c.piTotalInputTokens ?? 0;
        outputTokens = c.piTotalOutputTokens ?? 0;
        cacheTokens = c.piTotalCacheTokens ?? 0;
        totalTokens = inputTokens + outputTokens;
      }
      return {
        id: c.id,
        title: c.title,
        agentId: c.agentId,
        createdAt: c.createdAt,
        lastActivityAt: c.lastActivityAt ?? c.createdAt,
        totalTokens,
        inputTokens,
        outputTokens,
        cacheTokens,
      };
    });
  }

  const standaloneConvList: ConvInfo[] = buildConvInfoList(standaloneConvs);

  // Build convList: token numbers come from the loaded messages if present,
  // otherwise fall back to the Pi-derived summary fields (Q3-3c: updated after load).
  const convList: ConvInfo[] = currentProjectConvs.map((c) => {
    const cached = messagesCache.get(c.id);
    let totalTokens = 0, inputTokens = 0, outputTokens = 0, cacheTokens = 0;
    if (cached) {
      for (const m of cached) {
        const inT = m.inputTokens ?? (m.role === "user" ? Math.round(m.content.length / 4) : 0);
        const outT = m.outputTokens ?? (m.role === "assistant" ? Math.round(m.content.length / 4) : 0);
        const cacheT = m.cacheTokens ?? 0;
        inputTokens += inT;
        outputTokens += outT;
        cacheTokens += cacheT;
        totalTokens += inT + outT;
      }
    } else {
      inputTokens = c.piTotalInputTokens ?? 0;
      outputTokens = c.piTotalOutputTokens ?? 0;
      cacheTokens = c.piTotalCacheTokens ?? 0;
      totalTokens = inputTokens + outputTokens;
    }
    return {
      id: c.id,
      title: c.title,
      agentId: c.agentId,
      createdAt: c.createdAt,
      lastActivityAt: c.lastActivityAt ?? c.createdAt,
      totalTokens,
      inputTokens,
      outputTokens,
      cacheTokens,
    };
  });

  // Active conv: search both standalone and project conversations
  const activeIndex = [...standaloneConvs, ...currentProjectConvs].find((c) => c.id === activeConvId) ?? null;
  const activeConv: ConvData | null = activeIndex
    ? { ...activeIndex, messages: messagesCache.get(activeIndex.id) ?? [] }
    : null;

  /**
   * Load full messages for a Pi-synced conversation on demand.
   * Result is cached in memory; not persisted.
   */
  const loadConvMessages = useCallback(
    async (id: string): Promise<ChatMessageSnapshot[]> => {
      const cached = messagesCache.get(id);
      if (cached) return cached;
      const idx = indexes.find((c) => c.id === id);
      if (!idx || !idx.piSessionId) {
        // Web-UI-only conv: no Pi file to load
        setMessagesCache((prev) => {
          if (prev.has(id)) return prev;
          const next = new Map(prev);
          next.set(id, []);
          return next;
        });
        return [];
      }
      setLoadingConvId(id);
      try {
        const r = await fetch(
          `/api/pi/sessions/full?id=${encodeURIComponent(idx.piSessionId)}&workspace=${encodeURIComponent(idx.workspace || "")}`,
        );
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = (await r.json()) as { messages: ChatMessageSnapshot[] };
        setMessagesCache((prev) => {
          const next = new Map(prev);
          next.set(id, data.messages ?? []);
          return next;
        });
        return data.messages ?? [];
      } catch (e) {
        console.error("loadConvMessages failed:", e);
        return [];
      } finally {
        setLoadingConvId((cur) => (cur === id ? null : cur));
      }
    },
    [indexes, messagesCache],
  );

  const newConversation = useCallback((standalone = false) => {
    const now = Date.now();
    const id = now.toString();
    const targetWs = standalone ? "" : workspace;
    const c: ConvIndex = {
      id,
      title: "New conversation",
      agentId: activeAgent,
      workspace: targetWs,
      createdAt: now,
      lastActivityAt: now,
    };
    setIndexes((prev) => {
      const updated = [c, ...prev];
      saveConvs(updated);
      return updated;
    });
    setMessagesCache((prev) => {
      if (prev.has(id)) return prev;
      const next = new Map(prev);
      next.set(id, []);
      return next;
    });
    setActiveConvId(id);
  }, [activeAgent, workspace]);

  const selectConversation = useCallback((id: string) => {
    setActiveConvId(id);
  }, []);

  const deselectConversation = useCallback(() => {
    setActiveConvId(null);
  }, []);

  const deleteConversation = useCallback((id: string) => {
    // Determine next active conv BEFORE updating state
    const isDeletingActive = activeConvId === id;
    let nextConvId: string | null = null;
    if (isDeletingActive) {
      const allCurrent = [...standaloneConvs, ...projectConvs(indexes, workspace)];
      const remaining = allCurrent.filter((c) => c.id !== id);
      nextConvId = remaining.length > 0 ? remaining[0].id : null;
    }

    setIndexes((prev) => {
      const idx = prev.findIndex((c) => c.id === id);
      if (idx === -1) return prev;
      const conv = prev[idx];
      const updated = prev.filter((c) => c.id !== id);
      saveConvs(updated);
      // Also delete Pi session file
      if (conv?.piSessionId) {
        const ws = conv.workspace || "";
        fetch(`/api/pi/sessions?id=${encodeURIComponent(conv.piSessionId)}&workspace=${encodeURIComponent(ws)}`, {
          method: "DELETE",
        }).catch((e: unknown) => { console.error("[pi++] Failed to delete Pi session:", e); });
      }
      return updated;
    });
    setMessagesCache((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    if (isDeletingActive) {
      setActiveConvId(nextConvId);
    }
  }, [activeConvId, indexes, workspace]);

  const renameConversation = useCallback((id: string, title: string) => {
    setIndexes((prev) => {
      const updated = prev.map((c) =>
        c.id === id ? { ...c, title, manualTitle: true } : c,
      );
      saveConvs(updated);
      // Also rename in Pi session file
      const conv = updated.find((c) => c.id === id);
      if (conv?.piSessionId) {
        fetch("/api/pi/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "rename", sessionId: conv.piSessionId, name: title }),
        }).catch((e: unknown) => { console.error("[pi++] Failed to rename Pi session:", e); });
      }
      return updated;
    });
  }, []);

  const onMessagesChangeRef = useRef(true); // flag to prevent ghost convs
  onMessagesChangeRef.current = true;

  const onMessagesChange = useCallback(
    (messages: ChatMessageSnapshot[]) => {
      const firstUser = messages.find((m) => m.role === "user");
      const cid = activeConvId;
      const parsedPiSessionId = messages.find((m) => m.piSessionId)?.piSessionId;
      const nextId = parsedPiSessionId ? parsedPiSessionId.slice(0, 20) : cid;

      // Always update the in-memory messages cache for the active conv.
      if (cid) {
        setMessagesCache((prev) => {
          const next = new Map(prev);
          if (nextId && nextId !== cid) {
            next.delete(cid);
          }
          if (nextId) {
            next.set(nextId, messages);
          }
          return next;
        });
      }

      if (cid) {
        setIndexes((prev) => {
          const lastTs = messages[messages.length - 1]?.createdAt ?? Date.now();
          const updated = prev.map((c) => {
            if (c.id !== cid) return c;
            return {
              ...c,
              id: nextId || c.id,
              workspace,
              lastActivityAt: lastTs,
              piSessionId: parsedPiSessionId || c.piSessionId,
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
        if (nextId && nextId !== cid) {
          setActiveConvId(nextId);
        }
      } else if (messages.length > 0) {
        const now = Date.now();
        const newId = parsedPiSessionId ? parsedPiSessionId.slice(0, 20) : now.toString();
        const newConv: ConvIndex = {
          id: newId,
          title: firstUser ? truncateTitle(firstUser.content) : "New conversation",
          agentId: activeAgent,
          workspace,
          createdAt: now,
          lastActivityAt: now,
          piSessionId: parsedPiSessionId,
        };
        setIndexes((prev) => {
          const updated = [newConv, ...prev];
          saveConvs(updated);
          return updated;
        });
        setMessagesCache((prev) => {
          const next = new Map(prev);
          next.set(newId, messages);
          return next;
        });
        setActiveConvId(newId);
      }
    },
    [activeConvId, activeAgent, workspace],
  );

  /** Delete all conversations belonging to a workspace, including Pi sessions. */
  const deleteConversationsByWorkspace = useCallback((ws: string) => {
    setIndexes((prev) => {
      const toDelete = prev.filter((c) => (c.workspace ?? "") === ws);
      const updated = prev.filter((c) => (c.workspace ?? "") !== ws);
      if (updated.length !== prev.length) saveConvs(updated);
      // Delete Pi session files (async, track IDs to prevent sync re-adding)
      for (const c of toDelete) {
        if (c.piSessionId) {
          deletingSessionIds.current.add(c.piSessionId);
          fetch(`/api/pi/sessions?id=${encodeURIComponent(c.piSessionId)}&workspace=${encodeURIComponent(ws)}`, {
            method: "DELETE",
          })
            .finally(() => { deletingSessionIds.current.delete(c.piSessionId!); })
            .catch((e: unknown) => { console.error("[pi++] Failed to delete Pi session:", e); });
        }
      }
      return updated;
    });
    setMessagesCache((prev) => {
      const next = new Map(prev);
      let changed = false;
      for (const [id] of next) {
        const idx = indexes.find((c) => c.id === id);
        if (idx && (idx.workspace ?? "") === ws) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    // If active conv belonged to deleted workspace, deselect it
    setActiveConvId((prev) => {
      if (!prev) return null;
      const idx = indexes.find((c) => c.id === prev);
      return idx && (idx.workspace ?? "") === ws ? null : prev;
    });
  }, [indexes]);

  const deleteConversationsBySession = useCallback((sessionId: string) => {
    setIndexes((prev) => {
      const updated = prev.filter((c) => c.piSessionId !== sessionId);
      if (updated.length !== prev.length) saveConvs(updated);
      return updated;
    });
    setMessagesCache((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const [id, c] of next) {
        if (c.length > 0 && c[0]?.piSessionId === sessionId) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  /** Auto-sync Pi CLI sessions into the conversation index on startup. */
  const syncPiSessions = useCallback(async () => {
    try {
      const r = await fetch("/api/pi/sessions/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace: "", summary: true }),
      });
      const data = await r.json();
      if (!data.conversations?.length) return;

      // Use functional update to read LATEST state — avoids race with concurrent writes
      setIndexes((prev) => {
        const keyOf = (c: { piSessionId?: string; id: string }) => c.piSessionId || c.id;
        const merged = new Map<string, ConvIndex>();
        for (const c of prev) merged.set(keyOf(c), c);
        for (const c of data.conversations as ConvIndex[]) {
          // Skip sessions currently being deleted to avoid race condition
          if (c.piSessionId && deletingSessionIds.current.has(c.piSessionId)) continue;
          const key = keyOf(c);
          const existing = merged.get(key);
          if (existing) {
            merged.set(key, { ...c, title: existing.manualTitle ? existing.title : c.title, manualTitle: existing.manualTitle });
          } else {
            merged.set(key, c);
          }
        }
        const updated = Array.from(merged.values());
        saveConvs(updated);
        return updated;
      });
    } catch (e) {
      console.error("[pi++] Auto-sync failed:", e);
    }
  }, []);

  return {
    indexes,
    activeConvId,
    activeConv,
    convList,
    standaloneConvList,
    projectWorkspaces,
    loadingConvId,
    loadConvMessages,
    newConversation,
    selectConversation,
    deselectConversation,
    deleteConversation,
    renameConversation,
    syncPiSessions,
    onMessagesChange,
    deleteConversationsBySession,
    deleteConversationsByWorkspace,
  };
}
