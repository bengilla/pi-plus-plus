import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export async function GET() {
  // Read version from web package.json at runtime (npm_package_version not set in production)
  let version = "0.1.0";
  try {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf-8"));
    version = pkg.version || version;
  } catch { /* use fallback */ }
  return NextResponse.json({ version });
}
