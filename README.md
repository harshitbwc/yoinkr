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

## Production deployment

**Live at https://yoinkr.online**, running on an Oracle Cloud "Always Free" VM (`VM.Standard.E2.1.Micro`, 1 OCPU / 1GB RAM, Ubuntu 20.04, Mumbai region) — free forever, no time limit. This needs a persistent server that can install system binaries and run long-lived processes, so it's not deployable to a serverless platform (Vercel, etc. — no yt-dlp/ffmpeg, and execution time limits kill anything past a minute).

**Server layout:**
- SSH: `ssh -i ~/.ssh/oracle-yoinkr ubuntu@161.118.163.47`
- App: Docker container named `yoinkr`, `--restart=always`, bound to `127.0.0.1:3000` only (not directly internet-facing)
- Reverse proxy: Nginx on 80/443 (`/etc/nginx/sites-available/yoinkr`), `proxy_buffering off` so the live download-log SSE stream isn't delayed
- TLS: Let's Encrypt via Certbot (installed via `snap`, **not** `apt` — the apt-packaged certbot on this old Ubuntu conflicts with the newer `urllib3` yt-dlp needs). Auto-renews via certbot's own systemd timer; cert covers `yoinkr.online` + `www.yoinkr.online`
- DNS: Hostinger, A record for `@` → `161.118.163.47`, `www` is a CNAME to the root domain
- Firewall: opened in **two** places, both required — Oracle's cloud Security List (Console → VCN → Security Lists) *and* the VM's own `iptables` (persisted via `iptables-persistent`/`netfilter-persistent`) for ports 80/443
- Cookies: `/home/ubuntu/cookies.txt` on the VM, bind-mounted **writable** (not read-only) into the container at `/app/cookies.txt` — yt-dlp writes back to it to persist Google's rotating session tokens, which reduces (but doesn't eliminate) how often you need to manually refresh it
- Swap: a 4GB swap file (`/swapfile`) — the 1GB VM cannot *build* the Docker image without it (the Next.js production build alone briefly used over 1GB); runtime memory use is much lower (~200-400MB) and doesn't need it

**Redeploying after a code change:**

```bash
# from your local yoinkr/ directory
rsync -az --exclude=node_modules --exclude=.next --exclude=.git --exclude=dev.log --exclude=cookies.txt \
  -e "ssh -i ~/.ssh/oracle-yoinkr" ./ ubuntu@161.118.163.47:/home/ubuntu/yoinkr/

ssh -i ~/.ssh/oracle-yoinkr ubuntu@161.118.163.47 '
  cd ~/yoinkr && sudo docker build -t yoinkr:local .
  sudo docker rm -f yoinkr
  sudo docker run -d --name yoinkr --restart=always \
    -p 127.0.0.1:3000:3000 \
    -v /home/ubuntu/cookies.txt:/app/cookies.txt \
    -e YTDLP_COOKIES_FILE=/app/cookies.txt \
    yoinkr:local
'
```

The build alone can take several minutes on this VM's single shared core — worth running detached (`nohup ... & disown`) over SSH and polling, rather than holding one connection open, since long-lived SSH sessions to this VM have dropped mid-build before.

**Refreshing cookies** (needed whenever downloads start failing with "Sign in to confirm you're not a bot" — the YouTube login session expires periodically):

```bash
# locally, with the target account signed into youtube.com in Safari (check for the avatar, not a "Sign in" button)
cd ~/Documents/pda/yoinkr
yt-dlp --cookies-from-browser safari --cookies cookies.raw.txt --skip-download "https://www.youtube.com/watch?v=jNQXAC9IVRw"
awk -F'\t' '/^#/ || $1 ~ /(google|youtube)\.com$/' cookies.raw.txt > cookies.txt
rm cookies.raw.txt
scp -i ~/.ssh/oracle-yoinkr cookies.txt ubuntu@161.118.163.47:/home/ubuntu/cookies.txt
rm cookies.txt
```

No container restart needed — the file is read fresh on each request. Sanity-check a fresh export actually carries a real login before sending it: `awk -F'\t' '$1 ~ /youtube\.com$/ {print $6}' cookies.txt | grep -x LOGIN_INFO`.

**Checking logs:** `ssh -i ~/.ssh/oracle-yoinkr ubuntu@161.118.163.47 'sudo docker logs yoinkr'` — the entrypoint logs whether cookies loaded and whether the PO token provider started; per-request `yt-dlp` output only appears in a job's own SSE stream (the UI's log panel), not here, unless `YTDLP_VERBOSE=1` is set on the container.

**A PO-token provider** (`bgutil-ytdlp-pot-provider`, HTTP server mode) runs alongside the app as a backup path for when cookies alone aren't enough — YouTube increasingly requires a BotGuard-solved "Proof of Origin" token from datacenter IPs. Its "script" mode (spawn-per-request instead of a resident server) looked appealing to save memory, but hits a confirmed unresolved upstream bug (hangs on startup regardless of args — [issue #232](https://github.com/Brainicism/bgutil-ytdlp-pot-provider/issues/232)); don't switch back to it without checking if that's since been fixed.

**Housekeeping:** `sudo docker images` / `docker rmi` periodically — superseded image layers from rebuilds pile up (each full image is ~2GB) and this VM's disk, while generous, isn't infinite.

**Ongoing reality of running this publicly, with no auth or rate limiting:** every visitor's bandwidth and every yt-dlp process runs against this one server's IP/cookie identity — heavy simultaneous use looks the same to YouTube as one very busy user, which is exactly what triggers bot-checks fastest. If that becomes a real problem, revisit rate-limiting per IP (discussed, not yet built) before reaching for a bigger/paid instance — this shape already has large headroom for normal light traffic.
