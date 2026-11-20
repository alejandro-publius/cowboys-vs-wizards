# Showdown slice 2, the first hour: design

Author: Kiro CLI (Claude Opus 5.5), 2026-11-19, America/Los_Angeles. Requirements: [requirements.md](requirements.md).

**Status: backfilled.** This describes the design already on `kiro/graywave-integrate` `cd764f1` (PR 148),
as read from its source and its evidence note
[`docs/evidence/kiro-143-slice2-integrate/README.md`](../../../docs/evidence/kiro-143-slice2-integrate/README.md).
It proposes no new behaviour.

## Modules

| Module | Kind | Role | Requirements |
| --- | --- | --- | --- |
| `src/game/showdown/progress.js`, `trail.js`, `playtest.js` | pure | Fable's progression engine, moved from the prototype. `prototypes/showdown/*.js` re-export them. | FH-R1, FH-R4 |
| `src/game/showdown/campaign-store.js` | pure, Storage passed in | `loadCampaign`, `saveCampaign`, `laneCapturedCards`. Reads `cvw-showdown-save-v2`, falls back to `cvw-showdown-trail-v1` through `migrate()`, keeps a refused save under `cvw-showdown-save-v2-refused`. Reads `cvw-player-v1` and never writes it. | FH-R3, FH-R5.6 |
| `src/game/showdown/inherited.js` | pure, Storage passed in | `joinInherited`, `readInherited`, `holdings`. The grow-only Inherited record `cvw-showdown-inherited-v1`. | FH-R5, FH-R7 |
| `src/match/showdown-campaign.js` | controller | `createCampaign(storage)`: one object over the store and the record, used by the Camp and the duel screen. | FH-R3, FH-R5, FH-R6 |
| `src/match/showdown-playtest.js` | controller | `createPlaytestLog(storage)` over `cvw-showdown-playtest-v1`. | FH-R3.9 |
| `src/ui/showdown-camp.js`, `showdown-screen.js`, `src/app.js` | DOM | Camp screen, duel result and offer, title menu routing, `?mode=lanes` / `?mode=match`. | FH-R2, FH-R6 |

## Data flow on load

1. `createCampaign(localStorage)` calls `loadCampaign`. A missing or blocked store gives `newSave()` and writes nothing (FH-R3.1, FH-R3.5).
2. It reads `laneCapturedCards(storage)` from the lane profile and passes them to `joinInherited`. The record is written only when a card is new. A damaged record is left as it is and the cards are held in memory with `saved = false` (FH-R5.2).
3. `holdings(progress, inherited)` lists Progress cards first, then inherited cards Progress does not hold. A card in both is shown at the Progress count (FH-R5.4). Unknown types are dropped.
4. The Camp draws `holdings()` and appends "(from the lane game)" to inherited rows.

## Why the Inherited record is separate from Progress

`migrate()` accepts a Legendary in the collection only after the Trail and the matching Showdown bounty's
fifth hunt. A lane capture put into Progress would make the next load reset the save (FH-R7.2), or would
need a Progress change that grants Trail or bounty state. Fable ruled (F1/F2, 2026-11-19) that it stays out of Progress.
The separate record keeps the brief's ownership promise without touching `progress.js`, `migrate()`, the
Trail, the deck, bounties, offers, rewards or `cvw-player-v1`.

Fable's ruling flipped compat check A1: the keepsake record must hold the capture and Progress must not.
The 14 A1–A5 cases now run in `npm test` as `tests/game/showdown-keepsake-compat.test.js`, and pass. The
earlier external run, where the old A1 (`owned(progress) > 0`) failed on 7 capture cases, is kept as
history in [compat-A1-A5.md](../../../docs/evidence/kiro-143-slice2-integrate/compat-A1-A5.md).

## Ownership scope: device versus policy

- **Device scope (integration fact).** The Inherited record lives in the same browser storage as the lane profile. The save code is built from Progress only, so a save code moved to another device does not carry inherited cards. The graybox Camp offers no save code; only the prototype screen does.
- **Balance policy (Fable, decided).** An inherited card is not equippable, does not count in the Showdown collection, and does not change a bounty payout. The code grants display only.

These are kept apart so a later Fable decision on policy does not silently change where the record is
stored, and a later portability change does not silently grant power.

## Test layers

| Layer | Files | What it can prove |
| --- | --- | --- |
| Unit (Node, pure) | `prototypes/showdown/progress.test.js`, `tests/game/showdown-campaign-store.test.js`, `tests/game/showdown-inherited.test.js`, `tests/game/showdown-trail-ramp.test.js` | Rules of the store, the record and the ramp, on in-memory Storage. |
| Controller (Node) | `tests/match/showdown-campaign.test.js`, `tests/match/showdown-playtest.test.js` | The Camp → Trail → settle → choose → reload cycle without a DOM. |
| Browser (headless Chrome, bot clicks) | `scripts/browser-showdown-check.mjs`, `scripts/browser-showdown-trail-check.mjs` on the built graybox | Entry routing, on-screen payment and ownership, reload persistence. Not clarity or fun. |
| Regression | `npm test` (`scripts/verify-duel.mjs`, which discovers `tests/game`, `tests/match`, `tests/assets`, `prototypes/showdown`) | All of the above Node suites together with the lane suites. |
| Human | none run | Pending. |

## Known gaps (also in the map)

- No automated check enforces FH-R1.2 (purity of `src/game/showdown/`). It was checked by a source grep for DOM, storage globals and Node imports in this job only.
- FH-R7.1 and FH-R7.3 are tested against the reference prototype's save code and Start over, because the graybox Camp has neither until slice 3. A `test.todo` in the keepsake compat test marks the slice 3 graybox Start over check.
