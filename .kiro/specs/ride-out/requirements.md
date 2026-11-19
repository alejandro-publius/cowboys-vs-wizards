# Ride Out: requirements

Author: Kiro (Kiro IDE agent session), November 18, 2026 Pacific. Branch `kiro/ride-out-pilot`, base `55a395e`.
Status: graybox-first, developer-only rules experiment. Requirements were written before the code.
Task: `.artifacts/card-rd/brief.md` (local, untracked).

**Question.** Does spending the summon allowance to ride out give a real alternative to spreading troops, paying a
tribute or holding a position? Can it rescue a stalled board without strengthening an easy Base race?

## Glossary

- Flag: `createMatch(seed, { rideOut: true })`. Off by default. It cannot be combined with `traps: true`.
- Ride-out: `{ type: "ride-out", side, revision, slot, destination, actionId? }`. `slot` holds a friendly troop;
  `destination` is the friendly lane it moves to.
- Shipped choice: what the same CPU level picks from the same public view when no ride-out is listed.

## Requirements

| ID | Requirement | Check |
| --- | --- | --- |
| RO-1 | WHEN the flag is off, THE engine, public view, legal list and every CPU level SHALL give the same state, events and actions as `55a395e`. A `ride-out` action SHALL be rejected with `invalid-action`, as before. | Hashes recorded at `55a395e` for seeds 0 and 60 (opening, Normal and Hard logs, first-legal log) and for Hard actions on seeds 0-199; the existing Normal hash. |
| RO-2 | WHEN the flag is on, THE match SHALL add only `rideOut: { enabled: true, rulesVersion: "orb-duel-draft-1+ride-out" }`. Decks, hands, first seat and RNG SHALL equal the flag-off match. A non-boolean flag, or the flag with traps, SHALL throw. | `tests/game/ride-out.test.js` |
| RO-3 | WHILE the flag is on, THE active side MAY ride out once per phase: its troop in `slot` moves to `slot - 1` or `slot + 1` on its own board, and that lane must exist and be empty. The same troop moves, keeping its card and remaining health. No card changes zone, no Base or enemy troop changes and no RNG is drawn. One `ride-out` event `{ side, cardId, slot, destination, health }` is emitted. | same file |
| RO-4 | A ride-out SHALL use the summon allowance (`summonUsed`). After the shared checks, the first failing reason wins: `summon-used`, `ride-out-after-spell`, `invalid-slot` (not a lane, or no own troop there), `invalid-destination` (not one lane left or right on the board), `destination-occupied`. A summon after a ride-out SHALL be rejected with `summon-used`. A spell after a ride-out SHALL be accepted. | same file |
| RO-5 | IF a ride-out is rejected, THEN THE engine SHALL return the same state object, emit no event and leave state, `rng` and `revision` unchanged. | same file |
| RO-6 | Both sides SHALL have the same move under the same checks. | same file, every case run for both factions |
| RO-7 | WHILE the flag is on, `legalActions` SHALL list every accepted ride-out and nothing else of that type, after spells and before end-phase, by slot then destination. THE public view SHALL carry `rideOut`, so the list is the same from the view. | same file, exhaustive over slots and destinations |
| RO-8 | EACH CPU level SHALL see a ride-out only through `legalActions` on its own public view and SHALL score it with the clash projection it already uses for other plays. A ride-out SHALL be chosen only when it scores strictly higher than every shipped option the level compares it with, so a tie keeps the shipped choice. | same file: hidden-information twin, constructed positions, tie case |
| RO-9 | IN a paired match where neither side rides out, THE ride-out match SHALL have the same action log and result as the shipped match. | asserted for every paired match by `scripts/compare-ride-out.mjs` |
| RO-10 | THE experiment SHALL pair a development seed lane (60000-60999) and a holdout seed lane (61000-62999), with the shipped decks and each faction in the first seat on every seed, for Normal and for Hard as separate cohorts. It SHALL report move opportunities, actual use, whether a summon or tribute was also legal and what the shipped choice was, match rounds, draws, seat balance with paired 95% intervals, and two paired board examples, one of which gives up protecting a lane. | receipts under `.artifacts/card-rd/ride-out/`; note `docs/evidence/kiro-ride-out.md` |
| RO-11 | THE change SHALL add no card, stat, asset, renderer or UI surface, URL parameter, package change or dependency, and SHALL leave the release pipeline untouched. | `git diff --stat` against `55a395e` |

## Decisions

- D1 Rejection reasons reuse `summon-used` for the shared allowance, so no new allowance key is needed.
- D2 Ride-outs are listed after every shipped action type. A CPU that keeps the first of equal scores therefore keeps
  its shipped choice on a tie.
- D3 The comparison is between two policies of the same CPU: shipped rules and that CPU, and ride-out rules and the
  same CPU with one more option. RO-9 ties every changed result to an actual ride-out. Results are not attributed
  to the rule alone.
- D4 If the move turns out dominant, or almost never matters, the note says so and proposes one focused adjustment.

## Out of scope

Renderer, UI and URL wiring (later pass); human playtests; card, deck or stat changes; combining the flag with traps;
publishing, pushing or merging.
