# Practice challenges: brief for Kiro

Fable 5.2, November 18, 2026, Pacific. Designed against `21dda2a` on `fable/practice-challenges`. No production code or art was touched.

Everything below was checked in a scratch copy of `src/game` under `.artifacts/practice-lab/`. It differs from the repository in one way: it carries the Imp's card spec from the wagon brief, which is not in the repository yet. The Normal Wizard bot answered every Cowboy line. Nothing was clicked in a browser.

## Recommendation

Build both challenges as **decision snapshots**: a fixed deal that opens on the turn of the choice. One small mechanism covers both. A practice deal is a seed, two decks and a scripted Cowboy opening that is replayed through the engine before the player takes over. The script may be empty.

- **Dynamiter timing** needs no script. The choice is the first click of the duel, so its snapshot and its full seeded duel are the same thing.
- **Tribute timing** needs three scripted turns. Its choice comes in round 4.

## Full duel against snapshot

| | Full seeded duel | Decision snapshot |
| --- | --- | --- |
| Dynamiter, clicks before the choice | 0 | 0 |
| Tribute, clicks before the choice | 15, over three exact turns | 0 |
| Tribute, chance of reaching the board | 1 of the 582 distinct Cowboy lines through round 3 | always |
| Both outcomes still reachable | only after a perfect opening | yes |
| What it costs to build | a fixed deal, plus on-screen instructions for three turns | a fixed deal, plus one opening script |

A full duel for the tribute challenge loses the lesson the moment the player varies one of 15 clicks. The snapshot gets them to the same board every time, and Replay brings them back to it.

## Entry and exit

**Entry.**

- Two buttons on the How to Play page, under Try Ride Out: "Practice: time the Dynamiter" and "Practice: time the tribute".
- Show both from 7 counted duel wins. That is when the player owns every card in both decks and the Stargazer appears. Hide them while a duel is paused, as Try Ride Out is.
- Test links: `?mode=practice-dynamiter` and `?mode=practice-tribute`.

**During.**

- Standard rules. The Wizard is always the Normal bot, whatever `?cpu` says, or the routes below do not hold.
- One note line names the practice and the choice, without the answer. It also says: "Practice earns no wins or rewards."
- Restart in the ☰ menu returns to the snapshot. The seed box does nothing in practice.

**Exit.**

- The result screen keeps "Replay this deal", which returns to the snapshot.
- Its second button reads "Leave practice" and opens the How to Play page, the way a finished hunt returns to Wanted.
- "Main menu" works as in any duel.

**No wins, no rewards.** A practice deal is a draft deal. It must not record a match, a win, a summon or a spell, must not move any unlock, and must not trigger the first-duel Wraith notice. `isDraft` already carries those guards.

## Challenge 1: time the Dynamiter

| Setup | |
| --- | --- |
| Seed | 4, the seed's own first seat |
| Cowboy deck | Night Riders preset |
| Wizard deck | `STARGAZER_DECK` |
| Scripted opening | none |
| Handover | round 1, the Cowboy acts first |
| Cowboy hand | Outrider, Dynamiter, Outrider, Ranger |
| Wizard hand | Skeleton, Skeleton, Wizard, Singularity |
| Board | empty, both Bases on 5 |

Note line: "Practice: Night Riders against the Stargazer. You act first this round, so the Wizard answers before the clash. Lead with the Dynamiter or with an Outrider."

| Route | Cowboy clicks | Result |
| --- | --- | --- |
| Outrider first | R1 Outrider lane 2. R2 Dynamiter lane 3, Deadeye on Wizard lane 2. R3 Dynamiter lane 2. | Victory, round 3. Cowboy Base 2, Wizard Base 0. |
| Dynamiter first | R1 Dynamiter lane 2. R2 Outrider lane 1. R3 Dynamiter lane 3, Deadeye on Wizard lane 1. R4 Outrider lane 2. R5 Sheriff lane 3. R6 Sheriff lane 1. R7 Sheriff lane 3. | Defeat, round 7. Cowboy Base 0, Wizard Base 4. |

- **What the player sees at once.** On the second route the Stargazer casts Singularity on the Dynamiter in round 1, before the clash. Round 2 starts with no Cowboy troops and the Base on 4. On the first route the Dynamiter arrives in round 2 after the Wizard has acted and takes the Wizard Base from 5 to 2.
- **How far apart the routes are.** An exhaustive search of the Cowboy's lines against the Normal Wizard gives a win by round 3 after the Outrider lead. After the Dynamiter lead the earliest possible win is round 9.
- The first route is one round shorter than the round-4 route recorded in `docs/evidence/kiro-stargazer.md`. That one still holds and was the one checked in Chrome.

## Challenge 2: time the tribute

This challenge needs the Imp card and the Imp list from the wagon brief. If the Imp is not adopted, ship challenge 1 alone.

| Setup | |
| --- | --- |
| Seed | 4671, the seed's own first seat (the Cowboy acts first in round 1) |
| Cowboy deck | Wagon Train preset |
| Wizard deck | Imp list: `wizard-skeleton-1` to `-6`, `wizard-wizard-1` and `-2`, `wizard-dragon-1`, `wizard-singularity-1` and `-2`, `wizard-imp-1`, in that order |
| Scripted opening | R1 Sheriff lane 1, End turn. R2 Covered Wagon lane 2, End turn. R3 Sheriff lane 1, Deadeye on Wizard lane 1, End turn. |
| Wizard's replies | Normal bot: R1 Skeleton lane 1. R2 Skeleton lane 2, Singularity on Cowboy lane 1. R3 Skeleton lane 1. R4 Imp lane 3. |
| Handover | round 4, the Cowboy acts second, revision 16 |
| Cowboy hand | Billy, Sheriff, Gatling Crew |

Board at handover:

| | Lane 1 | Lane 2 | Lane 3 |
| --- | --- | --- | --- |
| Wizard (Base 5) | Skeleton, 2 orbs | Skeleton, 1 orb | Imp, 1 orb |
| Cowboy (Base 5) | Sheriff, 2 orbs | Covered Wagon, 2 orbs | empty |

Note line: "Practice: Wagon Train against the Imp. Rounds one to three were played for you. Block the Imp, or tribute the Sheriff and the Wagon for the Gatling Crew."

| Route | Cowboy clicks from round 4 | Result |
| --- | --- | --- |
| Hold, then cash in | R4 Sheriff lane 3. R5 Billy lane 1, tribute lane 1, then Lasso on Wizard lane 1. R6 Gatling Crew lane 1, tribute lanes 1 and 2, then Deadeye on Wizard lane 1. | Victory, round 6. Cowboy Base 4, Wizard Base 0. |
| Cash in now | R4 Gatling Crew lane 3, tribute lanes 1 and 2. R5 Sheriff lane 2, Lasso on Wizard lane 2. R6 Billy lane 1, tribute lane 2. R7 End turn. | Defeat, round 7. Cowboy Base 0, Wizard Base 4. |

- **What the player sees at once.** On the hold route the Sheriff and the Imp both fall and the Base stays on 5. On the cash-in route the Crew blocks the Imp and drops to 1 orb, the two Skeletons walk through the opened lanes, and the Base is on 3.
- **How far apart the routes are.** An exhaustive search shows that after cashing in on round 4, in any lane, no Cowboy line wins or draws against the Normal Wizard. After the hold, the win comes by round 6.
- The hold route here is shorter than the nine-round route in the wagon brief, which also still wins.

## Smallest implementation scope

1. **Two practice definitions.** Seed, Cowboy preset, Wizard deck, opening script, note line.
2. **One start helper.** Create the match, then replay the scripted Cowboy actions with the Normal bot answering for the Wizard, as `createRideOutLesson` already does for its own opening. An empty script returns the fresh match.
3. **Deal wiring.** A draft deal tagged as practice. The Wizard uses the Normal bot. Restart and Replay this deal reuse the deal. The result screen's second button leaves practice.
4. **Menu.** Two buttons on How to Play from 7 counted wins, and the two test links.
5. **For challenge 2 only:** the Imp card and list from the wagon brief.

Not in scope: new rules, hints beyond the note line, scoring, art, the illustrated build.

One optional extra: replay the opening through the graybox's own action wrapper, so the earlier-clashes panel shows rounds 1 to 3 when the tribute challenge opens. Without it the panel starts empty.

## Acceptance cases

1. Challenge 1 opens on round 1 with the hands in its table and an empty board.
2. Both challenge 1 routes end as listed. After round 1 of the Dynamiter route the Cowboy has no troops and its Base is on 4.
3. Challenge 2 opens on round 4 with the board and hand in its tables, the Cowboy to act, the Imp in Wizard lane 3.
4. Both challenge 2 routes end as listed. After clash 4 the Base is on 5 on the hold route and on 3 on the cash-in route.
5. Replay this deal and Restart return each challenge to its handover state.
6. After a practice Victory the profile's matches, wins, summons, spells, achievements and unlocks are unchanged, and no Frontier card or deck is granted.
7. Practice with `?cpu=hard` in the address still plays the Normal Wizard.
8. The buttons are absent at 6 counted wins, present at 7, and hidden while a duel is paused.
9. "Leave practice" opens How to Play. An ordinary duel started afterwards uses the saved deck and the default opponent.
10. Default duels, the guided duel, hunts, the Ride Out lesson and the Stargazer duel behave as before.

## Back to Fable

- Any route that does not reproduce.
- Whether the note lines say too much. They state the situation and the two options, not the answer.
- Whether practice should open before 7 wins. That would mean lending decks the player does not own.
