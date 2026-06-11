import { NextRequest, NextResponse } from "next/server";
import { execSync } from "node:child_process";
import { access, readFile, mkdtemp, unlink, rmdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir, homedir } from "node:os";
import { constants } from "node:fs";

const PI_SESSION_DIR = join(homedir(), ".pi", "agent", "sessions");

// Search for a session file by ID across all session subdirectories
async function findSessionFile(sessionId: string): Promise<string | null> {
  const dirs: string[] = [];
  try { 
    const entries = await readdir(PI_SESSION_DIR, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory()) dirs.push(join(PI_SESSION_DIR, e.name));
    }
  } catch { return null; }

  for (const dir of dirs) {
    const files = await readdir(dir);
    const match = files.find((f) => f.includes(sessionId));
    if (match) return join(dir, match);
  }
  return null;
}

// GET /api/pi/session/export?id=X
// Calls `pi --export <sessionFile>` and returns the HTML.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("id");

    if (!sessionId) {
      return NextResponse.json({ error: "Missing session id" }, { status: 400 });
    }

    // Find the session file by scanning ~/.pi/agent/sessions/
    const sessionFile = await findSessionFile(sessionId);
    if (!sessionFile) {
      return NextResponse.json({ error: `Session file not found: ${sessionId}` }, { status: 404 });
    }

    // Create a temp file for the output
    const tmpDir = await mkdtemp(join(tmpdir(), "pi-export-"));
    const outPath = join(tmpDir, "session.html");

    try {
      execSync(
        `pi --export "${sessionFile}" "${outPath}"`,
        {
          timeout: 30_000,
          env: { ...process.env, PATH: `${process.env.HOME}/.local/bin:/opt/homebrew/bin:${process.env.PATH || ""}` },
        },
      );

      // Read the exported HTML
      await access(outPath, constants.R_OK);
      const html = await readFile(outPath, "utf-8");

      // Cleanup
      try { await unlink(outPath); } catch { /* ignore */ }
      try { await rmdir(tmpDir); } catch { /* ignore */ }

      // Return as HTML
      return new NextResponse(html, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `attachment; filename="session-${sessionId.slice(0, 8)}.html"`,
        },
      });
    } catch (execError) {
      // Cleanup
      try { await unlink(outPath); } catch { /* ignore */ }
      try { await rmdir(tmpDir); } catch { /* ignore */ }

      const message = execError instanceof Error ? execError.message : "Export failed";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Export failed" },
      { status: 500 },
    );
  }
}
