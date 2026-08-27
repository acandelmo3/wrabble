// Plays a full week against a running local worker and asserts the rules hold —
// including that answers stay hidden during writing and authors stay hidden
// during guessing.
//
// Prereqs, in another terminal:
//   npm run db:local && npm run dev
//
// It seeds its own players, so no other setup is needed.
//
// Run: node test/e2e.mjs
import { execFileSync } from 'node:child_process';
import { signToken } from '../src/auth.js';

const API = process.env.WRABBLE_API || 'http://localhost:8787';
// Must match SESSION_SECRET in worker/.dev.vars.
const SECRET = process.env.WRABBLE_SECRET || 'dev-secret-for-local-testing-only';
const users = [
  { id: '1001', name: 'alice' },
  { id: '1002', name: 'bob' },
  { id: '1003', name: 'carol' },
];

let failures = 0;
const check = (label, cond, detail) => {
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!cond) failures++;
};

async function call(user, method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: {
      authorization: `Bearer ${user.token}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

// Seed our own players so this runs standalone against a fresh local D1.
const outsiderRow = { id: '9999', name: 'mallory' };
execFileSync('npx', [
  'wrangler', 'd1', 'execute', 'wrabble', '--local', '--env', 'dev', '--command',
  // Upsert, not REPLACE — see the note in scripts/dev-players.mjs.
  // display_name is reset too, not just set on insert: these ids get reused
  // across runs, and a custom name left over from playing with the app by hand
  // would rename the players this file asserts on.
  `INSERT INTO users (id,username,global_name,avatar,created_at) VALUES ${
    [...users, outsiderRow].map((u) => `('${u.id}','${u.name}',NULL,NULL,1)`).join(',')}
     ON CONFLICT(id) DO UPDATE SET username = excluded.username, display_name = NULL;
   UPDATE memberships SET nickname = NULL WHERE user_id IN (${
    [...users, outsiderRow].map((u) => `'${u.id}'`).join(',')});`,
], { stdio: 'ignore' });

for (const u of users) u.token = await signToken({ sub: u.id }, SECRET);

console.log('\n— auth —');
const anon = await fetch(`${API}/api/me`);
check('unauthenticated /api/me is rejected', anon.status === 401);
const bogus = await fetch(`${API}/api/me`, { headers: { authorization: 'Bearer forged.sig' } });
check('forged token is rejected', bogus.status === 401);

const me = await call(users[0], 'GET', '/api/me');
check('signed token is accepted', me.status === 200, me.data.user?.username);

console.log('\n— group setup —');
const created = await call(users[0], 'POST', '/api/groups', { name: 'Test Club', tz: 'America/New_York' });
check('alice creates a group', created.status === 200, `code ${created.data.invite_code}`);
const gid = created.data.id;

for (const u of users.slice(1)) {
  const j = await call(u, 'POST', '/api/groups/join', { code: created.data.invite_code });
  check(`${u.name} joins`, j.status === 200);
}

const outsider = { id: '9999', name: 'mallory', token: await signToken({ sub: '9999' }, SECRET) };
await fetch(`${API}/api/me`, { headers: { authorization: `Bearer ${outsider.token}` } });

// Pin the round into the writing phase. Otherwise this suite passes or fails
// depending on the wall clock: run it after Thursday 20:00 and a fresh group's
// round has already crossed its own cutoff.
await call(users[0], 'POST', `/api/groups/${gid}/advance`, { to: 'writing' });

let view = (await call(users[0], 'GET', `/api/groups/${gid}`)).data;
check('a round auto-started', view.round?.phase === 'writing', `week ${view.round?.week_index}`);
check('prompt was drawn', !!view.round?.prompt, view.round?.prompt);
check('all three members present', view.members.length === 3);

console.log('\n— writing phase —');
const texts = {
  alice: 'A short one. Barely a sentence, honestly.',
  bob: 'I have been thinking about the road behind my grandmother house for eleven years now, and I still cannot decide whether the thing I remember is the road or a photograph of the road that I have looked at too many times.',
  carol: 'ten letters',
};
for (const u of users) {
  const r = await call(u, 'PUT', `/api/rounds/${view.round.id}/submission`, { body: texts[u.name] });
  check(`${u.name} submits`, r.status === 200);
}
const edited = await call(users[0], 'PUT', `/api/rounds/${view.round.id}/submission`, { body: texts.alice + ' (edited)' });
check('alice can edit before cutoff', edited.status === 200);

view = (await call(users[1], 'GET', `/api/groups/${gid}`)).data;
check('SECRECY: no entries exposed while writing', view.round.entries === undefined);
check('bob sees only his own draft', view.round.my_submission === texts.bob);
check('submission count visible', view.round.submission_count === 3);

const guessEarly = await call(users[1], 'POST', `/api/rounds/${view.round.id}/guesses`, { guesses: {} });
check('guessing blocked during writing', guessEarly.status === 403, guessEarly.data.error);

console.log('\n— non-member isolation —');
const intrude = await call(outsider, 'GET', `/api/groups/${gid}`);
check('non-member cannot read the group', intrude.status === 404);
const intrudeWrite = await call(outsider, 'PUT', `/api/rounds/${view.round.id}/submission`, { body: 'sneaking in' });
check('non-member cannot submit', intrudeWrite.status === 404);

console.log('\n— prompt pool —');
for (const [u, text] of [[users[1], 'What is the last thing you stole?'], [users[2], 'Describe your worst haircut.']]) {
  const r = await call(u, 'POST', `/api/groups/${gid}/prompts`, { text });
  check(`${u.name} suggests a prompt`, r.status === 200);
}

const second = await call(users[1], 'POST', `/api/groups/${gid}/prompts`,
  { text: 'bob tries to stuff the ballot box' });
check('a second suggestion in the same week is refused', second.status === 409,
  second.data.error);
const poolAfter = await call(users[1], 'GET', `/api/groups/${gid}`);
check('the refused prompt did not reach the pool',
  poolAfter.data.round.my_prompt_suggestion === 'What is the last thing you stole?',
  poolAfter.data.round.my_prompt_suggestion);

// A group created mid-week is scheduled for the next opening, so opens_at is
// in the future. A created_at >= opens_at window matched nothing there: the app
// forgot your suggestion and the one-per-week cap silently stopped applying.
console.log('\n— suggestion survives on a round that has not opened —');
const future = await call(users[0], 'POST', '/api/groups', { name: 'Future', tz: 'America/New_York' });
const fg = future.data.id;
await call(users[0], 'POST', `/api/groups/${fg}/prompts`, { text: 'suggested before the round opens' });
const fv = (await call(users[0], 'GET', `/api/groups/${fg}`)).data;
if (fv.round.not_open_yet) {
  check('suggestion is remembered on a not-yet-open round',
    fv.round.my_prompt_suggestion === 'suggested before the round opens',
    JSON.stringify(fv.round.my_prompt_suggestion));
  const dup = await call(users[0], 'POST', `/api/groups/${fg}/prompts`, { text: 'second' });
  check('one-per-week still applies before the round opens', dup.status === 409, dup.data.error);
} else {
  check('one-per-week enforced on an open round',
    (await call(users[0], 'POST', `/api/groups/${fg}/prompts`, { text: 'second' })).status === 409);
}

console.log('\n— advance to guessing —');
const adv = await call(users[0], 'POST', `/api/groups/${gid}/advance`, { to: 'guessing' });
check('time travel to guessing', adv.status === 200, JSON.stringify(adv.data.log));

view = (await call(users[1], 'GET', `/api/groups/${gid}`)).data;
check('phase is guessing', view.round.phase === 'guessing');
check('entries now visible', view.round.entries?.length === 3);
check('SECRECY: no author ids during guessing',
  view.round.entries.every((e) => e.author_id === undefined));
check('bob sees exactly one entry flagged as his',
  view.round.entries.filter((e) => e.mine).length === 1);
check('the flagged entry really is his',
  view.round.entries.find((e) => e.mine).body === texts.bob);

const lateWrite = await call(users[2], 'PUT', `/api/rounds/${view.round.id}/submission`, { body: 'too late!' });
check('submissions rejected after cutoff', lateWrite.status === 403, lateWrite.data.error);

console.log('\n— guessing —');
const byAuthor = {};
for (const e of view.round.entries) {
  for (const [name, body] of Object.entries(texts)) {
    if (e.body.startsWith(body.slice(0, 20))) byAuthor[name] = e.id;
  }
}
check('resolved all three entry ids', Object.keys(byAuthor).length === 3);

// alice: bob right, carol wrong. bob: both wrong. carol: both right.
const sheets = [
  [users[0], { [byAuthor.bob]: '1002', [byAuthor.carol]: '1002' }],
  [users[1], { [byAuthor.alice]: '1003', [byAuthor.carol]: '1001' }],
  [users[2], { [byAuthor.alice]: '1001', [byAuthor.bob]: '1002' }],
];
for (const [u, g] of sheets) {
  const r = await call(u, 'POST', `/api/rounds/${view.round.id}/guesses`, { guesses: g, prompt_author: '1002' });
  check(`${u.name} submits guesses`, r.status === 200);
}

const reguess = await call(users[0], 'POST', `/api/rounds/${view.round.id}/guesses`,
  { guesses: { [byAuthor.bob]: '1003' } });
check('guesses can be changed', reguess.status === 200);
await call(users[0], 'POST', `/api/rounds/${view.round.id}/guesses`, { guesses: { [byAuthor.bob]: '1002' } });

const selfGuess = await call(users[0], 'POST', `/api/rounds/${view.round.id}/guesses`,
  { guesses: { [byAuthor.alice]: '1001' } });
check('self-guess accepted but discarded', selfGuess.status === 200 && selfGuess.data.saved === 0,
  JSON.stringify(selfGuess.data));

view = (await call(users[0], 'GET', `/api/groups/${gid}`)).data;
check('alice sees her saved guesses', Object.keys(view.round.my_guesses).length === 2,
  `${Object.keys(view.round.my_guesses).length} stored`);

console.log('\n— reveal —');
const rev = await call(users[0], 'POST', `/api/groups/${gid}/advance`, { to: 'revealed' });
check('time travel to reveal', rev.status === 200, JSON.stringify(rev.data.log));

view = (await call(users[0], 'GET', `/api/groups/${gid}`)).data;
check('phase is revealed', view.round.phase === 'revealed');
check('authors now attached', view.round.entries.every((e) => !!e.author));
const aliceEntry = view.round.entries.find((e) => e.id === byAuthor.alice);
check('alice entry attributed to alice', aliceEntry.author === 'alice');

const score = (n) => view.round.round_scores.find((s) => s.username === n)?.points;
console.log('    scores:', view.round.round_scores.map((s) => `${s.username}=${s.points}`).join(' '));
// alice: submit 1 + guessed 1 + 1 correct 3 + fooled bob 1 = 6
// bob:   submit 1 + guessed 1 + 0 correct + fooled nobody = 2
// carol: submit 1 + guessed 1 + 2 correct 6 + fooled alice 1 + fooled bob 1 = 10
check('alice scored 6', score('alice') === 6, `got ${score('alice')}`);
check('bob scored 2', score('bob') === 2, `got ${score('bob')}`);
check('carol scored 10', score('carol') === 10, `got ${score('carol')}`);

check('leaderboard has everyone', view.leaderboard.length === 3);
check('leaderboard sorted desc',
  view.leaderboard.every((r, i, a) => i === 0 || a[i - 1].total >= r.total),
  view.leaderboard.map((r) => `${r.username}:${r.total}`).join(' '));

console.log('\n— reactions —');
const target = byAuthor.alice;
// sid is explicit, never defaulted: an undefined id silently falling back to
// some other entry turns a failed guard into a passing test.
const react = (u, face, sid) =>
  call(u, 'POST', `/api/submissions/${sid}/reactions`, { face });

check('reveal ships the face list', Array.isArray(view.round.reaction_faces)
  && view.round.reaction_faces.includes('happy'),
  JSON.stringify(view.round.reaction_faces));

const r1 = await react(users[1], 'happy', target);
check('a member can react', r1.status === 200 && r1.data.on === true, JSON.stringify(r1.data));
check('count comes back with it', r1.data.reactions.counts.happy === 1);

// Same face twice is a toggle, not a stack ~ this is the primary key doing it.
const r2 = await react(users[1], 'happy', target);
check('the same face again removes it', r2.status === 200 && r2.data.on === false,
  JSON.stringify(r2.data.reactions.counts));

await react(users[1], 'happy', target);
const r3 = await react(users[2], 'happy', target);
check('two people stack on one face', r3.data.reactions.counts.happy === 2);
const r4 = await react(users[1], 'love', target);
check('one person can leave several faces', r4.data.reactions.counts.love === 1
  && r4.data.reactions.counts.happy === 2, JSON.stringify(r4.data.reactions.counts));
check('mine lists only my own', r4.data.reactions.mine.sort().join(',') === 'happy,love',
  JSON.stringify(r4.data.reactions.mine));

const badFace = await react(users[1], 'angry', target);
check('a face outside the set is refused', badFace.status === 400, JSON.stringify(badFace.data));
const noEntry = await call(users[1], 'POST', '/api/submissions/nope/reactions', { face: 'happy' });
check('an unknown entry is refused', noEntry.status === 404, JSON.stringify(noEntry.data));
const stranger = await react(outsider, 'happy', target);
check('SECRECY: a non-member cannot react', stranger.status === 404, JSON.stringify(stranger.data));

view = (await call(users[0], 'GET', `/api/groups/${gid}`)).data;
const reacted = view.round.entries.find((e) => e.id === target);
check('reactions ride along on the round payload',
  reacted.reactions.happy === 2 && reacted.reactions.love === 1,
  JSON.stringify(reacted.reactions));
check('alice sees none of them as hers', reacted.my_reactions.length === 0,
  JSON.stringify(reacted.my_reactions));

console.log('\n— next week rolls over —');
const roll = await call(users[0], 'POST', `/api/groups/${gid}/advance`, { to: 'next' });
check('rollover ran', roll.status === 200, JSON.stringify(roll.data.log));
view = (await call(users[0], 'GET', `/api/groups/${gid}`)).data;
check('a week-2 round exists', view.round.week_index === 2, `phase ${view.round.phase}`);
check('week 2 drew a player-written prompt',
  ['What is the last thing you stole?', 'Describe your worst haircut.'].includes(view.round.prompt),
  view.round.prompt);
// Pin week 2 to writing too — its calendar deadlines may already be in the
// past depending on the hour this runs.
await call(users[0], 'POST', `/api/groups/${gid}/advance`, { to: 'writing' });
view = (await call(users[0], 'GET', `/api/groups/${gid}`)).data;
check('SECRECY: week 2 hides entries again',
  view.round.phase === 'writing' && view.round.entries === undefined,
  `phase ${view.round.phase}`);
// Carol sits week 2 out on purpose ~ she must not appear on the ballot below.
for (const u of [users[0], users[1]]) {
  await call(u, 'PUT', `/api/rounds/${view.round.id}/submission`, { body: `${u.name} week two` });
}
check('standings carried over', view.leaderboard.reduce((a, b) => a + b.total, 0) === 18,
  `total ${view.leaderboard.reduce((a, b) => a + b.total, 0)}`);

const hist = await call(users[0], 'GET', `/api/groups/${gid}/history`);
check('history shows week 1 with authors', hist.data.rounds?.[0]?.entries?.length === 3);

// A finished week keeps taking reactions ~ the bar on the history screen is
// live, not a picture of what happened.
const oldStill = await react(users[1], 'sad', target);
check('an old revealed week still takes reactions', oldStill.status === 200,
  JSON.stringify(oldStill.data));

check('history carries the reaction counts',
  hist.data.rounds?.[0]?.entries?.some((e) => e.reactions && Object.keys(e.reactions).length),
  JSON.stringify(hist.data.rounds?.[0]?.entries?.map((e) => e.reactions)));
check('history entries carry ids so the bar can post',
  hist.data.rounds?.[0]?.entries?.every((e) => !!e.id));
check('history ships the face list too', Array.isArray(hist.data.reaction_faces));

console.log('\n— reveal + rollover in a single pass —');
// A late cron tick, or a group catching up after downtime, can cross the reveal
// boundary and the next open boundary at once. The finished week must still be
// announced; earlier this was dropped because only the round the pass ended on
// got notified.
await call(users[0], 'POST', `/api/groups/${gid}/advance`, { to: 'guessing' });

// The rule reactions exist under: while guessing is open the entries are
// anonymous, and a reaction bar would be a side channel for talking about who
// wrote what. Week 2 is in guessing right now, so its entries must refuse.
const guessing = (await call(users[0], 'GET', `/api/groups/${gid}`)).data;
check('week 2 is in guessing', guessing.round.phase === 'guessing');
const w2entry = guessing.round.entries?.[0]?.id;
check('guessing exposes entry ids', !!w2entry);

// The ballot is the writers, nobody else. Carol wrote nothing this week, so
// she is neither offered nor accepted as an answer.
check('the ballot is exactly this week\'s writers',
  guessing.round.entrant_ids?.slice().sort().join(',') === '1001,1002',
  JSON.stringify(guessing.round.entrant_ids));
const absentee = await call(users[1], 'POST', `/api/rounds/${guessing.round.id}/guesses`,
  { guesses: { [w2entry]: '1003' } });
check('guessing a player who sat the week out is refused', absentee.status === 400,
  `${absentee.status} ${JSON.stringify(absentee.data)}`);
const tooEarly = await react(users[1], 'happy', w2entry);
check('SECRECY: reacting during guessing is refused', tooEarly.status === 403,
  `${tooEarly.status} ${JSON.stringify(tooEarly.data)}`);

const combined = await call(users[0], 'POST', `/api/groups/${gid}/advance`, { to: 'next' });
const log = combined.data.log || [];
check('the pass both revealed and rolled over',
  log.some((l) => l.includes('-> revealed')) && log.some((l) => l.includes('started week')),
  JSON.stringify(log));
check('the finished week still announced its results',
  log.includes('notified revealed'), JSON.stringify(log));
check('the new week announced its prompt',
  log.includes('notified opened'), JSON.stringify(log));

console.log(`\n${failures === 0 ? '✅ all checks passed' : `❌ ${failures} check(s) failed`}\n`);
process.exit(failures ? 1 : 0);
