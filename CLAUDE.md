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

- **Host**: Dell XPS 15 (i7-9750H, 30GB RAM, no GPU/CUDA), Debian 13 headless, Docker with log caps in `/etc/docker/daemon.json`; treat as expendable — the NVMe has unexplained spare-block depletion, so no sole copies of anything.
- **Reach it over IPv6, never `100.107.144.35`**: the apartment LAN also uses `100.64.0.0/10`, so the Mac routes that IPv4 out wifi and every port times out while `tailscale ping` still pongs — use `ssh homelab`, which `~/.ssh/config:9` maps to `fd7a:115c:a1e0::bc01:90d2`. Reachable from tooling, not just an interactive shell: only the `hlstatus`/`hlconnect` aliases at `~/.zshrc:19,24` are zsh-only, and they are wrappers around that same host entry.
- **Not the firewall, and leave Tailscale SSH off**: nftables `INPUT` is `accept` and sshd listens on `0.0.0.0:22`, while `tailscale set --ssh` makes tailscaled answer port 22 and stall unless the tailnet ACL grants SSH.
- **Tailnet-only**: no public ingress, no port forwarding, no Let's Encrypt HTTP-01 (`tailscale serve` certs are fine); 53, 8080, 11434 and 8211 are taken, so Wrabble's 5173/8787/8443 are clear.
