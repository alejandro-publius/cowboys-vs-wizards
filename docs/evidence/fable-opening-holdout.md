# Opening-hand holdout experiment (Fable)

Run by Fable on November 16, 2026 on branch `fable/opening-hand-holdout`.
The holdout uses `orb-duel-draft-1` with four opening cards each as the shipped baseline.

```sh
node scripts/compare-opening-policies.mjs --from 1000 --count 2000 --out .artifacts/fable/opening-holdout/results.json
```

The run takes about 15 seconds. `results.json` holds the summary and one raw
row per match. `summary.json` beside it is the same output without the rows.
A second run produced a byte-identical file (SHA-256
`e0e5214f1c63d1f5b0735d7c27a7e68bfde4b69c0c6927f7cd0012544817cfac`).

## Method

- Seeds 1000–2999, which no earlier trial used. Each seed is played twice,
  once with each faction acting first in round 1, so every variant has
  4,000 matches and seat is balanced across factions.
- Both sides use the released CPU (`src/game/cpu.js`) through `publicState`,
  `applyAction` and `createMatch`. A variant edits only the opening state.
  Shuffles are identical across variants for a seed.
- The helper uses the shared `playMatch` loop with an explicit opening state.
  For all 2,000 seeds, the unmodified opening with the seed's own first seat
  reached the same final state as the default seeded run.
- Every card stayed in exactly one of deck, hand, board or discard after every
  action in all 16,000 matches, and the engine accepted every action.

| Variant | Change to the opening |
| --- | --- |
| Shipped | None. |
| Free opener | A hand with no free troop (Sheriff or Skeleton) trades its last-dealt card for the topmost free troop in its own deck. |
| Extra card | The side acting second in round 1 draws the top of its deck early and starts with five cards. |
| Both | The swap on the four dealt cards, then the extra draw. |

## Results

| 4,000 matches each | Shipped | Free opener | Extra card | Both |
| --- | --- | --- | --- | --- |
| First-seat wins | 2,355 (58.9%) | 2,362 (59.1%) | 2,167 (54.2%) | 2,204 (55.1%) |
| Second-seat wins | 1,222 (30.6%) | 1,194 (29.9%) | 1,370 (34.3%) | 1,323 (33.1%) |
| Draws | 423 (10.6%) | 444 (11.1%) | 463 (11.6%) | 473 (11.8%) |
| Seat gap, points | 28.3 | 29.2 | 19.9 | 22.0 |
| Cowboy wins | 1,670 | 1,661 | 1,715 | 1,708 |
| Wizard wins | 1,907 | 1,895 | 1,822 | 1,819 |
| Cowboy minus Wizard, points | −5.9 | −5.9 | −2.7 | −2.8 |
| Hands with no free summon (of 8,000) | 254 | 0 | 162 | 0 |
| Sides with no round-1 summon | 254 | 0 | 162 | 0 |
| Mean rounds | 7.27 | 7.44 | 7.56 | 7.69 |

Paired change against shipped, in percentage points. The interval is 95%
with each seed's two matches treated as one observation.

| | Free opener | Extra card | Both |
| --- | --- | --- | --- |
| Seat gap | +0.9 (+0.4 to +1.3) | −8.4 (−11.0 to −5.9) | −6.3 (−8.9 to −3.7) |
| Cowboy minus Wizard | +0.1 (−1.3 to +1.4) | +3.3 (+0.7 to +5.8) | +3.2 (+0.4 to +5.9) |
| Draw rate | +0.5 (+0.3 to +0.8) | +1.0 (−0.2 to +2.2) | +1.3 (0.0 to +2.5) |
| Matches with a different result | 126 | 1,142 | 1,229 |

### Opening free-summon drought

Under shipped rules 254 of 8,000 hands (3.2%) had no free troop, 127 in each
seat. This matches the expected 15 in 495 deals. Every one of those sides
made no summon in round 1. The table follows the same 254 sides through each
variant, as wins, losses and draws.

| Side that was dealt no free troop | Shipped | Free opener | Extra card | Both |
| --- | --- | --- | --- | --- |
| In the first seat (127) | 3 / 123 / 1 | 61 / 53 / 13 | 0 / 127 / 0 | 60 / 61 / 6 |
| In the second seat (127) | 6 / 120 / 1 | 48 / 70 / 9 | 43 / 70 / 14 | 57 / 51 / 19 |

### What the holdout confirms

- The first-seat advantage holds on fresh seeds: 28.3 points here against
  29.6 in the earlier trial.
- A side that opens with no free troop almost never wins: 9 wins in 254.
- The extra second-seat card replicates. The gap fell to 19.9 points here and
  to 18.4 in the earlier trial.
- The free-opener swap fixes the dead hands but does nothing for the seat gap.
  It widened the gap by 0.9 points, because it rescues the first seat's dead
  hands slightly more often than the second seat's.
- The extra card alone leaves the first seat's dead hands as dead as before
  (0 wins in 127).

## Seeds 0 and 60

Each seed was replayed CPU against CPU with its own first seat.

| Seed | Free opener | Extra card and Both |
| --- | --- | --- |
| 0, Cowboy first | Opening state and all actions identical to shipped. | Wizard starts with a fifth card, a Skeleton, and its deck shows 7 instead of 8. The first 22 actions are identical. The route then diverges and the result changes from a Cowboy win at the round limit to a draw with both bases destroyed in round 9. |
| 60, Wizard first | Opening state and all actions identical to shipped. | Cowboy starts with a fifth card, a Billy, and its deck shows 7 instead of 8. Every CPU action and the result (Cowboy wins, round 9) are identical to shipped. |

Both seeds already include a free summon on each side. The extra card
preserved the CPU-vs-CPU action sequence for seed 60. The scripted player
route and the browser captures still need verification under the variants.

## Candidate

No variant passes as a balance fix. The best one still leaves the first seat
about 20 points ahead.

The one candidate worth a human test is **Both**: the free-opener swap plus a
fifth opening card for the second seat. It is the only variant that removes
every no-summon first round and also narrows the seat gap (28.3 to 22.0). The
extra card alone narrows the gap by 2.1 points more, but the two were not
compared directly and their intervals against shipped overlap.

Test: play matched human games under shipped and Both with the first seat
alternating. Both passes if the second seat's win share rises and no player
reports a first round with nothing to summon. Adopting it means re-recording
the seed 0 browser check, since that route changes.

## Limits

- Both sides are the same one-clash-lookahead CPU with no search. It never
  plans a tribute line or holds a spell for a later round. The seat gap between
  people may be smaller or larger.
- The CPU breaks ties by hand order, so the swap position and the extra card's
  position can change results for reasons a person would not reproduce.
- Mirrored self-play cannot show whether a fifth card feels fair or whether a
  visible swap confuses a new player.
- The 2,000 seeds give about ±2.5 points on a paired seat-gap change. Faction
  differences of a few points sit near that noise.
- Only one swap rule and one extra-card rule were tried. A second-seat
  mulligan, a different first-round draw or a changed deck list were not.
