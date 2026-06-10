import { NextResponse, NextRequest } from "next/server";
import { readdirSync, readFileSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { execFileSync } from "node:child_process";

function encodeWorkspace(w: string): string {
  // Pi encodes workspace paths by replacing / with -, wrapped in --
  // e.g., /Users/foo/bar → --Users-foo-bar--
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
}

// GET /api/pi/sessions?workspace=/path — list Pi sessions
export async function GET(req: Request) {
  const url = new URL(req.url);
  const workspace = url.searchParams.get("workspace") || "";

  const sessionsDir = join(homedir(), ".pi", "agent", "sessions");
  const encoded = encodeWorkspace(workspace);
  const dir = join(sessionsDir, encoded);

  const sessions: SessionInfo[] = [];

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

        // Find first user message for preview
        let firstUserMessage = "";
        for (let i = 1; i < Math.min(lines.length, 30); i++) {
          try {
            const evt = JSON.parse(lines[i]);
            // Pi stores user messages as "message" events
            if ((evt.type === "message" || evt.type === "message_start") && evt.message?.role === "user") {
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
              break;
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
          firstMessage: firstUserMessage || undefined,
          size: stat.size,
        });
      } catch {
        // Skip unreadable files
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
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
          if (sessionId === id) {
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
// Body: { action: "branch", sessionId, workspace, entryId, filename }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
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
