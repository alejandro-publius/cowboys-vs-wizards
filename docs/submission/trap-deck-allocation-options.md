# Trap deck allocation: options for the user (issue #87)

Author: Kiro CLI 3.4 V3 (claude-opus-5.5). Base: main a327b1b. Status: PROPOSAL ONLY.
Nothing here is approved. No card name, effect change, art, copy count or deck content is decided.
Production `CARDS`, `DECKS`, specs and UI are unchanged. Numbers come from
[the exact odds experiment](../../experiments/trap-deck-odds/odds.js); the run and its output are in
[the evidence note](../evidence/kiro-trap-deck-odds.md).

## What the numbers say

Both factions ship 6 free / 3 mid-tier / 1 legendary / 2 spells, so any swap gives Cowboys and
Wizards identical draw odds. Parity holds if both sides make the same swap. "Spell-or-trap"
means a card that uses the shared cast allowance under A + X. Each value assumes the match reaches that round.

| Seen by start of round | T1: 1 trap, 1 spell | T2: 2 traps, 0 spells | Shipped: 2 spells |
|---|---|---|---|
| Trap in opener (4 cards) | 33.33% | 57.58% | - |
| Trap by round 2 / 4 / 6 | 41.67% / 58.33% / 75.00% | 68.18% / 84.85% / 95.45% | - |
| Spell by round 4 | 58.33% | 0% | 84.85% |
| Spell-or-trap by round 4 | 84.85% | 84.85% | 84.85% |
| First trap only in round 9 (set rejected, dead card) | 1/12 = 8.33% | 0% | - |
| First trap in round 8 (arms only for the round 9 clash) | 8.33% | 1/66 = 1.52% | - |
| Spell AND trap both drawn by round 4 (A's choice can bind) | 31.82% | 0% | 0% |
| Opener with no free troop | 3.03% | 3.03% | 3.03% |

## Interpretation under A + X (shared spell-or-trap allowance)

- **Spell access drops.** T1 halves spell copies: a spell by round 4 falls from 84.85% to 58.33%.
  T2 removes Deadeye and Singularity from the deck entirely, so each faction loses its only
  direct-damage card.
- **Total spell-or-trap access is unchanged.** Both swaps keep 2 spell-or-trap cards, so under A
  a phase still allows at most one of them, as before. A trap does not add a tactical action. It
  replaces a spell, and its value arrives one round later because it must arm.
- **When A costs a choice.** Only T1 can put a spell and a trap in hand together. Both drawn is
  necessary for the choice to bind: 9.09% in the opener, 31.82% by round 4, 54.55% by round 6.
  Then setting the trap delays the spell one round, or the other way round. Under T2 the choice
  never comes up, because there are no spells.
- **Dead and late traps.** A single trap first drawn in round 9 cannot be set (`trap-too-late`):
  1/12. If it has not appeared by round 6, that chance rises to 1/3. A round-8 draw can only
  answer the round-9 clash. Two copies remove the round-9 dead case. They add a different one:
  the second copy waits in hand while the first occupies the single zone (R1).
- **B alternative.** The #78 shadow study ([choice study](../evidence/kiro-trap-choice-study.md),
  [rule decision](trap-rule-decision.md)) recommended B + X, a separate `trapSet` allowance. The
  coordinator chose A + X for the first prototype. Under B the T1 binding case disappears: a
  phase can hold summon, spell and trap. That gives more actions per phase. These odds do not
  decide A against B.

No win rate or balance claim is made. These are draw probabilities only. No trap-aware CPU or
opponent behavior is modelled.

## Choices

1. **T1: one trap replaces one spell copy per side (recommended first flag-gated test).**
   Pros: both card kinds stay in the game. The free opener is unchanged. The trap shows up in
   a third of openers and three quarters of matches by round 6, often enough to playtest.
   Under A this is the only deck where the spell-or-trap choice can actually bind, so it tests
   the chosen rule. Cons: spell access falls. 1 match in 12 gets the trap only when it is dead.
2. **T2: two traps replace both spell copies.** Pros: a trap is seen early (57.58% in the
   opener), there is never a round-9-only dead trap, and the A choice never binds. Cons: it
   deletes each faction's spell role, which contradicts the reason for a separate trap kind
   (requirements D1/R7). Duplicates compete for one zone. Under A it does not exercise the
   spell-or-trap rule.
3. **Defer deck changes.** Keep the trap a fixture outside the decks, as in #78. Run the human
   decision-load playtest of A against B first, then pick T1 or T2. Pros: no content
   commitment. Cons: draw cost and spell loss are never seen in real play.

Text-only, not proposed: one trap replacing a free troop (5/3/1/2 + trap). This keeps both
spells, but an opener with no free troop rises from 3.03% to 7.07%, which risks the reliable
free summon.

## Proposed T1 composition (flag-gated, PROPOSAL ONLY)

"Trap (anonymous)" is a placeholder for a future, user-approved trap card. It is not a name.

| Slot type | Cowboy shipped | Cowboy T1 | Wizard shipped | Wizard T1 |
|---|---|---|---|---|
| Free troop | 6 Sheriff | 6 Sheriff | 6 Skeleton | 6 Skeleton |
| Mid-tier (1 tribute) | 3 Billy | 3 Billy | 3 Wizard | 3 Wizard |
| Legendary (2 tributes) | 1 Mounted Billy | 1 Mounted Billy | 1 Dragon | 1 Dragon |
| Spell | 2 Deadeye | 1 Deadeye | 2 Singularity | 1 Singularity |
| Trap (anonymous) | 0 | 1 | 0 | 1 |
| Total | 12 | 12 | 12 | 12 |

## Deterministic acceptance criteria for a future T1 prototype

Proposed, and only after user approval of the card:

1. Flag off: `createMatch(seed)` state is unchanged for seeds 0 and 60 (R8).
2. Flag on: each deck has 12 unique IDs with counts 6/3/1/1/1, the same for both sides.
3. If the trap takes the second spell copy's catalog index, then for every seed the flag-on order
   equals the shipped order with that one ID relabelled. Fisher-Yates moves positions, so this
   follows. [sample.js](../../experiments/trap-deck-odds/sample.js) depends on this to relabel
   seeds 0-9999. A real prototype should assert it directly.
4. Over seeds 0-9999 with the real shuffle, the first-trap-round frequencies stay within
   1.5 percentage points of the exact values (1/3, then 1/12 per round). The current sample is
   within 0.6 points.
5. `set-trap` in round 9 is rejected with `trap-too-late`. A trap set in round 8 can trigger in
   the round 9 clash (R3, R13).
