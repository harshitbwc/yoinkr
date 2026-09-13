"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

interface Resolution {
  height: number;
  sizeBytes: number | null;
}

interface VideoInfo {
  title: string;
  thumbnail: string | null;
  duration: number | null;
  uploader: string | null;
  resolutions: Resolution[];
  audioSizeBytes: number | null;
}

type JobStatus = "running" | "done" | "error" | "cancelled";

interface JobState {
  id: string;
  key: string;
  status: JobStatus;
  logs: string[];
  error: string | null;
}

function formatDuration(seconds: number | null): string | null {
  if (seconds == null) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function formatSize(bytes: number | null): string | null {
  if (bytes == null) return null;
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  const decimals = unitIndex > 0 && value < 10 ? 1 : 0;
  return `${value.toFixed(decimals)} ${units[unitIndex]}`;
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [job, setJob] = useState<JobState | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const logBoxRef = useRef<HTMLDivElement | null>(null);
  const downloadedJobsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  useEffect(() => {
    if (logBoxRef.current) {
      logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
    }
  }, [job?.logs]);

  async function handleFetch(e: FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setInfo(data);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  function triggerFileDownload(jobId: string) {
    // Guard against a re-delivered "done" status (e.g. an SSE reconnect)
    // firing a second save dialog for the same finished job.
    if (downloadedJobsRef.current.has(jobId)) return;
    downloadedJobsRef.current.add(jobId);

    // Same-tab: a successful response forces a save (Content-Disposition:
    // attachment) regardless of how long ago the user's click was, whereas
    // target="_blank" is a popup and gets silently blocked once the browser
    // no longer considers this a fresh user gesture (long downloads only).
    const link = document.createElement("a");
    link.href = `/api/jobs/${jobId}/file`;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function download(mode: "video" | "audio", height?: number) {
    const key = mode === "audio" ? "audio" : `video-${height}`;

    eventSourceRef.current?.close();
    setJob({ id: "", key, status: "running", logs: [], error: null });

    let res: Response;
    try {
      res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), mode, height }),
      });
    } catch {
      setJob({ id: "", key, status: "error", logs: [], error: "Could not reach the server." });
      return;
    }

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.id) {
      setJob({ id: "", key, status: "error", logs: [], error: data?.error ?? "Failed to start download." });
      return;
    }

    const jobId = data.id as string;
    setJob({ id: jobId, key, status: "running", logs: [], error: null });

    const source = new EventSource(`/api/jobs/${jobId}/stream`);
    eventSourceRef.current = source;

    source.addEventListener("log", (e) => {
      const line = JSON.parse((e as MessageEvent).data) as string;
      setJob((prev) => (prev && prev.id === jobId ? { ...prev, logs: [...prev.logs, line] } : prev));
    });

    source.addEventListener("status", (e) => {
      const payload = JSON.parse((e as MessageEvent).data) as { status: JobStatus; error: string | null };
      setJob((prev) => (prev && prev.id === jobId ? { ...prev, status: payload.status, error: payload.error } : prev));
      if (payload.status !== "running") {
        source.close();
        if (payload.status === "done") {
          triggerFileDownload(jobId);
        }
      }
    });

    source.onerror = () => {
      setJob((prev) =>
        prev && prev.id === jobId && prev.status === "running"
          ? { ...prev, status: "error", error: "Lost connection to the server." }
          : prev
      );
      source.close();
    };
  }

  async function cancelDownload() {
    if (!job?.id) return;
    await fetch(`/api/jobs/${job.id}/cancel`, { method: "POST" }).catch(() => {});
  }

  const isDownloading = job?.status === "running";

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-16 sm:py-24">
      <div className="w-full max-w-xl">
        <h1 className="text-3xl font-semibold tracking-tight text-center">ytgrab</h1>
        <p className="mt-2 text-center text-sm text-black/60 dark:text-white/60">
          Paste a YouTube link, pick a quality, download.
        </p>

        <form onSubmit={handleFetch} className="mt-8 flex gap-2">
          <input
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="flex-1 rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-black/30 dark:focus:border-white/40"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-foreground text-background px-5 py-2.5 text-sm font-medium disabled:opacity-50"
          >
            {loading ? "Fetching…" : "Fetch"}
          </button>
        </form>

        {error && (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        {info && (
          <div className="mt-8 rounded-xl border border-black/10 dark:border-white/15 overflow-hidden">
            {info.thumbnail && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={info.thumbnail} alt={info.title} className="w-full aspect-video object-cover" />
            )}
            <div className="p-4">
              <h2 className="font-medium leading-snug">{info.title}</h2>
              <p className="mt-1 text-sm text-black/60 dark:text-white/60">
                {[info.uploader, formatDuration(info.duration)].filter(Boolean).join(" · ")}
              </p>

              <div className="mt-5">
                <p className="text-xs font-medium uppercase tracking-wide text-black/50 dark:text-white/50">
                  Video
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {info.resolutions.length === 0 && (
                    <p className="text-sm text-black/50 dark:text-white/50">No video formats found.</p>
                  )}
                  {info.resolutions.map(({ height, sizeBytes }) => {
                    const key = `video-${height}`;
                    const sizeLabel = formatSize(sizeBytes);
                    return (
                      <button
                        key={key}
                        onClick={() => download("video", height)}
                        disabled={isDownloading}
                        className="rounded-full border border-black/15 dark:border-white/20 px-4 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50"
                      >
                        {job?.key === key && isDownloading ? (
                          "Downloading…"
                        ) : (
                          <>
                            {height}p
                            {sizeLabel && <span className="text-black/40 dark:text-white/40"> · ~{sizeLabel}</span>}
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5">
                <p className="text-xs font-medium uppercase tracking-wide text-black/50 dark:text-white/50">
                  Audio
                </p>
                <div className="mt-2">
                  <button
                    onClick={() => download("audio")}
                    disabled={isDownloading}
                    className="rounded-full border border-black/15 dark:border-white/20 px-4 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50"
                  >
                    {job?.key === "audio" && isDownloading ? (
                      "Downloading…"
                    ) : (
                      <>
                        MP3
                        {formatSize(info.audioSizeBytes) && (
                          <span className="text-black/40 dark:text-white/40"> · ~{formatSize(info.audioSizeBytes)}</span>
                        )}
                      </>
                    )}
                  </button>
                </div>
              </div>

              {job && (
                <div className="mt-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-black/70 dark:text-white/70">
                      {job.status === "running" && "Downloading…"}
                      {job.status === "done" && "Done — your download should start automatically."}
                      {job.status === "cancelled" && "Cancelled."}
                      {job.status === "error" && (job.error ?? "Download failed.")}
                    </p>
                    {job.status === "running" && (
                      <button
                        onClick={cancelDownload}
                        className="shrink-0 text-sm underline underline-offset-2 text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white"
                      >
                        Cancel
                      </button>
                    )}
                  </div>

                  <div
                    ref={logBoxRef}
                    className="mt-2 h-40 overflow-y-auto rounded-lg bg-black text-green-400 p-3 font-mono text-xs leading-relaxed"
                  >
                    {job.logs.length === 0 ? (
                      <p className="text-white/40">Waiting for yt-dlp…</p>
                    ) : (
                      job.logs.map((line, i) => <div key={i}>{line}</div>)
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
