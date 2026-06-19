import { NextRequest } from "next/server";
import { existsSync, accessSync, constants } from "node:fs";
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

  // Resolve session ID to full path if provided
  let resolvedSessionId = sessionId;
  if (sessionId) {
    const homedir = require("os").homedir();
    const fs = require("fs");
    const path = require("path");
    const sessionsBase = path.join(homedir, ".pi/agent/sessions");
    try {
      const dirs = fs.readdirSync(sessionsBase);
      for (const dir of dirs) {
        const dirPath = path.join(sessionsBase, dir);
        if (!fs.statSync(dirPath).isDirectory()) continue;
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
          if (file.includes(sessionId)) {
            resolvedSessionId = path.join(dirPath, file);
            break;
          }
        }
        if (resolvedSessionId !== sessionId) break;
      }
    } catch { /* session not found, use as-is */ }
  }

  // No Project mode: use home directory so Pi sessions land in the same place sync looks.
  const workspace = (reqWorkspace && reqWorkspace !== "__none__")
    ? reqWorkspace
    : (process.env.PI_PLUS_PLUS_WORKSPACE || require("os").homedir());

  // Verify workspace exists before spawning pi
  if (!existsSync(workspace)) {
    return Response.json({ error: `Workspace not found: ${workspace}` }, { status: 400 });
  }
  // Detect iCloud Drive paths — these cause uv_cwd failures in spawned child processes
  const mobileDocs = `${require("os").homedir()}/Library/Mobile Documents`;
  if (workspace.startsWith(mobileDocs)) {
    try {
      accessSync(workspace, constants.R_OK);
    } catch {
      return Response.json(
        { error: "iCloud Drive permission issue", permissionError: true, workspace },
        { status: 403 },
      );
    }
  }

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
      for await (const event of chat(agent, workspace, prompt, thinkingLevel, model, resolvedSessionId)) {
        const wrote = await writeEvent(event);
        if (!wrote) break;
        if (event.type === "error") {
          // Error ends the session — close the stream
          await new Promise((r) => setTimeout(r, 0));
          break;
        }
        // Don't break on 'done' — tool execution events come after the
        // model's message completes. The stream ends when the iterator ends.
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
