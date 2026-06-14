import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join, basename } from "node:path";
import { tmpdir } from "node:os";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("id");
    const workspace = searchParams.get("workspace") ?? "";
    const download = searchParams.get("download") === "1";

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID required" }, { status: 400 });
    }

    // Resolve session ID to .jsonl file path (same logic as sessions route)
    const sessionsBase = join(homedir(), ".pi", "agent", "sessions");
    let jsonlPath: string | null = null;

    try {
      const dirs = readdirSync(sessionsBase);
      for (const dir of dirs) {
        const dirPath = join(sessionsBase, dir);
        if (!statSync(dirPath).isDirectory()) continue;
        const files = readdirSync(dirPath);
        for (const file of files) {
          if (file.includes(sessionId) && file.endsWith(".jsonl")) {
            jsonlPath = join(dirPath, file);
            break;
          }
        }
        if (jsonlPath) break;
      }
    } catch { /* sessions dir missing */ }

    if (!jsonlPath || !existsSync(jsonlPath)) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Export to temp file
    const exportPath = join(tmpdir(), `pi-export-${Date.now()}.html`);

    const html = await new Promise<string>((resolve, reject) => {
      execFile(
        "pi",
        ["--export", jsonlPath!, exportPath],
        {
          timeout: 30_000,
          env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH || ""}` },
        },
        (err) => {
          if (err) {
            // Clean up temp file
            try { unlinkSync(exportPath); } catch { /* gone */ }
            reject(err);
            return;
          }
          try {
            const content = readFileSync(exportPath, "utf-8");
            try { unlinkSync(exportPath); } catch { /* gone */ }
            resolve(content);
          } catch (e) {
            reject(e);
          }
        },
      );
    });

    const filename = basename(jsonlPath).replace(/\.jsonl$/, ".html");

    if (download || !searchParams.has("download")) {
      // Return HTML directly for download or default
      return new NextResponse(html, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    return NextResponse.json({ html, filename });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Export failed" },
      { status: 500 },
    );
  }
}
