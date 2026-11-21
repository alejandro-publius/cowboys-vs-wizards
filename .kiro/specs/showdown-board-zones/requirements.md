# Showdown board zones: acceptance contract

Author: Kiro CLI 3.5.0 worker board-system, 2026-11-20, America/Los_Angeles. Base: main `ea183ee`.
Design source: Fable 5.2, "Showdown table: Boot Hill pass" (`board-design.md`) and the board-wave
markup contract (`board-contract.prompt`), both outside the repo in the coordinator folder. Fable owns
the rules, wording, layout intent and every open decision below. This file restates them as checkable
items. It adds no mechanic.

**How this spec was made:** written by hand in the Kiro requirements layout. It was not produced or
executed by a native Kiro spec run. K-003 (native spec execution receipt) is unverified for it: this is a file-only spec.

Status: CONTRACT ONLY. The UI (board-ui), CSS (board-layout) and browser QA (board-replay) are other
workers' commits. The review recipe is `.kiro/workflows/showdown-board-review.workflow.json`.

## Board requirements (BZ)

- **BZ-01 Markup.** Each faction stays in `.sd-side[data-side=cowboy|wizard]` with its `.sd-base` and
  `.sd-slot` unchanged, plus one `.sd-zone-rail[data-zone-side]`. Each rail has cells
  `[data-zone=deck|hand-count|traps|graveyard]`. `#sd-location`, `#sd-hand`, `#sd-actions`, the turn
  and lesson elements keep their existing IDs. Board `.sd-side` DOM order stays rival, then own.
- **BZ-02 Phone play.** At 390px a full normal match is playable without horizontal scroll, and either
  rail's pile sheet opens in one tap.
- **BZ-03 Pile order.** `#sd-graveyard-sheet` is a native `<dialog>`. Its `[data-graveyard-card]` rows
  equal the view's discard for that side, newest first. Both piles are open to both players.
- **BZ-04 Empty pile.** The `[data-graveyard=cowboy|wizard]` trigger exists only while that pile is
  non-empty. An empty pile is plain text "Boot Hill · empty", not a button. This holds again after
  Raise empties the pile.
- **BZ-05 No banish.** No banish zone, label or placeholder exists.
- **BZ-06 Raise marker.** `[data-raise-target]` marks the newest Undead in the Wizard pile, derived
  from public discard order only. It moves or disappears as the view changes.
- **BZ-07 One transaction.** A Wizard summon that pays tribute and triggers Raise is one `applyAction`.
  The UI shows no intermediate selectable graveyard state and no separate Raise cast. The final pile
  top and count come from the current view.
- **BZ-08 Move cue.** `#sd-zone-move` names the last move from public events. It survives the privacy
  curtain and clears on the incoming player's first action or on Reset.
- **BZ-09 Hidden information.** Rival hand identities, rival trap identities and deck order never
  reach the DOM: rival seat, hotseat curtain, preview or final screen. A trap's identity appears to
  the rival only at its trigger event. Under the curtain both seats show counts only.
- **BZ-10 Sheet lifetime.** The sheet closes on any pass or state change, and focus returns to a
  usable control.
- **BZ-11 Temporary states.** Tribute and target picking highlight legal slots only. The rail stays
  visible and inert.
- **BZ-12 Scope.** No engine (`src/game/showdown/`), save or `contract.js` change. The public gate is
  untouched. Both player careers (Cowboy and Wizard saves) are byte-identical after a check run.

## Review requirements (RV)

- **RV-01 Candidate identity.** A review names one 40-hex candidate SHA. It refuses, before any test
  runs, when the SHA is malformed, HEAD differs, HEAD is not detached, or the tree is not clean.
- **RV-02 One build, two tracks.** One hosted build (`dist/web/index.html`) is made at the candidate.
  Both tracks run on it, confirmed by its SHA-256 and the 12-hex revision the QA script prints.
- **RV-03 Negative controls.** Each track runs the QA script's own `--witness` fault once and requires
  exit 1. Exit 0 (fault not caught) or any other code (usage or harness fault) fails the review.
- **RV-04 Traceability.** Every command result names the BZ/RV IDs it supports and the step that ran it.
  An ID without a command result is `pending`, never `met`.
- **RV-05 Local and read-only.** No source edit, install, deploy, push, PR post, merge, schedule or Web
  call. Output goes only under `.artifacts/kiro/showdown-board-review/<sha>/`.

## Open decisions (Fable)

- Visual order inside each side at 390px (troop row then rail, or natural DOM order) where strict
  order conflicts with layout and DOM. The contract allows natural order with gameplay focus first.
- Whether the trap flip beat needs its own test or is covered by the move cue (BZ-08).
- Whether Raise lands in the pile before or after the Skeleton leaves. The UI renders the view.
