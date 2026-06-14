import { NextResponse, NextRequest } from "next/server";
import { readdirSync, readFileSync, statSync, unlinkSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { execFileSync } from "node:child_process";

function encodeWorkspace(w: string): string {
  // Pi stores "No Project" sessions under the homedir-encoded directory.
  // Empty workspace string maps to homedir, same as sync route's sessionsDirFor.
  if (!w) return "--" + homedir().replace(/^\/+|\/+$/g, "").replace(/\//g, "-") + "--";
  const cleaned = w.replace(/^\/+/, "").replace(/\/+$/, "");
  return "--" + cleaned.replace(/\//g, "-") + "--";
}

interface SessionInfo {
  id: string;
  filename: string;
  timestamp: string;
  model?: string;
  provider?: string;
  messageCount: number;
  firstMessage?: string;
  size: number;
  name?: string;
  workspace?: string;
}

// GET /api/pi/sessions?workspace=/path — list Pi sessions
export async function GET(req: Request) {
  const url = new URL(req.url);
  const workspace = url.searchParams.get("workspace") || "";

  const sessionsBase = join(homedir(), ".pi", "agent", "sessions");

  // Determine which directories to scan
  let dirsToScan: string[] = [];
  if (workspace) {
    const encoded = encodeWorkspace(workspace);
    dirsToScan.push(join(sessionsBase, encoded));
  } else {
    // No Project mode: scan all session directories (home, tmp, etc.)
    try {
      dirsToScan = readdirSync(sessionsBase)
        .filter((d) => {
          try { return statSync(join(sessionsBase, d)).isDirectory(); }
          catch { return false; }
        })
        .map((d) => join(sessionsBase, d));
    } catch { dirsToScan = []; }
  }

  const sessions: SessionInfo[] = [];

  for (const dir of dirsToScan) {
    try {
    const files = readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
    for (const file of files) {
      try {
        const filePath = join(dir, file);
        const stat = statSync(filePath);
        const content = readFileSync(filePath, "utf-8");
        const lines = content.trim().split("\n");

        // Parse first line for session metadata
        const firstLine = JSON.parse(lines[0]);
        const sessionId = firstLine.id || file.split("_")[1]?.replace(".jsonl", "") || file;

        // Check for session_info name first, then find first user message
        let sessionName: string | undefined;
        let firstUserMessage = "";
        for (let i = 1; i < Math.min(lines.length, 50); i++) {
          try {
            const evt = JSON.parse(lines[i]);
            if (evt.type === "session_info" && evt.name) {
              sessionName = evt.name;
            }
            // Pi stores user messages as "message" events
            if (!firstUserMessage && (evt.type === "message" || evt.type === "message_start") && evt.message?.role === "user") {
              const content = evt.message.content;
              if (Array.isArray(content)) {
                firstUserMessage = content
                  .filter((b: { type?: string; text?: string }) => b.type === "text" && b.text)
                  .map((b: { text: string }) => b.text)
                  .join(" ")
                  .slice(0, 80);
              } else if (typeof content === "string") {
                firstUserMessage = content.slice(0, 80);
              }
            }
          } catch { /* skip malformed lines */ }
        }

        // Try to find model from model_change event
        let model: string | undefined;
        let provider: string | undefined;
        for (let i = 1; i < Math.min(lines.length, 5); i++) {
          try {
            const evt = JSON.parse(lines[i]);
            if (evt.type === "model_change") {
              model = evt.modelId || evt.model;
              provider = evt.provider;
              break;
            }
          } catch { /* skip */ }
        }

        sessions.push({
          id: sessionId,
          filename: file,
          timestamp: firstLine.timestamp || "",
          model,
          provider,
          messageCount: lines.length,
          firstMessage: sessionName || firstUserMessage || undefined,
          size: stat.size,
          name: sessionName,
          workspace: firstLine.cwd || undefined,
        });
      } catch {
        // Skip unreadable files
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }
  }

  // Sort by timestamp descending
  sessions.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return NextResponse.json({ sessions, workspace });
}

// DELETE /api/pi/sessions?id=X&workspace=/path — delete a session
// DELETE /api/pi/sessions?workspace=/path — delete all sessions for workspace
export async function DELETE(req: NextRequest) {
  const url = new URL(req.url);
  const workspace = url.searchParams.get("workspace") || "";
  const id = url.searchParams.get("id");

  const sessionsDir = join(homedir(), ".pi", "agent", "sessions");
  const encoded = encodeWorkspace(workspace);
  const dir = join(sessionsDir, encoded);

  try {
    const files = readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
    let deleted = 0;

    for (const file of files) {
      if (id) {
        // Delete specific session — check if file contains this id
        try {
          const content = readFileSync(join(dir, file), "utf-8");
          const firstLine = JSON.parse(content.split("\n")[0]);
          const sessionId = firstLine.id || file.split("_")[1]?.replace(".jsonl", "") || file;
          if (sessionId.startsWith(id)) {
            unlinkSync(join(dir, file));
            deleted++;
          }
        } catch { /* skip */ }
      } else {
        // Delete all sessions for workspace
        unlinkSync(join(dir, file));
        deleted++;
      }
    }

    return NextResponse.json({ deleted });
  } catch {
    return NextResponse.json({ error: "Failed to delete sessions" }, { status: 500 });
  }
}

// POST /api/pi/sessions — branch a session
function findSessionFile(sessionId: string): string | null {
  const base = join(homedir(), ".pi", "agent", "sessions");
  try {
    const dirs = readdirSync(base);
    for (const dir of dirs) {
      const dirPath = join(base, dir);
      if (!statSync(dirPath).isDirectory()) continue;
      try {
        const files = readdirSync(dirPath).filter((f) => f.endsWith(".jsonl"));
        for (const file of files) {
          const content = readFileSync(join(dirPath, file), "utf-8");
          const firstLine = content.split("\n")[0];
          const parsed = JSON.parse(firstLine);
          if (parsed.id && parsed.id.startsWith(sessionId.slice(0, 20))) {
            return join(dirPath, file);
          }
        }
      } catch { /* skip */ }
    }
  } catch { /* skip */ }
  return null;
}

// Body: { action: "branch", sessionId, workspace, entryId, filename }
// Body: { action: "rename", sessionId, name }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.action === "rename") {
      const { sessionId, name } = body;
      if (!sessionId || !name) {
        return NextResponse.json({ error: "sessionId and name required" }, { status: 400 });
      }
      const filePath = findSessionFile(sessionId);
      if (!filePath) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }
      // Append a session_info event with the name
      const infoEvent = JSON.stringify({
        type: "session_info",
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        parentId: null,
        timestamp: new Date().toISOString(),
        name,
      }) + "\n";
      appendFileSync(filePath, infoEvent);
      return NextResponse.json({ ok: true });
    }

    if (body.action !== "branch") {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    const { sessionId: sessionIdParam, workspace: ws, entryId, filename } = body;
    if (!sessionIdParam || !ws || !entryId || !filename) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // The encoded workspace path for the session file
    function encodeWorkspace(w: string): string {
      const cleaned = w.replace(/^\/+/, "").replace(/\/+$/, "");
      return "--" + cleaned.replace(/\//g, "-") + "--";
    }

    const sessionsDir = join(homedir(), ".pi", "agent", "sessions");
    const encoded = encodeWorkspace(ws);
    const filePath = join(sessionsDir, encoded, filename);

    // Use pi --fork to create a branched session
    const result = execFileSync("pi", ["--fork", filePath], {
      cwd: ws,
      encoding: "utf-8",
      timeout: 15000,
    });

    return NextResponse.json({ ok: true, output: result.trim() });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Branch failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
