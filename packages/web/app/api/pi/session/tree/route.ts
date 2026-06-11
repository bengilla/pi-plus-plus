import { NextResponse } from "next/server";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

function encodeWorkspace(w: string): string {
  const cleaned = w.replace(/^\/+/, "").replace(/\/+$/, "");
  return "--" + cleaned.replace(/\//g, "-") + "--";
}

interface SessionEntry {
  type: string;
  id: string;
  parentId: string | null;
  timestamp: string;
  /** Human-readable summary of this entry */
  summary: string;
  /** The raw role from the message (if applicable) */
  role?: string;
  /** Provider/model if assistant message */
  provider?: string;
  model?: string;
  /** Sub-entry indicators for collapse/expand */
  children?: SessionEntry[];
  /** Whether this entry is the current leaf (active branch) */
  isLeaf: boolean;
}

interface SessionTree {
  id: string;
  filename: string;
  cwd: string;
  version: number;
  name?: string;
  entries: SessionEntry[];
  leafId: string | null;
}

// GET /api/pi/session/tree?id=X&workspace=Y — return full session tree
export async function GET(req: Request) {
  const url = new URL(req.url);
  const workspace = url.searchParams.get("workspace") || "";
  const id = url.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const sessionsBase = join(homedir(), ".pi", "agent", "sessions");

  // Determine which directories to scan
  let dirsToScan: string[] = [];
  if (workspace) {
    const encoded = encodeWorkspace(workspace);
    dirsToScan.push(join(sessionsBase, encoded));
  } else {
    // No Project mode: scan all session directories
    try {
      dirsToScan = readdirSync(sessionsBase)
        .filter((d) => {
          try { return statSync(join(sessionsBase, d)).isDirectory(); }
          catch { return false; }
        })
        .map((d) => join(sessionsBase, d));
    } catch { dirsToScan = []; }
  }

  for (const dir of dirsToScan) {
    try {
    const files = readdirSync(dir).filter((f) => f.endsWith(".jsonl"));

    for (const file of files) {
      const filePath = join(dir, file);
      const content = readFileSync(filePath, "utf-8");
      const lines = content.trim().split("\n");

      // Parse header
      const header = JSON.parse(lines[0]);
      const sessionId = header.id || file.split("_")[1]?.replace(".jsonl", "") || file;
      if (!sessionId.startsWith(id)) continue;

      // Determine the leaf: walk parentId chain from last entry to first
      const entryMap = new Map<string, { line: string; parsed: any }>();

      for (let i = 1; i < lines.length; i++) {
        try {
          const parsed = JSON.parse(lines[i]);
          if (parsed.id) {
            entryMap.set(parsed.id, { line: lines[i], parsed });
          }
        } catch { /* skip malformed */ }
      }

      // Build tree
      const rootEntries: SessionEntry[] = [];
      const childMap = new Map<string | null, SessionEntry[]>();

      for (const [entryId, { parsed }] of entryMap) {
        const parentId = parsed.parentId ?? null;
        if (!childMap.has(parentId)) childMap.set(parentId, []);
        const summary = summarizeEntry(parsed);
        const entry: SessionEntry = {
          type: parsed.type,
          id: entryId,
          parentId,
          timestamp: parsed.timestamp || "",
          summary,
          isLeaf: false,
        };
        if (parsed.message?.role) entry.role = parsed.message.role;
        if (parsed.provider || parsed.modelId) {
          entry.provider = parsed.provider;
          entry.model = parsed.modelId;
        }
        childMap.get(parentId)!.push(entry);
      }

      // Build hierarchy
      const buildTree = (parentId: string | null): SessionEntry[] => {
        return (childMap.get(parentId) ?? []).map((entry) => ({
          ...entry,
          children: buildTree(entry.id),
        }));
      };

      rootEntries.push(...buildTree(null));

      // Determine leaf: find the entry with no children that's deepest
      let leafId: string | null = null;
      const findLeaf = (entries: SessionEntry[]): string | null => {
        for (const entry of entries) {
          if (!entry.children || entry.children.length === 0) {
            return entry.id;
          }
          const childLeaf = findLeaf(entry.children);
          if (childLeaf) return childLeaf;
        }
        return null;
      };
      leafId = findLeaf(rootEntries);

      // Mark leaf
      const markLeaf = (entries: SessionEntry[]) => {
        for (const entry of entries) {
          if (entry.id === leafId) entry.isLeaf = true;
          if (entry.children) markLeaf(entry.children);
        }
      };
      markLeaf(rootEntries);

      // Get session name from session_info entries
      let name: string | undefined;
      for (const [, { parsed }] of entryMap) {
        if (parsed.type === "session_info" && parsed.name) {
          name = parsed.name;
        }
      }

      const tree: SessionTree = {
        id: sessionId,
        filename: file,
        cwd: header.cwd || "",
        version: header.version ?? 1,
        name,
        entries: rootEntries,
        leafId,
      };

      return NextResponse.json({ tree });
    }
    } catch { /* skip unreadable dir */ }
    }

    return NextResponse.json({ error: "Session not found" }, { status: 404 });
}

/** Produce a short human-readable summary of a session entry */
function summarizeEntry(parsed: any): string {
  switch (parsed.type) {
    case "message": {
      const msg = parsed.message;
      if (!msg) return "(unknown)";
      switch (msg.role) {
        case "user": {
          const c = msg.content;
          if (typeof c === "string") return c.slice(0, 80);
          if (Array.isArray(c)) {
            const text = c.filter((b: any) => b.type === "text").map((b: any) => b.text).join(" ").slice(0, 80);
            return text || "(image/attachment)";
          }
          return "(user)";
        }
        case "assistant": {
          const c = msg.content;
          if (Array.isArray(c)) {
            const text = c.filter((b: any) => b.type === "text").map((b: any) => b.text).join(" ").slice(0, 60);
            const hasToolCall = c.some((b: any) => b.type === "toolCall");
            const label = text ? `assistant: ${text}` : "assistant";
            return hasToolCall ? `${label} 🛠️` : label;
          }
          return "(assistant)";
        }
        case "toolResult": {
          const c = msg.content;
          const text = Array.isArray(c) ? c.filter((b: any) => b.type === "text").map((b: any) => b.text).join(" ").slice(0, 40) : "";
          return `toolResult${text ? `: ${text}` : ""} (${msg.toolName || "?"})`;
        }
        case "bashExecution": {
          return `bash: ${(msg.command || "").slice(0, 50)}`;
        }
        default:
          return `${msg.role}: ${JSON.stringify(msg.content).slice(0, 60)}`;
      }
    }
    case "compaction":
      return `📦 compaction (${parsed.tokensBefore ?? "?"} tokens)`;
    case "branch_summary":
      return `🔀 branch switch — ${(parsed.summary || "").slice(0, 60)}`;
    case "model_change":
      return `model → ${parsed.provider || ""}/${parsed.modelId || parsed.model || "?"}`;
    case "thinking_level_change":
      return `thinking → ${parsed.thinkingLevel || "?"}`;
    case "session_info":
      return parsed.name ? `📝 ${parsed.name}` : "(session info)";
    case "label":
      return `🏷️ ${parsed.label || ""} → ${(parsed.targetId || "").slice(0, 8)}`;
    case "custom_message":
      return `📎 ${(parsed.customType || "")}: ${typeof parsed.content === "string" ? parsed.content.slice(0, 60) : ""}`;
    default:
      return `${parsed.type}: ${JSON.stringify(parsed).slice(0, 60)}`;
  }
}
