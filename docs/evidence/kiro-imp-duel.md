# Optional Imp duel

Fable 5.2 designed the Imp matchup and the two seed-4671 routes.
Kiro CLI implemented the registered troop, optional deck, title-menu entry
and public tile description. Codex generated the catalog, kept the opponent
in the captured deal, and verified the replays and card registry.

**Duel the Imp** opens after seven counted duel wins. The deck is six
Skeletons, two Wizards, one Dragon, two Singularities and one Imp. The
Imp is a free troop with three attack and one orb.

## Replay the tribute decision

Save Wagon Train in Build Deck. Open the graybox at
`?wizard=imp&seed=4671&cpu=normal` and choose **Play**. Start with
Sheriff in lane 1, Covered Wagon in lane 2, then Sheriff in lane 1 and
Deadeye on Wizard lane 1 over the first three rounds. End each phase.
An Imp faces the open Cowboy lane 3 in round 4.

| Round | Hold the lane | Cash in early |
| --- | --- | --- |
| 4 | Sheriff in lane 3 | Gatling Crew in lane 3, paying lanes 1 and 2 |
| 5 | Gatling Crew in lane 2, paying lanes 1 and 2. Lasso on Wizard lane 1. | Sheriff in lane 2. Lasso on Wizard lane 2. |
| 6 | End phase | Billy in lane 1, paying lane 2 |
| 7 | End phase | End phase. Defeat, Wizard Base at 4. |
| 8 | End phase | |
| 9 | Covered Wagon in lane 1. Victory, Cowboy Base at 5. | |

After clash 4, holding keeps the Cowboy Base on five. Cashing in leaves
the Base on three and Gatling Crew on one orb. **Replay this deal** returns
to the same seed and opponent.

## Verification

- Chrome exercised the unlock gate at six and seven wins, both routes,
  Restart, Replay, pause and resume, both optional opponent query
  selections, ordinary Play, Try Draft and guided play. The Imp tile
  showed the public card line as authored.
- Direct engine runs verified the exact hands and round-4 board and
  checked the baseline deals, all ten hunt openings, Ride Out and the
  existing seeded Frontier and Stargazer routes.
- The full duel suite passed all 424 tests. Both builds compiled and
  the generated catalog check passed.
- The production engine matched Fable's 12,000 Imp matchup bot games
  on seeds 84000–84999 with both first seats. Wagon Train's Normal win
  rate was 52.35% against the Imp and 46.45% against the default list in
  Fable's paired study. The Imp gives the player a clearer tribute
  decision when it appears. It also makes the matchup more forgiving
  overall for Wagon Train in these simulations.
