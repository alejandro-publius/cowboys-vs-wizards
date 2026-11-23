# Frontier kit

Code shared by Showdown and Boot Hill Poker. It imports neither game and has
no DOM, Node, network or rendering dependency.

## What is shared

One module: `paired-cohort.js`, the deterministic paired-duel cohort audit
(`measurePairedCohort`, `PairedCohortError`, `DRAW`, `MAX_DEALS`). It was
moved here unchanged from `src/review/paired-duel-kit.js`, which is now a
re-export so existing callers keep working.

| Game | Consumer | Import path |
| --- | --- | --- |
| Showdown | `scripts/field-trial-confirm.mjs`, `tests/game/field-trial-repair.test.js` | `src/review/paired-duel-kit.js` (re-export) |
| Boot Hill Poker | `scripts/verify-poker-kit.mjs` | `packages/frontier-kit/index.js` |

Both games share the audit only. There is no shared combat engine, renderer,
networking or WebSocket layer, and neither game's browser runtime imports
the kit yet.

## Runtime packaging

`scripts/stage-pages.mjs` copies five files of `experiments/boot-hill-poker/`
into `/poker/`, and `scripts/check-pages-tree.mjs` requires that import
graph to be exactly those files. A runtime import of this kit from Poker
would need both scripts to stage `packages/frontier-kit/` and a relative path
that resolves under the Pages project path. Showdown's pages are esbuild
bundles, so a runtime import there would be bundled without staging changes.

## Checks

`node --test tests/game/dec4-frontier-kit.test.js` checks the import
boundaries (including indirect imports), the re-export, the 500 mirrored
Poker seeds and the recorded Showdown Billy cohort through the kit.
