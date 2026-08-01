// Creates fake players in the LOCAL D1 and prints a sign-in link for each one,
// so you can play a full group by yourself without setting up Discord OAuth.
//
//   node scripts/dev-players.mjs            # alice, bob, carol
//   node scripts/dev-players.mjs ann bo cy dee
//
// Open each link in a different browser profile (or one normal window + one
// private window) to be several players at once. The link carries a session
// token in the URL fragment, which the app stores and then scrubs.
//
// Local only: the tokens are signed with the dev secret from .dev.vars, so they
// are worthless against a deployed worker.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { signToken } from '../src/auth.js';

const APP = process.env.WRABBLE_APP || 'http://localhost:5173/index.html';

function devSecret() {
  if (process.env.WRABBLE_SECRET) return process.env.WRABBLE_SECRET;
  try {
    const vars = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8');
    const line = vars.split('\n').find((l) => l.startsWith('SESSION_SECRET='));
    if (line) return line.slice('SESSION_SECRET='.length).trim();
  } catch { /* fall through */ }
  console.error('No SESSION_SECRET found. Create worker/.dev.vars with:\n'
    + '  DISCORD_CLIENT_SECRET=dev-not-used\n'
    + '  SESSION_SECRET=dev-secret-for-local-testing-only');
  process.exit(1);
}

const names = process.argv.slice(2).length ? process.argv.slice(2) : ['alice', 'bob', 'carol'];
const secret = devSecret();

// Deterministic ids, so re-running keeps the same players and their history.
const players = names.map((name, i) => ({ name, id: String(9000 + i) }));

const values = players
  .map((p) => `('${p.id}','${p.name.replace(/'/g, "''")}',NULL,NULL,${Math.floor(Date.now() / 1000)})`)
  .join(',');

// NB: upsert with ON CONFLICT, never INSERT OR REPLACE. REPLACE deletes the row
// before reinserting, and users(id) is referenced ON DELETE CASCADE by
// memberships, submissions, guesses and scores — so a reseed would silently
// wipe every group and entry belonging to these players.
execFileSync('npx', [
  'wrangler', 'd1', 'execute', 'wrabble', '--local', '--env', 'dev', '--command',
  `INSERT INTO users (id,username,global_name,avatar,created_at) VALUES ${values}
     ON CONFLICT(id) DO UPDATE SET username = excluded.username;`,
], { stdio: 'ignore' });

console.log(`\nSeeded ${players.length} local players. Open one link per player:\n`);
for (const p of players) {
  const token = await signToken({ sub: p.id }, secret);
  console.log(`  ${p.name.padEnd(10)} ${APP}#token=${encodeURIComponent(token)}`);
}
console.log(`
First player: create a group, copy its invite code.
Everyone else: join with that code.

To skip ahead instead of waiting for Thursday (dev env only):

  curl -X POST "http://localhost:8787/api/groups/<GROUP_ID>/advance" \\
    -H "authorization: Bearer <TOKEN from a link above>" \\
    -H 'content-type: application/json' -d '{"to":"guessing"}'

  ...where "to" is "guessing", "revealed", or "next".
`);
