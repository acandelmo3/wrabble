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

## Deployment target: homelab

- **Host**: Dell XPS 15 (i7-9750H, 6c/12t, 30GB RAM, Intel UHD 630 — no discrete GPU, no CUDA). Debian 13, headless (`multi-user.target`, no desktop installed).
- **Access**: SSH only, key-based, as user `homelab` over Tailscale at `100.107.144.35`. There is no LAN path worth relying on — see network constraints.
- **Network constraints**: apartment building wifi with no router access. The LAN hands out CGNAT addresses (`100.64.0.0/10`), likely has client isolation, and port forwarding is impossible. **Anything hosted here is reachable only over the tailnet** — no public URLs, no inbound from the internet, no Let's Encrypt HTTP-01 challenges. Tailscale runs with `--netfilter-mode=off` to avoid a range collision with the LAN; don't re-enable its netfilter management.
- **Containers**: Docker installed, user is in the `docker` group (no sudo needed). Global log caps are set in `/etc/docker/daemon.json` (10MB × 3) — keep new services within that pattern rather than logging unbounded.
- **Ports in use**: 53 (Pi-hole DNS), 8080 (Pi-hole admin), 11434 (Ollama, usually stopped), 8211 (Palworld). Pick something else.
- **Storage caveat**: the internal NVMe (Samsung PM9A1) has an unexplained spare-block depletion — 63% remaining against a 32% failure threshold at only ~3% write endurance used. It passes every health check but is not trusted. **Treat this machine as expendable**: no sole copies of anything, prefer external storage for bulk or write-heavy data, and assume it may need a rebuild.
- **Not suitable for**: GPU inference, anything needing public ingress, anything where the machine going down would be more than an inconvenience.
- **Reaching it**: `hlstatus` is `ssh homelab@100.107.144.35 /usr/local/bin/status` (a status script on the box) and `hlconnect` is `ssh homelab@100.107.144.35` — both defined in `~/.zshrc:19,24`, so they are zsh interactive aliases and do **not** exist in a non-interactive shell; run the full `ssh` command instead. Two things block this by default: the Bash sandbox has no route to the `utun` tailnet interface (needs sandbox disabled), and as of 2026-08-11 no TCP port on the box is reachable at all — 22, 8080, 11434, 8211 all time out and 53 answers neither UDP nor TCP, while `tailscale ping` still pongs via DERP relay `nyc` (~100ms, no direct connection). tailscaled answering its own pings while delivering no TCP is the expected shape of `--netfilter-mode=off`. Confirm the box actually accepts connections before assuming anything tailnet-hosted is reachable.

### How this lands on Wrabble

- The dev ports already chosen (5173 web, 8787 API, 8443 for TLS) don't collide with anything above.
- `tailscale serve` HTTPS is still fine despite the no-HTTP-01 note: Tailscale provisions `ts.net` certs through its own control plane, not an inbound challenge.
- The local D1 lives in `worker/.wrangler/` on that disk. It is disposable dev state ~ rebuildable from `schema.sql` plus the files in `worker/migrations/` ~ so the storage caveat costs nothing here. Keep it that way; never let it become the only copy of anything.
