# Trap selection seam (issue #106)

Date: 2026-11-17 (America/Los_Angeles). Worker: Kiro (single worker; the coordinator launched it with `--model claude-opus-5.5`; this session did not emit client, model or credit metadata beyond that). Base: main `dfade1a` (after #105). Branch: `kiro/trap-selection-106`, one local commit, not pushed.

## Problem

The controller bridge (#105) could submit a fixture `set-trap`, but `selection.js` called `legalActions` with the shipped `CARDS`. With the test-only fixture trap in hand, `controller.options()` threw (`cards[cardId].kind` on an unknown ID), and there was no click path to set a trap.

## Change

- `src/match/selection.js`: `selectionStep(..., { cards = CARDS })` and `selectionOptions(current, view, { cards = CARDS })`. The catalog is passed to `legalActions`, which stays the only authority. New trap path: `card -> confirm -> set-trap`; confirm commits the single matching legal entry plus `actionId`, cancel returns to idle. The prompt names only the viewer's own card. Blocked trap texts follow contract section 3 order (`Traps are not in this match.`, too late, zone full, after spell); summon and spell gain the `tactical === "trap"` texts, which exist only on trap matches. A viewer hand card missing from the catalog throws `TypeError: Card <id> is in the hand but not in the card catalog` instead of an anonymous lookup error. Only the viewer's own hand is looked up.
- `src/match/controller.js`: optional `cards = CARDS` in `createController`, passed to `selectionStep` and `selectionOptions`. A catalog that changes or drops any `CARDS` entry is refused at construction. `src/main.js` passes nothing, so production uses `CARDS` as before. No change to onChange, scheduler, Presenter, renderer, engine or `publicEvents`.
- `tests/match/trap-selection.test.js` (new, 7 tests). Fixture IDs exist only in this file.

No `CARDS`, deck, seed, renderer, CSS, asset, UI, CI, package or entry-point change. No engine mechanic change.

## Tests (seeds 0 and 60, Node 26.0.0)

| Test | Covers |
|---|---|
| default and injected catalog give identical selections and options at every CPU-vs-CPU position | flag-off selection parity |
| injected-catalog controller replays exactly like the default controller (all onChange snapshots incl. `options()`, and all renderer calls) | flag-off replay parity |
| `options()` with the fixture in hand; `input({type:'card'})` -> confirm; slot click refused; cancel; card toggle; confirm applies exactly one `set-trap` equal to the single legal entry, with `action-N` actionId | click path |
| full match through the click path; own trap triggers in a later round than its set round; enemy trap ID absent from every snapshot (status, view, displayed, message, selection, options/prompts) while set, present only after it springs | next-round arming, redaction |
| set before summon blocks summon and spell; stale confirm refused; summon then set legal; spell then set refused (seed 60 only: seed 0's first Cowboy phase has no legal spell); second trap refused while the zone is full | shared allowance, summon-first, one zone |
| round 9 refuses a set (absent from legalActions and playable cards); flag-off match refuses the fixture with a readable text; an unknown enemy-hand ID is never looked up | round 9, graceful refusal, no enemy lookup |
| default catalog with fixture in hand: `options()` throws the descriptive TypeError; changed, empty or null catalog refused | invalid catalog, real errors not masked |

## Commands and results

- `node --test tests/match/trap-selection.test.js`: 7 tests, 7 pass.
- `node --test tests/match/selection.test.js tests/match/controller.test.js tests/match/trap-controller.test.js`: 22 tests, 22 pass.
- `npm test` (`scripts/verify-duel.mjs`, includes the new file): 306 tests, 306 pass.
- `node scripts/check-links.mjs`: 168 Markdown files, 611 links, 0 broken.
- `git diff --check`: clean.

## Limits

- No browser, rendered or human test was run. Production UI has no trap button or face-down marker; the seam is reachable only by a test that injects both an engine and a catalog.
- The fixture is synthetic and says nothing about balance. Trap card content, deck migration and UI texts remain blocked on the user (O1-O3, contract section 10).
- `tests/match/trap-controller.test.js` still carries the #104 comment that `options()` is left out of its snapshots; that file is outside this task.
- `controller.options()` still throws when a hand card is missing from its catalog (now with the card ID); it does not set an error status.

## Independent coordinator verification (November 17, 2026)

After Kiro authored commit 3d01b2f and the worker process exited,
the coordinator reviewed the two source changes and new tests and reran:

- Focused 4 files (trap-selection, selection, controller, trap-controller): **29/29 Node tests pass**.
- Full npm test: **306/306 Node tests pass**; 2/2 existing GLB *structure-only* checks pass (not evidence of motion quality).
- Documentation: **169 Markdown files, 611 relative links and images, 0 broken**.
- git diff HEAD^ HEAD --check: **pass**.
- Reviewed base: dfade1ace3061cc29fa4015c35e971b5c7f6f719.

The Kiro V3 launch requested the claude-opus-5.5 model and the installed
CLI reported version 3.4.0. Session-selected model and credit usage
metadata were not available in the saved worker evidence: do not infer
them from the launch argument. No production trap card, deck migration,
renderer/UI asset, deployment or human playtest was performed.

Authorship is distinct: Kiro authored the code and tests, and the
coordinator independently checked and added this evidence paragraph.
