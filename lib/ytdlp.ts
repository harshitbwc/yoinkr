import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const CANDIDATE_PATHS = [
  "yt-dlp",
  "/opt/homebrew/bin/yt-dlp",
  "/usr/local/bin/yt-dlp",
  "/usr/bin/yt-dlp",
];

let resolvedPath: string | null = null;

// YouTube increasingly requires a signed-in session to serve formats.
// Locally, read straight from Safari. In a container there's no Safari to
// read from, so YTDLP_COOKIES_FILE (a cookies.txt exported once from a real
// browser session, see README) takes over instead.
export function cookieArgs(): string[] {
  const cookiesFile = process.env.YTDLP_COOKIES_FILE;
  if (cookiesFile) return ["--cookies", cookiesFile];

  // /.dockerenv only exists inside a container — there's no Safari to read
  // there, so trying anyway just wastes time and masks a missing secret
  // as a confusing YouTube bot-check failure instead.
  if (existsSync("/.dockerenv")) {
    console.warn(
      "[cookieArgs] Running in a container with no YTDLP_COOKIES_FILE set — proceeding with no cookies at all."
    );
    return [];
  }

  return ["--cookies-from-browser", "safari"];
}

// A datacenter IP (any hosted platform) gets YouTube's stricter bot-check
// far more often than a home IP; the android/tv player clients historically
// dodge that check better than the default web client (same trick as
// clippooor's modal/app.py). Only worth the tradeoff — those clients can
// expose fewer/lower-bitrate formats — when actually running from a
// container, so local dev keeps the full resolution list.
export function extractorArgs(): string[] {
  if (existsSync("/.dockerenv")) {
    return ["--extractor-args", "youtube:player_client=android,tv"];
  }
  return [];
}

function runRaw(bin: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr.trim().split("\n").pop() || `yt-dlp exited with code ${code}`));
    });
  });
}

export async function ytDlpPath(): Promise<string> {
  if (resolvedPath) return resolvedPath;
  for (const candidate of CANDIDATE_PATHS) {
    try {
      await runRaw(candidate, ["--version"]);
      resolvedPath = candidate;
      return candidate;
    } catch {
      // try next candidate
    }
  }
  throw new Error("yt-dlp is not installed. Install it with `brew install yt-dlp`.");
}

export async function ytDlp(args: string[]) {
  const bin = await ytDlpPath();
  return runRaw(bin, args);
}

export function isValidYoutubeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    return (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com" ||
      host === "youtu.be"
    );
  } catch {
    return false;
  }
}
