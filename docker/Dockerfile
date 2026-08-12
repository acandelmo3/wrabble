# The whole dev stack in one container: the Worker (wrangler, local D1) and the
# static web app. Built to run on the homelab and be reached over the tailnet.
#
# Deliberately NOT a production image ~ it runs `wrangler dev` with
# ALLOW_TIME_TRAVEL and seeded sign-in links, and must never face the internet.
FROM node:22-bookworm-slim

# python3 is for web/serve.py, the no-cache static server.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependencies first, so editing source doesn't reinstall node_modules.
COPY worker/package.json worker/package-lock.json ./worker/
RUN cd worker && npm ci

COPY worker/ ./worker/
COPY web/ ./web/
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# wrangler is chatty and prompts on a TTY; neither is wanted under compose.
ENV CI=true \
    WRANGLER_SEND_METRICS=false

EXPOSE 5173 8787

CMD ["/usr/local/bin/entrypoint.sh"]
