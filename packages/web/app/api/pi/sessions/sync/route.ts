import { NextRequest, NextResponse } from "next/server";
import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

// ── Helpers ──────────────────────────────────────────────────

function sessionsDirFor(workspace: string): string {
  if (!workspace) return join(homedir(), ".pi/agent/sessions/--Users-bengilla--");
  const dirname = "--" + workspace.replace(/^\/+|\/+$/g, "").replace(/\//g, "-") + "--";
  return join(homedir(), ".pi/agent/sessions", dirname);
}

function extractConvs(sessionsDir: string): any[] {
  if (!existsSync(sessionsDir)) return [];
  const convs: any[] = [];
  const seen = new Set<string>();

  const files = readdirSync(sessionsDir)
    .filter((f) => f.endsWith(".jsonl"))
    .sort();

  for (const fname of files) {
    const fpath = join(sessionsDir, fname);
    if (!statSync(fpath).isFile()) continue;

    const content = readFileSync(fpath, "utf-8");
    const lines = content.trim().split("\n");
    let sid: string | null = null;
    let sessionWorkspace = "";
    const messages: any[] = [];

    for (const line of lines) {
      try {
        const evt = JSON.parse(line);
        if (evt.type === "session") {
          sid = evt.id;
          sessionWorkspace = evt.cwd || "";
        } else if (evt.type === "message") {
          const msg = evt.message || {};
          const role = msg.role || "";
          const parts = msg.content || [];
          let text = "";
          for (const part of Array.isArray(parts) ? parts : []) {
            if (typeof part === "object") text += part.text || part.content || "";
            else if (typeof part === "string") text += part;
          }
          const usage = msg.usage || {};
          if (["user", "assistant", "error"].includes(role)) {
            messages.push({
              role,
              content: text,
              id: evt.id || `msg-${messages.length}`,
              inputTokens: usage.input || 0,
              outputTokens: usage.output || 0,
              cacheTokens: usage.cacheRead || 0,
            });
          }
        }
      } catch { /* skip malformed lines */ }
    }

    if (messages.length > 0 && sid && !seen.has(sid)) {
      seen.add(sid);
      const firstUser = messages.find((m) => m.role === "user");
      let title = firstUser ? [...firstUser.content].slice(0, 36).join("") : "Session";
      if (firstUser && [...firstUser.content].length > 36) title += "…";
      const stat = statSync(fpath);
      convs.push({
        id: sid.slice(0, 20),
        title,
        agentId: "pi",
        workspace: sessionWorkspace,
        messages,
        createdAt: stat.mtimeMs,
        piSessionId: sid,
      });
    }
  }

  return convs;
}

// ── Route ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const workspace = (body.workspace as string) || "";

    // Collect all Pi sessions from all known directories
    const base = join(homedir(), ".pi/agent/sessions");
    const allConvs: any[] = [];

    if (existsSync(base)) {
      const dirs = readdirSync(base);
      for (const dir of dirs) {
        const dirPath = join(base, dir);
        if (!statSync(dirPath).isDirectory()) continue;
        allConvs.push(...extractConvs(dirPath));
      }
    }

    return NextResponse.json({ count: allConvs.length, conversations: allConvs });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Sync failed" }, { status: 500 });
  }
}
