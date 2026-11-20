# Issue 143 slice 1 on the PR 144 base

Kiro CLI integration worker, local branch `kiro/144-integrate`, 2026-11-19 20:38 PST (America/Los_Angeles). Local only, not pushed.

Base: PR 144 head `6819557` (on main `735cb09`). Cherry-picked only `9686810` (engine move), `54b78ab` (graybox screen) and `40d1b8c` (integration fixes). The pilot kit (`afec255`), 3D starter kit (`163383d`) and save-migration experiment (`0d1a02a`) are not on this branch. All three picks applied without conflicts.

- `browser-showdown-file.json`: `node scripts/browser-showdown-check.mjs dist/cowboys-vs-wizards-board-duel.html .artifacts/int144-file`, 12 of 12, seed 0.
- `browser-showdown-web.json`: the same check on `dist/web/index.html`, 12 of 12.

Both built pages hash to SHA-256 `2d60da31931c98123db0cb39e8b7637c31d734c80a0ebd2ae3e2ae2a4b84d6d6`, the same as the `40d1b8c` receipts. Each run used headless Chrome with a new temporary profile and loaded the page from `file://`. The clicks come from a script, so these receipts say nothing about clarity or fun.

Static rules check: `src/game/showdown/rules.js` and `contract.js` are byte-identical to `735cb09:prototypes/showdown/`. `cards.js` differs only in its `card-specs.generated.js` import path. The bot (`planTurn`) and all rules are unchanged.
