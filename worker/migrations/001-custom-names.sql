-- Custom names, overall and per group. Launch week 1.
--
-- schema.sql is CREATE TABLE IF NOT EXISTS throughout, so it does nothing to a
-- database that already has these tables. Run this once against the live one:
--
--   npx wrangler d1 execute wrabble --remote --file=./migrations/001-custom-names.sql
--
-- Both columns are nullable with no default, so every existing row keeps
-- falling back to the Discord name until its owner picks something.

ALTER TABLE users ADD COLUMN display_name TEXT;
ALTER TABLE memberships ADD COLUMN nickname TEXT;
