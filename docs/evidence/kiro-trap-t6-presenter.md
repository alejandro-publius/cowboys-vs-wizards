# Trap T6: headless presenter handling for trap events (issue #99)

Date: 2026-11-17 (America/Los_Angeles). Base: `main` at 6f5f088, after T1 #91,
T2 #93, T3 #96, T4 #98 and T5 #101. Branch `kiro/trap-presenter-99`. Work done
by Kiro using Kiro CLI 3.4.0 (verified by CLI version output). The worker
explicitly requested `claude-opus-5.5`; the stream selected-model metadata
contains `claude-opus-5.5`. At `runFinished`, Kiro stream metadata reported
12.003287369154226 session credits (metadata, not an account invoice).
Headless only: no 3D, model, sound, art, animation,
UI activation, renderer, controller, `src/game`, card, deck or CI change.

## Problem

The presenter rejected `trap-set` and `trap-trigger` as unsupported, so a trap
match could not be played through it. Contract:
[trap-prototype-contract.md](../submission/trap-prototype-contract.md)
section 5 (fixed order `clash`, `trap-trigger*`, `damage*`, `defeat*`,
`result`). Also, the `clash` pause built the optional `clashReady` cue from
the damage events directly after the clash; a `trap-trigger` there ended that
scan, so no attacker got the pre-attack cue.

## Change

[`src/match/presenter.js`](../../src/match/presenter.js) only:

- `DEFAULT_PAUSES` gains `"trap-set": 150` and `"trap-trigger": 400`. Existing
  pauses are unchanged. Both events are timed pauses with no renderer call, so
  no renderer or 3D API is needed.
- `trap-set` copies the setter's `trap`, `hand` and `handCount` and its
  allowance from `batch.to`. The opponent's `to` holds only
  `{ faceDown: true, setRound }`, no hand and no `tactical`, so nothing hidden
  is copied.
- `trap-trigger` copies the cleared `trap` zone from `batch.to` and appends the
  event's revealed `cardId` to the owner's displayed discard. The whole
  discard is not copied from `to` at this point, because `to` already holds
  troops that the later `defeat` events of the same clash remove; those
  defeats still copy the discard from `to` as before. The drain check proves
  the result equals `to`.
- The `clash` lookahead skips zero or more `trap-trigger` events, then collects
  the damage attackers. The cue's `ms` is the clash pause plus those trigger
  pauses, so it lasts until the attacks start. With no trigger the call is
  identical to before. `playClash` and impact timing are unchanged; damage
  events stay consecutive.
- `enqueue` throws, before queueing, for an opponent's `trap-set` that still
  names a `cardId`. Callers must project events with `publicEvents(events,
  to.viewer)` (T4).

No new event type was added. `scheduler.js` is unchanged.

## Verification (run in this session)

New [`tests/match/trap-presenter.test.js`](../../tests/match/trap-presenter.test.js),
9 tests, fake scheduler and renderer (the renderer has no trap method).
Fixture trap IDs exist only in that file and reach the rules through the
`cards` option on cloned `createMatch(seed, { traps: true })` states. Batches
are `publicState` and `publicEvents` for one viewer.

| Property | Test |
| --- | --- |
| Set-then-trigger scenarios with one and two troops per side, both viewers: every batch drains, displayed deep-equals `batch.to`, no renderer trap call | 1 |
| `trap-set` pause is 150 ms; own view shows `{ cardId, setRound }`, hand and `tactical: "trap"`; the opponent shows `{ faceDown, setRound }` with no hand or `tactical` | 2 |
| Before the trigger batch no renderer call or `onChange` copy names the opponent's trap; the projected opponent `trap-set` has no `cardId`; a raw one is refused by `enqueue` and nothing is queued | 3 |
| Raw event order matches section 5; each trigger clears its zone and appends its revealed card to discard during playback | 4 |
| `clashReady` lists every damage attacker past two `trap-trigger` events, with `ms` 250 + 2 × 400; attacks match the damage events in order and start together | 5 |
| A trigger that cancels the only attack (no damage event) still drains to `to` | 6 |
| `reset`, and `scheduler.advance` then `reset`, during a trigger pause: no later renderer call or `onChange`, no pending timer, displayed equals the new match | 7 |
| CPU-vs-CPU trap matches on seeds 0-19 (fixture trap in each hand, `chooseAction` with `cards`), both viewers: every batch drains to `to` with no error | 8 |
| Default (no-trap) seeds 0 and 60: SHA-256 of the full renderer trace, `onChange` copies, `drawing()` keys and end time equals the digest recorded with the 6f5f088 presenter; `publicEvents` is the identity on those events | 9 |

Test 8 corpus (rules version `orb-duel-draft-1+traps`, CPU normal both sides,
596 batches): 40 `trap-set`, 40 `trap-trigger`, 1 trigger batch with no
damage; Cowboy 9 wins, Wizard 9, 2 draws; 19 base-destroyed, 1 round-limit.
These describe a fixture with no approved card and say nothing about balance.

Recorded no-trap digests (identical before and after the change):

- seed 0 `34400b3ee4f3270e2dad218183338ca11ae5166f47197f647bd63a92a5ee979d`
- seed 60 `be4b182607dd10503dd38eb71a0b9fd1883b88580b34c861adfc07477c99dd17`

Commands and results:

- `node --test tests/match/trap-presenter.test.js`: 9 pass, 0 fail.
- Test 9 against the 6f5f088 presenter (stashed, then restored): digests
  recorded and matched.
- With the lookahead skip removed (restored afterwards): test 5 fails, 8 pass.
- `node --test tests/match/presenter.test.js tests/match/pace.test.js`
  (unchanged files): all pass.
- `npm test` (`node scripts/verify-duel.mjs`): 286 pass, 0 fail, exit 0.
- `node scripts/check-links.mjs`: 166 Markdown files, 600 links, 0 broken (run with this note added).
- `git diff --cached --check`: clean.

Not run: renderer build, browser replay, playtest. T6 changes no rendered code.

## Remaining

- The controller still passes raw `applied.events` and is not trap-aware.
  Wiring `publicEvents` there and any UI activation are outside T6.
- Any visible trap cue (face-down card, reveal) needs a design agreed with the
  user and sourced assets before it is built.
- `docs/kiro-build-log.md` entry is coordinator-owned.


## Independent coordinator follow-up (November 17, 2026)

After the Kiro-authored commit `af65974` and worker exit, the coordinator
independently inspected the changed presenter, test and evidence files and ran:

- `node --test tests/match/trap-presenter.test.js tests/match/presenter.test.js tests/match/pace.test.js`: **21 pass, 0 fail**.
- `npm test`: **286 Node tests pass**, 2/2 structural animation-file checks (not visual quality).
- `node scripts/check-links.mjs`: 166 Markdown files, 600 links, **0 broken**.
- `git diff HEAD^ HEAD --check`: pass.
- Remote `main` and worktree merge-base were both `6f5f088` at review time.
- Kiro CLI `--version`: **3.4.0**; `chat --list-models` advertised
  `claude-opus-5.5` at 2.00× credits.
- The final Kiro V3 stream contained selected-model metadata
  `claude-opus-5.5` and session credit usage **12.003287369154226 credits**.
  These are Kiro-emitted observations, not estimated usage or billing.

This coordinator documentation-only follow-up is separate from Kiro's
code/test authoring. No browser, 3D, human playtest or published UI claim.
