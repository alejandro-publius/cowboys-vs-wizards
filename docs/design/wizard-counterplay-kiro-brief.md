# Wizard counterplay: an optional opponent, brief for Kiro

Fable 5.2, November 18, 2026, Pacific. Designed against `bccaff3` on `fable/wizard-counterplay`. No repository file was edited.

All numbers come from a scratch copy of `src/game` under `.artifacts/wizard-lab/`, changed in two places only: it accepts a Wizard deck list, and it registers enough Wizard card instances to build one. The existing Normal and Hard bots played both sides. Nothing was clicked in a browser and no person has played this opponent. Against the current opponent the scratch copy reproduces the Frontier note's seeds 72000–72999 figures.

## Recommendation

Add one optional opponent, the **Stargazer**. Its deck is the current Wizard deck with one Wizard replaced by a third Singularity.

| Opponent | Skeleton | Wizard | Dragon | Singularity |
| --- | ---: | ---: | ---: | ---: |
| Current (default, unchanged) | 6 | 3 | 1 | 2 |
| **Stargazer** | 6 | 2 | 1 | 3 |

It uses the same cards, the same rules and the same CPU. The default opponent stays the default everywhere.

**What it changes for the player.**

- **Night Riders.** The third spell goes into Dynamiters. They were shot before clashing 0.56 times a match against the current opponent and 0.73 times against the Stargazer (Normal). Night Riders drops from the best of the three decks to the worst. The answer is timing: play the Dynamiter on a round where you act second, after the Wizard has spent its turn.
- **Wagon Train.** Four-orb wagons shrug off single orbs, so the deck holds up. The Stargazer moves its troops instead: 0.20 troops dragged a match against the current opponent, 0.33 against the Stargazer (Normal). Wagon Train becomes the better pick, by 10.5 points of win share under Normal and 4.3 under Hard (a draw counts as half a win).
- **Deck choice now matters.** Against the current opponent Night Riders is at least as strong as Wagon Train under both bots, and clearly stronger under Hard. Against the Stargazer the order reverses.

**What it does not do.** It does not trouble Wagon Train much under the Normal bot. With only four Wizard card types, no list I screened did. A real Wagon Train counter needs a new Wizard card, which is a later pack.

## The comparison

Seeds 81000–81999, each side first once per seed, 2,000 matches per cell, same Cowboy deals across opponents. Each cell is win / draw / loss in percent, then mean rounds. Win rates carry about ±2.2 points.

**Normal bot on both sides**

| Cowboy deck | Current 6/3/1/2 | Stargazer 6/2/1/3 | Seventh Skeleton 7/3/0/2 |
| --- | --- | --- | --- |
| Starter | 45.5 / 9.6 / 44.9, 7.24 | 43.0 / 9.7 / 47.4, 7.09 | 38.3 / 8.3 / 53.4, 7.65 |
| Night Riders | 47.0 / 12.3 / 40.8, 5.44 | 37.3 / 12.8 / 50.0, 5.23 | 40.5 / 9.8 / 49.8, 5.73 |
| Wagon Train | 46.4 / 11.0 / 42.6, 5.89 | 49.0 / 10.3 / 40.7, 5.91 | 44.8 / 8.4 / 46.8, 6.16 |

**Hard bot on both sides**

| Cowboy deck | Current 6/3/1/2 | Stargazer 6/2/1/3 | Seventh Skeleton 7/3/0/2 |
| --- | --- | --- | --- |
| Starter | 45.8 / 7.0 / 47.3, 5.76 | 36.0 / 5.2 / 58.9, 5.58 | 39.5 / 8.0 / 52.5, 6.17 |
| Night Riders | 54.4 / 4.1 / 41.5, 5.06 | 39.0 / 5.1 / 55.9, 4.96 | 47.1 / 5.3 / 47.5, 5.45 |
| Wagon Train | 48.6 / 7.7 / 43.8, 5.38 | 42.1 / 7.5 / 50.4, 5.39 | 47.6 / 7.1 / 45.3, 5.54 |

**Opening playability.** Chance of an opening hand with no free troop:

| Deck | Exact | Seen in these matches |
| --- | ---: | ---: |
| Wizard, current | 3.03% | 3.2% |
| Wizard, Stargazer | 3.03% | 3.2% |
| Wizard, Seventh Skeleton | 1.01% | 0.8% |
| Starter | 3.03% | 3.1% |
| Night Riders | 1.01% | 1.2% |
| Wagon Train | 7.07% | 8.2% |

The Stargazer keeps six Skeletons, so its openings are exactly as playable as the current opponent's. Match length and draw rates stay close to today's.

**The second candidate, Seventh Skeleton** (the Dragon becomes a seventh Skeleton), is rejected. It is harder for every deck by a similar amount, it makes matches longer, and it asks nothing new of the player. It also removes the Dragon, which the bounty story is built on.

**How the two candidates were chosen.** I first screened 29 lists on a separate range (seeds 80000–80149, 300 matches a cell). Singularity count decides almost everything. Lists with none lose to the Cowboys 70 to 95% of the time. Lists with four push Night Riders to about 30%. Extra Wizards and Dragons make the opponent weaker. One more Singularity is the smallest change that moves the matchup without breaking it.

## Placement

- Offer the Stargazer once the player has 7 counted duel wins, the same moment Wagon Train unlocks. By then they own both Frontier decks and have a reason to choose between them.
- Put it beside Play as a second button, "Duel the Stargazer". Play itself keeps the default opponent.
- Keep it out of the guided duel, the first session, every hunt, the lessons and Try Draft's default.
- Wins against it count as duel wins. It grants no card.
- Do not offer it before 7 wins. The Starter deck's win share against it is 38.6% under the Hard bot.
- Name and line, both open to change: "The Stargazer. Three Singularities. It shoots what it can and moves the rest."

## One seed to play: Night Riders, seed 4

Standard duel, Night Riders, Normal Wizard, the seed's own first seat. The Cowboy acts first in round 1. Opening hand: Outrider, Dynamiter, Outrider, Ranger. The Stargazer's opening hand is Skeleton, Skeleton, Wizard, Singularity.

**The decision.** Lead with the Dynamiter, or lead with an Outrider and hold the Dynamiter for round 2, when you act second.

| Line | Cowboy clicks | Result |
| --- | --- | --- |
| Dynamiter first | R1 Dynamiter lane 2. R2 Outrider lane 1. R3 Dynamiter lane 3, Deadeye on Wizard lane 1. R4 Outrider lane 2. R5 Sheriff lane 3. R6 Sheriff lane 1. R7 Sheriff lane 3. | Defeat, round 7. Cowboy Base 0, Wizard Base 4. |
| Outrider first | R1 Outrider lane 2. R2 Dynamiter lane 3, Deadeye on Wizard lane 2. R3 Outrider lane 1. R4 Dynamiter lane 3. | Victory, round 4. Cowboy Base 3, Wizard Base 0. |

What to watch in round 1 of the first line: the Stargazer summons a Skeleton in lane 2 and casts Singularity on the Dynamiter. After the clash the Cowboy has no troops and its Base is on 4. In the second line the Dynamiter arrives in round 2 after the Wizard has acted, and takes the Wizard Base from 5 to 2 in that clash.

Both results are the same with the Hard bot continuing for the Cowboy.

**The same seed against the default opponent.** The Wizard's hand holds a Dragon where the Stargazer holds the Singularity, so the Dynamiter is not shot. It trades with the Skeleton, and after clash 1 both Bases are on 5 with no troops in lane 2. With the Normal bot continuing, the Dynamiter lead then wins in round 6 and the Outrider lead wins in round 4. With the Hard bot continuing, the Dynamiter lead loses in round 7, so use the round-1 board as the comparison and not the final result.

## Smallest implementation scope

1. **Card pool.** Register a third Singularity instance, `wizard-singularity-3`. `DECKS.wizard` must not change.
2. **Match option.** `createMatch(seed, { wizardDeck })`, a list of 12 Wizard card IDs. Validate it: 12 IDs, all registered non-bounty Wizard cards, no ID twice. Omitted, the match is exactly today's. The RNG order stays cowboy shuffle, wizard shuffle, first seat.
3. **Preset.** One constant for the Stargazer: IDs in catalog order, `wizard-skeleton-1` to `-6`, `wizard-wizard-1` and `-2`, `wizard-dragon-1`, `wizard-singularity-1` to `-3`. The seeded cases below depend on this order.
4. **Graybox.** `?wizard=stargazer` selects it for a standard duel. The second Play button appears at 7 counted wins. Replay this deal and Restart keep the opponent. Show the opponent's name in the duel's note line.
5. **Nothing else.** No CPU change, no new card, no new rule, no art. The illustrated build is out of scope.

## Acceptance cases

**The default is intact.**

1. With no `wizardDeck`, `createMatch` returns the same state as at `bccaff3` for seeds 0, 60, 690, 4, 6 and 244, with the Starter, Night Riders (4, 244) and Wagon Train (6), and for seed 2328 with Wraith Posse.
2. All ten hunts and both lessons start from the same state as at `bccaff3`.
3. The Frontier note's two seeded routes (Night Riders seed 244, Wagon Train seed 6) end as recorded.

**The Stargazer.**

4. The preset is 6 Skeleton, 2 Wizard, 1 Dragon, 3 Singularity, 12 cards, in the ID order above.
5. `createMatch(4, { cowboyDeck: Night Riders, wizardDeck: Stargazer })`: the Cowboy acts first. Cowboy hand Outrider, Dynamiter, Outrider, Ranger. Wizard hand Skeleton, Skeleton, Wizard, Singularity.
6. Dynamiter first on that deal ends in Defeat in round 7 with the clicks in the table. After clash 1: Cowboy Base 4, no Cowboy troops, a 3-orb Skeleton in Wizard lane 2.
7. Outrider first ends in Victory in round 4 with Cowboy Base 3.
8. A `wizardDeck` of 11 cards, with a Cowboy card, with a repeated ID, or with the Lantern Wraith is refused.
9. `?wizard=stargazer&seed=4` with Night Riders saved deals case 5 in the graybox. Without the parameter the same seed deals the default opponent's hand: Skeleton, Skeleton, Wizard, Dragon.
10. The second Play button is absent at 6 counted wins and present at 7.

**Bot check.** 11. Re-run the three Cowboy decks against the Stargazer on seeds 81000–81999. Each win rate should land within about three points of the tables above.

## Back to Fable

- Any seeded case that does not reproduce.
- Playtests where Night Riders against the Stargazer feels unwinnable instead of tricky. The fix would be to offer it only alongside Wagon Train, or to drop it.
- Any wish for a harder list, a different unlock, or a new Wizard card.
