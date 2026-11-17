# Trap CPU levels: easy and hard on opt-in trap matches (issue #112)

Date: 2026-11-17 (America/Los_Angeles). Base: `main` at be0d587. Branch
`kiro/trap-cpu-levels-112`. Work done by Kiro (Kiro CLI 3.4.0 per
`kiro-cli --version`; model claude-opus-5.5 as reported by the session
context). The session emitted no credit or usage figures, so none are recorded.
Headless rules work only: no renderer, `src/match`, card, deck, package, CSS,
3D, script or CI change. Trap names, counts, deck migration and public UI stay
owner-blocked.

## Problem

`chooseAction(view, { cards })` (T5, [kiro-trap-t5-cpu.md](kiro-trap-t5-cpu.md))
already handled fixture traps, but `cpuFor("easy")` and `cpuFor("hard")`
called `legalActions` with the shipped `CARDS` and took no options. With a
fixture trap in hand both threw `TypeError: Cannot read properties of
undefined (reading 'kind')`. The new test was run against the unmodified
`cpu.js` and failed that way for easy and hard; normal passed.

## Change

[`src/game/cpu.js`](../../src/game/cpu.js) only:

- easy: `chooseEasy(view, { cards = CARDS } = {})` returns
  `chooseAction(view, { cards })`, with a spell still replaced by end-phase.
  On a trap match easy therefore sets a held trap exactly where normal would
  (after a beneficial summon, before any cast, own zone empty, round below 9).
  It still never casts.
- hard: `chooseHard(view, { cards = CARDS } = {})` passes `cards` to both
  `legalActions` calls. Its scoring loop skips `set-trap`, so `viewAfter` and
  `hardScore` never handle a set. After scoring, if its pick is a summon it is
  kept; otherwise (spell or end-phase) normal's `trapSet` step is applied and
  the first held trap is set instead, if one is legal. A summon is followed
  by a fresh choice, which may then set. No trap effect, search or new weight
  is added; the two-clash score and its constants are unchanged.
- normal (`chooseAction`) and `cpuFor` fallback are unchanged.

Without a trap in hand, or with traps off, every level makes the same choice
as before.

## Verification

[`tests/game/trap-cpu-levels.test.js`](../../tests/game/trap-cpu-levels.test.js),
using anonymous fixture traps `test-fixture-level-trap-<side>-<n>` that exist
only in the test. Each seeded opt-in state is cloned, then one trap is added
to each opening hand and one fourth from the top of each deck (outside the
12-card deck).

- Each level against itself on seeds 0-199, every decision: no view or state
  mutation; `Math.random` and `Date.now` throw if called; the action is in
  `legalActions(state, side, { cards })` and `applyAction` accepts it; the
  choice equals the same level's choice with the traps removed from hand,
  except a set that replaces a spell or end-phase; easy never casts; per phase
  no repeated action type, no summon after a cast or set, no cast after a set;
  a set only on an empty own zone, before round 9, of a held fixture trap;
  every `trap-trigger` comes from an end-phase clash, names the set card and
  was set in an earlier round; under 54 actions per match. Seeds 0 and 60
  replay identically and set at least two traps.
- Seeds 0 and 60, all nine level pairings: legal, accepted, replayable.
- Redaction, every level, seeds 0 and 60: the opponent's view holds no
  fixture ID; the choice is the same for an empty opponent zone and either
  opponent fixture trap, with opponent hand and both decks reversed, and with
  the opponent's face-down marker deleted from the view. easy and normal also
  pass with a Proxy that throws on reading the opponent's `trap` or `hand`.
  hard copies its view with `structuredClone`, which cannot copy a Proxy, so
  only the deletion check applies to hard.
- hard in round 8 sets and does not cast; in round 9 it never sets.
- `cpuFor` returns `chooseAction` for "normal", unknown, empty, "HARD",
  `undefined`, `null` and `1`; each chooser has `length` 1 and gives the same
  choice for no options, `{}` and the fixture catalog on seeds 0 and 60 with
  traps off and on; each returns `null` outside its phase.

Diagnostics from the run (fixture conditions only; no balance claim):

| Level vs itself, seeds 0-199 | Sets | Triggers |
| --- | --- | --- |
| easy | 766 | 748 |
| normal | 766 | 712 |
| hard | 612 | 550 |

The default-level digests in
[`tests/game/trap-cpu.test.js`](../../tests/game/trap-cpu.test.js) (seeds
0-199, flag off and flag on with no trap dealt) pass unchanged for all three
levels.

## Checks run

- `node --test tests/game/trap-cpu-levels.test.js tests/game/trap-cpu.test.js tests/game/cpu.test.js`: 29 tests, 29 pass.
- `npm test`: 313 tests, 313 pass, then both GLB structure checks PASS. Run
  twice: once for the tail of the output and once to read the counts.
- `node scripts/check-links.mjs`: before this note: 172 Markdown files, 617 relative links and images, 0 broken; with it: 173 files, 621 links, 0 broken.
- `git diff --check`: clean.

No browser run: pure engine change.

## Remaining

Production trap cards, counts, deck migration and UI remain owner-blocked.
The fixture numbers say nothing about win rates or balance of a real trap.
