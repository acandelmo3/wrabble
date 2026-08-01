# Wrabble

A weekly writing game for a group of friends.

Every week one prompt drops. Everyone writes an answer — 10 letters, 10 pages, or anywhere in between.
Thursday night, submissions close and the answers appear with the names stripped
off. You read them and pin a name to each one. Sunday night the names are
revealed, points are tallied, and the standings carry over week to week.

Next week's prompt is drawn at random from prompts the players themselves wrote,
so there's a bonus round: **who wrote the prompt?**

## How a week runs

| When | What happens | Discord post |
|---|---|---|
| Mon 9:00 | Prompt drops, writing opens | new prompt |
| Wed 8:00pm | 24h warning, names who still owes an entry | last call |
| Thu 8:00pm | Writing closes, answers go up anonymized, guessing opens | time to guess |
| Sun 9:00pm | Names revealed, scores posted, standings updated | results |

Every one of those times is per-group configurable (day + hour + timezone).

## Scoring

| | Points |
|---|---|
| Correctly naming who wrote an entry | +3 |
| Each player who wrongly guesses **your** entry | +1 |
| Correctly naming who wrote the prompt | +2 |
| Your prompt got drawn for the week | +5 |
| Submitting an entry | +1 |
| Turning in guesses | +1 |

Tune these in [`worker/src/scoring.js`](worker/src/scoring.js) — it's one object.

## Architecture

GitHub Pages only serves static files, and this game needs secrets kept (nobody
may read answers before Thursday) plus a clock (something must fire on Sunday
night). So it's split in two:

```
web/      static ES-module app  -> GitHub Pages
worker/   API + D1 + cron       -> Cloudflare Workers (free tier)
```

The Worker is the only thing that ever sees unrevealed answers. During the
writing phase the API response contains **no** entries field at all; during
guessing, entries carry no author ids. Nothing is hidden with CSS.

Phase transitions are clock-driven and idempotent — a missed or retried cron
tick just re-reads the deadlines, and Discord posts are latched in a
`notifications` table so nothing double-posts.

---

## Setup

### 1. Discord application (for login)

1. https://discord.com/developers/applications → **New Application**
2. **OAuth2** → copy the **Client ID** and **Client Secret**
3. Add a redirect URL: `https://wrabble-api.<your-subdomain>.workers.dev/auth/callback`
   (and `http://localhost:8787/auth/callback` for local dev)

### 2. Cloudflare Worker

```bash
cd worker
npm install
npx wrangler login
npx wrangler d1 create wrabble
```

Put the printed `database_id` into `wrangler.toml`, then fill in the `[vars]`
block — `APP_BASE_URL`, `API_BASE_URL`, `ALLOWED_ORIGINS`, `DISCORD_CLIENT_ID`.

Create the tables and set the secrets:

```bash
npx wrangler d1 execute wrabble --remote --file=./schema.sql
npx wrangler secret put DISCORD_CLIENT_SECRET
npx wrangler secret put SESSION_SECRET   # any long random string
npx wrangler deploy
```

### 3. Web app

Set your Worker URL in [`web/js/config.js`](web/js/config.js), then push to
`main`. Enable **Settings → Pages → Source: GitHub Actions** on the repo and the
included workflow publishes `web/` on every push.

There is no build step — `web/` is plain ES modules and ships as-is.

## Look and feel

A sunlit library reading room: warm paper and wood, Fraunces for headings and
Nunito for text, chunky outlined cards with hard offset shadows. All the
illustration is hand-authored inline SVG in [`web/js/art.js`](web/js/art.js) —
no icon font, no image files. A second theme, `evening`, relights the same room
with a single amber lamp; it follows the system setting on first visit and the
toggle in the shelf after that. Motion is limited to gentle drifts and settles,
and all of it is disabled under `prefers-reduced-motion`.

### 4. Discord notifications

In your Discord channel: **Channel settings → Integrations → Webhooks → New
Webhook → Copy URL**, then paste it into the group's **Settings** page in the
app. That's the whole integration — no bot to host, no token to rotate, and it
only ever posts to the one channel you pointed it at.

---

## Local development

You do **not** need Discord or a Cloudflare account to play locally.

Create `worker/.dev.vars`:

```
DISCORD_CLIENT_SECRET=dev-not-used
SESSION_SECRET=dev-secret-for-local-testing-only
```

Then, in three terminals:

```bash
cd worker && npm install && npm run db:local && npm run dev
```

```bash
cd web && python3 -m http.server 5173
```

```bash
cd worker && npm run players
```

The last one seeds fake players and prints a sign-in link for each. Open one per
browser profile (a normal window plus a private window is enough for two) and
you can play a whole group by yourself. Pass names to get more: `npm run players
ann bo cy dee`.

### Skipping ahead

Waiting until Thursday to see the guessing phase is no way to test. In the `dev`
environment `ALLOW_TIME_TRAVEL=true` enables:

```bash
curl -X POST "http://localhost:8787/api/groups/<GROUP_ID>/advance" \
  -H "authorization: Bearer <TOKEN>" \
  -H 'content-type: application/json' -d '{"to":"guessing"}'
```

`to` is `guessing`, `revealed`, or `next` (rolls into a fresh week). The group id
is in the URL when you have a group open; the token is in the sign-in links. This
route is refused in production.

### Testing the Discord posts

Make a webhook in a throwaway channel, paste it into the group's Settings, then
time-travel — each transition posts as it happens. Failed posts are logged and
retried on the next cron tick rather than being silently dropped.

## Tests

```bash
cd worker && npm test
```

Covers the scoring rules and the scheduling math — including that a round
opening the Monday before a DST change still closes Thursday 8:00pm local and
reveals Sunday 9:00pm local, walked across a full year of weeks.

With the dev server running, there is also a full-week integration run:

```bash
npm run test:e2e
```

It plays three players through writing, guessing, reveal, and rollover, and
asserts the things that would be embarrassing to get wrong: that answers are
absent from the API during writing, that author ids are absent during guessing,
that a non-member can neither read nor write, that late submissions are refused,
and that the scores come out exactly right.
