# Dragon reward payoff: brief for Kiro

Fable 5.2, November 18, 2026, Pacific. Designed against `a795fbf` on `fable/dragon-reward-payoff`. No repository file was edited.

All numbers come from an unmodified scratch copy of `src/game` under `.artifacts/dragon-lab/`. The existing Normal and Hard bots played the deck comparison. The seeded lines were replayed click by click against the Normal Wizard, and the claims about what each choice can still achieve come from an exhaustive search of the Cowboy's lines against that bot. Nothing was clicked in a browser and no person has played this.

## Recommendation

Add one optional showcase duel after the fifth Graveyard Dragon capture, and change the Dragon Posse preset it uses. The five-capture unlock, the card and the rules stay as they are.

The two go together. The preset has to change in any case, because today's Dragon Posse is weaker than the Starter deck the player already has. The showcase is what turns the reward into a moment, the way the Wraith Posse duel does for the Wraith.

If only one can be built, change the preset.

## The preset

| Deck | Sheriff | Billy | Mounted Billy | Deadeye | Captured Dragon |
| --- | ---: | ---: | ---: | ---: | ---: |
| Starter | 6 | 3 | 1 | 2 | |
| Dragon Posse today | 6 | 3 | 0 | 2 | 1 |
| **Dragon Posse, proposed** | 6 | 2 | 0 | 3 | 1 |

The proposed list is legal for anyone who has the reward: starter cards plus the one Captured Dragon. It swaps one Billy for a third Deadeye.

Seeds 91000–91999 against the default opponent, each side first once per seed, 2,000 matches per row. Each cell is win / draw / loss in percent, then mean rounds. The change is in Cowboy win share (a draw counts half), paired by seed against the Starter.

| Deck | Normal | Change | Hard | Change |
| --- | --- | --- | --- | --- |
| Starter | 43.5 / 10.4 / 46.1, 7.22 | | 44.5 / 7.0 / 48.5, 5.86 | |
| Dragon Posse today | 34.8 / 13.4 / 51.8, 6.68 | −7.1 ±2.3 | 41.0 / 6.2 / 52.8, 5.63 | −3.9 ±2.1 |
| Dragon Posse, proposed | 46.1 / 10.8 / 43.1, 6.64 | +2.9 ±2.3 | 48.6 / 7.3 / 44.0, 5.53 | +4.3 ±2.3 |

- **Today's preset is a downgrade.** Loading the reward deck costs the bots 7 points of win share under Normal and 4 under Hard.
- **The proposed list is a small upgrade.** It also gets the Dragon onto the table more often: in 82% of Normal matches against 74%, and 59% of Hard matches against 51%.
- **Opening playability is unchanged.** All three lists hold six Sheriffs, so the chance of an opening hand with no free troop stays at 3.03% (3.7% seen).
- **The gain comes from the Deadeye, not the Dragon.** On a smaller screen (seeds 90000–90299) the same list with a Billy in the Dragon's slot, which is Deadeye Control, scored about 60%. Every list I tried scored lower with the Captured Dragon than with a Billy in its place. The card is weak in the bots' hands. That is a question about the card for another day, and it is the main reason the showcase matters: the reward needs one duel where it visibly wins.

Four other legal lists were screened on those seeds and none beat the Starter. One of them added Captured Wraith.

## The showcase duel

**Entry.** On the hunt result screen that completes the fifth distinct Graveyard Dragon capture, next to the existing "Bounty Hunter earned" line, add one button: "Duel with the Dragon Posse". It mirrors "Duel with the Wraith Posse" in every respect.

**Setup.**

| | |
| --- | --- |
| Deck | Dragon Posse, proposed list, as an unsaved draft |
| Seed | 264, the seed's own first seat (the Cowboy acts first) |
| Opponent | default Wizard deck, Normal bot |
| Rules | standard duel, no Ride Out |
| Cowboy hand | Sheriff, Sheriff, Deadeye, Captured Dragon |
| Wizard hand | Skeleton, Skeleton, Singularity, Wizard |
| Counts as | a draft: no counted win, no reward, saved deck untouched |

Note line in round 1: "Dragon Posse: Captured Dragon rides in place of Mounted Billy. It costs one tribute, hits for 3 and has 2 orbs." Give no lane hint.

**Round 1 is forced apart from the lane.** The only playable card is a Sheriff. The lines below use lane 1.

**The decision, round 2.** The Wizard has acted: a second Skeleton, and Singularity on your Sheriff.

| | Lane 1 | Lane 2 | Lane 3 |
| --- | --- | --- | --- |
| Wizard (Base 5) | Skeleton, 2 orbs | Skeleton, 3 orbs | empty |
| Cowboy (Base 5) | Sheriff, 1 orb | empty | empty |

Hand: Sheriff, Deadeye, Captured Dragon, Sheriff. You act second, so End turn resolves the clash.

Tribute the wounded Sheriff for the Captured Dragon, or keep him and add a second Sheriff?

| Line | Cowboy clicks | Result |
| --- | --- | --- |
| A. Dragon into the open lane | R1 Sheriff lane 1. R2 Captured Dragon lane 3, tribute lane 1, then Deadeye on Wizard lane 1. R3 Sheriff lane 1. R4 Sheriff lane 3, Deadeye on Wizard lane 3. | Victory, round 4. Cowboy Base 1, Wizard Base 0. |
| B. Keep the Sheriff, add another | R1 Sheriff lane 1. R2 Sheriff lane 3, Deadeye on Wizard lane 1. R3 Sheriff lane 1. R4 Captured Dragon lane 2, tribute lane 1, then Deadeye on Wizard lane 3. R5 Sheriff lane 1. R6 Sheriff lane 2, Deadeye on Wizard lane 2. | Victory, round 6. Cowboy Base 2, Wizard Base 0. |

- **What the player sees in round 2.** On line A the Dragon takes the Wizard Base from 5 to 2 in one clash, and the two Skeletons take the Cowboy Base to 3. On line B both Bases go to 4.
- **Why it is a real choice.** The search shows line A's first play forces a win by round 4, and line B's by round 6. The Dragon is two rounds faster and ends with one Base orb left. The Sheriff is slower and ends with two.
- **The wrong lane is punished.** The Dragon in lane 1, where the Sheriff stood, cannot win at all against this bot. In lane 2, facing the fresh Skeleton, it can do no better than a draw.
- **Passing is punished too.** Ending the turn, or casting Deadeye alone, loses.
- **It does not depend on the round-1 lane.** With the first Sheriff in lane 2 or 3 the board is the same shape. The Dragon into the open lane still forces a win by round 4, and a second Sheriff by round 6. With the Sheriff in lane 2 the open lane is lane 3; with the Sheriff in lane 3 it is lane 2. In those two cases the Dragon into the other Skeleton's lane wins no earlier than round 8, and the Dragon into the Sheriff's own lane cannot win. The equivalent line A click lists were replayed and both end in Victory in round 4.

## Smallest implementation scope

1. **Preset.** Dragon Posse becomes 6 Sheriff, 2 Billy, 3 Deadeye, 1 Captured Dragon wherever "Load Dragon Posse" defines it, with its loaded-message text and the card library's deck table.
2. **Showcase start.** One fixed-deal draft like the Wraith Posse duel: seed 264, the proposed list, the Normal bot, no Ride Out, the note line.
3. **Result button.** "Duel with the Dragon Posse" on the capture that completes the five.
4. **Nothing else.** No card, rule, unlock, opponent or art change.

## Acceptance cases

1. The fifth distinct Dragon capture still unlocks Captured Dragon and Bounty Hunter. A repeat capture still adds no progress.
2. "Load Dragon Posse" loads 6 Sheriff, 2 Billy, 3 Deadeye, 1 Captured Dragon, and the list validates for a profile with only the Dragon reward.
3. The showcase deals seed 264: the Cowboy acts first, with the two hands in the setup table.
4. After R1 Sheriff lane 1 and End turn, round 2 shows the decision board and hand above.
5. Line A ends in Victory in round 4 with Cowboy Base 1. After clash 2 the Bases are Cowboy 3 and Wizard 2.
6. Line B ends in Victory in round 6 with Cowboy Base 2.
7. The showcase with `?cpu=hard` in the address still plays the Normal Wizard.
8. After a showcase Victory the profile's matches, wins and saved deck are unchanged.
9. The Wraith Posse duel, the guided duel, all ten hunts and default duels behave as before.
10. Bot check: re-run the three lists on seeds 91000–91999. Each win rate should land within about three points of the table.

## What would make me cut it

- **The showcase:** playtesters who never consider the Dragon and simply keep adding Sheriffs, or who win line A without noticing they had a choice. Also cut it if the Wraith Posse duel shows that players skip the result-screen button.
- **The showcase, on fairness:** if the Dragon in a Skeleton's lane reads as a trap with no warning. The lane previews show a Base hit against a trade, which should be enough. If it is not, the seed is wrong for a first Dragon duel.
- **The preset:** if people play the proposed list as Deadeye Control and leave the Dragon in hand. Then the deck was never the problem and the card needs a look. Send that back to Fable; this brief changes no card.
- **Either:** any change to the Normal bot or the default Wizard deck. The seed and both lines depend on them, so re-verify before shipping.
