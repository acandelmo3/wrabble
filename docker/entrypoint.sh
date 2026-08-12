#!/bin/bash
# Bring up the dev stack: initialise the local D1 on first run, then serve the
# web app and the Worker together. Exits if either dies, so compose restarts it.
#
# bash, not sh: `wait -n` is a bash builtin and Debian's /bin/sh is dash.
set -eu

cd /app/worker

# Local dev never talks to Discord ~ players sign in through the seeded token
# links from `npm run players`. The real client secret must not be in here.
if [ ! -f .dev.vars ]; then
  cat > .dev.vars <<'EOF'
DISCORD_CLIENT_SECRET=dev-not-used
SESSION_SECRET=dev-secret-for-local-testing-only
EOF
fi

# .wrangler is a named volume, so this runs once and the database survives
# restarts and rebuilds. schema.sql is already current ~ the files in
# migrations/ exist to upgrade OLD databases and would fail here with
# "duplicate column name", so a fresh database must not run them.
if [ ! -d .wrangler/state ]; then
  echo "==> initialising local D1"
  npx wrangler d1 execute wrabble --local --env dev --file=./schema.sql
  echo "==> seeding players: ann bo cy"
  npx wrangler dev --env dev --port 8787 --ip 127.0.0.1 &
  _warmup=$!
  # dev-players talks to the running worker's database file, not the worker, so
  # it only needs wrangler to have created the state directory first.
  sleep 8
  kill "$_warmup" 2>/dev/null || true
  wait "$_warmup" 2>/dev/null || true
  node scripts/dev-players.mjs ann bo cy || echo "!! player seeding failed, run it by hand"
fi

echo "==> web  on :5173"
( cd /app/web && exec python3 serve.py 5173 ) &
_web=$!

echo "==> api  on :8787"
npx wrangler dev --env dev --port 8787 --ip 0.0.0.0 &
_api=$!

# If either half dies the container should too, rather than sit half-up.
trap 'kill $_web $_api 2>/dev/null || true' TERM INT
wait -n "$_web" "$_api"
exit $?
