# CLAUDE.md

## Conventions established in the custom-names pass

1. Resolve a displayed value in exactly one module and route every query through it, rather than letting each call site pick its own fallback chain.
2. Enforce constraints the game depends on (names unique per group, case-insensitive, no invisible or bidi characters) at the API, not just in the UI.
3. `schema.sql` only creates missing tables, so any change to an existing table needs a numbered file in `worker/migrations/` applied once against the live D1.
4. Verify with all three: `npm test` for rules, `npm run test:e2e` for a full week, and the real UI driven locally for anything a player touches.
5. Never deploy, push, or run `--remote` without being asked; record player-facing changes in `PATCHNOTES.md` and new strings in `COPY.md`.
