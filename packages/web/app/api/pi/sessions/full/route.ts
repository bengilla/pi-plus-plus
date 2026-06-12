import { NextRequest, NextResponse } from "next/server";
import { readdirSync, statSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { parseSessionFile } from "../sync/route";

// Find a .jsonl file for the given piSessionId, search under base or under a specific workspace dir.
// Returns the file path or null.
function findSessionFile(workspace: string, piSessionId: string): string | null {
  const base = join(homedir(), ".pi/agent/sessions");
  if (!existsSync(base)) return null;

  // Build a list of directories to search:
  // - if workspace is given, only that one
  // - otherwise, all directories
  const dirs: string[] = [];
  if (workspace) {
    const encoded = "--" + workspace.replace(/^\/+|\/+$/g, "").replace(/\//g, "-") + "--";
    dirs.push(join(base, encoded));
  } else {
    for (const d of readdirSync(base)) {
      const dp = join(base, d);
      if (statSync(dp).isDirectory()) dirs.push(dp);
    }
  }

  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    const files = readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
    for (const f of files) {
      // Filename pattern: <date>_<piSessionId>.jsonl
      if (f.includes(piSessionId)) {
        return join(dir, f);
      }
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const piSessionId = url.searchParams.get("id") || "";
    const workspace = url.searchParams.get("workspace") || "";

    if (!piSessionId) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const fpath = findSessionFile(workspace, piSessionId);
    if (!fpath) {
      return NextResponse.json({ error: "Session file not found" }, { status: 404 });
    }

    const parsed = parseSessionFile(fpath);
    if (!parsed) {
      return NextResponse.json({ error: "Failed to parse session" }, { status: 500 });
    }

    // Same workspace mapping as sync: home cwd → "" (No Project).
    const home = homedir();
    const mappedWorkspace = parsed.workspace === home ? "" : parsed.workspace;

    return NextResponse.json({
      piSessionId: parsed.sid,
      workspace: mappedWorkspace,
      createdAt: parsed.startedAt ?? parsed.lastActivityAt ?? Date.now(),
      lastActivityAt: parsed.lastActivityAt,
      messages: parsed.messages,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Load failed" }, { status: 500 });
  }
}
