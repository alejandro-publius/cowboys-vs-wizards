# Implementation Plan: Orb Duel

## Overview

Kiro builds the Orb Duel interaction and presentation layer in JavaScript on top of Fable's committed Engine (`src/game/*.js`) and CPU (`chooseAction(view)` in `src/game/cpu.js`), both present on `codex/repo-layout` at b3c77bd. Pure modules come first (selection, scheduler, Presenter, controller), each tested in Node with a fake clock and a fake renderer. The card overlay, orbs, board view and entry-point wiring follow, then browser verification. Fable's Engine, CPU, asset auditor and rule tests are reused, not duplicated. Card numbers remain a working draft, balance unproven.

Status tags: **Ready**, **Awaiting asset**, **Awaiting tasks N**. All Kiro tests live in `tests/match/` and run with `node --test "tests/match/*.test.js"`. Fable regression runs with `node --test "tests/game/*.test.js"`.

Coordination update by Codex, November 15, 2026: Kiro owns entry-point wiring, the additive scene export, approved card-back import and build wiring, and local browser verification. `docs/fable-tasks.md` records this assignment. Job F is an unassigned animation-polish follow-up. Continue through implementation and verification checkpoints when checks pass.

## Tasks

- [x] 1. Selection state machine
  - Status: **Ready**. Depends on: Fable `createMatch`, `applyAction`, `legalActions`, `publicState`, `chooseAction`.
  - Files: `src/match/selection.js`, `tests/match/selection.test.js`
  - Acceptance: `node --test tests/match/selection.test.js` passes and shows that cancel from every selection state leaves committed state and Player_View deep-equal and submits nothing; confirm submits exactly one action equal to a `legalActions(view, "cowboy")` entry plus an `actionId`; a tribute shortfall shows its message; a full-board tribute can target the vacated Slot; Deadeye takes a target and Singularity takes a target plus destination; clicks are ignored outside the Cowboy phase or while the controller is not accepting input.
  - _Requirements: 2.2, 2.3, 2.4, 2.5, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 8.1, 8.2, 8.3, 8.4, 12.5_
  - [x] 1.1 Implement `src/match/selection.js`
    - States: idle, card-selected, choosing-tribute, choosing-slot, choosing-target, choosing-destination, confirm
    - Offer only options from the `legalActions(view, view.viewer)` entries matching the clicked `cardId`; never re-implement rules
    - Messages: tribute shortfall, blocking allowance, "Slot is invalid"
    - Confirm copies the single matching legal action and adds a fresh `actionId`; cancel and re-click clear UI state only; input is ignored unless the caller reports accepting_input
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 8.1, 8.2, 8.3, 8.4, 12.5_
  - [x] 1.2 Write property test and examples in `tests/match/selection.test.js`
    - **Property 1: Selection never touches the Engine**
    - Seeded loop over seeds 0 to 99 with random click sequences on positions reached through `applyAction` and `chooseAction`; one example per acceptance case
    - Singularity is a Wizard card, so its destination example uses `publicState(state, "wizard")`
    - **Validates: Requirements 2.2, 2.3, 2.4, 2.5, 4.1, 4.2, 4.3, 4.4, 4.5, 12.5**

- [x] 2. Epoch scheduler
  - Status: **Ready**. Depends on: none.
  - Files: `src/match/scheduler.js`, `tests/match/scheduler.test.js`
  - Acceptance: with a fake clock, `node --test tests/match/scheduler.test.js` shows that after an epoch increment no pending timer, frame or impact callback runs, and a late callback tagged with an old epoch is dropped.
  - _Requirements: 12.7, 12.8_
  - [x] 2.1 Implement `src/match/scheduler.js`
    - Single entry point for timers, animation frames, impact callbacks and CPU requests, each tagged with the current epoch; clock functions are injected so Node tests can use a fake clock
    - Advancing the epoch cancels all pending entries; a callback carrying an old epoch returns without running
    - _Requirements: 12.7, 12.8_
  - [x] 2.2 Write unit tests in `tests/match/scheduler.test.js`
    - Fake clock; cancellation for each entry kind; late old-epoch callback dropped
    - _Requirements: 12.7, 12.8_

- [x] 3. Presenter
  - Status: **Ready**. Depends on: task 2; Fable event schema and `chooseAction`.
  - Files: `src/match/presenter.js`, `tests/match/presenter.test.js`
  - Acceptance: `node --test tests/match/presenter.test.js` runs seeded walks over seeds 0 to 99 (Cowboy moves from a test-local legal-action picker or `chooseAction`, Wizard moves from `chooseAction`) against a fake renderer and asserts that at every drain the displayed state deep-equals the new `publicState(state, "cowboy")`; orb counts change only at impact cues; every attacker in a clash group gets exactly one attack and one impact, including attackers defeated in that clash, and all removals follow all impacts; chained Base `before`/`after` values apply in event order; an unsupported event type throws a development error naming it; the displayed state never contains the opponent hand or deck order.
  - _Requirements: 5.1, 5.2, 5.3, 5.5, 5.6, 5.7, 5.8, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 8.2, 12.1, 12.2, 12.3, 12.4_
  - [x] 3.1 Implement `src/match/presenter.js`
    - Deep-copy `from`, patch each target from `before` to `after` at its impact cue, and copy fields events do not carry from `to` at the event that changes them
    - Group `clash` through the last `damage`; start all attacks together; play `defeat` removals after the group; remove a spell-defeated troop after the spell impact; move a Singularity survivor to `destination` after its impact
    - Throw a development error naming an unsupported event type, and naming the first differing field path when the drained state differs from `to`
    - Drive an injected renderer interface through the scheduler
    - _Requirements: 5.3, 5.5, 5.6, 5.7, 5.8, 7.1, 7.5, 7.6, 8.2, 12.1, 12.2, 12.3, 12.4_
  - [x] 3.2 Write property test for Presenter fidelity in `tests/match/presenter.test.js`
    - **Property 2: Presenter fidelity**
    - Includes the unsupported-event example and the no-opponent-hand check
    - **Validates: Requirements 2.1, 5.1, 5.2, 5.3, 5.5, 12.1, 12.2, 12.3, 12.4**
  - [x] 3.3 Write property test for clash completeness in `tests/match/presenter.test.js`
    - **Property 3: Clash completeness**
    - Includes chained Base `before`/`after` in event order
    - **Validates: Requirements 5.6, 5.7, 5.8**
  - [x] 3.4 Write property test for displayed health bounds in `tests/match/presenter.test.js`
    - **Property 4: Displayed health bounds**
    - **Validates: Requirements 5.1, 5.2, 5.6**

- [x] 4. Match controller
  - Status: **Ready**. Depends on: tasks 1, 2 and 3; Fable `chooseAction` (job D, c1ea873).
  - Files: `src/match/controller.js`, `tests/match/controller.test.js`
  - Acceptance: `node --test tests/match/controller.test.js` passes a focused test that restarts midway through clash playback and another that switches mode midway, each advancing the fake clock to completion and asserting that no old impact, animation callback or queued CPU action changes the new match's committed state, displayed state or renderer; it also shows that clicks during playback submit nothing, a pinned seed is reused on restart and otherwise a new seed is used, the CPU receives only the Wizard view, and seeds 0 to 99 complete with a fake renderer with the displayed result outcome equal to the Engine result.
  - _Requirements: 1.9, 1.10, 1.11, 1.12, 1.13, 9.1, 9.2, 9.6, 10.1, 10.2, 10.3, 10.4, 10.5, 11.4, 11.5, 12.5, 12.6, 12.7, 12.8_
  - [x] 4.1 Implement `src/match/controller.js`
    - Hold the full Engine state, seed, `seedPinned`, epoch and controller state (playing, accepting_input, submitting, cpu_turn, terminal)
    - Generate a seed with `crypto.getRandomValues(new Uint32Array(1))[0]`; pin an integer seed from `?seed=` or the seed field; refuse non-integer input before `createMatch`; record the seed for display
    - Submit through `applyAction`; on rejection show the reason and return to accepting_input; on success enqueue `from`, `to` and events to the Presenter
    - After the queue drains in the Wizard phase, request `chooseAction(publicState(state, "wizard"))` through the scheduler (slot injectable for tests); a `null` in the Wizard phase is a development error
    - Restart and mode switch advance the epoch, clear the queue and selection, and call renderer `clear()`
    - _Requirements: 1.9, 1.10, 1.11, 1.12, 9.1, 9.2, 9.6, 10.4, 11.4, 11.5, 12.5, 12.6, 12.7, 12.8_
  - [x] 4.2 Write property test for cancellation in `tests/match/controller.test.js`
    - **Property 5: Cancellation**
    - Includes the mid-clash restart and mid-playback mode switch cases; the renderer is empty before the new state is shown
    - **Validates: Requirements 11.5, 12.7, 12.8**
  - [x] 4.3 Write property test for the CPU information limit in `tests/match/controller.test.js`
    - **Property 6: CPU information limit**
    - **Validates: Requirements 9.1, 9.2, 12.6**
  - [x] 4.4 Write example tests in `tests/match/controller.test.js`
    - Clicks during playback submit nothing; generated and pinned seeds reach `createMatch`; non-integer seed refused; restart seed choice; seeds 14, 27 and 47 play with no mulligan; seeds 0 to 99 complete with outcome equal to the Engine result
    - _Requirements: 1.10, 1.11, 1.12, 1.13, 10.1, 10.2, 10.3, 10.5, 11.4, 12.5_

- [x] 5. Checkpoint: pure match modules
  - Run `node --test "tests/match/*.test.js"` and `node --test "tests/game/*.test.js"` and record the actual counts and commit in `docs/evidence/kiro-match-ui.md`.
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Card overlay
  - Status: **Ready**. Kiro imports the approved card back as A1 for 6.4. Depends on: task 1 for 6.1 and 6.3; task 4.1 for 6.2.
  - Files: `src/ui/card-model.js` (pure), `src/ui/cards.js` (DOM), `tests/match/card-model.test.js`
  - Acceptance: `node --test tests/match/card-model.test.js` shows deck and hand counts equal the Player_View, one entry per held card, no opponent card identity, and the temporary label present.
  - _Requirements: 1.12, 2.1, 2.2, 2.3, 4.1, 4.2, 4.5, 6.3, 10.5_
  - Asset Gaps: AC3
  - [x] 6.1 Implement `src/ui/card-model.js`
    - Map Player_View, selection and controller UI state to deck count, hand count, one card per held card (name, stars or spell type, health, attack) labelled temporary, opponent hand and deck as counts only, seed in match details, prompt and message, end-phase enabled flag, and a result label (Victory, Defeat or Draw from `win`, `loss` or `draw`) with restart
    - _Requirements: 1.12, 2.1, 4.1, 4.2, 4.5, 10.5_
  - [x] 6.2 Implement `src/ui/cards.js`
    - Render the card model as temporary HTML text cards; forward hand, Slot, end-phase, seed and restart input to the controller
    - _Requirements: 2.1, 2.2, 2.3, 6.3, 10.5_
  - [x] 6.3 Write unit tests in `tests/match/card-model.test.js`
    - Views from seeds 0 to 99: counts, one entry per held card, no opponent card identity, temporary label, outcome labels
    - _Requirements: 1.12, 2.1, 10.5_
  - [x] 6.4 Show the approved card back on the deck pile and opponent hand
    - Status: **Ready after A1 import**, owned by Kiro. Files: `src/ui/cards.js`, `scripts/build.mjs`, `assets/cards/card-back.png`
    - Acceptance: the SHA-256 of the image bytes the deck pile displays equals the SHA-256 recorded for A1; visual check deferred to task 10
    - _Requirements: 2.1_

- [x] 7. Orbs and troop placement
  - Status: **Ready after task 3** (renderer interface). Kiro owns the additive `src/render/scene.js` export and match-board integration.
  - Files: `src/render/orbs.js`, `src/render/match-board.js`, `tests/match/orbs.test.js`, additive export in `src/render/scene.js`
  - Acceptance: `node --test tests/match/orbs.test.js` (Node with `three`, no WebGL) shows troop orbs equal health for 0 to 5 and Base orbs equal 0 to 5; Slot i maps to `stage.tiles[i]` for Cowboys and `stage.tiles[3 + i]` for Wizards; Sheriff, Mounted Billy, Skeleton and Dragon produce a labelled temporary token, never a duplicated Billy or Wizard; and `npm run check` still passes after the `scene.js` export.
  - _Requirements: 5.1, 5.2, 5.4, 5.5, 5.6, 5.7, 11.5_
  - Asset Gaps: AC1, AC2, AC4
  - [x] 7.1 Implement `src/render/orbs.js`
    - Procedural troop orbs above a troop and Base orbs per Base, with a count setter; no orb assets
    - _Requirements: 5.1, 5.2, 5.4_
  - [x] 7.2 Write orb count tests in `tests/match/orbs.test.js`
    - Troop counts 0 to 5 and Base counts 0 to 5
    - _Requirements: 5.1, 5.2, 5.4_
  - [x] 7.3 Add the minimal additive board-setup export to `src/render/scene.js`
    - Status: **Ready**, coordinator sign-off recorded in `docs/fable-tasks.md`
    - No behavior change to `createDuel` (fire, cast, exchange, tiles 1 vs 4, health 100/100, existing event names)
    - _Requirements: 12.9_
  - [x] 7.4 Implement `src/render/match-board.js`
    - Renderer interface the Presenter calls: place a troop at its Slot tile (Billy and Wizard through `rigActor`, labelled temporary tokens for Sheriff, Mounted Billy, Skeleton and Dragon), set troop and Base orbs, move a troop, remove a troop, and `clear()` troops, orbs and result displays
    - Status: **Awaiting tasks 7.3**
    - _Requirements: 5.5, 5.6, 5.7, 11.5_
  - [x] 7.5 Write board tests in `tests/match/orbs.test.js`
    - Slot-to-tile mapping, labelled stand-ins with no duplicated Billy or Wizard model, `clear()` leaves no troop or orb, then `npm run check`
    - _Requirements: 5.5, 11.5_

- [x] 8. Match mode integration
  - Status: **Awaiting tasks 4, 6 and 7**. Kiro owns the `src/main.js` and `src/ui/layout.html` integration.
  - Files: `src/render/cues.js`, `src/main.js`, `src/ui/layout.html`
  - Acceptance: `npm run check` passes unchanged, `npm run build` succeeds, `node --test "tests/match/*.test.js"` and `node --test "tests/game/*.test.js"` pass, and switching back to the demo shows the original fire, cast and exchange controls.
  - _Requirements: 6.3, 6.5, 6.6, 8.1, 8.2, 10.5, 11.4, 11.5, 12.7, 12.8, 12.9_
  - Asset Gaps: AC2, AC5
  - [x] 8.1 Implement `src/render/cues.js`
    - Status: **Awaiting tasks 7**
    - Billy shot and Wizard cast from the existing procedural rig and effects, and a temporary token cue for stand-ins, each reporting its impact keyframe through the scheduler
    - _Requirements: 5.3, 5.8, 8.1, 8.2_
  - [x] 8.2 Wire Orb Duel mode in `src/main.js` and `src/ui/layout.html`
    - Mode switch and match markup; connect controller, Presenter, card overlay, match board and cues for turns, end phase, spells, CPU playback, result and restart; a mode switch advances the controller epoch; the attack demo stays unchanged
    - _Requirements: 6.3, 6.5, 6.6, 10.5, 11.4, 12.7, 12.8, 12.9_

- [x] 9. Checkpoint: integration
  - Run `node --test "tests/match/*.test.js"`, `node --test "tests/game/*.test.js"`, `npm run check` and `npm run build`.
  - Fix failures, then continue directly to local browser verification. Record any concrete blocker requiring user input.

- [x] 10. Browser verification of the complete match flow
  - Status: **Awaiting tasks 1-9**. Local browser verification is already authorized by the current assignment.
  - Files: `docs/evidence/kiro-match-browser.md`
  - Acceptance: the evidence file records build commit, browser, machine and seed, and marks each step observed or pending; no step is marked passed unless it was observed.
  - _Requirements: 1.11, 1.12, 2.2, 2.3, 4.1, 4.3, 4.4, 5.3, 5.6, 5.7, 5.8, 8.1, 8.2, 9.1, 10.5, 11.4, 11.5, 12.5, 12.7, 12.9_
  - [x] 10.1 Run the browser flow and write `docs/evidence/kiro-match-browser.md`
    - Steps: generated seed shown; pinned `?seed=` replays; select and cancel; tribute select, cancel and confirm, including a full board; Deadeye; Singularity with relocation; end phase and CPU turn; clash with simultaneous attacks, including a defeated attacker finishing its attack; orbs drop at impact; removals after the attacks; result; restart midway through playback; mode switch to the demo and back; card back from 6.4, or pending
    - _Requirements: 1.11, 4.4, 5.6, 5.8, 12.7, 12.9_

## Asset imports and animation follow-up

- A1 Card back import. Owner: Kiro. Input: `~/Downloads/Amethyst Horseshoe Arcana.png` (1060x1484, 3,467,714 bytes), the approved concept. Import to `assets/cards/card-back.png` and add the `scripts/build.mjs` embed. Check: SHA-256 of the imported file is recorded. The raw card-back GLB is outside this task.
- A2 Card front (OQ-A). Owner: user, who must name the approved file. Input: the named file. Check: the file path is recorded; temporary text cards stay until then. No redesign.
- A3 Sheriff, Mounted Billy, Skeleton and Dragon models, rigs and clips (OQ-C). Owner: to be assigned. Input: approved character direction. Check: `node scripts/audit-assets.mjs` plus a rendered review; labelled tokens stay until then.
- A4 Character animation polish. The proposed job F is unassigned and follows the first playable interface. Kiro uses the existing procedural Billy/Wizard motion for this implementation. Later draw, cast, hit and defeat polish follows `docs/character-animation-plan.md`. Owner: to be assigned. Check: the review step in that plan.
- A5 Production card textures import. Owner: to be assigned. Input: approved production textures. Check: SHA-256 recorded per imported texture. Status: pending.

`docs/fable-tasks.md` assigns job E and its integration edits to Kiro.

## Notes

- No task is optional; every listed task is required.
- Fable's Engine, `chooseAction`, `scripts/audit-assets.mjs`, `scripts/play-match.mjs` and `tests/game/*.test.js` are reused unchanged. Kiro never edits Fable's tests; Engine properties are covered there.
- CPU wiring is Ready: the main checkout at b3c77bd includes job D (c1ea873). Kiro wires `chooseAction` using only the Wizard public view.
- Property tests are seeded loops over seeds 0 to 99 (no PBT library; package files belong to the coordinator). A failure prints its seed. Each test is tagged `Feature: orb-duel, Property N: <property text>`.
- In the first playable version Singularity is cast only by the CPU; the human sees it through Presenter playback.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "7.1"] },
    { "id": 1, "tasks": ["1.2", "2.2", "3.1", "6.1", "7.2"] },
    { "id": 2, "tasks": ["3.2", "4.1", "6.3"] },
    { "id": 3, "tasks": ["3.3", "4.2", "6.2"] },
    { "id": 4, "tasks": ["3.4", "4.3"] },
    { "id": 5, "tasks": ["4.4", "7.3"] },
    { "id": 6, "tasks": ["7.4"] },
    { "id": 7, "tasks": ["7.5", "8.1"] },
    { "id": 8, "tasks": ["6.4", "8.2"] },
    { "id": 9, "tasks": ["10.1"] }
  ]
}
```
