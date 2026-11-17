# Trap zone and faster pacing: requirements

Author: Kiro CLI 3.4.0 V3. Issue: alejandro-publius/cowboys-vs-wizards#60. Base: main 8ace1ce.
Status: SPEC ONLY. No runtime code, art, dependency or deck change is part of this job.
Update (issue #85, base 769a4fc): first experimental prototype is A + X, chosen by the coordinator. The Kiro study (PR #84) recommended B + X for easier integration; B + X and A + Y stay as alternatives. See `docs/submission/trap-prototype-contract.md`. The requirements below are written for A + X and agree with the contract; B + X is described only as an alternative.
Scope: original Orb Duel (rules version `orb-duel-draft-1`), not the retro build.

Design inspiration only: Yu-Gi-Oh's rule that a trap cannot act the turn it is set, and
Pokemon's few, predictable per-turn actions. No names, art, text or economies are imported.

## Glossary

- Trap zone: one extra slot per side, separate from the three troop lanes.
- Trap card: a dedicated card kind `trap` with its own unique ID. It is not a troop and not a spell.
- Set: move a trap card from hand, face-down, into the trap zone.
- Armed: a set trap that may trigger. Spent: triggered once, card moved to discard.
- Flag: `createMatch(seed, { traps: true })`. Default is off. The flag enables the zone and the `trap` kind; it adds no cards.

## Requirements

R1 One zone per side. Each side has exactly one trap zone. The three troop lanes, tribute
   summons and the 1-5 orb rule are unchanged. A second set while the zone is occupied is rejected.

R2 Set action (A: shared allowance). `{ type: "set-trap", side, revision, cardId, actionId? }`. Legal only for the active
   side, a card of kind `trap` in hand, empty zone, flag on, and `round < MAX_ROUNDS`. A set uses the same allowance as a cast
   (`castUsed`), so a phase is: summon, then one spell OR one trap. Never both. Flag-on state records which with
   `allowances[side].tactical = null | "spell" | "trap"`. A set blocks a later summon like a cast does.
   Rejections after the shared checks, first failing wins: `traps-disabled`, `card-not-in-hand`, `not-a-trap`,
   `trap-too-late` (round 9), `trap-zone-full`, `trap-after-spell`. Existing actions gain, flag on only,
   `summon-after-trap` and `cast-after-trap`. Reasons, order and player text are in the contract section 3.
   Rejections return the same state object and emit no event.

R3 One-turn delay. A trap set in round N cannot trigger in round N. Recommended rule is
   interpretation A (see design.md): armed when `round > setRound`.

R4 One auto-trigger, defensive (X). At the start of a clash, an armed trap cancels the attack (not the troop) of the single
   highest-attack enemy troop for that clash (ties: lowest lane). The troop stays on the board. It then goes to discard.
   With no enemy troop the trap stays set. `trap-trigger` is emitted before every `damage` event of that clash.
   No choice, no targeting input, no second effect.

R5 Hidden until triggered. The opponent's public view shows `{ faceDown: true, setRound }`
   and never the card ID until it triggers. The setter sees its own card ID. The `trap-set` event
   is redacted per viewer.

R6 Card conservation. Every trap card has a unique ID and is in exactly one of: deck, hand, trap zone,
   discard. Set: hand to zone. Trigger: zone to discard. Total card count per side is constant.
   Triggering never draws, shuffles or touches RNG.

R7 Dedicated trap kind, no content yet. Only cards of kind `trap` may be set; no existing spell is
   converted or repurposed. This spec adds no card name, art, stat or copy count, and the default
   decks, `validateDeckIds`, shuffles and draw order are unchanged. Trap cards enter play only through
   a later, flag-gated card prototype and deck migration (see design.md section 8). Until that is
   approved, flag-on matches have no trap cards and the zone stays empty; tests use a test-only
   fixture card kind, not the shipped card table.

R8 Determinism. Same seed, deck and action list give the same events with the flag on.
   With the flag off, state, events and replays are identical to 8ace1ce (seeds 0 and 60).

R9 Simultaneous clash. If both sides have armed traps, each is evaluated against the pre-trigger
   board snapshot. Trigger events are emitted in `SIDES` order, then all cancellations apply at once.
   Neither trap can cancel the other, and order cannot change the outcome.

R10 Restart and epoch. A new match clears every trap. The scheduler epoch advance drops pending
    trigger presentation. A late callback from an older match never mutates the new one.

R11 CPU. The CPU reads only its public view (own trap card ID, opponent `{ faceDown, setRound }`). It may set a trap with a deterministic rule (no RNG).
    It cannot see the opponent's card. Legal-action list for the CPU includes `set-trap` only when legal.

R12 Pacing (optional). A fast-play option shortens non-damage pauses only. Damage and defeat
    event order, and the ordering of impacts, is unchanged. No latency is claimed as measured.

R13 Round 9. A set in the last round can never spring and is rejected with `trap-too-late`. An already armed trap may
    still trigger in round 9.

## Alternatives and reversal

B + X (separate `trapSet` allowance) and A + Y (prevent at most 1 damage) are retained. Reversal criteria for A and X are
in the contract section 8. Thresholds are proposals for the user, not measured.

## Out of scope

Naming or statting any trap card, trap card art or models, more than one zone, offensive traps, trap draw/search, deck edits,
default deck changes, retro build, balance claims, renderer changes (a face-down marker is a later, user-planned asset task).

## Decisions and open items

D1 (resolved by the user) The zone is for dedicated trap cards. Converting any spell into a trap is
   rejected: it makes every spell a hidden-defense option, removes the spell's own role, and gives no
   reason to add a card type. It is kept only as a rejected shortcut in design.md.
O1 Card prototype: name, copy count per deck, art and card copy need user approval before any work
   (AGENTS.md sourcing rule). Pending.
O2 Deck migration: which decks gain trap cards and whether `DECKS` sizes change. Pending, flag-gated.
O3 Tie-break for equal attack: assumed lowest lane. Pending.
