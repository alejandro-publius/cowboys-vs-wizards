# Issue 143 slice 1 integration receipts

Kiro integration worker, branch `kiro/showdown-143-slice1`, 2026-11-19 PST (America/Los_Angeles). Local only.

- `browser-showdown-file.json`: `node scripts/browser-showdown-check.mjs dist/cowboys-vs-wizards-board-duel.html .artifacts/sd-file`, 12 of 12 checks, seed 0.
- `browser-showdown-web.json`: the same check on `dist/web/index.html`, 12 of 12.
- `browser-showdown-seed7.json`: the same check from an uncommitted temporary copy of the script with `?seed=0` replaced by `?seed=7` on the Showdown steps, 12 of 12. The opening hand differed from seed 0 (`cowboy-sheriff-8`, `cowboy-sheriff-4` playable against `cowboy-sheriff-3`, `cowboy-sheriff-8`).

All three ran on the built page with SHA-256 `2d60da31931c98123db0cb39e8b7637c31d734c80a0ebd2ae3e2ae2a4b84d6d6`, in headless Chrome with a new temporary profile. The clicker is a script. It says nothing about clarity or fun.
