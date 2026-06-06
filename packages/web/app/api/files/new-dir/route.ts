import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export async function POST(req: NextRequest) {
  try {
    const { workspace, name } = await req.json();
    if (!workspace || !name) {
      return NextResponse.json({ error: "workspace and name required" }, { status: 400 });
    }

    const resolved = path.resolve(workspace, name);
    if (!resolved.startsWith(path.resolve(workspace))) {
      return NextResponse.json({ error: "Path outside workspace" }, { status: 403 });
    }

    if (fs.existsSync(resolved)) {
      return NextResponse.json({ error: `"${name}" already exists` }, { status: 409 });
    }

    fs.mkdirSync(resolved, { recursive: true });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const err = e as NodeJS.ErrnoException;
    return NextResponse.json({ error: err.message ?? "Create folder error" }, { status: 500 });
  }
}
