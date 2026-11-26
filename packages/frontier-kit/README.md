# Frontier kit

Code shared by Showdown and Boot Hill Poker. It imports neither game and has
no DOM, Node, network or rendering dependency.

## What is shared

Two modules.

`paired-cohort.js` is the deterministic paired-duel cohort audit
(`measurePairedCohort`, `PairedCohortError`, `DRAW`, `MAX_DEALS`). It was
moved here unchanged from `src/review/paired-duel-kit.js`, which is now a
re-export so existing callers keep working. `index.js` exports this module
and nothing else.

| Game | Consumer | Import path |
| --- | --- | --- |
| Showdown | `scripts/field-trial-confirm.mjs`, `tests/game/field-trial-repair.test.js` | `src/review/paired-duel-kit.js` (re-export) |
| Boot Hill Poker | `scripts/verify-poker-kit.mjs` | `packages/frontier-kit/index.js` |

## Seeded deals in both games

Showdown and Boot Hill Poker call the same `mulberry32` implementation. The package exposes it from `packages/frontier-kit/seeded-rng.js`. The dependency-free source lives in `src/game/frontier-kit/seeded-rng.js` so archived `src/game` snapshots include every input needed to reproduce a Showdown deal.

| Consumer | Call site | Seed handling |
| --- | --- | --- |
| Showdown, including the illustrated and reference builds | `random(seed)` in `src/game/showdown/rules.js` | Coerce to uint32 using `seed >>> 0`. |
| Boot Hill Poker, in the browser and terminal | `createRng(seed)` in `experiments/boot-hill-poker/engine.js` | Use Poker’s existing numeric and decimal seed parsing, or FNV-1a for other text. |

Each call creates an independent stream of numbers in [0, 1). The package entry for the paired audit stays at `index.js`. Each game owns its rules, shuffling order, rendering and input.

## Browser packaging

The Showdown pages bundle the generator. Poker’s import map resolves the public package import to `./frontier-kit/seeded-rng.js` within its own URL. Staging copies the implementation into that location as a regular file. On a source checkout the same relative path is a symbolic link, so the existing single-folder HTTP server still works. For a checkout with symbolic links disabled, serve the output of `node scripts/stage-pages.mjs` from `dist/web`.

## Checks

- `node --test tests/game/frontier-kit-seeded-rng.test.js tests/game/dec4-frontier-kit.test.js` checks the real entry points, an independent BigInt oracle across 4,096 seeds, old deals, 120 Showdown duel outcomes, and 1,000 mirrored Poker outcomes. The recorded inputs predate the move to the shared generator.
- `node scripts/check-pages-tree.mjs --browser` checks the staged module graph, follows the saloon link, and compares Poker’s shuffled deck and dealt state against Node for numeric and text seeds. Stage with a commit identity before running it.
- To compare Showdown before and after a build change, record complete public duels with `scripts/referee/browser-transcripts.mjs --source public` on the original commit, then run `scripts/referee/browser.mjs --cohort --transcripts <file>` on the staged page.
