import { NextRequest, NextResponse } from "next/server";
import { cookieArgs, extractorArgs, isValidYoutubeUrl, verboseArgs, ytDlp } from "@/lib/ytdlp";

export const runtime = "nodejs";

interface YtDlpFormat {
  vcodec?: string;
  acodec?: string;
  height?: number;
  ext?: string;
  filesize?: number | null;
  filesize_approx?: number | null;
}

interface YtDlpInfo {
  title?: string;
  thumbnail?: string;
  duration?: number;
  uploader?: string;
  formats?: YtDlpFormat[];
}

function cleanErrorMessage(message: string): string {
  // In verbose diagnostic mode, keep the whole thing (the [pot] debug lines
  // are what we're actually after) — otherwise trim to a clean one-liner.
  if (process.env.YTDLP_VERBOSE === "1") return message.trim().slice(0, 8000);
  return message.trim().replace(/^ERROR:\s*/, "").slice(0, 300);
}

function formatSize(format: YtDlpFormat): number | null {
  return format.filesize ?? format.filesize_approx ?? null;
}

// Mirrors the format selector in lib/jobs.ts (prefer mp4+m4a at the exact
// height) so the estimate roughly matches what actually gets downloaded.
function bestSize(formats: YtDlpFormat[], preferredExt: string): number | null {
  const preferred = formats.filter((f) => f.ext === preferredExt);
  const pool = preferred.length > 0 ? preferred : formats;
  let best: number | null = null;
  for (const format of pool) {
    const size = formatSize(format);
    if (size != null && (best == null || size > best)) best = size;
  }
  return best;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url.trim() : "";

  if (!url || !isValidYoutubeUrl(url)) {
    return NextResponse.json({ error: "Enter a valid YouTube URL." }, { status: 400 });
  }

  try {
    const { stdout } = await ytDlp([
      "-j",
      "--no-playlist",
      "--no-warnings",
      ...cookieArgs(),
      ...extractorArgs(),
      ...verboseArgs(),
      url,
    ]);
    const info: YtDlpInfo = JSON.parse(stdout);
    const formats = info.formats ?? [];

    const videoFormats = formats.filter(
      (f) => f.vcodec && f.vcodec !== "none" && typeof f.height === "number"
    );
    const audioFormats = formats.filter(
      (f) => f.acodec && f.acodec !== "none" && (!f.vcodec || f.vcodec === "none")
    );

    const audioSizeBytes = bestSize(audioFormats, "m4a");

    const heights = Array.from(new Set(videoFormats.map((f) => f.height!))).sort((a, b) => b - a);
    const resolutions = heights.map((height) => {
      const videoSize = bestSize(
        videoFormats.filter((f) => f.height === height),
        "mp4"
      );
      const sizeBytes = videoSize != null && audioSizeBytes != null ? videoSize + audioSizeBytes : null;
      return { height, sizeBytes };
    });

    return NextResponse.json({
      title: info.title ?? "Untitled video",
      thumbnail: info.thumbnail ?? null,
      duration: info.duration ?? null,
      uploader: info.uploader ?? null,
      resolutions,
      audioSizeBytes,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch video info.";
    return NextResponse.json({ error: cleanErrorMessage(message) }, { status: 502 });
  }
}
