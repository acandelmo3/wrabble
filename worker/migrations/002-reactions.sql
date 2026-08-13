-- Wrobby reactions on revealed entries. Launch week 2.
--
-- schema.sql already carries this table, but it only runs against a fresh
-- database ~ the homelab container runs it on first boot only, and the live one
-- was created before this existed. Run this once against each:
--
--   npx wrangler d1 execute wrabble --local  --env dev --file=./migrations/002-reactions.sql
--   npx wrangler d1 execute wrabble --remote            --file=./migrations/002-reactions.sql
--
-- Unlike 001 this adds a table rather than columns, so it is genuinely
-- idempotent and re-running it is harmless.

CREATE TABLE IF NOT EXISTS reactions (
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  face          TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  PRIMARY KEY (submission_id, user_id, face)
);
CREATE INDEX IF NOT EXISTS idx_reactions_submission ON reactions(submission_id);
