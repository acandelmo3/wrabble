import { signToken, verifyToken, oauthRedirectUrl, exchangeCode } from './auth.js';
import {
  advanceGroup, currentRound, startRound, revealPayload, uid, now, SEED_PROMPTS,
} from './rounds.js';
import {
  nameSql, globalNameSql, globalName, cleanName, findNameConflict, MAX_NAME,
} from './names.js';

const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json', ...extra },
});

function corsHeaders(env, request) {
  const origin = request.headers.get('origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const ok = allowed.includes(origin) || allowed.includes('*');
  return {
    'access-control-allow-origin': ok ? origin : allowed[0] || '',
    'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
}

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const bad = (msg) => { throw new HttpError(400, msg); };
const forbid = (msg) => { throw new HttpError(403, msg); };
const missing = (msg) => { throw new HttpError(404, msg); };

async function requireUser(request, env) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  const payload = await verifyToken(token, env.SESSION_SECRET);
  if (!payload) throw new HttpError(401, 'not signed in');
  const user = await env.DB.prepare(`SELECT * FROM users WHERE id = ?1`)
    .bind(payload.sub).first();
  if (!user) throw new HttpError(401, 'unknown user');
  return user;
}

async function requireMember(env, groupId, userId) {
  const row = await env.DB.prepare(
    `SELECT g.*, m.role, m.nickname FROM groups g
       JOIN memberships m ON m.group_id = g.id AND m.user_id = ?2
      WHERE g.id = ?1`,
  ).bind(groupId, userId).first();
  if (!row) missing('group not found, or you are not a member');
  return row;
}

const inviteCode = () => {
  // Ambiguity-free alphabet: no O/0, I/1.
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => abc[Math.floor(Math.random() * abc.length)]).join('');
};

/**
 * A user as the client sees them. `username` is whatever they should be
 * *called* here; `discord_name` is what Discord calls them, so the settings
 * screen can show what clearing a custom name would fall back to.
 *
 * Rows selected inside a group carry a `name` column from `nameSql()` and so
 * pick up that group's nickname; rows without one fall back to the overall name.
 */
const publicUser = (u) => ({
  id: u.id,
  username: u.name || globalName(u),
  discord_name: u.global_name || u.username,
  avatar: u.avatar,
});

// ---------------------------------------------------------------- routes

/** Shown when Discord OAuth has not been configured yet. */
function setupPage(env) {
  const redirect = `${env.API_BASE_URL}/auth/callback`;
  return `<!doctype html><meta charset="utf-8">
<title>Discord sign-in is not configured yet</title>
<style>
 body{font:16px/1.6 ui-sans-serif,system-ui,sans-serif;background:#fbf1de;color:#40291c;
      margin:0;padding:2.5rem 1.2rem;display:flex;justify-content:center}
 main{max-width:34rem}
 h1{font-size:1.4rem;margin:0 0 .6rem}
 code{background:#f4e6cd;border:1px solid #d9c3a2;border-radius:5px;padding:.1rem .35rem;
      font-size:.9em;word-break:break-all}
 ol{padding-left:1.2rem} li{margin:.5rem 0}
 .note{color:#8a6b53;font-size:.92rem;margin-top:1.4rem}
</style>
<main>
<h1>Discord sign-in isn't set up yet</h1>
<p>The app is running, but it has no Discord application to sign you in with. Three steps:</p>
<ol>
 <li>Create an app at <code>discord.com/developers/applications</code>.</li>
 <li>Under <b>OAuth2</b>, add this exact redirect URL:<br><code>${redirect}</code></li>
 <li>Put the <b>Client ID</b> into <code>DISCORD_CLIENT_ID</code> in
     <code>wrangler.toml</code>, and set the <b>Client Secret</b> with
     <code>wrangler secret put DISCORD_CLIENT_SECRET</code>
     (locally: add it to <code>worker/.dev.vars</code>).</li>
</ol>
<p class="note">Testing locally without Discord? Run <code>npm run players</code> in
<code>worker/</code> for sign-in links that skip OAuth entirely.</p>
</main>`;
}

async function handle(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const method = request.method;
  const body = ['POST', 'PUT'].includes(method)
    ? await request.json().catch(() => ({}))
    : {};

  // ---- auth ----
  if (path === '/auth/login') {
    // Without a real Discord app, redirecting would dump the player on
    // Discord's own error page with no clue what to do. Say it plainly here.
    if (!env.DISCORD_CLIENT_ID || env.DISCORD_CLIENT_ID.startsWith('REPLACE_')) {
      return new Response(setupPage(env), {
        status: 503,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }
    const state = url.searchParams.get('return') || env.APP_BASE_URL;
    return Response.redirect(oauthRedirectUrl(env, btoa(state)), 302);
  }

  if (path === '/auth/callback') {
    const code = url.searchParams.get('code');
    if (!code) return new Response('missing code', { status: 400 });
    const d = await exchangeCode(env, code);
    await env.DB.prepare(
      `INSERT INTO users (id, username, global_name, avatar, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5)
       ON CONFLICT(id) DO UPDATE SET username = ?2, global_name = ?3, avatar = ?4`,
    ).bind(d.id, d.username, d.global_name || null, d.avatar || null, now()).run();

    const token = await signToken({ sub: d.id }, env.SESSION_SECRET);
    let dest = env.APP_BASE_URL;
    try { dest = atob(url.searchParams.get('state') || '') || dest; } catch { /* default */ }
    // Token rides back in the fragment so it never hits a server log.
    return Response.redirect(`${dest}#token=${encodeURIComponent(token)}`, 302);
  }

  if (path === '/api/me' && method === 'GET') {
    const user = await requireUser(request, env);
    const groups = await env.DB.prepare(
      `SELECT g.id, g.name, g.invite_code, m.nickname FROM groups g
         JOIN memberships m ON m.group_id = g.id
        WHERE m.user_id = ?1 ORDER BY g.created_at`,
    ).bind(user.id).all();
    return json({
      user: { ...publicUser(user), display_name: user.display_name || null },
      groups: groups.results || [],
    });
  }

  // PUT /api/me — your name everywhere. Empty clears it back to Discord's.
  if (path === '/api/me' && method === 'PUT') {
    const user = await requireUser(request, env);
    let name;
    try { name = cleanName(body.display_name); }
    catch (err) { bad(err.message); }

    // Checked against every group they are in: clearing a custom name can
    // collide too, by exposing a Discord name someone else already answers to.
    const effective = name || (user.global_name || user.username);
    const clash = await findNameConflict(env.DB, user.id, effective);
    if (clash) {
      throw new HttpError(409,
        `Someone in one of your groups already goes by "${clash}". `
        + 'Pick something else, or set a different name just for that group.');
    }

    await env.DB.prepare(`UPDATE users SET display_name = ?1 WHERE id = ?2`)
      .bind(name || null, user.id).run();
    return json({ ok: true, display_name: name || null, username: name || effective });
  }

  // ---- groups ----
  if (path === '/api/groups' && method === 'POST') {
    const user = await requireUser(request, env);
    const name = (body.name || '').trim();
    if (!name) bad('name required');
    const id = uid();
    const code = inviteCode();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO groups (id, name, invite_code, owner_id, tz, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
      ).bind(id, name, code, user.id, body.tz || 'America/New_York', now()),
      env.DB.prepare(
        `INSERT INTO memberships (group_id, user_id, role, joined_at)
         VALUES (?1, ?2, 'owner', ?3)`,
      ).bind(id, user.id, now()),
    ]);
    const group = await env.DB.prepare(`SELECT * FROM groups WHERE id = ?1`).bind(id).first();
    await startRound(env.DB, group);
    return json({ id, invite_code: code });
  }

  if (path === '/api/groups/join' && method === 'POST') {
    const user = await requireUser(request, env);
    const code = (body.code || '').trim().toUpperCase();
    const group = await env.DB.prepare(`SELECT * FROM groups WHERE invite_code = ?1`)
      .bind(code).first();
    if (!group) missing('no group with that code');
    await env.DB.prepare(
      `INSERT OR IGNORE INTO memberships (group_id, user_id, role, joined_at)
       VALUES (?1, ?2, 'member', ?3)`,
    ).bind(group.id, user.id, now()).run();
    return json({ id: group.id, name: group.name });
  }

  let m;

  // GET /api/groups/:id  — the whole client view, phase-gated.
  if ((m = path.match(/^\/api\/groups\/([\w-]+)$/)) && method === 'GET') {
    const user = await requireUser(request, env);
    const group = await requireMember(env, m[1], user.id);
    return json(await groupView(env, group, user));
  }

  // PUT /api/groups/:id/nickname — what you are called in this group only.
  // Any member, for themselves; empty falls back to your overall name.
  if ((m = path.match(/^\/api\/groups\/([\w-]+)\/nickname$/)) && method === 'PUT') {
    const user = await requireUser(request, env);
    const group = await requireMember(env, m[1], user.id);
    let name;
    try { name = cleanName(body.nickname); }
    catch (err) { bad(err.message); }

    const effective = name || globalName(user);
    const clash = await findNameConflict(env.DB, user.id, effective, group.id);
    if (clash) throw new HttpError(409, `Someone here already goes by "${clash}".`);

    await env.DB.prepare(
      `UPDATE memberships SET nickname = ?1 WHERE group_id = ?2 AND user_id = ?3`,
    ).bind(name || null, group.id, user.id).run();
    return json({ ok: true, nickname: name || null, username: effective });
  }

  // PUT /api/groups/:id/settings — owner only.
  if ((m = path.match(/^\/api\/groups\/([\w-]+)\/settings$/)) && method === 'PUT') {
    const user = await requireUser(request, env);
    const group = await requireMember(env, m[1], user.id);
    if (group.role !== 'owner') forbid('only the group owner can change settings');
    const fields = ['tz', 'open_dow', 'open_hour', 'close_dow', 'close_hour',
      'reveal_dow', 'reveal_hour', 'webhook_url'];
    const sets = [], vals = [];
    for (const f of fields) {
      if (body[f] !== undefined) { sets.push(`${f} = ?${sets.length + 1}`); vals.push(body[f]); }
    }
    if (!sets.length) bad('nothing to update');
    await env.DB.prepare(
      `UPDATE groups SET ${sets.join(', ')} WHERE id = ?${vals.length + 1}`,
    ).bind(...vals, group.id).run();
    return json({ ok: true });
  }

  // PUT /api/rounds/:id/submission — write or edit your entry (writing phase only).
  if ((m = path.match(/^\/api\/rounds\/([\w-]+)\/submission$/)) && method === 'PUT') {
    const user = await requireUser(request, env);
    const round = await env.DB.prepare(`SELECT * FROM rounds WHERE id = ?1`)
      .bind(m[1]).first();
    if (!round) missing('round not found');
    await requireMember(env, round.group_id, user.id);
    if (now() < round.opens_at) forbid('this week has not started yet');
    if (round.phase !== 'writing' || now() >= round.closes_at) {
      forbid('submissions are closed for this round');
    }
    const text = (body.body || '').trim();
    if (!text) bad('write something first');
    if (text.length > 100000) bad('that is longer than 100k characters');

    const existing = await env.DB.prepare(
      `SELECT id FROM submissions WHERE round_id = ?1 AND user_id = ?2`,
    ).bind(round.id, user.id).first();

    if (existing) {
      await env.DB.prepare(`UPDATE submissions SET body = ?1, updated_at = ?2 WHERE id = ?3`)
        .bind(text, now(), existing.id).run();
    } else {
      await env.DB.prepare(
        `INSERT INTO submissions (id, round_id, user_id, body, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?5)`,
      ).bind(uid(), round.id, user.id, text, now()).run();
    }
    return json({ ok: true });
  }

  // POST /api/rounds/:id/guesses — attribute entries (guessing phase only).
  if ((m = path.match(/^\/api\/rounds\/([\w-]+)\/guesses$/)) && method === 'POST') {
    const user = await requireUser(request, env);
    const round = await env.DB.prepare(`SELECT * FROM rounds WHERE id = ?1`).bind(m[1]).first();
    if (!round) missing('round not found');
    await requireMember(env, round.group_id, user.id);
    if (round.phase !== 'guessing') forbid('guessing is not open for this round');

    // Guessing your own entry is meaningless (and scores nothing), so drop
    // those rather than storing junk that later renders as a "wrong" guess.
    const ownRes = await env.DB.prepare(
      `SELECT id FROM submissions WHERE round_id = ?1 AND user_id = ?2`,
    ).bind(round.id, user.id).all();
    const own = new Set((ownRes.results || []).map((r) => r.id));

    const entries = Object.entries(body.guesses || {});
    const stmts = [];
    for (const [submissionId, guessedUserId] of entries) {
      if (!guessedUserId || own.has(submissionId)) continue;
      stmts.push(env.DB.prepare(
        `INSERT INTO guesses (round_id, guesser_id, submission_id, guessed_user_id, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(round_id, guesser_id, submission_id)
           DO UPDATE SET guessed_user_id = ?4`,
      ).bind(round.id, user.id, submissionId, guessedUserId, now()));
    }
    if (body.prompt_author) {
      stmts.push(env.DB.prepare(
        `INSERT INTO prompt_author_guesses (round_id, guesser_id, guessed_user_id, created_at)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(round_id, guesser_id) DO UPDATE SET guessed_user_id = ?3`,
      ).bind(round.id, user.id, body.prompt_author, now()));
    }
    if (stmts.length) await env.DB.batch(stmts);
    return json({ ok: true, saved: stmts.length });
  }

  // POST /api/groups/:id/prompts — add to the pool for future weeks.
  if ((m = path.match(/^\/api\/groups\/([\w-]+)\/prompts$/)) && method === 'POST') {
    const user = await requireUser(request, env);
    const group = await requireMember(env, m[1], user.id);
    const text = (body.text || '').trim();
    if (!text) bad('prompt text required');
    if (text.length > 500) bad('keep prompts under 500 characters');

    // One suggestion per person per week. Without this, one player can flood
    // the pool and skew the random draw toward their own prompts. The week is
    // the current round's window, so the allowance resets when it rolls over.
    const round = await currentRound(env.DB, group.id);
    if (round) {
      const existing = await env.DB.prepare(
        `SELECT text FROM prompts
          WHERE group_id = ?1 AND author_id = ?2 AND suggested_round_id = ?3
          ORDER BY created_at DESC LIMIT 1`,
      ).bind(group.id, user.id, round.id).first();
      if (existing) {
        throw new HttpError(409,
          'You already suggested a prompt this week ~ one each. Yours: '
          + `"${existing.text}"`);
      }
    }

    await env.DB.prepare(
      `INSERT INTO prompts
         (id, group_id, author_id, text, status, created_at, suggested_round_id)
       VALUES (?1, ?2, ?3, ?4, 'pending', ?5, ?6)`,
    ).bind(uid(), group.id, user.id, text, now(), round?.id ?? null).run();
    return json({ ok: true });
  }

  // GET /api/groups/:id/history — past rounds, fully revealed.
  if ((m = path.match(/^\/api\/groups\/([\w-]+)\/history$/)) && method === 'GET') {
    const user = await requireUser(request, env);
    const group = await requireMember(env, m[1], user.id);
    const rounds = await env.DB.prepare(
      `SELECT * FROM rounds WHERE group_id = ?1 AND phase = 'revealed'
        ORDER BY week_index DESC LIMIT 20`,
    ).bind(group.id).all();
    const out = [];
    for (const r of rounds.results || []) {
      // LEFT JOIN on memberships: someone who has since left the group still
      // wrote the entry, and their name should keep showing on it.
      const subs = await env.DB.prepare(
        `SELECT s.body, ${nameSql('name')} FROM submissions s
           JOIN users u ON u.id = s.user_id
           LEFT JOIN memberships m ON m.user_id = u.id AND m.group_id = ?2
          WHERE s.round_id = ?1`,
      ).bind(r.id, group.id).all();
      out.push({
        week_index: r.week_index,
        prompt: r.prompt_text,
        reveals_at: r.reveals_at,
        entries: (subs.results || []).map((s) => ({ author: s.name, body: s.body })),
      });
    }
    return json({ rounds: out });
  }

  // Dev-only time travel: force the round forward without waiting for Thursday.
  if ((m = path.match(/^\/api\/groups\/([\w-]+)\/advance$/)) && method === 'POST') {
    if (env.ALLOW_TIME_TRAVEL !== 'true') forbid('time travel is disabled');
    const user = await requireUser(request, env);
    const group = await requireMember(env, m[1], user.id);
    const round = await currentRound(env.DB, group.id);
    if (round && body.to) {
      // Rewrite deadlines into the past so the normal state machine does the work.
      const t = now() - 60;
      let cols;
      // 'writing' pushes the deadlines forward instead of back, so a round can
      // be put into the writing phase at any hour. Without it, anything run
      // after the Thursday cutoff starts mid-week and cannot submit.
      if (body.to === 'writing') {
        // opens_at must come back too: a group created mid-week is scheduled
        // for the next Monday, and a round that has not opened refuses writing.
        cols = `phase = 'writing', scored_at = NULL, opens_at = ${now() - 60}, `
             + `closes_at = ${now() + 7200}, reveals_at = ${now() + 14400}`;
      } else if (body.to === 'guessing') cols = `closes_at = ${t}`;
      else if (body.to === 'revealed') cols = `closes_at = ${t}, reveals_at = ${t}`;
      // 'next' also drags opens_at back exactly one week, so the round's next
      // open boundary is the one that already passed — the new week then gets
      // the real current schedule. Going back further would land the new round
      // on deadlines that are themselves in the past, cascading extra weeks.
      else cols = `closes_at = ${t}, reveals_at = ${t}, opens_at = ${round.opens_at - 7 * 86400}`;
      await env.DB.prepare(`UPDATE rounds SET ${cols} WHERE id = ?1`).bind(round.id).run();
    }
    const log = await advanceGroup(env, group);
    return json({ ok: true, log });
  }

  return json({ error: 'not found' }, 404);
}

/**
 * The single view the client renders from. This is where secrecy is enforced:
 * bodies are withheld during `writing`, and author identities during `guessing`.
 */
async function groupView(env, group, user) {
  const db = env.DB;
  await advanceGroup(env, group).catch(() => {});
  const round = await currentRound(db, group.id);

  const membersRes = await db.prepare(
    `SELECT u.*, ${nameSql('name')} FROM memberships m
       JOIN users u ON u.id = m.user_id WHERE m.group_id = ?1`,
  ).bind(group.id).all();
  const members = (membersRes.results || []).map(publicUser);

  const leaderboardRes = await db.prepare(
    `SELECT u.id, ${nameSql('name')}, COALESCE(SUM(rs.points), 0) AS total
       FROM memberships m
       JOIN users u ON u.id = m.user_id
       LEFT JOIN (
         SELECT rs.user_id, rs.points FROM round_scores rs
           JOIN rounds r ON r.id = rs.round_id WHERE r.group_id = ?1
       ) rs ON rs.user_id = m.user_id
      WHERE m.group_id = ?1
      GROUP BY u.id ORDER BY total DESC`,
  ).bind(group.id).all();

  const base = {
    group: {
      id: group.id, name: group.name, invite_code: group.invite_code,
      tz: group.tz, role: group.role, has_webhook: !!group.webhook_url,
      open_dow: group.open_dow, open_hour: group.open_hour,
      close_dow: group.close_dow, close_hour: group.close_hour,
      reveal_dow: group.reveal_dow, reveal_hour: group.reveal_hour,
    },
    // Your own entry in `members` already carries this group's nickname, so
    // take it from there rather than re-deriving it from the bare users row.
    me: {
      ...(members.find((mem) => mem.id === user.id) || publicUser(user)),
      nickname: group.nickname || null,
      display_name: user.display_name || null,
    },
    members,
    leaderboard: (leaderboardRes.results || []).map((r) => ({
      id: r.id, username: r.name, total: r.total,
    })),
    server_time: now(),
  };

  if (!round) return { ...base, round: null };

  const mySub = await db.prepare(
    `SELECT body, updated_at FROM submissions WHERE round_id = ?1 AND user_id = ?2`,
  ).bind(round.id, user.id).first();

  const counts = await db.prepare(
    `SELECT COUNT(*) AS n FROM submissions WHERE round_id = ?1`,
  ).bind(round.id).first();

  // The prompt this player suggested during the current week, if any.
  // Keyed on the round, not on a created_at window. A window anchored to
  // opens_at silently matched nothing for a round scheduled in the future,
  // so the app forgot your suggestion and let you add unlimited more.
  const mySuggestion = await db.prepare(
    `SELECT text FROM prompts
      WHERE group_id = ?1 AND author_id = ?2 AND suggested_round_id = ?3
      ORDER BY created_at DESC LIMIT 1`,
  ).bind(group.id, user.id, round.id).first();

  // Before a round opens there is nothing to show: withhold the prompt text
  // itself, not just the writing box.
  const notOpenYet = now() < round.opens_at;

  const r = {
    id: round.id,
    week_index: round.week_index,
    not_open_yet: notOpenYet,
    prompt: notOpenYet ? null : round.prompt_text,
    phase: round.phase,
    opens_at: round.opens_at,
    closes_at: round.closes_at,
    reveals_at: round.reveals_at,
    submission_count: counts?.n || 0,
    my_submission: mySub?.body || null,
    my_prompt_suggestion: mySuggestion?.text || null,
  };

  if (round.phase === 'writing') {
    // Deliberately no entries field — nothing to leak before the cutoff.
    return { ...base, round: r };
  }

  const entriesRes = await db.prepare(
    `SELECT id, user_id, body FROM submissions WHERE round_id = ?1 ORDER BY id`,
  ).bind(round.id).all();
  const entries = entriesRes.results || [];

  const myGuessesRes = await db.prepare(
    `SELECT submission_id, guessed_user_id FROM guesses
      WHERE round_id = ?1 AND guesser_id = ?2`,
  ).bind(round.id, user.id).all();
  const myGuesses = Object.fromEntries(
    (myGuessesRes.results || []).map((g) => [g.submission_id, g.guessed_user_id]),
  );
  const myPromptGuess = await db.prepare(
    `SELECT guessed_user_id FROM prompt_author_guesses WHERE round_id = ?1 AND guesser_id = ?2`,
  ).bind(round.id, user.id).first();

  if (round.phase === 'guessing') {
    return {
      ...base,
      round: {
        ...r,
        // author_id is withheld; `mine` only reveals your own entry to you.
        entries: entries.map((e) => ({
          id: e.id, body: e.body, mine: e.user_id === user.id,
        })),
        my_guesses: myGuesses,
        my_prompt_guess: myPromptGuess?.guessed_user_id || null,
        has_prompt_author: !!round.prompt_author_id,
      },
    };
  }

  // revealed
  const reveal = await revealPayload(db, group, round);
  const scoresRes = await db.prepare(
    `SELECT user_id, points, breakdown FROM round_scores WHERE round_id = ?1`,
  ).bind(round.id).all();
  const byUser = new Map(members.map((mem) => [mem.id, mem.username]));

  return {
    ...base,
    round: {
      ...r,
      entries: entries.map((e) => ({
        id: e.id,
        body: e.body,
        mine: e.user_id === user.id,
        author_id: e.user_id,
        author: byUser.get(e.user_id) || 'unknown',
        my_guess: myGuesses[e.id] || null,
        my_guess_correct: myGuesses[e.id] ? myGuesses[e.id] === e.user_id : null,
      })),
      prompt_author_id: round.prompt_author_id,
      prompt_author: reveal.promptAuthor,
      my_prompt_guess: myPromptGuess?.guessed_user_id || null,
      round_scores: (scoresRes.results || []).map((s) => ({
        user_id: s.user_id,
        username: byUser.get(s.user_id) || 'unknown',
        points: s.points,
        breakdown: JSON.parse(s.breakdown),
      })).sort((a, b) => b.points - a.points),
    },
  };
}

export default {
  async fetch(request, env, ctx) {
    const cors = corsHeaders(env, request);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      const res = await handle(request, env, ctx);
      const headers = new Headers(res.headers);
      for (const [k, v] of Object.entries(cors)) headers.set(k, v);
      return new Response(res.body, { status: res.status, headers });
    } catch (err) {
      const status = err.status || 500;
      if (status === 500) console.error('unhandled', err.stack || err);
      return json(
        { error: status === 500 ? 'internal error' : err.message },
        status,
        cors,
      );
    }
  },

  // Cron drives every phase transition and every Discord notification.
  async scheduled(event, env, ctx) {
    const groups = await env.DB.prepare(`SELECT * FROM groups`).all();
    for (const g of groups.results || []) {
      try {
        const log = await advanceGroup(env, g);
        if (log.length) console.log(`[${g.name}]`, log.join('; '));
      } catch (err) {
        console.error(`group ${g.id} failed:`, err.stack || err);
      }
    }
  },
};

export { SEED_PROMPTS };
