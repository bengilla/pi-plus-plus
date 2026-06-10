import { NextRequest } from "next/server";
import { initAgents, chat, interrupt } from "@/lib/agents";

function isAbortLikeError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === "AbortError" || error.name === "ResponseAborted";
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { agent, prompt, workspace: reqWorkspace, thinkingLevel, model, sessionId } = body as Record<string, string | undefined>;

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
    let disconnected = false;
    const abort = () => {
      disconnected = true;
      interrupt(agent);
    };
    req.signal.addEventListener("abort", abort, { once: true });

    const writeEvent = async (event: unknown) => {
      if (disconnected || req.signal.aborted) return false;
      try {
        await writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        return true;
      } catch (error) {
        if (isAbortLikeError(error) || req.signal.aborted) {
          abort();
          return false;
        }
        throw error;
      }
    };

    try {
      for await (const event of chat(agent, workspace, prompt, thinkingLevel, model, sessionId)) {
        const wrote = await writeEvent(event);
        if (!wrote) break;
        if (event.type === "done" || event.type === "error") {
          // Yield a tick so the stream flushes the done event before close
          await new Promise((r) => setTimeout(r, 0));
          break;
        }
      }
    } catch (e) {
      if (!disconnected && !isAbortLikeError(e)) {
        await writeEvent({ type: "error", error: e instanceof Error ? e.message : "Unknown" });
      }
    } finally {
      req.signal.removeEventListener("abort", abort);
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
