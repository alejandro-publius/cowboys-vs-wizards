# Graywave cues: placeholder Showdown cues before 3D

Date: 2026-11-19 (America/Los_Angeles). Worker: Kiro CLI 3.5.0 (claude-opus-5.5), branch `kiro/graywave-cues`.
Brief: [showdown-integration-kiro-brief.md](../design/showdown-integration-kiro-brief.md), "Before any 3D work", Cues.

## Problem

The Showdown graybox screen showed every engine event only as a log line. The brief asks for a
placeholder for ten events (take cover, trap revealed, gear attached, location changed, troop raised,
sweep, last stand, set face down, burned draw, fatigue): a flash and the log line, with no rule
waiting on an animation.

## Change

- `src/ui/showdown-cues.js` (new). `cuesFor(events, before, after)` turns one batch of engine events
  into cues using only the `EVENTS` contract and the seat's `viewFor` views. A cue names places
  (a side's slot, Base or row, or the location line) and carries `presentEvent` text. It holds no
  card id. Payload subcases are kept as `variant`: trap `cancelled` / `through` / `defeated`, and
  Last Stand `wounded` / `defeated`. One session batch can hold a whole bot turn, so the board is
  followed through the batch with the contract's own facts: a troop arrives on the first empty slot,
  and tribute or a `left`/`targetLeft`/`attackerLeft` of 0 removes one. That way a troop that arrives
  and falls in the same batch is still cued on its slot. After a sweep the row is unknown, and
  anything that arrives there later is read from the final view. A troop that still cannot be placed
  falls back to its row. `createCuePlayer` plays one cue per 700 ms step. Each batch or clear starts
  a new epoch, so older timers never paint. With `prefers-reduced-motion: reduce` it shows the whole
  batch at once with a still outline and no timer.
- `src/ui/showdown-screen.js` hookup: takes the view before each action, tags log lines
  (`data-line`, `data-cue-kind`), adds `data-slot` to empty slots, adds an `aria-hidden` `#sd-cue` label
  row (the existing `#sd-feedback` live region already announces the text), repaints cues after each
  redraw, clears them on restart and Main menu, and accepts an optional `cueOptions` (only the check
  uses it, to shorten the step).
- `src/ui/showdown.css`: outline flash, tagged log lines, and a reduced-motion rule.
- No rule, number, wording, event or contract changed. Scout was not touched.

## Verification (actual runs, 2026-11-19)

- `node --test tests/match/showdown-cues.test.js`: 9/9 pass. Covers each of the 3×3 attacker/target
  slot pairs for Hex, Last Stand and Sweep; Bear Trap `through` and `defeated` from each Wizard
  slot; raise onto a different slot from the one its id had; cover/gear/location/set/burn/fatigue;
  80 seeds of random legal play in session-sized batches (a Cowboy action plus the whole Wizard turn
  after it), where each of 1,922 slot marks matched the full state just before or after its action,
  with 0 row fallbacks and no card id in any cue; a rapid second batch cancels the first one's
  timers; and reduced motion.
- `npm test`: 525/525 pass.
- `node scripts/build-graybox.mjs`, then `node scripts/browser-showdown-cues-check.mjs dist/cowboys-vs-wizards-board-duel.html`
  in Chrome 158 headless: 5/5 checks, 1,944 real mouse clicks, no page errors.
  Report: [graywave-cues/browser-showdown-cues.json](graywave-cues/browser-showdown-cues.json).
  - Built page, Boot Hill `?seed=1`, played by clicks at the real step (14 turns, won). Cover,
    burned-draw and fatigue cues painted, and each marked the place its log line names.
  - Harness built by the check from the same screen module, with gear, locations and a Captured Dragon
    added to the even decks, bot level 1, 150 ms step, seeds 0–31 by clicks. All ten kinds and every
    trap and Last Stand subcase painted. Slot pairs seen: Last Stand on cowboy-0/1 with wizard-0/1, and
    traps on cowboy-0 and wizard-0/1/2.
  - Rapid actions: two covers inside one 700 ms step. The newer cue replaced the older one at once,
    and the older batch never painted again.
  - Emulated reduced motion: multi-cue batches shown at once, `animation-name: none`, every line lit.
  - Every painted state was checked: no Wizard card id in the page.
- `node scripts/browser-showdown-check.mjs dist/cowboys-vs-wizards-board-duel.html`: 12/12 pass (existing slice 1 check).

## Findings for Fable

- The trap `defeated` subcase (a Bear Trap that defeats the attacker) always has `stopped: true`.
  `presenter.js` checks `stopped` first, so the log reads "its attack was cancelled", and its
  "defeated before it struck" wording is never reached. The cue keeps the subcase in `variant`.
  The wording was left unchanged. Fable owns that decision.
- The cue labels are taken from the brief's own names (for example "Trap revealed", "Burned draw").
  Fable may want to reword them.

## Not claimed / pending

The appearance of the flash has had no rendered review (screenshots were not reviewed). Whether the
cues are clear has had no human playtest. Camp entry and match completion belong to another wave.
