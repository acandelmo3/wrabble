// The weekly state machine: writing -> guessing -> revealed -> (next round).
//
// Driven entirely by wall-clock deadlines stored on the round, so a cron miss
// or a retry is harmless: advance() is idempotent and just re-checks the clock.

import { roundSchedule, lastOccurrence, nextOccurrence } from './time.js';
import { scoreRound } from './scoring.js';
import * as discord from './discord.js';

export const SEED_PROMPTS = [
  'Describe a place you can no longer go back to.',
  'What is the worst advice you ever followed?',
  'Write about a stranger you still think about.',
  'The most embarrassing thing you did before age 12.',
  'Something you believed for far too long.',
  'Describe your ideal Tuesday, hour by hour.',
  'A meal that meant more than the food.',
  'What would your 10-year-old self be disappointed by?',
  'The last time you were genuinely surprised.',
  'Write an apology you never sent.',
];

export const uid = () => crypto.randomUUID().replace(/-/g, '').slice(0, 16);

/** Pull a random pending prompt from the group's pool, else fall back to seeds. */
async function drawPrompt(db, groupId) {
  const pool = await db.prepare(
    `SELECT id, text, author_id FROM prompts
      WHERE group_id = ?1 AND status = 'pending'
      ORDER BY RANDOM() LIMIT 1`,
  ).bind(groupId).first();

  if (pool) return pool;

  // Empty pool: seed one so the game never stalls. No author, no bonus round.
  const used = await db.prepare(
    `SELECT text FROM prompts WHERE group_id = ?1 AND author_id IS NULL`,
  ).bind(groupId).all();
  const seen = new Set((used.results || []).map((r) => r.text));
  const fresh = SEED_PROMPTS.filter((p) => !seen.has(p));
  const text = (fresh.length ? fresh : SEED_PROMPTS)[
    Math.floor(Math.random() * (fresh.length || SEED_PROMPTS.length))
  ];

  const id = uid();
  await db.prepare(
    `INSERT INTO prompts (id, group_id, author_id, text, status, created_at)
     VALUES (?1, ?2, NULL, ?3, 'pending', ?4)`,
  ).bind(id, groupId, text, now()).run();
  return { id, text, author_id: null };
}

export const now = () => Math.floor(Date.now() / 1000);

/** Create the next round for a group. `openEpoch` defaults to the last open boundary. */
export async function startRound(db, group, openEpoch) {
  let opensAt = openEpoch ?? lastOccurrence(now(), group.open_dow, group.open_hour, group.tz);
  let sched = roundSchedule(opensAt, group);

  // A group created after this week's cutoff (say, a Friday) would otherwise
  // open a round that is already past its own deadline: nobody could write, and
  // the group would sit in an empty guessing phase until Sunday. Start such a
  // group on the next opening instead. Only applies when we picked the anchor
  // ourselves — an explicit openEpoch comes from rollover and is already right.
  if (openEpoch === undefined && sched.closes_at <= now()) {
    opensAt = nextOccurrence(now(), group.open_dow, group.open_hour, group.tz);
    sched = roundSchedule(opensAt, group);
  }

  const prompt = await drawPrompt(db, group.id);

  const last = await db.prepare(
    `SELECT MAX(week_index) AS n FROM rounds WHERE group_id = ?1`,
  ).bind(group.id).first();

  const id = uid();
  await db.batch([
    db.prepare(
      `INSERT INTO rounds
         (id, group_id, week_index, prompt_id, prompt_text, prompt_author_id,
          phase, opens_at, closes_at, reveals_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'writing', ?7, ?8, ?9)`,
    ).bind(
      id, group.id, (last?.n || 0) + 1, prompt.id, prompt.text, prompt.author_id,
      sched.opens_at, sched.closes_at, sched.reveals_at,
    ),
    db.prepare(
      `UPDATE prompts SET status = 'used', used_round_id = ?1 WHERE id = ?2`,
    ).bind(id, prompt.id),
  ]);

  return db.prepare(`SELECT * FROM rounds WHERE id = ?1`).bind(id).first();
}

export async function currentRound(db, groupId) {
  return db.prepare(
    `SELECT * FROM rounds WHERE group_id = ?1 ORDER BY week_index DESC LIMIT 1`,
  ).bind(groupId).first();
}

async function alreadySent(db, roundId, kind) {
  const row = await db.prepare(
    `SELECT 1 AS x FROM notifications WHERE round_id = ?1 AND kind = ?2`,
  ).bind(roundId, kind).first();
  return !!row;
}

async function markSent(db, roundId, kind) {
  await db.prepare(
    `INSERT OR IGNORE INTO notifications (round_id, kind, sent_at) VALUES (?1, ?2, ?3)`,
  ).bind(roundId, kind, now()).run();
}

/**
 * Advance one group as far as the clock allows, firing Discord notifications
 * for each transition it crosses. Safe to call repeatedly.
 */
export async function advanceGroup(env, group) {
  const db = env.DB;
  const t = now();
  const log = [];
  let round = await currentRound(db, group.id);

  if (!round) {
    round = await startRound(db, group);
    log.push(`started week ${round.week_index}`);
  }

  // writing -> guessing
  if (round.phase === 'writing' && t >= round.closes_at) {
    await db.prepare(`UPDATE rounds SET phase = 'guessing' WHERE id = ?1`)
      .bind(round.id).run();
    round.phase = 'guessing';
    log.push(`week ${round.week_index} -> guessing`);
  }

  // guessing -> revealed (scores get materialized here)
  if (round.phase === 'guessing' && t >= round.reveals_at) {
    await finalizeRound(db, group, round);
    round.phase = 'revealed';
    log.push(`week ${round.week_index} -> revealed`);
  }

  // Notify for THIS round before considering rollover. If a single pass both
  // reveals a round and rolls into the next week — a delayed cron, or a group
  // catching up after downtime — the results post would otherwise be dropped
  // on the floor, because only the round we ended on would get notified.
  await sendNotifications(env, group, round, t, log);

  // A revealed round whose next open boundary has passed rolls into a new week.
  if (round.phase === 'revealed') {
    const nextOpen = nextOccurrence(round.opens_at, group.open_dow, group.open_hour, group.tz);
    if (t >= nextOpen) {
      round = await startRound(db, group, nextOpen);
      log.push(`started week ${round.week_index}`);
      await sendNotifications(env, group, round, t, log);
    }
  }

  return log;
}

async function sendNotifications(env, group, round, t, log) {
  const app = env.APP_BASE_URL;
  const db = env.DB;

  const fire = async (kind, fn) => {
    if (await alreadySent(db, round.id, kind)) return;
    const res = await fn();
    // Only latch on success, so a transient Discord failure retries next tick.
    if (res && res.error) { log.push(`notify ${kind} failed: ${res.error}`); return; }
    await markSent(db, round.id, kind);
    log.push(`notified ${kind}`);
  };

  if (round.phase === 'writing' && t >= round.opens_at) {
    await fire('opened', () => discord.notifyOpened(group, round, app));

    // Nudge in the final 24h, naming whoever still owes an entry.
    if (t >= round.closes_at - 86400) {
      await fire('closing_soon', async () => {
        const missing = await db.prepare(
          `SELECT u.id, u.username FROM memberships m
             JOIN users u ON u.id = m.user_id
            WHERE m.group_id = ?1
              AND u.id NOT IN (SELECT user_id FROM submissions WHERE round_id = ?2)`,
        ).bind(group.id, round.id).all();
        return discord.notifyClosingSoon(group, round, app, missing.results || []);
      });
    }
  }

  if (round.phase === 'guessing') {
    await fire('guessing', async () => {
      const c = await db.prepare(
        `SELECT COUNT(*) AS n FROM submissions WHERE round_id = ?1`,
      ).bind(round.id).first();
      return discord.notifyGuessing(group, round, app, c?.n || 0);
    });
  }

  if (round.phase === 'revealed') {
    await fire('revealed', async () => {
      const payload = await revealPayload(db, group, round);
      return discord.notifyRevealed(group, round, app, payload);
    });
  }
}

/** Compute + persist scores for a round, then flip it to revealed. */
export async function finalizeRound(db, group, round) {
  const [subs, guesses, pGuesses, members] = await Promise.all([
    db.prepare(`SELECT id, user_id FROM submissions WHERE round_id = ?1`).bind(round.id).all(),
    db.prepare(
      `SELECT guesser_id, submission_id, guessed_user_id FROM guesses WHERE round_id = ?1`,
    ).bind(round.id).all(),
    db.prepare(
      `SELECT guesser_id, guessed_user_id FROM prompt_author_guesses WHERE round_id = ?1`,
    ).bind(round.id).all(),
    db.prepare(`SELECT user_id FROM memberships WHERE group_id = ?1`).bind(group.id).all(),
  ]);

  const scores = scoreRound({
    submissions: subs.results || [],
    guesses: guesses.results || [],
    promptGuesses: pGuesses.results || [],
    promptAuthorId: round.prompt_author_id,
    memberIds: (members.results || []).map((m) => m.user_id),
  });

  const stmts = scores.map((s) => db.prepare(
    `INSERT INTO round_scores (round_id, user_id, points, breakdown)
     VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT(round_id, user_id) DO UPDATE SET points = ?3, breakdown = ?4`,
  ).bind(round.id, s.user_id, s.points, JSON.stringify(s.breakdown)));

  stmts.push(db.prepare(
    `UPDATE rounds SET phase = 'revealed', scored_at = ?1 WHERE id = ?2`,
  ).bind(now(), round.id));

  await db.batch(stmts);
}

/** Per-author accuracy + standings, shared by the API and the Discord embed. */
export async function revealPayload(db, group, round) {
  const results = await db.prepare(
    `SELECT u.username AS author,
            COUNT(g.guesser_id) AS attempts,
            SUM(CASE WHEN g.guessed_user_id = s.user_id THEN 1 ELSE 0 END) AS correct
       FROM submissions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN guesses g
         ON g.submission_id = s.id AND g.guesser_id != s.user_id
      WHERE s.round_id = ?1
      GROUP BY s.id
      ORDER BY correct ASC`,
  ).bind(round.id).all();

  const leaderboard = await db.prepare(
    `SELECT u.username AS name,
            COALESCE(SUM(rs.points), 0) AS total,
            COALESCE(SUM(CASE WHEN rs.round_id = ?2 THEN rs.points ELSE 0 END), 0) AS round_points
       FROM memberships m
       JOIN users u ON u.id = m.user_id
       -- Scope scores to THIS group before aggregating; a plain LEFT JOIN on
       -- round_scores would fold in points the user earned in other groups.
       LEFT JOIN (
         SELECT rs.user_id, rs.points, rs.round_id
           FROM round_scores rs
           JOIN rounds r ON r.id = rs.round_id
          WHERE r.group_id = ?1
       ) rs ON rs.user_id = m.user_id
      WHERE m.group_id = ?1
      GROUP BY u.id
      ORDER BY total DESC`,
  ).bind(group.id, round.id).all();

  let promptAuthor = null;
  if (round.prompt_author_id) {
    const a = await db.prepare(`SELECT username FROM users WHERE id = ?1`)
      .bind(round.prompt_author_id).first();
    promptAuthor = a?.username || null;
  }

  return {
    results: results.results || [],
    leaderboard: leaderboard.results || [],
    promptAuthor,
  };
}
