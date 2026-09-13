# yoinkr

Paste a YouTube link, pick a resolution (best to worst) or grab audio only, and download.

## Requirements

- [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) on `PATH` — `brew install yt-dlp`
- `ffmpeg` on `PATH` — `brew install ffmpeg` (used to merge video/audio and extract MP3)

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), paste a YouTube URL, click Fetch, then pick a quality.

## How it works

- `POST /api/info` shells out to `yt-dlp -j` to read the title, thumbnail, duration, and the distinct video heights (resolutions) available for the URL.
- `POST /api/jobs` starts a background `yt-dlp` process for the requested resolution (merged to MP4 via ffmpeg) or audio extraction (MP3), and returns a job id.
- `GET /api/jobs/[id]/stream` is a Server-Sent Events stream of that job's live `yt-dlp` output plus a final `done`/`error`/`cancelled` status — this is what powers the live log panel in the UI.
- `GET /api/jobs/[id]/file` streams the finished file to the browser as an attachment once the job is done. `POST /api/jobs/[id]/cancel` kills the job's `yt-dlp` process.
- Jobs are kept in an in-memory map (server process only, not persisted), reaped 15 minutes after finishing if never picked up. Every `yt-dlp` invocation has socket timeouts/retries and a 20-minute hard cap so a stalled connection can't hang forever.
- Cookies come from `cookieArgs()` in `lib/ytdlp.ts`: locally it reads your Safari session directly (`--cookies-from-browser safari`); if `YTDLP_COOKIES_FILE` is set (as it is in the Docker image), it uses `--cookies <path>` instead, since a container has no Safari to read from.

This app has no database, auth, or queue. It runs fine locally against your own machine, and can also run as a single always-on container (see **Deploying** below) — but the in-memory job map means it must stay a **single instance**; horizontal scaling would break the live log stream / file download for any job that lands on a different instance than the one that started it.

## Deploying

This needs a persistent server that can install system binaries and run long-lived processes — not a serverless platform (Vercel functions, etc. — no yt-dlp/ffmpeg, and execution time limits kill anything past a minute or so). A single-instance container platform (Fly.io, Railway, Render) or a plain VPS works.

**1. Export a cookies file once, locally, then filter it down** (there's no Safari on a server, and without *some* signed-in session YouTube's bot-check will block most requests):

```bash
yt-dlp --cookies-from-browser safari --cookies cookies.raw.txt --skip-download "https://www.youtube.com/watch?v=jNQXAC9IVRw"
awk -F'\t' '/^#/ || $1 ~ /(google|youtube)\.com$/' cookies.raw.txt > cookies.txt
rm cookies.raw.txt
```

`--cookies-from-browser` exports your *entire* Safari cookie jar, not just YouTube's — every site you're logged into (Amazon, GitHub, Slack, whatever else) ends up in there too. The `awk` filter keeps only `*.google.com`/`*.youtube.com` lines (which is what carries your Google login — YouTube shares Google's session, so `accounts.google.com`'s cookies matter even though you never explicitly "signed into YouTube"). Only upload the **filtered** `cookies.txt`, never the raw export — treat it as a login session for whatever Google account it came from, and never commit it. Cookies expire, so repeat this occasionally (e.g. if downloads start failing with "Sign in to confirm you're not a bot" again) and re-upload per step 3.

**Strongly consider using a secondary/throwaway Google account for this**, signed into Safari just for this purpose, rather than your primary one — this cookie file is what carries all the risk of an account-level flag or restriction if YouTube's abuse detection ever reacts to this server's traffic pattern.

**2. Build & test the image locally:**

```bash
docker build -t yoinkr .
docker run --rm -p 3000:3000 \
  -e YTDLP_COOKIES_B64="$(base64 < cookies.txt | tr -d '\n')" \
  yoinkr
```

Open http://localhost:3000 — this is the exact image that ships to production, so anything broken here is broken there too.

**3. Deploy to Fly.io** (Railway/Render: same Dockerfile, use their dashboard to connect the repo instead of the CLI):

```bash
brew install flyctl
fly auth login          # opens a browser — needs your own Fly account
fly launch --no-deploy   # detects the Dockerfile, asks for an app name/region — say NO to Postgres/Redis, and NO to autoscaling beyond 1 machine
fly secrets set YTDLP_COOKIES_B64="$(base64 < cookies.txt | tr -d '\n')"
fly deploy
```

`fly launch` writes a `fly.toml` — before deploying, make sure it has exactly one machine and no autoscaling (`[[vm]] ... ` section with `min_machines_running = 1`, no `max_machines_running` beyond 1), since the in-memory job map only works within a single instance.

**4. Verify:** `fly open` (or the URL Fly prints), paste a link, download something. `fly logs` shows the same `yt-dlp` output you'd otherwise see in `dev.log`.

**Ongoing maintenance to expect, since this is now open to anyone:**
- A datacenter IP gets bot-checked by YouTube more often than a home IP — if downloads start failing, refresh `cookies.txt` (step 1) and re-run step 3's `fly secrets set` + `fly deploy`.
- No auth and no rate limiting means every visitor's bandwidth and every yt-dlp process runs against your one hosted IP/cookie identity — heavy simultaneous use will look the same to YouTube as one very busy user, which is exactly what triggers bot-checks and quota limits fastest.
