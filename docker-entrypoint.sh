#!/bin/sh
set -e

# YTDLP_COOKIES_B64 is a base64-encoded cookies.txt (Netscape format),
# set as a platform secret. Decode it to a real file yt-dlp can read via
# --cookies, and point the app at it.
if [ -n "$YTDLP_COOKIES_B64" ]; then
  echo "$YTDLP_COOKIES_B64" | base64 -d > /app/cookies.txt
  export YTDLP_COOKIES_FILE=/app/cookies.txt
fi

exec "$@"
