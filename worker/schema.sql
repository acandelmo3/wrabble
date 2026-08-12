-- Wrabble — D1 schema
-- Apply with: wrangler d1 execute wrabble --file=./schema.sql

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,            -- discord user id
  username     TEXT NOT NULL,               -- from discord, overwritten on login
  global_name  TEXT,                        -- from discord, overwritten on login
  display_name TEXT,                        -- chosen here; wins over both, all groups
  avatar       TEXT,
  created_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS groups (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  invite_code   TEXT NOT NULL UNIQUE,
  owner_id      TEXT NOT NULL REFERENCES users(id),
  tz            TEXT NOT NULL DEFAULT 'America/New_York',
  -- 0=Sunday .. 6=Saturday, hour is 0-23 local wall clock
  open_dow      INTEGER NOT NULL DEFAULT 1,   -- Monday: new prompt drops
  open_hour     INTEGER NOT NULL DEFAULT 9,
  close_dow     INTEGER NOT NULL DEFAULT 4,   -- Thursday: writing closes, guessing opens
  close_hour    INTEGER NOT NULL DEFAULT 20,
  reveal_dow    INTEGER NOT NULL DEFAULT 0,   -- Sunday: results revealed
  reveal_hour   INTEGER NOT NULL DEFAULT 21,
  webhook_url   TEXT,
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS memberships (
  group_id   TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'member',  -- 'owner' | 'member'
  nickname   TEXT,                            -- chosen here; wins in this group only
  joined_at  INTEGER NOT NULL,
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id);

-- Pool of prompts suggested by players. The next round draws from here at random.
CREATE TABLE IF NOT EXISTS prompts (
  id            TEXT PRIMARY KEY,
  group_id      TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  author_id     TEXT REFERENCES users(id),     -- NULL for seeded/system prompts
  text          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'used'
  used_round_id TEXT,          -- the round this prompt was later drawn for
  suggested_round_id TEXT,     -- the round during which it was suggested
  created_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_prompts_pool ON prompts(group_id, status);

CREATE TABLE IF NOT EXISTS rounds (
  id               TEXT PRIMARY KEY,
  group_id         TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  week_index       INTEGER NOT NULL,
  prompt_id        TEXT REFERENCES prompts(id),
  prompt_text      TEXT NOT NULL,
  prompt_author_id TEXT REFERENCES users(id),  -- hidden until reveal
  phase            TEXT NOT NULL DEFAULT 'writing', -- writing | guessing | revealed
  opens_at         INTEGER NOT NULL,
  closes_at        INTEGER NOT NULL,
  reveals_at       INTEGER NOT NULL,
  scored_at        INTEGER
);
CREATE INDEX IF NOT EXISTS idx_rounds_group ON rounds(group_id, week_index DESC);
CREATE INDEX IF NOT EXISTS idx_rounds_phase ON rounds(phase);

CREATE TABLE IF NOT EXISTS submissions (
  id          TEXT PRIMARY KEY,
  round_id    TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  UNIQUE (round_id, user_id)
);

-- One row per (guesser, submission) pair.
CREATE TABLE IF NOT EXISTS guesses (
  round_id        TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  guesser_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  submission_id   TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  guessed_user_id TEXT NOT NULL REFERENCES users(id),
  created_at      INTEGER NOT NULL,
  PRIMARY KEY (round_id, guesser_id, submission_id)
);

-- Bonus round: who wrote this week's prompt?
CREATE TABLE IF NOT EXISTS prompt_author_guesses (
  round_id        TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  guesser_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  guessed_user_id TEXT NOT NULL REFERENCES users(id),
  created_at      INTEGER NOT NULL,
  PRIMARY KEY (round_id, guesser_id)
);

-- Materialized once at reveal time so the leaderboard is a cheap SUM().
CREATE TABLE IF NOT EXISTS round_scores (
  round_id   TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points     INTEGER NOT NULL,
  breakdown  TEXT NOT NULL,  -- JSON
  PRIMARY KEY (round_id, user_id)
);

-- Idempotency guard so cron retries never double-post to Discord.
CREATE TABLE IF NOT EXISTS notifications (
  round_id  TEXT NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  kind      TEXT NOT NULL,  -- opened | closing_soon | guessing | revealed
  sent_at   INTEGER NOT NULL,
  PRIMARY KEY (round_id, kind)
);
