import { NextResponse } from "next/server";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { getCurrentUser } from "@/lib/auth";
import { one } from "@/lib/db";
import { mediaFilePath } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** Streams uploaded media from local storage. Swap for S3/CDN in production. */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const media = await one<{ storage_key: string; mime_type: string; size_bytes: number }>(
    `SELECT storage_key, mime_type, size_bytes FROM uploaded_media WHERE id = $1`,
    [id],
  );
  if (!media) return new NextResponse("Not found", { status: 404 });

  let filePath: string;
  try {
    filePath = mediaFilePath(media.storage_key);
  } catch {
    return new NextResponse("Invalid media", { status: 400 });
  }
  let info;
  try {
    info = await stat(filePath);
  } catch {
    return new NextResponse("Media file not available on this instance", { status: 404 });
  }

  const ext = media.storage_key.split(".").pop() ?? "mp4";
  const contentType = MIME[ext] ?? media.mime_type;
  const range = request.headers.get("range");
  const total = info.size;

  if (range) {
    const match = /bytes=(\d*)-(\d*)/.exec(range);
    const start = match?.[1] ? Number(match[1]) : 0;
    const end = match?.[2] ? Math.min(Number(match[2]), total - 1) : Math.min(start + 2_000_000, total - 1);
    if (start >= total) {
      return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${total}` } });
    }
    const stream = Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream;
    return new NextResponse(stream, {
      status: 206,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(end - start + 1),
        "Content-Range": `bytes ${start}-${end}/${total}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
  return new NextResponse(stream, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(total),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
