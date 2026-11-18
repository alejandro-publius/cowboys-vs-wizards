# Ride Out: design

Follows `requirements.md`. Same engine, same public view, no renderer change.

## Rules

- `src/game/lanes.js` holds the one-lane move: `isSlot`, `adjacentLanes(slot)`, `shiftDestinations(board, slot)` and
  `shiftTroop(board, slot, destination)`. Singularity's relocation and the ride-out both use it, so the two moves share
  one definition. The troop object itself moves.
- `createMatch` (`state.js`) validates the flag and stores `state.rideOut` only when it is on. No RNG draw, no new
  allowance key.
- `actions.js`: `rejection` returns `invalid-action` for a ride-out on a match without the flag, before every other check,
  exactly where an unknown type failed before. `rideOutRejection` follows RO-4 order. `applyRideOut` moves the troop, sets
  `summonUsed` and emits the event. A summon already rejects with `summon-used` and a spell only checks `castUsed`, so
  neither needs a change.
- `legal.js` lists ride-outs after spells and trap sets, before end-phase. `view.js` copies `state.rideOut` into the view.

## CPU

The same scoring functions score the move:

- `boardsAfter` moves the viewer's troop copy, so Normal's one-clash `score` and Hard's two-clash `hardScore` both see it.
- Normal: the summon step chooses among summons and ride-outs together, with the same floor (`stay + 1`). Summons are
  listed first and a later action must score strictly higher, so a summon wins a tie. A spell may follow, as after a summon.
- Hard: `viewAfter` treats the move as using the summon allowance without touching the hand. The move is valued like a
  summon: alone, or with the best spell that may follow. Ride-outs come last in the loop, so a ride-out replaces the
  current pick only with a strictly higher value. A spell, summon or end-phase wins a tie.
- Easy is Normal without spells, unchanged in shape.

## Experiment harness

`scripts/compare-ride-out.mjs --lane development|holdout --cpu normal|hard [--out <file>]`

- Seeds are fixed per lane. Each seed is played twice per arm, once with each faction first. Arms: `shipped`
  (`createMatch(seed)`) and `rideOut` (`createMatch(seed, { rideOut: true })`). Both seats use the same level.
- After every action: card conservation per side and troop health between 1 and the card's printed health.
- RO-9: the two arms play the same actions and events until the first ride-out; a ride-out match with no ride-out
  must equal the paired shipped match action for action. At the first ride-out, the level's choice from the view
  without the move must equal the action the shipped match played there.
- Phase: one side's turn in one round. Its first decision is the one with neither allowance used.
  An opportunity is a phase whose first decision lists a ride-out. For each opportunity the harness records whether a
  summon, free summon, tribute summon or spell was also legal, the level's shipped choice from the same view with
  `rideOut` removed, and what the level did.
- A use is classified from the view before the move. **Gives up protection**: an enemy troop stood opposite the source
  lane. **Move kinds**: break-out (enemy opposite the source only), block (opposite the destination only), re-match
  (both), reposition (neither). **Base pressure**: total attack of own troops with no enemy opposite. Stalled means
  no Base pressure before the move; racing means some; a mutual stall means neither side had any.
  **Lead**: own Base orbs minus enemy Base orbs.
- First-divergence uses are the first ride-out of a paired match, where both arms share the full history. They
  carry the riding side's paired outcome (better, same or worse), its result in each arm and the example boards.
- Paired statistics use the seed as the unit (two matches), as in `scripts/compare-opening-policies.mjs`.
- Examples: three slots, each filled by the first first-divergence use in seed order that qualifies, one slot per
  use, in this priority: gives up protection, changed the riding side's result, shipped choice was a summon.
  The runner fills them by rule; the note shows the first slot of each holdout lane.
