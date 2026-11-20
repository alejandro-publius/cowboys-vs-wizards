# Final local integration: issue 143 slice 1 + PR 144 + onboarding layout

Kiro CLI worker (Claude Opus 5.5), branch `kiro/144-integrate`, 2026-11-19 20:47–20:51 PST (America/Los_Angeles). Local only.

Code under test: `6f2245a`. That commit is a cherry-pick of `f802687` (onboarding layout, `prototypes/showdown/style.css` only) onto `64c026e`. The commit after it changes only docs.

All results below come from this run. Full output is in [run-summary.txt](run-summary.txt).

| Check | Result |
| --- | --- |
| `npm test` | 516 pass, 0 fail. GLB structure checks 2 of 2 |
| `node --test prototypes/showdown/*.test.js` | 53 pass, 0 fail |
| `node scripts/build-graybox.mjs` and `--web` | Both builds are byte-identical, sha256 `2d60da31…d6d6`, unchanged from `64c026e` |
| `node prototypes/showdown/build.mjs` | `dist/showdown.html` sha256 `871ff32f…dd2f` |
| PR 144 Chrome checks on that build | access 34 ok, onboarding 31 ok, hotseat 47 ok, savecode 27 ok, bo3 47 checks, campaign 55 ok. All exit 0 |
| `scripts/browser-showdown-check.mjs`, offline and web | 12 of 12 each: Boot Hill opens from Play and is won by clicks (seed 0), plus the `?mode=lanes` and `?mode=match` fallbacks |
| Rules static diff against `735cb09` and `6819557` | `rules.js` and `contract.js` are identical. `cards.js` differs only in its import path |
| Bot trace (seeds 0–49, Wizard levels 0/1/1.5/2 vs Cowboy level 2, 80-turn cap) | Same sha256 `917609b9…8bdd` on the 735cb09 prototype, on HEAD `src/game/showdown` and on the HEAD shim. 2,570 turns, 150 Cowboy and 50 Wizard wins |
| Scout look-ahead oracle (seeds 0–19, level 2, 40-turn cap) | 474 comparisons, 78 with a Scout in hand, 16 plans changed, 0 changed without a Scout. The hash is the same on all three trees, so the shipped limitation is unchanged |

The six PR 144 browser check scripts, `main.js` and `index.html` are byte-identical to `6819557`. The trace script was temporary and has been deleted. These are automated checks on one machine and do not replace a human playtest.
