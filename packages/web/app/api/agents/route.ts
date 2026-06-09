import { NextResponse } from "next/server";
import { detectInstalledAgents, discoverAgents } from "@/lib/agents";

// GET /api/agents — return agents installed on this device
export async function GET() {
  const agents = discoverAgents({ refresh: true });
  const detectedAgents = detectInstalledAgents({ refresh: true });

  return NextResponse.json({
    agents: agents.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      version: a.version,
      path: a.path,
      capabilities: a.capabilities,
    })),
    detectedAgents,
  });
}
