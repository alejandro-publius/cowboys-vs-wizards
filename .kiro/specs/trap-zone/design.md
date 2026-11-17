# Trap zone and pacing: design

Author: Kiro CLI 3.4.0 V3. Spec only. Files named below are where a later task would edit; none are edited now.
Read for this design: `src/game/{state,actions,legal,view,clash}.js`, `src/match/{presenter,scheduler,controller}.js`.

## 1. Delay interpretations

Current turn shape: each round has two action phases (`startingSide` first, then the other), then one
simultaneous clash on the second side's `end-phase`; `startingSide` alternates each round.

| | A. Next round (armed when `round > setRound`) | B. Next own action phase (armed after the setter's next `phase-start`) |
|---|---|---|
| Set in round N by the first actor | Cannot trigger at the round N clash; can at round N+1 | Own next phase is round N+1, same result |
| Set in round N by the second actor | Same: first possible clash is N+1 | Same |
| Rule to state | One comparison on a stored number | Needs a per-side phase counter or armed flag flipped at phase-start |
| State added | `setRound` | `setRound` plus a flip hook in `applyEndPhase` |
| Round 9 (`MAX_ROUNDS`) | Set in round 9 never fires (round-limit ends match) | Same |

Both give the same first trigger clash, because every side gets exactly one phase per round and the clash
is the last event of the round. They differ only if phases ever become unequal (not in this ruleset).

**Recommendation: A.** It is a single stored integer, checked at clash time with no new event or hook,
and it gives a trap set in round N a protective effect from round N+1, which keeps the game moving. It
also gives the players one fixed, predictable rule ("set this round, live next round"). B adds
state for no observable difference today.

## 2. State (behind `traps` flag, default false)

```
state.traps = { enabled: bool }                       // only when createMatch(..., { traps: true })
sides[side].trap = null | { cardId, setRound }        // hidden zone; absent key when flag off
```
When the flag is off, `trap` is not added and `traps` is not added, so `structuredClone(state)` and
every existing replay are byte-identical to 8ace1ce. `RULES_VERSION` becomes `orb-duel-draft-1+traps`
only when the flag is on.

## 3. Action and events

Action: `{ type: "set-trap", side, revision, cardId, actionId? }`.

Rejections, first failing wins, added to `REJECTIONS` in `actions.js` after the shared checks
(`match-over`, `invalid-action`, `duplicate-action`, `stale`, `wrong-side`):
`traps-disabled`, `cast-used`, `card-not-in-hand`, `not-a-spell`, `trap-zone-full`.

Apply: remove card from hand, set `trap = { cardId, setRound: round }`, `allowances.castUsed = true`.
Event: `{ type: "trap-set", side, revision, actionId? , cardId }`. No RNG draw.

`legal.js`: if flag on, `!castUsed`, zone empty, add one `set-trap` per distinct spell in hand, after
spells and before `end-phase`. Existing order (summons, spells, end-phase) is kept when the flag is off.

## 4. Trigger (in `resolveClash`, before the attack snapshot loop)

1. For each side in `SIDES` order, if `trap && trap.setRound < round`, pick the target: the enemy troop
   with the highest `CARDS[id].attack` on the pre-trigger board; tie to the lowest lane. No target means
   the trap stays set (no waste).
2. Compute all triggers from that snapshot, then emit and apply together (R9): remove the target's
   attack entry from `attacks`, move trap card to discard, set `trap = null`.
3. Event, emitted before the `clash` damage events: `{ type: "trap-trigger", side, cardId, target: { side, slot, cardId }, cancelled: attack }`.
   `damage` events for the cancelled attacker are not emitted. Impact order of the remaining damage is unchanged.

Because the `clash` event is emitted just before `resolveClash`, the order is `clash`, `trap-trigger*`,
`damage*`, `defeat*`. Presenter groups damage events, so `trap-trigger` plays as one pause-type event.

## 5. Public view and hidden information (`view.js`)

- Viewer's own side: `trap: { cardId, setRound }` or null.
- Opponent: `trap: { faceDown: true, setRound }` or null. `cardId` never appears.
- Events to the opponent: `trap-set` is redacted to `{ type, side, revision, actionId }` (no `cardId`),
  matching how `draw` already hides the card. `trap-trigger` is public, since the card is revealed on use.
- `discard` already public, so the spent card is visible then.
- CPU: `chooseAction(publicState(state, "wizard"))` sees only its own trap. Rule sketch (no RNG):
  set a trap if it holds a spell, is `castUsed` false and no spell has a legal target worth casting; left to a later task.

## 6. Presenter and restart

Add `trap-set` and `trap-trigger` to `EVENT_TYPES` and `DEFAULT_PAUSES` (`trap-set: 150`, `trap-trigger: 400`);
patch `displayed.sides[side].trap` from `batch.to` at the event, so the final deep-equal check still holds.
Renderer gets no required method; an optional `trapCue` is a later art task (needs user-planned asset).
Restart goes through `scheduler.advance()` and `presenter.reset`, which already drops pending trigger
callbacks; `createMatch` builds `trap: null` fresh, so no trap survives a restart.

## 7. Pacing (observed constants, no latency measured)

Top 3 current waits, from source (milliseconds are scheduler timers, excluding renderer cue lengths that
I did not read):

1. CPU request delay: `cpuDelay = 600` in `createController` (`src/match/controller.js:87`), applied through
   `scheduler.after(cpuDelay, ...)` at line 147 before every CPU action, including its `end-phase`. A Wizard
   phase with a summon, a spell and an end is up to 3 x 600 = 1800 ms of waiting before any animation.
2. Round turnover chain: `DEFAULT_PAUSES["round-start"] = 500`, visible draw `VISIBLE_DRAW_PAUSE = 450`
   (Cowboy), hidden-hand draw `draw: 250` (Wizard), `"phase-start": 350` in `src/match/presenter.js`.
   Played in order, these total 500 + 450 + 250 + 350 = 1550 ms per round with no input possible.
3. Clash lead-in: `"phase-end": 150` plus `clash: 250` (also the `clashReady` cue length, passed as `pause`),
   so 400 ms elapse before the first attack starts; the second phase-end repeats `phase-end` before it.

**Optional fast-play proposal** (default off, `?pace=fast` or a `pace` option; touches only pause constants):
`cpuDelay 600 to 250`; `round-start 500 to 250`; `phase-start 350 to 150`; `draw 250 to 120`;
`VISIBLE_DRAW_PAUSE 450 to 300`; `phase-end 150 to 80`. Leave `clash`, `result`, `damage`, `defeat` and
all renderer cue times unchanged, so `clashReady` lead-in, attack impact order and the "same-target
impacts never overtake" rule in `playClash` are untouched. `createPresenter` already takes `pauses`
overrides, and the controller already takes `cpuDelay`, so this needs no new mechanism. Expected saving
(arithmetic only, not measured): 350 + 250 + 200 + 130 + 150 + 70 = about 1150 ms per Cowboy-visible round
plus 350 ms per CPU action. Needs a timed browser run to confirm.

## 8. Risks

- A set card is not castable, so trap use costs tempo; fine for a first version, tune after playtest.
- Flag-off parity is the main safety net. Never add a key to `state` when the flag is off.
- `legalActions` consumers (CPU, UI, tests that pin action counts) must be checked with the flag on.
