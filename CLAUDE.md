# CLAUDE.md

## Conventions

1. Resolve a displayed value in one module; route every query through it: [names.js](worker/src/names.js) +2
2. Enforce game-critical constraints at the API, not the UI: [index.js](worker/src/index.js) +1
3. `schema.sql` only creates missing tables ~ altering one needs a numbered migration: [001-custom-names.sql](worker/migrations/001-custom-names.sql) +1
4. Verify with unit tests, the full-week e2e, and the real UI driven locally: [names.test.js](worker/test/names.test.js)
5. Never deploy, push, or run `--remote` unasked; log player-facing changes: [PATCHNOTES.md](PATCHNOTES.md) +2
