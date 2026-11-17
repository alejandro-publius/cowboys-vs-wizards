# Trap zone and pacing: design

Author: Kiro CLI 3.4.0 V3. Spec only. Files named below are where a later task would edit; none are edited now.
Read for this design: `src/game/{state,actions,legal,view,clash}.js`, `src/match/{presenter,scheduler,controller}.js`.

> Update (issue #85, base 769a4fc): the canonical prototype is **A + X**: trap setting shares the cast allowance
> (`castUsed` plus `tactical`). B + X, the Kiro PR #84 study recommendation with a separate `trapSet` allowance, is kept only
> as a rejected-for-now alternative in section 10. Nothing is shipped or implemented.
> The letters A and B in section 1 below name delay interpretations and are unrelated to the allowance options A and B.

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

Card kind: a new `kind: "trap"` (unique card ID, no attack, health or tribute cost) beside `troop` and
`spell`. The kind and zone exist only behind the flag; no trap card is defined in this spec.

```
state.traps = { enabled: bool }                       // only when createMatch(..., { traps: true })
sides[side].trap = null | { cardId, setRound }        // hidden zone; absent key when flag off
allowances[side].tactical = null                      // flag on only: null | "spell" | "trap", reset each round-start
```
`castUsed` stays the single shared allowance for one spell or one trap. `tactical` records which one was used, so the
rejection can name it. No `trapSet` key exists in the prototype. When the flag is off, `trap`, `traps` and `tactical` are
not added, so `structuredClone(state)` and every existing replay are byte-identical to 8ace1ce. `RULES_VERSION`
becomes `orb-duel-draft-1+traps` only when the flag is on.

## 3. Action and events (A: shared allowance)

Action: `{ type: "set-trap", side, revision, cardId, actionId? }`.

Phase shape: optional summon, then at most one of one spell or one trap, then `end-phase`. Choosing a spell or a trap
before summoning forfeits that round's summon (the summon is then rejected), so the UI tooltip warns first (contract section 3).

Rejections, first failing wins, after the shared checks (`match-over`, `invalid-action`, `duplicate-action`, `stale`,
`wrong-side`): `traps-disabled`, `card-not-in-hand`, `not-a-trap` (spells and troops land here), `trap-too-late`
(round === `MAX_ROUNDS`), `trap-zone-full`, `trap-after-spell` (`tactical === "spell"`).
For existing actions, flag on only: `summonRejection` returns `summon-after-trap` and `spellRejection` returns
`cast-after-trap` when `tactical === "trap"`. Spell paths keep `summon-after-spell` and `cast-used`.

Apply: remove card from hand, set `trap = { cardId, setRound: round }`, `castUsed = true`, `tactical = "trap"`.
`summonUsed` is untouched. Event: `{ type: "trap-set", side, revision, actionId?, cardId }`. No RNG draw.

`legal.js`: if flag on, `!castUsed`, zone empty, `round < MAX_ROUNDS`, add one `set-trap` per distinct trap card in hand,
after spells and before `end-phase`. Existing order (summons, spells, end-phase) is kept when the flag is off.

## 4. Trigger (in `resolveClash`, before the attack snapshot loop)

1. For each side in `SIDES` order, if `trap && trap.setRound < round`, pick the target: the enemy troop
   with the highest `CARDS[id].attack` on the pre-trigger board; tie to the lowest lane. No target means
   the trap stays set (no waste).
2. Compute all triggers from that snapshot, then emit and apply together (R9): remove the target's
   attack entry from `attacks`, move trap card to discard, set `trap = null`. The move to discard is part of this state transition; there is no standalone `discard` event for it.
3. Event, emitted before the `clash` damage events: `{ type: "trap-trigger", side, cardId, target: { side, slot, cardId }, cancelled: attack }`.
   `damage` events for the cancelled attacker are not emitted. Impact order of the remaining damage is unchanged.

The cancelled attack is removed, so no `damage` event exists for it (X). A reduced or zero `damage` event belongs to Y only.
Next-turn ordering across rounds is in the contract section 5.

Because the `clash` event is emitted just before `resolveClash`, the order is `clash`, `trap-trigger*`,
`damage*`, `defeat*`. Presenter groups damage events, so `trap-trigger` plays as one pause-type event.

## 5. Public view and hidden information (`view.js`)

- Viewer's own side: `trap: { cardId, setRound }` or null.
- Opponent: `trap: { faceDown: true, setRound }` or null. `cardId` never appears.
- Events to the opponent: `trap-set` is redacted to `{ type, side, revision, actionId }` (no `cardId`),
  matching how `draw` already hides the card. `trap-trigger` is public, since the card is revealed on use.
- The spent card is revealed by `trap-trigger` (which carries `cardId`) and then appears in the public discard pile of `to`. No separate `discard` event is emitted for it.
- Flag-on `allowances` of the opponent need not be exposed; `tactical` is shown only on the viewer's side.
- Flag-on `allowances` of the opponent need not be exposed; `tactical` is shown only on the viewer's side.
- CPU: `chooseAction(publicState(state, "wizard"))` sees only its own trap. Rule sketch (no RNG): summon first if the
  existing rule would; then, if it holds a trap card, the zone is empty, `round < MAX_ROUNDS` and `set-trap` is legal,
  set it; otherwise cast as today; otherwise end. Final rule is a later task (T5).

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

## 8. Card prototype and deck migration (future, flag-gated, needs user approval)

Not part of this spec: trap card name, art, card copy, stats, copy count, and which `DECKS` gain it.
Required before implementation: (1) user approves the design, art source and copy count (AGENTS.md
sourcing rule); (2) a generated card spec under `.kiro/specs/duel-card-pipeline/cards/` with kind `trap`,
then `sh scripts/check-card-specs.sh`; (3) a flagged deck variant, for example `DECKS_TRAPS`, leaving the
default `DECKS` and `validateDeckIds` results unchanged; (4) a new `RULES_VERSION` and a fresh balance run.
Until then trap tests use a fixture card injected by the test only.

Rejected shortcut: let any spell be set face-down as a trap. It needs no new card, but it makes every
spell a hidden-defense option, removes that spell's role, forces `legal.js` and balance reasoning to
treat each spell twice, and does not match the request for a slot for trap cards. Not recommended.

## 9. Risks

- Trap cards cost a hand slot and a deck slot once added; tune after playtest.
- Flag-on matches have no trap cards until the migration lands, so the zone is inert by default.
- Flag-off parity is the main safety net. Never add a key to `state` when the flag is off.
- `legalActions` consumers (CPU, UI, tests that pin action counts) must be checked with the flag on.

## 10. Alternative B + X (rejected for now, kept for reversal)

Kiro's PR #84 study recommended B + X because it is additive. The coordinator chose A + X for the first prototype for
faster, strategically meaningful turns. B is not the prototype. If the reversal criteria in the contract (section 8) are met,
B is a small change:
- State: `allowances[side].trapSet = false`, reset each round-start. No `tactical` field.
- Rejections after the shared checks: `traps-disabled`, `trap-set-used`, `card-not-in-hand`, `not-a-trap`, `trap-zone-full`
  (and `trap-too-late`). `summonUsed` and `castUsed` and their rejections are untouched; no `summon-after-trap`, `cast-after-trap` or `trap-after-spell`.
- Apply: set `trapSet = true`. A phase may hold summon, spell, trap and end (four actions).
- `legal.js`: add `set-trap` when `!trapSet`, zone empty, `round < MAX_ROUNDS`.
- Everything else (trigger, view, events, presenter, restart) is identical to A.
