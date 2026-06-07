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

  // Use TransformStream so writer.write() flushes each event immediately.
  // ReadableStream's controller.enqueue() can batch under backpressure.
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  (async () => {
    try {
      for await (const event of chat(agent, workspace, prompt)) {
        await writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        if (event.type === "done" || event.type === "error") {
          // Yield a tick so the stream flushes the done event before close
          await new Promise((r) => setTimeout(r, 0));
          break;
        }
      }
    } catch (e) {
      await writer.write(
        encoder.encode(
          `data: ${JSON.stringify({ type: "error", error: e instanceof Error ? e.message : "Unknown" })}\n\n`,
        ),
      );
    } finally {
      try { await writer.close(); } catch { /* already closed */ }
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
