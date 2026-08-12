# CLAUDE.md

## End every pass with a summary

After finishing a pass, close the reply with numbered bullets ~ at most 5, one
line each, no sub-bullets. Each names the primary file it changed as a clickable
relative link, plus `+N` when the pass touched N further files:

```
1. What changed and why, in one line: [file.js](path/to/file.js) +2
```

Pick the primary file by lines changed. Omit `+N` when only one file changed.

## Conventions

1. Resolve a displayed value in one module; route every query through it: [names.js](worker/src/names.js)
2. Enforce game-critical constraints at the API, not the UI: [index.js](worker/src/index.js)
3. `schema.sql` only creates missing tables ~ altering one needs a numbered migration: [001-custom-names.sql](worker/migrations/001-custom-names.sql)
4. Verify with unit tests, the full-week e2e, and the real UI driven locally: [names.test.js](worker/test/names.test.js)
5. Never deploy, push, or run `--remote` unasked; log player-facing changes: [PATCHNOTES.md](PATCHNOTES.md)
