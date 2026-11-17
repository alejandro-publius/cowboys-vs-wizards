# Trap controller bridge: project events before the presenter (issue #104)

Date: 2026-11-17 (America/Los_Angeles). Base: `main` at a8d1bba, after T1-T7
(T7 #103). Branch `kiro/trap-controller-104`. Work done by Kiro using Kiro CLI
3.4.0 (verified by `kiro-cli --version`). The session context names
`claude-opus-5.5` as the current model. No session-credit figure was emitted
inside this session, so none is recorded here.
Headless only: no 3D, model, sound, art, animation, UI flag, renderer method,
`src/game`, `selection.js`, card, deck, package or CI change. The trap flag
stays off by default; this is not production activation.

## Problem

`commit()` in [`src/match/controller.js`](../../src/match/controller.js)
passed the Engine's raw `result.events` to `presenter.enqueue`. In an opt-in
trap match the raw Wizard `trap-set` names its `cardId`, and the T6 presenter
([kiro-trap-t6-presenter.md](kiro-trap-t6-presenter.md)) refuses an
opponent's `trap-set` that names a card. Observed before the fix with the new
test file: three trap tests ended in status `error` with
`Development error: Presenter: the wizard trap-set names its cardId to cowboy; use publicEvents`.
Contract: [trap-prototype-contract.md](../submission/trap-prototype-contract.md)
sections 5 and 6.

## Change

[`src/match/controller.js`](../../src/match/controller.js) only: `commit()`
enqueues `publicEvents(result.events, "cowboy")` from
[`src/game/view.js`](../../src/game/view.js) instead of the raw events. The
`from` and `to` views were already `publicState(..., "cowboy")`. Flag off,
`publicEvents` returns copies equal to the raw events, so the default event
stream to the presenter is unchanged. The controller's external API is
unchanged.

## Test

New [`tests/match/trap-controller.test.js`](../../tests/match/trap-controller.test.js),
real epoch scheduler on a fake clock, fake renderer, seeds 0 and 60 (seed 0:
Cowboy starts; seed 60: Wizard starts). The test engine wraps
`createMatch(seed)` as `createMatch(seed, { traps: true })`, pushes one
test-only trap ID per side into the opening hand, and passes
`{ cards: TEST_CARDS }` to `applyAction`, `legalActions` and the injected
`chooseCpuAction`. Shipped `CARDS`/`DECKS` are untouched. The Cowboy plays
`chooseAction(view, { cards })` through `controller.submit()` (including
`set-trap`) and `controller.endPhase()`.

- Redaction: before the Wizard `trap-trigger` is committed, no `view()`,
  `displayed()`, `message()` snapshot or renderer call contains the Wizard
  trap ID; a `faceDown: true` marker is shown. After the trigger the ID
  appears (spent card in the Wizard discard). Exactly one Wizard trigger per
  match; the presenter never errors; every drained `displayed()` equals
  `view()`; both matches reach `terminal` with a result after round 1.
- Restart and leave while the trigger batch is still playing: `clear` (and
  `reset` on restart), round 1, revision 0, both trap zones `null`; no renderer
  call from the old batch; leave makes no later renderer, Engine or CPU call.
- CPU request pending at restart (restart 300 ms into a round-2+ Wizard
  phase): no CPU call and no applied action in the next 550 ms; the first
  action applied afterwards is at revision 0; no rejection; plays to terminal.
- Flag off, seeds 0 and 60: terminal with a result, no `traps` key in the
  view, no trap events, and `publicEvents(events, "cowboy")` deep-equals the
  raw events of every accepted action.

Results under this synthetic fixture are not balance evidence.

## Checks run (2026-11-17)

- `node --test tests/match/trap-controller.test.js tests/match/controller.test.js`:
  14 tests, 14 pass.
- Same trap test with the controller change stashed: 3 of 4 fail with the
  presenter error above; the flag-off test passes.
- `npm test` (`scripts/verify-duel.mjs`): 299 tests, 299 pass.
- `node scripts/check-links.mjs`: 168 Markdown files, 611 links, 0 broken (with this note tracked).
- `git diff --check`: clean.

No browser replay, human playtest or deploy was run.

## Found, not fixed (outside the owned files)

- `controller.options()` calls `selectionOptions`, which calls `legalActions`
  without the `cards` option. With the fixture trap in hand it throws
  `Cannot read properties of undefined (reading 'kind')`
  (`src/game/legal.js:32`). The new test therefore does not call `options()`.
  A shipped trap card in `CARDS` would avoid it; a selection trap step is a
  later task.
- The comment above `publicEvents` in `src/game/view.js` still says it is not
  used by the controller ("wiring is T6"). It is now used; `src/game` was not
  in scope.
