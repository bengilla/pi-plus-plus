import { NextRequest } from "next/server";
import { statSync, createReadStream } from "node:fs";
import { extname } from "node:path";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const filePath = searchParams.get("path");

  if (!filePath || !filePath.startsWith("/")) {
    return Response.json({ error: "Invalid path" }, { status: 400 });
  }

  // Only allow image extensions
  const ext = extname(filePath).toLowerCase();
  const mimeType = MIME[ext];
  if (!mimeType) {
    return Response.json({ error: "Not an image file" }, { status: 400 });
  }

  try {
    const stats = statSync(filePath);
    if (!stats.isFile()) {
      return Response.json({ error: "File not found" }, { status: 404 });
    }

    const stream = createReadStream(filePath);
    return new Response(stream as unknown as ReadableStream, {
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(stats.size),
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return Response.json({ error: "File not found" }, { status: 404 });
  }
}
