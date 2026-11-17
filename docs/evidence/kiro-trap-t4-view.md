# Trap T4: public view and event projection (issue #94)

Date: 2026-11-17 (America/Los_Angeles). Base: `main` at 3b99990, after T1 #91,
T2 #93 and T3 #96. Branch `kiro/trap-view-94`. Work done by Kiro (Kiro IDE
session, Claude Opus 5.5 reported by the session context). Headless rules work
only: no 3D, model, sound, art, CPU, renderer, animation or CI change.

## Problem

On a `traps: true` match, `publicState` did not expose either trap zone or the
`traps` flag, and it copied both sides' `allowances` including `tactical`.
`legalActions(view, viewer)` therefore could not see the flag or the viewer's
zone, and the raw `trap-set` event (which names the card) had no projection for
the opponent. Contract: [trap-prototype-contract.md](../submission/trap-prototype-contract.md)
sections 5 and 6.

## Change

[`src/game/view.js`](../../src/game/view.js):

- `publicState(state, viewer)`, only when `state.traps.enabled === true`:
  - `sides[viewer].trap`: `{ cardId, setRound }` or `null`.
  - `sides[opponent].trap`: `{ faceDown: true, setRound }` or `null`. No ID.
  - `allowances[opponent]` keeps `summonUsed` and `castUsed` only; the
    viewer's own entry keeps `tactical`.
  - `traps: { enabled: true, rulesVersion }`, so `legalActions(view, viewer)`
    lists `set-trap` exactly as on the full state.
- Flag off (or `traps.enabled !== true`): the code path and output are the
  pre-T4 ones.
- New pure export `publicEvents(events, viewer)`: deep-copies each raw event;
  removes `cardId` from a `trap-set` whose `side` is not the viewer. The
  owner's `trap-set` and every `trap-trigger` keep `cardId` (a trap is public
  once used). All other events are copied unchanged.

`publicEvents` is **not wired** to the controller or UI. Wiring is T6.

## Verification (run in this session)

New [`tests/game/trap-view.test.js`](../../tests/game/trap-view.test.js), 7
tests, real `applyAction`/`legalActions` with a test-only `cards` option
holding two fixture trap IDs on a cloned `createMatch(0, { traps: true })`.
Shipped `CARDS` and `DECKS` are unchanged. Each side sets its trap in round 1
and both traps trigger at the round 2 clash.

| Property | Test |
| --- | --- |
| Own trap `{cardId, setRound}`, opponent `{faceDown, setRound}`, empty `null`, both viewers and both sides; opponent ID absent from the view JSON | test 1 |
| Opponent's `tactical` hidden, owner's visible, `traps` marker present | test 2 |
| No `seed`, `rng`, `deck`, `actionIds` keys; no opponent hand or any deck ID in the JSON; round, revision and counts equal the state | test 3 |
| `legalActions(publicState(s, v), v, fixture)` equals the full-state list before and after a set, and every listed action is accepted | test 4 |
| `trap-set` redacted for the opponent only; `trap-trigger` reveals; no opponent trap ID before the trigger; raw log not mutated | test 5 |
| Mutating a view or projected event leaves the source state and log unchanged; bad viewer throws | test 6 |
| Flag off, seeds 0 and 60, default CPU match: every view at every revision, both viewers, has the same JSON (keys and order) as a copy of the pre-T4 function; `publicEvents` is identity on those logs; `traps.enabled: false` also matches | test 7 |

Commands and results:

- `node --test tests/game/trap-view.test.js`: 7 pass, 0 fail.
- Same file against the pre-T4 `view.js` (restored afterwards): fails
  (`publicEvents` is not exported).
- `node scripts/verify-duel.mjs` (Node suites plus GLB structure preflight):
  267 tests, 267 pass, exit 0.
- `node scripts/check-links.mjs`: 162 Markdown files, 582 links, 0 broken (with this note tracked).
- `git diff --cached --check`: clean.

## Known limits and remaining work

- Opponent `castUsed: true` with no `spell` event still implies a set trap.
  This is already public through the face-down zone, so it is not a new leak.
- T5 (CPU trap choice) and T6 (wiring `publicEvents` into controller/UI) are
  not started. No browser replay was run; none is needed for this headless
  change.
- `docs/kiro-build-log.md` was not updated, because this task limited the
  changed files to three. The coordinator can add the log entry.
- Selected-model and credit usage: this session ran in Kiro IDE, not
  `kiro-cli --model claude-opus-5.5` with JSON stream output, so no CLI usage
  receipt or credit count exists for it. None is claimed.
