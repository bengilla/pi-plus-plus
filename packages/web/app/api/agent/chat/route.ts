import { NextRequest } from "next/server";
import { initAgents, chat } from "@/lib/agents";

export async function POST(req: NextRequest) {
  const { agent, prompt, workspace: reqWorkspace } = await req.json();

  if (!agent || !prompt) {
    return Response.json({ error: "agent and prompt required" }, { status: 400 });
  }

  // Ensure agents are discovered and initialized
  const available = initAgents();

  if (!available.includes(agent)) {
    return Response.json(
      { error: `Agent "${agent}" not installed. Available: ${available.join(", ") || "none"}` },
      { status: 400 },
    );
  }

  const workspace = reqWorkspace || process.env.AGENTS_WEB_WORKSPACE || process.cwd();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of chat(agent, workspace, prompt)) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          if (event.type === "done" || event.type === "error") break;
        }
        controller.close();
      } catch (e) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", error: e instanceof Error ? e.message : "Unknown" })}\n\n`,
          ),
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
