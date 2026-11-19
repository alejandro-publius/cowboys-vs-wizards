# Captured Dragon balance: brief for Kiro

Fable 5.2, November 18, 2026, Pacific. Designed against `d0cf982` on `fable/dragon-balance`. No repository file was edited.

All numbers come from three scratch copies of `src/game` under `.artifacts/balance-lab/`. One is unmodified. The other two change one number on the Captured Dragon spec. The existing Normal and Hard bots played the comparison. The showcase lines were replayed click by click against the Normal Wizard, and the claims about what a play can still achieve come from an exhaustive search of the Cowboy's lines against that bot. Nothing was clicked in a browser and no person has played either variant.

## Recommendation

Make one stat change: **Captured Dragon attack 3 → 4.** It stays a one-tribute troop with 2 orbs, one copy, unlocked by five captures.

| | Tribute | Orbs | Attack |
| --- | ---: | ---: | ---: |
| Captured Dragon today | 1 | 2 | 3 |
| **Captured Dragon, proposed** | 1 | 2 | **4** |
| Rejected: one more orb | 1 | 3 | 3 |

- **Today the reward is worse than the card it replaces.** In the Dragon Posse list, the Captured Dragon scores 7 to 9 points below a Billy in the same slot, against both opponents and under both bots.
- **At attack 4 it is level with a Billy**, 0.3 to 3.6 points ahead, and it plays differently from one.
- **At 3 orbs it is too strong**, 7 to 11 points ahead of a Billy, and summoning it stops being a decision.

This change breaks the seed-264 showcase that Kiro is building. A replacement, seed 468, is below. The Dragon Posse preset does not change.

## The comparison

Seeds 93000–93999, each side first once per seed, 2,000 matches per cell. The Dragon rows use the Dragon Posse list (6 Sheriff, 2 Billy, 3 Deadeye, 1 Captured Dragon). The Billy row puts a third Billy in the Dragon's slot (6 Sheriff, 3 Billy, 3 Deadeye). Each cell is win / draw / loss in percent, then mean rounds. Win rates carry about ±2.2 points.

**Default Wizard**

| List | Normal | Hard |
| --- | --- | --- |
| Billy in the slot | 58.4 / 6.6 / 35.0, 7.28 | 57.9 / 8.2 / 33.9, 5.86 |
| Dragon today (2 orbs, 3 attack) | 48.8 / 12.3 / 39.0, 6.60 | 50.9 / 6.0 / 43.1, 5.51 |
| Dragon, 2 orbs, 4 attack | 55.0 / 17.5 / 27.4, 6.27 | 60.0 / 4.5 / 35.4, 4.89 |
| Dragon, 3 orbs, 3 attack | 60.9 / 16.4 / 22.8, 6.30 | 66.8 / 8.4 / 24.8, 5.92 |

**Stargazer**

| List | Normal | Hard |
| --- | --- | --- |
| Billy in the slot | 57.2 / 7.9 / 34.9, 7.23 | 46.2 / 8.1 / 45.7, 5.73 |
| Dragon today (2 orbs, 3 attack) | 46.0 / 13.3 / 40.7, 6.43 | 38.3 / 6.0 / 55.6, 5.38 |
| Dragon, 2 orbs, 4 attack | 53.6 / 17.6 / 28.7, 6.20 | 51.5 / 4.8 / 43.7, 4.73 |
| Dragon, 3 orbs, 3 attack | 60.4 / 17.1 / 22.5, 6.36 | 57.0 / 8.4 / 34.5, 5.86 |

**Win share against the Billy list** (a draw counts half), in points:

| Dragon | Default, Normal | Default, Hard | Stargazer, Normal | Stargazer, Hard |
| --- | ---: | ---: | ---: | ---: |
| Today | −6.8 | −8.1 | −8.5 | −8.9 |
| 4 attack | +2.1 | +0.3 | +1.3 | +3.6 |
| 3 orbs | +7.4 | +9.0 | +7.8 | +11.0 |

**Costs of the 4-attack Dragon.**

- **Shorter matches.** About a round shorter than the Billy list: 6.27 against 7.28 under Normal, 4.89 against 5.86 under Hard.
- **More draws under Normal.** 17.5% against 6.6% for the Billy list. Both Bases fall together more often.
- **A strong reward deck.** Dragon Posse reaches about 62 to 64% against the default opponent. That matches Deadeye Control, which every player can load from the start, so it sets no new ceiling.
- **It out-hits the Wizard's own Dragon**, which has attack 3. That is a flavour question, not a rules one.

## How often the Dragon can be summoned

This does not depend on the stat line. It needs the card in hand and one friendly troop to tribute.

| | Normal | Hard |
| --- | --- | --- |
| Matches where a summon was legal at some point | 87% | 75% |
| Average round of the first chance | 3.7 | 3.2 |
| Matches where the bot summoned it, today | 83% | 61% |
| Matches where the bot summoned it, 4 attack | 86% | 71% |

Default Wizard. Against the Stargazer the figures are within two points.

## Lane tradeoffs

One clash, the Dragon at full orbs:

| The Dragon faces | Today | 4 attack | 3 orbs |
| --- | --- | --- | --- |
| An open lane | Wizard Base 5 → 2 | Wizard Base 5 → 1 | Wizard Base 5 → 2 |
| A Skeleton (3) | Skeleton falls, Dragon on 1 | Skeleton falls, Dragon on 1 | Skeleton falls, Dragon on 2 |
| A Wizard (4) | Wizard on 1, Dragon falls | both fall | Wizard on 1, Dragon on 1 |
| The Wizard's Dragon (5) | it is on 2, Dragon falls | it is on 1, Dragon falls | it is on 2, Dragon falls |

The 4-attack Dragon changes two rows. It trades evenly with a Wizard, where today it dies for nothing. And through an open lane it leaves the Wizard Base on its last orb.

What it did in the bot matches, default Wizard:

| Per summon | Normal, today | Normal, 4 attack | Hard, today | Hard, 4 attack |
| --- | ---: | ---: | ---: | ---: |
| Base orbs taken | 1.28 | 1.68 | 0.38 | 1.36 |
| Troops defeated | 0.30 | 0.76 | 0.75 | 0.63 |
| Survived its first clash | 55% | 57% | 68% | 52% |

**Is the summon still a choice?** Each match was split at the first legal summon: the Dragon in its best lane against the bot's best other play. Default Wizard, Normal, 1,740 boards.

| Dragon | Summoning better | Same result | Holding better |
| --- | ---: | ---: | ---: |
| Today | 549 | 1,002 | 189 |
| 4 attack | 515 | 931 | 294 |
| 3 orbs | 583 | 1,096 | 61 |

At 4 attack, holding is right more often than today. At 3 orbs it almost never is. The best lane is picked with hindsight, so all three rows flatter summoning.

## The seed-264 showcase under each variant

| Dragon | Line A (Dragon into the open lane) | Line B (second Sheriff) | Is it still a choice? |
| --- | --- | --- | --- |
| Today | Victory, round 4, Base 1 | Victory, round 6, Base 2 | Yes. Wrong lanes cannot win. |
| 3 orbs | Same clicks, same result | Same clicks, same result | Weaker. The Dragon in either wrong lane now wins by round 7. |
| 4 attack | Clicks break in round 4 | Clicks break in round 6 | No. Either first play forces a win by round 4. |

At 4 attack a scripted Deadeye has no target, because its target already fell. Corrected lines exist, but the speed difference that made the choice is gone.

## Replacement showcase: seed 468

Use this only if the stat change is adopted. Everything else in the reward brief stays: the entry button, the draft deal, the Normal bot, no Ride Out, the proposed Dragon Posse list.

| | |
| --- | --- |
| Seed | 468, the seed's own first seat (the Cowboy acts first) |
| Cowboy hand | Deadeye, Deadeye, Sheriff, Captured Dragon |
| Wizard hand | Wizard, Dragon, Skeleton, Skeleton |
| Round 1 | The only playable card is the Sheriff. The lines use lane 1. |

**Round 2 board.** You act second, so End turn resolves the clash.

| | Lane 1 | Lane 2 | Lane 3 |
| --- | --- | --- | --- |
| Wizard (Base 5) | Skeleton, 2 orbs | Skeleton, 3 orbs | empty |
| Cowboy (Base 5) | Sheriff, 2 orbs | empty | empty |

Hand: Deadeye, Deadeye, Captured Dragon, Sheriff.

| Line | Cowboy clicks | Result |
| --- | --- | --- |
| A. Dragon into the open lane | R1 Sheriff lane 1. R2 Captured Dragon lane 3, tribute lane 1, then Deadeye on Wizard lane 1. R3 Sheriff lane 1, Deadeye on Wizard lane 1. | Victory, round 3. Cowboy Base 1, Wizard Base 0. |
| B. Keep the Sheriff, add another | R1 Sheriff lane 1. R2 Sheriff lane 3, Deadeye on Wizard lane 1. R3 Captured Dragon lane 1, tribute lane 1. R4 Sheriff lane 1, Deadeye on Wizard lane 3. R5 Sheriff lane 2, Deadeye on Wizard lane 3. | Victory, round 5. Cowboy Base 4, Wizard Base 0. |

- **The choice.** Win in round 3 with one Base orb left, or in round 5 with four. After clash 2 on line A the Bases stand at Cowboy 3 and Wizard 1.
- **The search agrees.** The Dragon into the open lane forces a win by round 3, never with more than one Base orb left. A second Sheriff in lane 3 cannot win before round 5 and can keep four.
- **Wrong lanes are slower, not lost.** The Dragon in lane 1 or lane 2 wins no earlier than round 6.
- **Passing is not punished here.** Ending the turn in round 2 can still win by round 6. Seed 264 was stricter.
- **Other round-1 lanes.** The search gives the same shape with the first Sheriff in lane 2 or 3: the open lane wins by round 3, a second Sheriff by round 5 or 6. There the Dragon in the Sheriff's own lane can only draw. I did not replay click lists for those two cases.

## Smallest implementation scope

1. One number in the Captured Dragon card spec: attack 3 → 4. Regenerate the catalog.
2. Card text wherever its stats are shown: the Wanted poster's reward line, the showcase note line and the card library.
3. Showcase seed 264 → 468, with the two lines above.
4. Nothing else. Same cost, same unlock, same preset, no rule change.

## Acceptance cases

1. The spec reads one tribute (5 stars), 2 orbs, 4 attack, one copy, bounty card.
2. Single clashes with boards set directly: the four "4 attack" cells of the lane table.
3. All ten hunts start from the same states as at `d0cf982`. No hunt contains the reward card.
4. Default duels, the guided duel, the Wraith Posse duel, the Stargazer and Imp duels and both practice challenges are unchanged for decks without the Captured Dragon.
5. The showcase deals seed 468 with the hands above. After R1 Sheriff lane 1 and End turn, round 2 shows the board and hand above.
6. Line A ends in Victory in round 3 with Cowboy Base 1. After clash 2 the Bases are Cowboy 3 and Wizard 1.
7. Line B ends in Victory in round 5 with Cowboy Base 4.
8. Bot check: re-run the Dragon Posse list and the Billy list on seeds 93000–93999 against the default Wizard and the Stargazer. Each win rate should land within about three points of the tables.

If the change is not adopted, keep the card and the seed-264 showcase exactly as the reward brief has them. Both of its lines hold at `d0cf982`.

## Back to Fable

- Any case that does not reproduce.
- Playtests where the 4-attack Dragon makes duels feel decided by one open lane, or where the extra draws read as anticlimax. The fallback is today's card.
- This pass was limited to one stat. Attack 4 fixes the numbers and keeps the card a glass cannon. Whether a captured Dragon should do something only a Dragon does is a question for a later pack.
