# Trap zone and faster pacing: requirements

Author: Kiro CLI 3.4.0 V3. Issue: alejandro-publius/cowboys-vs-wizards#60. Base: main 8ace1ce.
Status: SPEC ONLY. No runtime code, art, dependency or deck change is part of this job.
Scope: original Orb Duel (rules version `orb-duel-draft-1`), not the retro build.

Design inspiration only: Yu-Gi-Oh's rule that a trap cannot act the turn it is set, and
Pokemon's few, predictable per-turn actions. No names, art, text or economies are imported.

## Glossary

- Trap zone: one extra slot per side, separate from the three troop lanes.
- Set: move a spell card from hand, face-down, into the trap zone.
- Armed: a set trap that may trigger. Spent: triggered once, card moved to discard.
- Flag: `createMatch(seed, { traps: true })`. Default is off.

## Requirements

R1 One zone per side. Each side has exactly one trap zone. The three troop lanes, tribute
   summons and the 1-5 orb rule are unchanged. A second set while the zone is occupied is rejected.

R2 Set action. `{ type: "set-trap", side, revision, cardId, actionId? }`. Legal only for the active
   side, a spell in hand, empty zone, flag on, and `castUsed` false. A set consumes the side's
   cast allowance for the round (so a set and a cast are exclusive, as summon-after-spell already is).

R3 One-turn delay. A trap set in round N cannot trigger in round N. Recommended rule is
   interpretation A (see design.md): armed when `round > setRound`.

R4 One auto-trigger, defensive. At the start of a clash, an armed trap cancels the single
   highest-attack enemy troop's attack for that clash (ties: lowest lane). It then goes to discard.
   No choice, no targeting input, no second effect.

R5 Hidden from the opponent. The opponent's public view shows `{ faceDown: true, setRound }`
   and never the card ID until it triggers. The setter sees its own card ID. The `trap-set` event
   is redacted per viewer.

R6 Card conservation. A card is in exactly one of: deck, hand, board, trap zone, discard.
   Set: hand to zone. Trigger: zone to discard. Total card count per side is constant.
   Triggering never draws, shuffles or touches RNG.

R7 No deck mechanic change. Deck sizes, `validateDeckIds`, shuffles and draw order are untouched.
   Only existing spell cards may be set. No new card, art or stat is added. Open decision O1:
   the set card's own spell effect is lost while set, which is the cost of the trap.

R8 Determinism. Same seed, deck and action list give the same events with the flag on.
   With the flag off, state, events and replays are identical to 8ace1ce (seeds 0 and 60).

R9 Simultaneous clash. If both sides have armed traps, each is evaluated against the pre-trigger
   board snapshot. Trigger events are emitted in `SIDES` order, then all cancellations apply at once.
   Neither trap can cancel the other, and order cannot change the outcome.

R10 Restart and epoch. A new match clears every trap. The scheduler epoch advance drops pending
    trigger presentation. A late callback from an older match never mutates the new one.

R11 CPU. The CPU reads only its public view. It may set a trap with a deterministic rule (no RNG).
    It cannot see the opponent's card. Legal-action list for the CPU includes `set-trap` only when legal.

R12 Pacing (optional). A fast-play option shortens non-damage pauses only. Damage and defeat
    event order, and the ordering of impacts, is unchanged. No latency is claimed as measured.

## Out of scope

Trap card art or models, more than one trap, offensive traps, trap draw/search, deck edits,
retro build, balance claims, renderer changes (a face-down marker is a later, user-planned asset task).

## Open decisions for the owner

O1 Any spell vs a dedicated trap card. This spec assumes any spell (no deck change).
O2 Should a set consume the cast allowance (assumed yes, predictable and pace-friendly)?
O3 Should the tie-break be lowest lane (assumed) or rule out ties by card order?
