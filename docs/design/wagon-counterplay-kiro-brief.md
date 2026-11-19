# Wagon counterplay: one Wizard card, brief for Kiro

Fable 5.2, November 18, 2026, Pacific. Designed against `facbaf9` on `fable/wagon-counterplay`. No production code or art was touched.

All numbers come from a scratch copy of `src/game` under `.artifacts/wagon-lab/`. It differs from the repository in three places only: it accepts a Wizard deck list, it registers enough Wizard card instances to build one, and it carries the candidate card's stats. The existing Normal and Hard bots played both sides. Nothing was clicked in a browser and no person has played the card.

## Recommendation

Keep one candidate: the **Imp**, in an optional opponent that swaps one Wizard for it. Leave the default opponent alone.

It does what was asked, with one limit. When an Imp is on the table, Wagon Train's choice between holding a lane and cashing its Wagons in for the Gatling Crew is close to even, where today cashing in wins about three to one. But the Imp reaches the table before that turn in about half of matches. In the other half the choice is as one-sided as it is now.

It is not a counter to Wagon Train. Wagon Train scores higher against this list than against the default, because the Imp replaced a sturdier Wizard and a Covered Wagon beats an Imp.

## The card

| | |
| --- | --- |
| Name | Imp |
| Type | `wizard-imp` |
| Kind | troop |
| Cost | free (2 stars) |
| Orbs | 1 |
| Attack | 3 |
| Effect | none |
| Card line | "Hits for three. One orb." |

It uses existing engine behavior only: a stat line, no rule. It is the Wizard's Dynamiter.

**What it does in one clash.**

| The Imp faces | Result |
| --- | --- |
| An open lane | Cowboy Base 5 → 2 |
| A Covered Wagon (4) | The Wagon is on 1. The Imp falls. |
| A Sheriff (3) | Both fall. |
| A Gatling Crew (4) | The Crew is on 1. The Imp falls. |

**Why it creates the choice.** An Imp punishes an open lane harder than any other Wizard card, and cashing two troops in for the Gatling Crew opens a lane. A Wagon is the only free Cowboy troop that survives it. So with an Imp across the table, a standing Wagon is worth more than usual and the cash-in costs more than usual.

**Counterplay.** Any blocker kills it. Deadeye or Lasso kills it outright. It cannot hold a lane.

Other stat lines were screened as the same one-card swap on seeds 83000–83199. A free 2-orb, 2-attack troop and a free 4-orb, 1-attack troop also made holding better more often, but each cost the Starter and Night Riders 8 to 15 points under the Normal bot. A one-tribute 2-orb, 4-attack troop let Wagon Train reach the decision less often (125 boards against 174 under Hard).

## Deck counts

| Opponent | Skeleton | Wizard | Dragon | Singularity | Imp |
| --- | ---: | ---: | ---: | ---: | ---: |
| Default (unchanged) | 6 | 3 | 1 | 2 | |
| Stargazer (earlier brief) | 6 | 2 | 1 | 3 | |
| **Imp list** | 6 | 2 | 1 | 2 | 1 |

One Imp, not two. A two-Imp list made holding the better call outright once an Imp was seen (131 boards against 91 under Normal), but it had to drop the Dragon as well, and Wagon Train's win share rose to 61% under Normal.

## The comparison

Seeds 84000–84999, each side first once per seed, 2,000 matches per cell, same Cowboy deals across opponents. Each cell is win / draw / loss in percent, then mean rounds. Win rates carry about ±2.2 points.

**Normal bot on both sides**

| Cowboy deck | Default | Stargazer | Imp list |
| --- | --- | --- | --- |
| Starter | 44.3 / 10.1 / 45.6, 7.25 | 40.4 / 11.4 / 48.2, 7.10 | 45.3 / 10.1 / 44.6, 6.38 |
| Night Riders | 49.2 / 12.1 / 38.8, 5.45 | 35.2 / 13.5 / 51.3, 5.23 | 51.5 / 11.4 / 37.1, 5.22 |
| Wagon Train | 46.5 / 11.2 / 42.4, 5.91 | 45.5 / 11.2 / 43.3, 5.89 | 52.4 / 12.3 / 35.3, 5.33 |

**Hard bot on both sides**

| Cowboy deck | Default | Stargazer | Imp list |
| --- | --- | --- | --- |
| Starter | 44.1 / 6.8 / 49.1, 5.75 | 33.7 / 6.3 / 60.0, 5.54 | 45.4 / 5.1 / 49.5, 5.47 |
| Night Riders | 53.7 / 5.9 / 40.4, 5.12 | 38.6 / 4.9 / 56.5, 5.00 | 54.7 / 4.3 / 41.0, 4.87 |
| Wagon Train | 48.5 / 7.1 / 44.5, 5.35 | 39.9 / 8.1 / 52.1, 5.37 | 53.6 / 6.0 / 40.3, 5.15 |

- **Other matchups stay level.** Against the Imp list the Starter and Night Riders are within about two points of their results against the default.
- **Wagon Train gets easier.** Its win share (a draw counts half) goes from 52.0% to 58.5% under Normal and from 52.0% to 56.7% under Hard.
- **Matches are shorter**, by 0.2 to 0.9 rounds. An unblocked Imp takes three Base orbs. Imps took 0.86 Base orbs a match from Wagon Train under Normal.

**Opening playability.** Chance of an opening hand with no free troop:

| Deck | Exact | Seen in these matches |
| --- | ---: | ---: |
| Wizard, default | 3.03% | 3.4% |
| Wizard, Stargazer | 3.03% | 3.4% |
| Wizard, Imp list | 1.01% | 1.4% |
| Starter | 3.03% | 3.0% |
| Night Riders | 1.01% | 1.7% |
| Wagon Train | 7.07% | 8.2% |

The Imp is a seventh free troop, so this opponent is stuck on its first turn less often.

## The cash-in decision

Each Wagon Train match was split at the first turn the Gatling Crew could take a Covered Wagon as tribute. One branch cashed in, in the best lane. The other made the bot's best play without the Crew that turn. The same bot finished both.

| First cash-in turn | Boards | Cashing in better | Same result | Holding better |
| --- | ---: | ---: | ---: | ---: |
| Normal, default | 929 | 272 | 570 | 87 |
| Normal, Stargazer | 906 | 289 | 547 | 70 |
| Normal, Imp list | 849 | 218 | 532 | 99 |
| of which an Imp had appeared | 398 | 66 | 275 | 57 |
| of which no Imp yet | 451 | 152 | 257 | 42 |
| Hard, default | 870 | 230 | 462 | 178 |
| Hard, Stargazer | 853 | 229 | 446 | 178 |
| Hard, Imp list | 851 | 162 | 496 | 193 |
| of which an Imp had appeared | 374 | 58 | 249 | 67 |
| of which no Imp yet | 477 | 104 | 247 | 126 |

The best lane is picked with hindsight, so these rows flatter cashing in.

The Stargazer does not touch this decision. The Imp list moves it: under Normal from about 3.1 to 1 in favour of cashing in to 2.2 to 1, and under Hard from 1.3 to 1 for cashing in to 1.2 to 1 for holding. Where an Imp has been played, the two choices are about even under both bots.

I expected an unseen Imp to make players wait. The bots do not show that under Normal: with no Imp yet, cashing in is still better 152 times to 42. The effect is on the board, not in the threat.

## One seed to play: Wagon Train, seed 4671

Standard duel, Wagon Train, Normal Wizard playing the Imp list, the seed's own first seat. The Cowboy acts first in round 1. Opening hands: Cowboy Billy, Sheriff, Sheriff, Sheriff. Wizard Skeleton, Skeleton, Dragon, Skeleton.

**Opening, same on both routes.** R1 Sheriff lane 1. R2 Covered Wagon lane 2. R3 Sheriff lane 1, Deadeye on Wizard lane 1.

**Round 4 board.** The Wizard acts first and summons the Imp into open lane 3.

| | Lane 1 | Lane 2 | Lane 3 |
| --- | --- | --- | --- |
| Wizard (Base 5) | Skeleton, 2 orbs | Skeleton, 1 orb | Imp, 1 orb |
| Cowboy (Base 5) | Sheriff, 2 orbs | Covered Wagon, 2 orbs | empty |

Hand: Billy, Sheriff, Gatling Crew.

**The decision.** Cash the Sheriff and the Wagon in for the Gatling Crew now, or block the Imp with the free Sheriff and cash in next turn.

| Route | Cowboy clicks from round 4 | Result |
| --- | --- | --- |
| Hold, then cash in | R4 Sheriff lane 3. R5 Gatling Crew lane 2, tribute lanes 1 and 2, then Lasso on Wizard lane 1. R6, R7, R8 End turn. R9 Covered Wagon lane 1. | Victory, round 9. Cowboy Base 5, Wizard Base 0. |
| Cash in now | R4 Gatling Crew lane 3, tribute lanes 1 and 2. R5 Sheriff lane 2, Lasso on Wizard lane 2. R6 Billy lane 1, tribute lane 2. R7 End turn. | Defeat, round 7. Cowboy Base 0, Wizard Base 4. |

What to watch in round 4. On the hold route the Sheriff and the Imp both fall and the Base stays on 5. On the cash-in route the Crew blocks the Imp and drops to 1 orb, the two Skeletons walk through the lanes the tributes opened, and the Base is on 3 after the clash. Putting the Crew in lane 1 or 2 instead leaves the Imp unblocked and loses in round 5.

With the Hard bot continuing for the Cowboy, holding wins in round 6 and every cash-in still loses.

Against the default opponent the same seed plays out differently from round 1, because the Wizard's hand differs. At its own round-4 decision there, cashing in wins in two of three lanes and holding loses.

## Smallest implementation scope

1. **Card.** One spec: `wizard-imp`, troop, 2 stars, 1 orb, 3 attack, zero copies in the default deck, order after Lantern Wraith. Register one instance, `wizard-imp-1`. `DECKS.wizard` must not change.
2. **Opponent list.** The Wizard deck option and preset mechanism from the Stargazer brief. If that is not built yet, this needs the same seam: `createMatch(seed, { wizardDeck })`, validated, default untouched.
3. **Preset.** IDs in catalog order: `wizard-skeleton-1` to `-6`, `wizard-wizard-1` and `-2`, `wizard-dragon-1`, `wizard-singularity-1` and `-2`, `wizard-imp-1`. The seeded case depends on this order.
4. **Graybox.** A link parameter that selects the list for a standard duel, and the Imp's stats and card line on its board tile. Placement follows the Stargazer: optional, offered from 7 counted wins, never in the guided duel, the first session, hunts or lessons.
5. **Nothing else.** No rule, no CPU change, no Cowboy change, no art.

## Acceptance cases

1. With no Wizard list chosen, `createMatch` returns the same state as at `facbaf9` for seeds 0, 60, 690 and 2328 (Wraith Posse), and for the Frontier routes at seeds 244 and 6. All ten hunts are unchanged.
2. Single clashes with boards set directly: the four rows of "What it does in one clash".
3. The Imp list is 6 Skeleton, 2 Wizard, 1 Dragon, 2 Singularity, 1 Imp, 12 cards, in the ID order above.
4. `createMatch(4671, { cowboyDeck: Wagon Train, wizardDeck: Imp list })`: the Cowboy acts first, with the two opening hands above.
5. After the three opening turns, round 4 shows the board in the table, with the Imp in Wizard lane 3.
6. The hold route ends in Victory in round 9 with Cowboy Base 5. After clash 4 the Base is on 5 and the Imp is gone.
7. The cash-in route ends in Defeat in round 7. After clash 4 the Base is on 3 and the Crew is on 1 orb.
8. Bot check: re-run the three Cowboy decks against the Imp list on seeds 84000–84999. Each win rate should land within about three points of the tables.

## Limits, and back to Fable

- The decision improves only once an Imp is on the table, which is under half of cash-in turns.
- Wagon Train finds this opponent easier than the default. If the aim is a harder Wagon Train matchup, this card is not it.
- Bots do not hold back for a card they have not seen. People might, and that would make the Imp matter more than these numbers show.
- Route back any seeded case that does not reproduce, and any wish for a second copy, a different swap, or an Imp in the default deck.
