# Trap rule decision: allowance (A or B) and effect (X or Y)

Author: Kiro CLI 3.4.0 V3. Date: 2026-11-17, America/Los_Angeles. Issue #78. Status: recommendation for the user. Nothing is chosen, shipped or implemented.
Evidence and method: [docs/evidence/kiro-trap-choice-study.md](../evidence/kiro-trap-choice-study.md). Lab: [experiments/trap-balance/](../../experiments/trap-balance/).

## The two choices

| | X: cancel the highest-attack enemy attack | Y: prevent at most 1 damage of that attack |
|---|---|---|
| **A: trap shares the cast allowance** (summon, then spell or trap) | AX | AY |
| **B: separate trapSet allowance** | BX | BY |

Fixed in all four: one dedicated trap slot per side, card kind `trap` (not a spell), armed from the next round, one use then discard, opponent's card hidden, simultaneous clash. No card name, art, stat or copy count is proposed.

## What the study can and cannot say

It is a shadow model: the real engine and CPU run everything except the trap, and the trap is re-implemented in the lab. The CPU does not know traps exist, and the trap card is an extra card outside the 12-card deck. It gives direction and exact event behavior. It does not give shipped-game win shares, and nothing here is a human playtest.

## Findings

1. **Allowance A against B is a small difference.** With a trap in the opening hand the two give identical results, because the allowance never binds. Where it does bind (trap arrives in round 4, CPU prefers the trap), A forgoes 0.26-0.57 casts per match and costs the setter about 1-1.5 win-share points in the negative control (intervals touch zero). B lets a phase hold 4 actions (summon, cast, trap, end), in about 46% of matches at that arrival. A keeps 3.
2. **A has a rules trap.** The engine rejects a summon after a cast (`summon-after-spell`). If a trap is literally a cast, setting it before summoning silently costs the summon. The study CPU summons first, so that cost is not in the numbers.
3. **Effect X against Y is also small and mostly invisible in symmetric play.** No symmetric row separates them at 1000 seeds. They differ only when the target has attack 2 or more. The auto-trigger usually spends the trap on the first available troop. In the one-sided stress test X is about twice as strong as Y when the trap arrives in round 4 (+14 to +16 vs +8 to +10 points) and about equal when it arrives in round 1.
4. **The real hazard is asymmetry.** One free trap on one side moves that faction's win share by about 8 to 22 points under either effect. Copy count and draw odds per faction matter more than X against Y.
5. **Exact behavior checks out.** One-round delay, one slot, single-use discard, highest attack with lowest-lane tie, empty board keeps the trap, simultaneous triggers from a snapshot, round-9 dead set, hidden face-down view and no-trap parity pass in the lab (13 tests).

## Recommendation (for a feature-flagged prototype only)

**Take forward B + X**, as already written in `.kiro/specs/trap-zone/design.md`, and keep **Y as a ready fallback**.

- **B** because it is additive. It leaves `summonUsed`, `castUsed` and the summon-after-spell rule untouched, so there is no hidden "set a trap and lose your summon" outcome, and flag-off parity stays simple. The decision-load cost is real but small: one extra decision, only in phases where a trap is held, about +6% actions per match in the shadow. If a human playtest finds 4-action phases confusing, switch to A with the explicit rule that a trap is set after the summon and counts as the cast.
- **X** because it is legible ("that attack does nothing") and it is the only variant that still matters when the highest attacker has attack 3. Y is a weaker, less swingy option: it equals X against attack-1 troops and prevents only 1 of the 3 damage from the biggest troop. Switch to Y if a prototype playtest finds trap games decided by a single cancelled big attack, or if one-faction swing exceeds the gate below.

Confidence is low to moderate: the shadow model separates A from B and X from Y only in stress cases, so the choice rests on rules clarity and implementation simplicity more than on a measured balance gap.

## Experiments needed before any real game implementation

Each is a gate. None has been run.

1. **User approval** of the trap card concept, art source, copy count per deck, and which existing card (if any) leaves a 12-card deck. A silent spell replacement is not allowed.
2. **Real engine prototype behind the `traps` flag** (production task T1-T3), then rerun this study on the real `applyAction`, not the shadow. Pass condition: flag-off replays for seeds 0 and 60 are byte-identical to the current baseline, and the shadow and real results agree on the event order.
3. **A trap-aware CPU rule** (public view only, no opponent card, no RNG), including "never set in round 9". Rerun the symmetric and one-sided grids with it.
4. **Faction balance gate:** with the user-approved copy counts and real draws (a trap in a 12-card deck, not in hand), each faction's Cowboy-versus-Wizard win share on at least 2000 matched seeds stays inside a band agreed with the user in advance, and no single trap card moves one faction by more than a pre-agreed limit (set it with the user; the shadow's 8-22 points for a free trap in hand is far above any acceptable value).
5. **Decision-load playtest** with 3-5 humans per allowance variant: count clicks and hesitation per phase, and ask whether trap-or-spell (A) or four decisions (B) is clearer. This is the only way to support a claim about clarity or fun.
6. **Presenter check:** a `trap-trigger` before `damage`, X (no damage event) and Y (a zero-amount damage event) both play without breaking the "same-target impacts never overtake" rule.
7. **Round-9 and lethal cases** in the real engine: a set in round 9 is refused or warned in the UI, and a trap that prevents lethal base damage ends the match correctly at the round limit.
