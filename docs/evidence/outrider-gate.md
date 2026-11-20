# K-011 Outrider gate: evidence (gate worker)

Author: Kiro CLI gate worker, session `sess_2109871e-40e2-4ed2-9f65-901526fa8cee`, branch `kiro/showdown-ride-gate`
(base bf510f3), 2026-11-20 PST. Local only, not pushed. Spec: [`.kiro/specs/outrider-gate/`](../../.kiro/specs/outrider-gate/requirements.md).
No rule, card, deck, reward or save change. No human play. Fable decides whether any case becomes advice or a bounty;
the search worker reports its cue as unsupported, so nothing here is advice.

## Dependency
`experiments/showdown-outrider/decision/` imported byte-identical from the search worker's data commit
`6ab88990a5536040594286f5f2d9d840a526f474` (`../cases-ready.json`), committed separately as 49c4823.
The gate reads `replay.json`, `results/observed.json` and `decision.js` `policy` (the layout in `../contract.json`).
It does not run the search worker's checker: it replays each arm with its own `playArm` through `createShowdownSession`.

## Results (all actually run in this session)

| Check | Result |
| --- | --- |
| `node scripts/outrider-gate.mjs --check` on the 10 imported cases | 10 fresh, 0 stale (both arms match winner and final turn in `observed.json`, and the receipt's transcripts) |
| `node --test tests/match/showdown-outrider-gate.test.js` | 9/9 pass |
| Showdown suites (`tests/match/showdown-*`, `tests/game/showdown-*`, `prototypes/showdown/{rules,contract}.test.js`, `decision.test.js`) | 155/155 pass |
| Clean detached worktree at c4e9723: `--check`, `npm run build` (build `c4e97235fab9`, "Outrider gate: 10 verified") | pass |
| Same clean build: `browser-showdown-outrider-check.mjs` (headless Chrome, fresh profile) | 85 checks pass |
| Same clean build: `browser-showdown-check.mjs` 22 checks, `browser-showdown-turn-check.mjs` 29 checks | pass (existing game unchanged) |
| No-case build (before import): Outrider check | 4 checks pass: no control, `?outrider=` opens the menu, save intact |
| Fixture page (`--outrider-fixture`, `.artifacts/` only) | 20 checks pass |

Browser check per case: Camp control → landing with neutral lesson, no Wizard hand card and no seed in the page; the Base
and a troop are both offered once the Outrider is picked; ride arm, Restart, fight arm, play out with End turn, Retry,
Back to camp (focus returns to the control); direct `?outrider=<id>` and reload; four ids outside the list open the menu;
375 px Camp fits; saved career byte-identical throughout. It does not judge outcomes (the browser plays End turn, not the
policy); the Node replay does.

Built page: grep of the clean HTML found no `ride-only`, `fight-only`, `riderHealth` or `"winner":"cowboy"`. The page holds
each verified case's id, Trail position, seed, Cowboy prefix and turn (same exposure as the Dragon turns' seeds); the seed
never reaches the view or the DOM.

## Mutation and control (clean worktree, then discarded)
- Gameplay mutation: `rules.js` ride strike past troops 1 → 2 orbs. `--write` refused (`refused: case-j: ride: replayed
  {"winner":"cowboy","turn":11} but measured {"winner":"wizard","turn":20}`, and the rest). Receipt source hashes then
  refreshed to the mutated files: `--check` still 0 fresh, 10 stale, exit 1. Build: "Outrider gate: withheld stale".
  Browser check on that build: no Outrider control, menu for bad ids, save intact (5 checks).
- Unrelated edit: a `rules.js` comment and a new export in the lane-only `src/game/clash.js` (both change source
  hashes): `--check` 10 fresh; build "10 verified".
- The same pair runs in a disposable `src/` copy in the unit tests on the fixture.

## Native hook (G7)
`.kiro/hooks/check-outrider-gate.json` (PostFileSave, engine/session/decision/receipt paths) →
`scripts/check-outrider-gate-hook.mjs`. Receipts: [`outrider-gate/hook-receipts.jsonl`](outrider-gate/hook-receipts.jsonl)
(copied from ignored `.artifacts/outrider-gate-hook/receipts.jsonl`, output trimmed to the last line). Each carries this
session's id and `hook_event_name: "PostFileSave"`; a manual run of the wrapper would have neither.
- Trigger, fail: a save of `src/match/showdown-outrider.js` mid-edit (duplicate export) failed; the next save passed.
- Trigger, stale claim: a probe receipt naming a case with no decision files failed; removed afterwards.
- Trigger, gameplay mutation: saving the ride-strike mutation in `rules.js` → failed, "0 fresh, 10 stale"; the revert
  save → passed. A first attempt with two saves in quick succession produced two passing receipts with the same
  timestamp: the hook ran after the revert, so it missed the mutated state. Recorded, not counted as a proof.
- Trigger, unrelated: a comment-only `rules.js` save → passed, "10 fresh".
- Skip: saves of the three spec Markdown files and other non-matching files produced no receipt.
- Not shown: Kiro IDE behaviour (no IDE run), and whether a non-zero hook exit is surfaced to a user.
- `node scripts/outrider-gate.mjs --check` run from a shell is the manual path and leaves no receipt.

## Not done or pending
- The Sheriff's Ledger payload and hook are unchanged; this gate is a separate check modelled on its `--check`.
- X-041 SpecGuard README and videos 55 and 24 were not read in this session.
- `docs/kiro-build-log.md` not edited (coordinator owns it); `../gate.md` carries the entry.
- `npm test` (lane `verify-duel.mjs`) not run: no lane file changed.
