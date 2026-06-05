import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

function getWorkspace(req: NextRequest): string {
  const url = new URL(req.url);
  return url.searchParams.get("workspace") || process.env.AGENTS_WEB_WORKSPACE || process.cwd();
}

interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
}

// Only scan one level — children are loaded on demand
function scanDirShallow(dirPath: string, base: string): FileNode[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const nodes: FileNode[] = [];

  const sorted = entries.sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  for (const entry of sorted) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;

    const fullPath = path.join(dirPath, entry.name);
    const relPath = path.relative(base, fullPath);

    if (entry.isDirectory()) {
      // Has children = will show expand arrow; actual children loaded on click
      const hasChildren = fs.readdirSync(fullPath).some(
        (n) => !n.startsWith(".") && n !== "node_modules"
      );
      nodes.push({
        name: entry.name, path: relPath, type: "directory",
        children: hasChildren ? [] : undefined, // [] = expandable, undefined = empty
      });
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      const skipExts = [".png", ".jpg", ".jpeg", ".gif", ".ico", ".woff", ".woff2", ".ttf", ".eot", ".mp4", ".webm", ".mov", ".mp3"];
      if (skipExts.includes(ext)) continue;
      nodes.push({ name: entry.name, path: relPath, type: "file" });
    }
  }

  return nodes;
}

// GET /api/files?path=...&workspace=...
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const filePath = url.searchParams.get("path") ?? ".";
    const ws = getWorkspace(req);

    const resolved = path.resolve(ws, filePath);
    if (!resolved.startsWith(path.resolve(ws))) {
      return NextResponse.json({ error: "Path outside workspace" }, { status: 403 });
    }

    const stat = fs.statSync(resolved);

    if (stat.isDirectory()) {
      const files = scanDirShallow(resolved, ws);
      return NextResponse.json({ files, path: filePath });
    }

    // Read file content
    const content = fs.readFileSync(resolved, "utf-8");
    return NextResponse.json({ content, path: filePath });
  } catch (e: unknown) {
    const err = e as NodeJS.ErrnoException;
    return NextResponse.json({ error: err.message ?? "Read error" }, { status: 404 });
  }
}

// PUT /api/files — save file
export async function PUT(req: NextRequest) {
  try {
    const { path: filePath, content } = await req.json();
    if (!filePath || content === undefined) {
      return NextResponse.json({ error: "path and content required" }, { status: 400 });
    }
    const ws = getWorkspace(req);
    const resolved = path.resolve(ws, filePath);
    if (!resolved.startsWith(path.resolve(ws))) {
      return NextResponse.json({ error: "Path outside workspace" }, { status: 403 });
    }
    const dir = path.dirname(resolved);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(resolved, content, "utf-8");
    return NextResponse.json({ ok: true, path: filePath });
  } catch (e: unknown) {
    const err = e as NodeJS.ErrnoException;
    return NextResponse.json({ error: err.message ?? "Write error" }, { status: 500 });
  }
}
