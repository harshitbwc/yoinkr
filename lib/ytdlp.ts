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
// dodge that check better than the default web client when there's no real
// account behind the session (same trick as clippooor's modal/app.py). But
// they conflict with an actual signed-in cookie file — confirmed: forcing
// android/tv on top of a real account session throws "The page needs to be
// reloaded", while the default web client with the same cookies works fine.
// So only reach for android/tv as the anonymous-cookie fallback, never
// alongside a real cookies file.
export function extractorArgs(): string[] {
  if (process.env.YTDLP_COOKIES_FILE) return [];
  if (existsSync("/.dockerenv")) {
    return ["--extractor-args", "youtube:player_client=android,tv"];
  }
  return [];
}

// Toggle with the YTDLP_VERBOSE=1 platform env var (no redeploy needed) to
// see yt-dlp's detailed PO-token debug lines in the job's live log panel —
// normal output doesn't show whether the PO provider was actually reached
// or a token was actually generated/used, only the final pass/fail.
export function verboseArgs(): string[] {
  return process.env.YTDLP_VERBOSE === "1" ? ["-v"] : [];
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
