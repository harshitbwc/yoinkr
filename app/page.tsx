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

function Mark({ size = 28 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-lg bg-accent font-black text-accent-foreground"
      style={{ width: size, height: size, fontSize: size * 0.55 }}
    >
      y
    </span>
  );
}

function Logo({ small = false }: { small?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Mark size={small ? 20 : 30} />
      <span className={`font-black tracking-tight ${small ? "text-base" : "text-xl"}`}>yoinkr</span>
    </span>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-border px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-muted">
      {children}
    </span>
  );
}

function AdSlot({ label }: { label: string }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="mb-2 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
        Advertisement
      </p>
      {/*
        Real AdSense unit goes here once the site is approved, e.g.:
        <ins className="adsbygoogle" style={{ display: "block" }}
          data-ad-client="ca-pub-XXXXXXXXXXXXXXXX" data-ad-slot="XXXXXXXXXX"
          data-ad-format="auto" data-full-width-responsive="true" />
      */}
      <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted sm:h-28">
        {label}
      </div>
    </div>
  );
}

const STEPS = [
  { n: "01", title: "Paste", body: "Drop in any YouTube video link." },
  { n: "02", title: "Pick", body: "Choose a resolution, from 4K down to 144p — or just grab the audio." },
  { n: "03", title: "Download", body: "We fetch it and hand you the file. That's the whole thing." },
];

const FAQS = [
  {
    q: "Is this actually free?",
    a: "Yes — no account, no subscription, no watermark. It's supported by the ad on this page.",
  },
  {
    q: "What resolutions can I get?",
    a: "Whatever the original video actually offers. Paste a link and the real available options show up automatically.",
  },
  {
    q: "Can I just get the audio?",
    a: "Yes — there's a dedicated MP3 option next to the video resolutions.",
  },
  {
    q: "Do you keep a copy of my downloads?",
    a: "No. Files are fetched on demand for your download and aren't stored afterward.",
  },
  {
    q: "Is downloading videos allowed?",
    a: "Only download videos you own the rights to or are otherwise permitted to save — this tool doesn't judge what you paste in, so that part's on you.",
  },
];

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [job, setJob] = useState<JobState | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
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
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
          <Logo />
          <nav className="flex items-center gap-6 font-mono text-xs uppercase tracking-widest text-muted">
            <a href="#how-it-works" className="hover:text-foreground">
              How it works
            </a>
            <a href="#faq" className="hover:text-foreground">
              FAQ
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero + tool */}
        <section className="relative overflow-hidden border-b border-border">
          <div className="dot-grid pointer-events-none absolute inset-0" />
          <div className="relative mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
            <span className="crosshair -left-1 -top-1 hidden sm:block" />
            <span className="crosshair -right-1 -top-1 hidden sm:block" />

            <div className="flex flex-wrap justify-center gap-2">
              <Badge>100% free</Badge>
              <Badge>No sign-up</Badge>
              <Badge>Up to 4K</Badge>
            </div>

            <h1 className="mt-6 text-center text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
              Yoink any YouTube video
              <br />
              <span className="text-accent">in seconds.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-md text-center text-muted">
              Paste a link, pick a resolution — or just grab the MP3 — and download. No installs, no nonsense.
            </p>

            <form onSubmit={handleFetch} className="mx-auto mt-8 flex max-w-xl gap-2">
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="flex-1 rounded-lg border border-border bg-surface px-4 py-3 text-sm outline-none placeholder:text-muted focus:border-foreground/40"
              />
              <button
                type="submit"
                disabled={loading}
                className="shrink-0 rounded-lg bg-foreground px-5 py-3 text-sm font-bold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Fetching…" : "Grab it"}
              </button>
            </form>

            {error && (
              <p className="mx-auto mt-4 max-w-xl text-center text-sm text-accent">{error}</p>
            )}

            {info && (
              <div className="mx-auto mt-10 max-w-xl overflow-hidden rounded-xl border border-border bg-surface text-left shadow-sm">
                {info.thumbnail && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={info.thumbnail} alt={info.title} className="aspect-video w-full object-cover" />
                )}
                <div className="p-5">
                  <h2 className="font-semibold leading-snug">{info.title}</h2>
                  <p className="mt-1 text-sm text-muted">
                    {[info.uploader, formatDuration(info.duration)].filter(Boolean).join(" · ")}
                  </p>

                  <div className="mt-5">
                    <p className="font-mono text-[11px] uppercase tracking-widest text-muted">Video</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {info.resolutions.length === 0 && (
                        <p className="text-sm text-muted">No video formats found.</p>
                      )}
                      {info.resolutions.map(({ height, sizeBytes }) => {
                        const key = `video-${height}`;
                        const sizeLabel = formatSize(sizeBytes);
                        return (
                          <button
                            key={key}
                            onClick={() => download("video", height)}
                            disabled={isDownloading}
                            className="rounded-lg border border-border px-4 py-1.5 text-sm transition-colors hover:border-foreground/30 hover:bg-background disabled:opacity-50"
                          >
                            {job?.key === key && isDownloading ? (
                              "Downloading…"
                            ) : (
                              <>
                                {height}p
                                {sizeLabel && <span className="text-muted"> · ~{sizeLabel}</span>}
                              </>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-5">
                    <p className="font-mono text-[11px] uppercase tracking-widest text-muted">Audio</p>
                    <div className="mt-2">
                      <button
                        onClick={() => download("audio")}
                        disabled={isDownloading}
                        className="rounded-lg border border-border px-4 py-1.5 text-sm transition-colors hover:border-foreground/30 hover:bg-background disabled:opacity-50"
                      >
                        {job?.key === "audio" && isDownloading ? (
                          "Downloading…"
                        ) : (
                          <>
                            MP3
                            {formatSize(info.audioSizeBytes) && (
                              <span className="text-muted"> · ~{formatSize(info.audioSizeBytes)}</span>
                            )}
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {job && (
                    <div className="mt-5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm text-foreground/80">
                          {job.status === "running" && "Downloading…"}
                          {job.status === "done" && "Done — your download should start automatically."}
                          {job.status === "cancelled" && "Cancelled."}
                          {job.status === "error" && (job.error ?? "Download failed.")}
                        </p>
                        {job.status === "running" && (
                          <button
                            onClick={cancelDownload}
                            className="shrink-0 text-sm font-medium text-muted underline underline-offset-2 hover:text-foreground"
                          >
                            Cancel
                          </button>
                        )}
                      </div>

                      <div
                        ref={logBoxRef}
                        className="mt-2 h-40 overflow-y-auto rounded-lg bg-foreground p-3 font-mono text-xs leading-relaxed text-accent-soft"
                      >
                        {job.logs.length === 0 ? (
                          <p className="text-background/40">Waiting for yt-dlp…</p>
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
        </section>

        <AdSlot label="Ad slot — 728×90 / responsive leaderboard" />

        {/* How it works */}
        <section id="how-it-works" className="border-b border-t border-border">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
            <p className="font-mono text-xs uppercase tracking-widest text-muted">How it works</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Three steps. No installs.</h2>
            <div className="mt-10 grid gap-8 sm:grid-cols-3">
              {STEPS.map((step) => (
                <div key={step.n}>
                  <p className="font-mono text-sm text-accent">{step.n}</p>
                  <h3 className="mt-2 text-lg font-bold">{step.title}</h3>
                  <p className="mt-1 text-sm text-muted">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-b border-border">
          <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
            <p className="font-mono text-xs uppercase tracking-widest text-muted">FAQ</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Good questions</h2>
            <div className="mt-8 divide-y divide-border border-y border-border">
              {FAQS.map((item, i) => {
                const open = openFaq === i;
                return (
                  <div key={item.q}>
                    <button
                      onClick={() => setOpenFaq(open ? null : i)}
                      className="flex w-full items-center justify-between gap-4 py-4 text-left"
                    >
                      <span className="font-medium">{item.q}</span>
                      <span className="shrink-0 font-mono text-muted">{open ? "−" : "+"}</span>
                    </button>
                    {open && <p className="pb-4 text-sm text-muted">{item.a}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <AdSlot label="Ad slot — responsive in-content unit" />
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-4 py-10 text-center sm:flex-row sm:justify-between sm:px-6 sm:text-left">
          <div>
            <Logo small />
            <p className="mt-1 text-xs text-muted">Not affiliated with YouTube or Google.</p>
          </div>
          <p className="font-mono text-xs text-muted">© {new Date().getFullYear()} yoinkr</p>
        </div>
      </footer>
    </div>
  );
}
