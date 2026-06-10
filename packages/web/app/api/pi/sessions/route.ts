import { NextResponse } from "next/server";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

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
