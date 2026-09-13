import { spawn } from "node:child_process";

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
  return ["--cookies-from-browser", "safari"];
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
