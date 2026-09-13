import { EventEmitter } from "node:events";
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { cookieArgs, ytDlpPath } from "@/lib/ytdlp";

export type JobStatus = "running" | "done" | "error" | "cancelled";

export interface DownloadJob {
  id: string;
  mode: "video" | "audio";
  status: JobStatus;
  logs: string[];
  error: string | null;
  dir: string;
  filePath: string | null;
  child: ChildProcess | null;
  emitter: EventEmitter;
  cleanupTimer: ReturnType<typeof setTimeout> | null;
}

const jobs = new Map<string, DownloadJob>();

// If the client never comes back for a finished job's file, don't leak it forever.
const JOB_TTL_MS = 15 * 60 * 1000;

function scheduleCleanup(job: DownloadJob) {
  if (job.cleanupTimer) clearTimeout(job.cleanupTimer);
  job.cleanupTimer = setTimeout(() => {
    jobs.delete(job.id);
    rm(job.dir, { recursive: true, force: true }).catch(() => {});
  }, JOB_TTL_MS);
}

function pushLog(job: DownloadJob, line: string) {
  job.logs.push(line);
  if (job.logs.length > 500) job.logs.shift();
  job.emitter.emit("log", line);
}

function attachLineBuffering(stream: NodeJS.ReadableStream, job: DownloadJob) {
  let buffer = "";
  stream.on("data", (chunk: Buffer) => {
    buffer += chunk.toString();
    const parts = buffer.split(/\r\n|\r|\n/);
    buffer = parts.pop() ?? "";
    for (const line of parts) {
      if (line.trim()) pushLog(job, line);
    }
  });
  stream.on("end", () => {
    if (buffer.trim()) pushLog(job, buffer);
  });
}

export async function startJob(opts: {
  url: string;
  mode: "video" | "audio";
  height?: string;
}): Promise<DownloadJob> {
  const bin = await ytDlpPath();
  const dir = await mkdtemp(path.join(tmpdir(), "yoinkr-"));
  const outTemplate = path.join(dir, "%(title).150B [%(id)s].%(ext)s");

  // A stalled TCP connection to YouTube can otherwise hang yt-dlp forever
  // with no feedback, so bound every socket op.
  const reliabilityArgs = ["--socket-timeout", "30", "--retries", "10", "--fragment-retries", "10"];

  const args =
    opts.mode === "audio"
      ? [
          "-f", "bestaudio/best",
          "-x",
          "--audio-format", "mp3",
          "--audio-quality", "0",
          "--no-playlist",
          "--newline",
          ...reliabilityArgs,
          ...cookieArgs(),
          "-o", outTemplate,
          opts.url,
        ]
      : [
          "-f",
          `bv*[height=${opts.height}][ext=mp4]+ba[ext=m4a]/bv*[height=${opts.height}]+ba/b[height=${opts.height}]` +
            `/bv*[height<=${opts.height}][ext=mp4]+ba[ext=m4a]/bv*[height<=${opts.height}]+ba/b[height<=${opts.height}]`,
          "--merge-output-format", "mp4",
          "--no-playlist",
          "--newline",
          ...reliabilityArgs,
          ...cookieArgs(),
          "-o", outTemplate,
          opts.url,
        ];

  const id = randomUUID();
  const job: DownloadJob = {
    id,
    mode: opts.mode,
    status: "running",
    logs: [],
    error: null,
    dir,
    filePath: null,
    child: null,
    emitter: new EventEmitter(),
    cleanupTimer: null,
  };
  job.emitter.setMaxListeners(0);
  jobs.set(id, job);

  const child = spawn(bin, args);
  job.child = child;
  attachLineBuffering(child.stdout, job);
  attachLineBuffering(child.stderr, job);

  child.on("close", async (code) => {
    if (job.status === "cancelled") {
      job.emitter.emit("status");
      scheduleCleanup(job);
      return;
    }
    if (code === 0) {
      try {
        const files = await readdir(dir);
        if (files.length === 0) throw new Error("Download produced no file.");
        job.filePath = path.join(dir, files[0]);
        job.status = "done";
      } catch (err) {
        job.status = "error";
        job.error = err instanceof Error ? err.message : "Download produced no file.";
      }
    } else {
      job.status = "error";
      job.error = [...job.logs].reverse().find((line) => line.trim()) ?? `yt-dlp exited with code ${code}`;
    }
    job.emitter.emit("status");
    scheduleCleanup(job);
  });

  child.on("error", (err) => {
    job.status = "error";
    job.error = err.message;
    job.emitter.emit("status");
    scheduleCleanup(job);
  });

  return job;
}

export function getJob(id: string): DownloadJob | undefined {
  return jobs.get(id);
}

export function cancelJob(id: string): boolean {
  const job = jobs.get(id);
  if (!job || job.status !== "running") return false;
  job.status = "cancelled";
  job.child?.kill();
  return true;
}
