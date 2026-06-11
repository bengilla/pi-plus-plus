import { NextRequest, NextResponse } from "next/server";
import { readFile, access } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { homedir } from "node:os";
import { constants } from "node:fs";

const GLOBAL_DIR = join(homedir(), ".pi", "agent");

// Scan for AGENTS.md / CLAUDE.md from workspace up to root,
// and in ~/.pi/agent/
async function scanContextFiles(workspace: string): Promise<{
  files: { path: string; name: string; scope: "global" | "project" | "parent" | "cwd"; content?: string }[];
}> {
  const results: { path: string; name: string; scope: "global" | "project" | "parent" | "cwd"; content?: string }[] = [];

  // 1. Global context files (~/.pi/agent/)
  for (const name of ["AGENTS.md", "CLAUDE.md"]) {
    const p = join(GLOBAL_DIR, name);
    try { await access(p, constants.R_OK); results.push({ path: p, name, scope: "global" }); } catch { /* not found */ }
  }

  // 2. Workspace cwd
  for (const name of ["AGENTS.md", "CLAUDE.md"]) {
    const p = join(workspace, name);
    try { await access(p, constants.R_OK); results.push({ path: p, name, scope: "cwd" }); } catch { /* not found */ }
  }

  // 3. Project-level (.pi/AGENTS.md / .pi/CLAUDE.md)
  for (const name of ["AGENTS.md", "CLAUDE.md"]) {
    const p = join(workspace, ".pi", name);
    try { await access(p, constants.R_OK); results.push({ path: p, name, scope: "project" }); } catch { /* not found */ }
  }

  // 4. Parent directories (walk up to root)
  let current = dirname(resolve(workspace));
  const root = dirname(current); // stop before root
  while (current && current !== root) {
    for (const name of ["AGENTS.md", "CLAUDE.md"]) {
      const p = join(current, name);
      try {
        await access(p, constants.R_OK);
        // Check not already found in cwd
        if (!results.some((r) => r.path === p)) {
          results.push({ path: p, name, scope: "parent" });
        }
      } catch { /* not found */ }
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return { files: results };
}

// GET /api/pi/context-files?workspace=X&read=1
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspace = searchParams.get("workspace") || process.cwd();
    const shouldRead = searchParams.has("read");

    const { files } = await scanContextFiles(workspace);

    // Optionally read content if ?read=1
    if (shouldRead) {
      for (const file of files) {
        try {
          file.content = await readFile(file.path, "utf-8");
        } catch {
          file.content = "(unreadable)";
        }
      }
    }

    return NextResponse.json({ files, workspace });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to scan context files" },
      { status: 500 },
    );
  }
}
