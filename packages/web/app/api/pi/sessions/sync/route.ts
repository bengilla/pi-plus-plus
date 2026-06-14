import { NextRequest, NextResponse } from "next/server";
import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

// ── Helpers ──────────────────────────────────────────────────

function extractContentText(content: any): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((p) => {
      if (typeof p === "string") return p;
      if (p && typeof p === "object") return p.text || p.content || "";
      return "";
    }).join("");
  }
  return "";
}

function sessionsDirFor(workspace: string): string {
  if (!workspace) {
    const homeClean = homedir().replace(/^\/+|\/+$/g, "").replace(/\//g, "-");
    return join(homedir(), ".pi/agent/sessions", `--${homeClean}--`);
  }
  const dirname = "--" + workspace.replace(/^\/+|\/+$/g, "").replace(/\//g, "-") + "--";
  return join(homedir(), ".pi/agent/sessions", dirname);
}

function extractConvs(sessionsDir: string, opts: { summary?: boolean } = {}): any[] {
  if (!existsSync(sessionsDir)) return [];
  const convs: any[] = [];
  const seen = new Set<string>();

  const files = readdirSync(sessionsDir)
    .filter((f) => f.endsWith(".jsonl"))
    .sort();

  for (const fname of files) {
    const fpath = join(sessionsDir, fname);
    if (!statSync(fpath).isFile()) continue;

    const parsed = parseSessionFile(fpath);
    if (!parsed || parsed.messages.length === 0 || !parsed.sid) continue;
    if (seen.has(parsed.sid)) continue;
    seen.add(parsed.sid);

    const { sid, workspace: rawWorkspace, startedAt, lastActivityAt, messages } = parsed;
    // Sessions stored under "--Users-bengilla--" (i.e. Pi's "No Project" / home)
    // carry cwd = homedir(). Map them to workspace = "" so they surface under
    // the "No Project" filter in the sidebar.
    const home = homedir();
    const sessionWorkspace = rawWorkspace === home ? "" : rawWorkspace;
    const firstUser = messages.find((m) => m.role === "user");
    // Strip Pi-injected system prefixes from titles
    const cleanContent = firstUser
      ? [...firstUser.content]
          .join("")
          .replace(/^(请用中文回复[.。]?\s*)+/i, "")
          .replace(/^(Please respond in Chinese[.!]?\s*)+/i, "")
          .trim()
      : "";
    let title = cleanContent ? [...cleanContent].slice(0, 36).join("") : "Session";
    if (cleanContent && [...cleanContent].length > 36) title += "…";
    // createdAt: session 开始时间(mtime 在 macOS 是秒级,且会随每次写入变化,不可靠)
    // lastActivityAt: 最后一条 message 的时间戳,真正反映"最后活动"
    const createdAt = startedAt ?? lastActivityAt ?? Date.now();
    const activity = lastActivityAt ?? createdAt;

    if (opts.summary) {
      // Lightweight index only — no messages. Token totals from assistant message usage.
      let totalInput = 0, totalOutput = 0, totalCache = 0;
      for (const m of messages) {
        if (m.role === "assistant") {
          totalInput += m.inputTokens || 0;
          totalOutput += m.outputTokens || 0;
          totalCache += m.cacheTokens || 0;
        }
      }
      convs.push({
        id: sid.slice(0, 20),
        title,
        agentId: "pi",
        workspace: sessionWorkspace,
        createdAt,
        lastActivityAt: activity,
        piSessionId: sid,
        piMessageCount: messages.length,
        piTotalInputTokens: totalInput,
        piTotalOutputTokens: totalOutput,
        piTotalCacheTokens: totalCache,
      });
    } else {
      convs.push({
        id: sid.slice(0, 20),
        title,
        agentId: "pi",
        workspace: sessionWorkspace,
        messages,
        createdAt,
        lastActivityAt: activity,
        piSessionId: sid,
      });
    }
  }

  return convs;
}

// Parse a single .jsonl session file into structured data.
// Returns null if the file is unreadable / malformed.
export function parseSessionFile(fpath: string): {
  sid: string;
  workspace: string;
  startedAt: number | null;
  lastActivityAt: number | null;
  messages: any[];
} | null {
  let content: string;
  try {
    content = readFileSync(fpath, "utf-8");
  } catch {
    return null;
  }
  const lines = content.trim().split("\n");
  let sid: string | null = null;
  let sessionWorkspace = "";
  let sessionStartedAt: number | null = null;
  let lastActivityAt: number | null = null;
  const messages: any[] = [];
  // toolCallId -> { msgIdx, blockIdx } in messages[], so a later toolResult event
  // can patch the corresponding tool_use block's status and append a tool_result block.
  const toolCallIndex = new Map<string, { msgIdx: number; blockIdx: number }>();

  for (const line of lines) {
    try {
      const evt = JSON.parse(line);
      if (evt.type === "session") {
        sid = evt.id;
        sessionWorkspace = evt.cwd || "";
        if (evt.timestamp) sessionStartedAt = Date.parse(evt.timestamp);
      } else if (evt.type === "message") {
        const msg = evt.message || {};
        const role = msg.role || "";

        // Standalone toolResult event: patch the corresponding tool_use block
        // and append a tool_result block to the same assistant message.
        if (role === "toolResult") {
          const toolCallId: string | undefined = msg.toolCallId;
          const resultText = extractContentText(msg.content);
          const isError = msg.isError === true;
          const target = toolCallId ? toolCallIndex.get(toolCallId) : undefined;
          if (target) {
            const m = messages[target.msgIdx];
            if (m && Array.isArray(m.blocks)) {
              const b = m.blocks[target.blockIdx];
              if (b && b.type === "tool_use") {
                b.status = isError ? "error" : "completed";
              }
              m.blocks.push({ type: "tool_result", id: toolCallId, toolOutput: resultText });
            }
          }
          // Orphan toolResult (no matching tool_use): drop silently.
          continue;
        }

        if (["user", "assistant", "error"].includes(role)) {
          const parts = msg.content;
          const blocks: any[] = [];
          let textConcat = "";

          if (Array.isArray(parts)) {
            for (const part of parts) {
              if (typeof part === "string") {
                blocks.push({ type: "text", content: part });
                textConcat += part;
              } else if (part && typeof part === "object") {
                if (part.type === "thinking" && typeof part.thinking === "string") {
                  blocks.push({ type: "thinking", content: part.thinking });
                } else if (part.type === "text" && typeof part.text === "string") {
                  blocks.push({ type: "text", content: part.text });
                  textConcat += part.text;
                } else if (part.type === "toolCall") {
                  const blockIdx = blocks.length;
                  blocks.push({
                    type: "tool_use",
                    id: part.id,
                    toolName: part.name,
                    toolInput: part.arguments ?? {},
                    status: "running", // patched to "completed"/"error" by toolResult event
                  });
                  if (part.id) {
                    toolCallIndex.set(part.id, { msgIdx: messages.length, blockIdx });
                  }
                } else {
                  // Unknown part type: try to extract any text
                  const t = part.text || part.content || "";
                  if (t) {
                    blocks.push({ type: "text", content: t });
                    textConcat += t;
                  }
                }
              }
            }
          } else if (typeof parts === "string") {
            blocks.push({ type: "text", content: parts });
            textConcat = parts;
          }

          const usage = msg.usage || {};
          // Estimate durationSeconds as evt.timestamp - previous user message timestamp
          let durationSeconds: number | undefined;
          if (role === "assistant") {
            const prevUser = [...messages].reverse().find((m: any) => m.role === "user" && m.createdAt);
            if (prevUser && evt.timestamp) {
              durationSeconds = Math.max(0, (Date.parse(evt.timestamp) - prevUser.createdAt) / 1000);
            }
          }
          const createdAt = evt.timestamp ? Date.parse(evt.timestamp) : Date.now();
          messages.push({
            role,
            content: textConcat,
            id: evt.id || `msg-${messages.length}`,
            createdAt,
            blocks: blocks.length > 0 ? blocks : undefined,
            inputTokens: usage.input || 0,
            outputTokens: usage.output || 0,
            cacheTokens: usage.cacheRead || 0,
            durationSeconds,
          });
          lastActivityAt = createdAt;
        }
      }
    } catch { /* skip malformed lines */ }
  }

  if (!sid) return null;
  return { sid, workspace: sessionWorkspace, startedAt: sessionStartedAt, lastActivityAt, messages };
}

// ── Route ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const workspace = (body.workspace as string) || "";
    // Lightweight index by default (no messages). Pass `summary: false` to get full messages.
    const summary = body.summary !== false;

    // If a workspace is given, only scan that workspace's session directory.
    // Otherwise (No Project mode) scan all directories.
    const allConvs: any[] = [];

    if (workspace) {
      const dir = sessionsDirFor(workspace);
      allConvs.push(...extractConvs(dir, { summary }));
    } else {
      const base = join(homedir(), ".pi/agent/sessions");
      if (existsSync(base)) {
        const dirs = readdirSync(base);
        for (const dir of dirs) {
          const dirPath = join(base, dir);
          if (!statSync(dirPath).isDirectory()) continue;
          allConvs.push(...extractConvs(dirPath, { summary }));
        }
      }
    }

    return NextResponse.json({ count: allConvs.length, conversations: allConvs });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Sync failed" }, { status: 500 });
  }
}
