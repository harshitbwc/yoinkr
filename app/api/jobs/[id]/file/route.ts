import { NextRequest, NextResponse } from "next/server";
import { createReadStream } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { getJob } from "@/lib/jobs";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = getJob(id);

  if (!job) {
    return NextResponse.json({ error: "Job not found. It may have already been downloaded or expired." }, { status: 404 });
  }
  if (job.status !== "done" || !job.filePath) {
    return NextResponse.json({ error: "This download isn't finished yet." }, { status: 409 });
  }

  const filePath = job.filePath;
  const mode = job.mode;

  // Don't consume/delete the job here: a duplicate request for the same
  // finished job (e.g. an SSE reconnect re-delivering the "done" event)
  // must succeed the same way every time, not 404. The job map entry and
  // its temp dir are reaped later by the job's own TTL cleanup instead.
  const fileStream = createReadStream(filePath);
  req.signal.addEventListener("abort", () => {
    fileStream.destroy();
  });

  const webStream = Readable.toWeb(fileStream) as ReadableStream;
  const filename = path.basename(filePath);
  // Header values must be Latin-1/ByteString — a title with e.g. a fullwidth
  // "｜" throws when set directly, crashing the response before it's sent.
  // Keep the real name only in the UTF-8-encoded `filename*` param.
  const asciiFallback = filename.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");

  return new NextResponse(webStream, {
    headers: {
      "Content-Type": mode === "audio" ? "audio/mpeg" : "video/mp4",
      "Content-Disposition": `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
