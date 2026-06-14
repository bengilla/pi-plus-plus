import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname, relative, resolve } from "node:path";

interface ContextFile {
  path: string;
  displayPath: string;
  size: number;
  exists: boolean;
  level: "global" | "project" | "parent";
  content?: string;
}

const FILE_NAMES = ["AGENTS.md", "CLAUDE.md"];

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspace = searchParams.get("workspace") || homedir();
    const preview = searchParams.get("preview");
    const files: ContextFile[] = [];
    const seen = new Set<string>();

    // 1. Global: ~/.pi/agent/
    const globalDir = join(homedir(), ".pi", "agent");
    for (const name of FILE_NAMES) {
      const p = join(globalDir, name);
      const key = resolve(p);
      if (seen.has(key)) continue;
      seen.add(key);
      const exists = existsSync(p);
      files.push({
        path: p,
        displayPath: `~/.pi/agent/${name}`,
        size: exists ? statSync(p).size : 0,
        exists,
        level: "global",
      });
    }

    // 2. Project: workspace itself
    const ws = resolve(workspace);
    for (const name of FILE_NAMES) {
      const p = join(ws, name);
      const key = resolve(p);
      if (seen.has(key)) continue;
      seen.add(key);
      const exists = existsSync(p);
      files.push({
        path: p,
        displayPath: `./${name}`,
        size: exists ? statSync(p).size : 0,
        exists,
        level: "project",
      });
    }

    // 3. Parent directories (up to root, excluding workspace itself)
    let dir = dirname(ws);
    const root = resolve("/");
    let depth = 0;
    while (dir !== root && depth < 20) {
      for (const name of FILE_NAMES) {
        const p = join(dir, name);
        const key = resolve(p);
        if (seen.has(key)) continue;
        seen.add(key);
        const exists = existsSync(p);
        if (exists) {
          files.push({
            path: p,
            displayPath: relative(ws, p) || p,
            size: statSync(p).size,
            exists: true,
            level: "parent",
          });
        }
      }
      dir = dirname(dir);
      depth++;
    }

    // If previewing a specific file, include its content
    if (preview) {
      const target = files.find(
        (f) => f.path === preview || f.path.endsWith(preview) || f.displayPath === preview,
      );
      if (target && target.exists) {
        target.content = readFileSync(target.path, "utf-8");
      }
    }

    const totalLoaded = files.filter((f) => f.exists).length;

    return NextResponse.json({ files, totalLoaded });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}
