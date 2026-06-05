import { NextResponse } from "next/server";

// GET /api/settings — return current config
export async function GET() {
  return NextResponse.json({
    workspace: process.env.AGENTS_WEB_WORKSPACE ?? "(current dir)",
    agents: ["pi", "claude-code", "codex"],
    features: {
      fileBrowser: true,
      editor: true,
      chat: true,
      skills: false, // Phase 4
    },
  });
}
