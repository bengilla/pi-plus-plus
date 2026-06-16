import { NextResponse } from "next/server";

export async function GET() {
  // Read version from web package.json at build time
  const version = process.env.npm_package_version || "0.1.1";
  return NextResponse.json({ version });
}
