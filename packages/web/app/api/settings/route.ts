import { NextResponse } from "next/server";
import { initAgents, getAvailableAgents } from "@/lib/agents";

// GET /api/settings — return current config
export async function GET() {
  try {
    initAgents();
    const agents = getAvailableAgents();

    return NextResponse.json({
      workspace: process.env.PI_PLUS_PLUS_WORKSPACE ?? require("os").homedir(),
      agents,
      features: {
        fileBrowser: true,
        editor: true,
        chat: true,
        skills: true,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Settings unavailable" },
      { status: 500 },
    );
  }
}
