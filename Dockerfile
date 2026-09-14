FROM node:24-bookworm-slim

# python3/pip for yt-dlp, ffmpeg to mux video+audio, curl/unzip for the Deno install below.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 python3-pip ffmpeg curl unzip ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Plain `pip install yt-dlp` skips its optional extras (requests, urllib3,
# websockets, brotli, certifi, Cryptodome, yt_dlp_ejs) that a Homebrew
# install pulls in automatically — yt_dlp_ejs in particular solves
# YouTube's JS signature challenge; without it, extraction fails with
# "The page needs to be reloaded" even with valid cookies.
RUN pip3 install --no-cache-dir --break-system-packages "yt-dlp[default]"

# YouTube requires solving a JS challenge to extract formats; yt-dlp
# auto-detects Deno on PATH and uses it for this.
RUN curl -fsSL https://deno.land/install.sh | sh -s -- -y
ENV PATH="/root/.deno/bin:${PATH}"

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "start"]
