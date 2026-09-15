#!/bin/sh
set -e

# YTDLP_COOKIES_B64 is a base64-encoded cookies.txt (Netscape format),
# set as a platform secret. Decode it to a real file yt-dlp can read via
# --cookies, and point the app at it.
if [ -n "$YTDLP_COOKIES_B64" ]; then
  echo "$YTDLP_COOKIES_B64" | base64 -d > /app/cookies.txt
  export YTDLP_COOKIES_FILE=/app/cookies.txt
  echo "[entrypoint] Loaded cookies from YTDLP_COOKIES_B64 -> $(wc -l < /app/cookies.txt) lines"
else
  echo "[entrypoint] WARNING: YTDLP_COOKIES_B64 is not set — yt-dlp will run with no cookies at all, not even Safari's (there's no browser here). Expect YouTube's bot-check to block most requests."
fi

# "Script" mode (a fresh Node process spawned per token instead of a
# resident server) turned out to hit a known upstream bug — generate_once.js
# hangs on startup regardless of args (bgutil-ytdlp-pot-provider#232) — so
# back to the HTTP server, which we've verified actually works end to end.
# Start it in the background, then run the app in the foreground — not
# exec'd, so this script stays alive to trap shutdown signals and stop
# both processes cleanly.
node /opt/bgutil-pot-provider/server/build/main.js &
POT_PID=$!
echo "[entrypoint] Started PO token provider (pid $POT_PID)"

trap 'echo "[entrypoint] Shutting down"; kill "$POT_PID" 2>/dev/null; kill "$APP_PID" 2>/dev/null; exit' TERM INT

"$@" &
APP_PID=$!
wait "$APP_PID"
