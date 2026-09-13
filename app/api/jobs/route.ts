import { NextRequest, NextResponse } from "next/server";
import { isValidYoutubeUrl } from "@/lib/ytdlp";
import { startJob } from "@/lib/jobs";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  const mode = body?.mode;
  const height = body?.height != null ? String(body.height) : undefined;

  if (!isValidYoutubeUrl(url)) {
    return NextResponse.json({ error: "Invalid YouTube URL." }, { status: 400 });
  }
  if (mode !== "video" && mode !== "audio") {
    return NextResponse.json({ error: "Invalid download mode." }, { status: 400 });
  }
  if (mode === "video" && !/^\d+$/.test(height ?? "")) {
    return NextResponse.json({ error: "Missing or invalid resolution." }, { status: 400 });
  }

  try {
    const job = await startJob({ url, mode, height });
    return NextResponse.json({ id: job.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start download.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
