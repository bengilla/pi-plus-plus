import { NextRequest } from "next/server";
import { interrupt } from "@/lib/agents";

export async function POST(req: NextRequest) {
  const { agent } = await req.json();

  if (!agent) {
    return Response.json({ error: "agent required" }, { status: 400 });
  }

  interrupt(agent);
  return Response.json({ ok: true });
}
