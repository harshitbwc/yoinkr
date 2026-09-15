FROM node:24-bookworm-slim

# python3/pip for yt-dlp, ffmpeg to mux video+audio, git for the PO token
# provider clone below, curl/unzip for the Deno install below.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 python3-pip ffmpeg curl unzip ca-certificates git \
    && rm -rf /var/lib/apt/lists/*

# Plain `pip install yt-dlp` skips its optional extras (requests, urllib3,
# websockets, brotli, certifi, Cryptodome, yt_dlp_ejs) that a Homebrew
# install pulls in automatically — yt_dlp_ejs in particular solves
# YouTube's JS signature challenge; without it, extraction fails with
# "The page needs to be reloaded" even with valid cookies.
RUN pip3 install --no-cache-dir --break-system-packages "yt-dlp[default]"

# A datacenter IP increasingly needs a PO (Proof of Origin) token attached
# to YouTube requests — a BotGuard-challenge attestation that a script
# can't produce on its own. bgutil-ytdlp-pot-provider runs a small local
# Node server that solves the challenge for real; the pip package is the
# yt-dlp-side plugin that auto-detects and talks to it on localhost:4416.
RUN pip3 install --no-cache-dir --break-system-packages -U bgutil-ytdlp-pot-provider
RUN git clone --depth 1 --branch 2.0.0 \
      https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git /opt/bgutil-pot-provider \
    && cd /opt/bgutil-pot-provider/server \
    && npm ci \
    && npx tsc

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
