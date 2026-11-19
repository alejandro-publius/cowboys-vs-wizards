# Stargazer opponent

Fable 5.2 designed the matchup and authored the two seed-4 routes.
Kiro CLI implemented the optional Wizard deck, the seven-win menu gate,
and the deal controls. Codex attached the opponent to the existing deal
configuration, updated the affected regression checks, and verified the
integration.

Stargazer deals six Skeletons, two Wizards, one Dragon and three Singularities.
The **Duel the Stargazer** button appears after seven counted duel wins.
Stargazer outcomes count as ordinary duels.

## Play both routes

Save Night Riders in Build Deck. Open the graybox at
`?wizard=stargazer&seed=4&cpu=normal` and choose **Play**. The starting
hand is Outrider, Dynamiter, Outrider, Ranger. End the phase after each
row. **Replay this deal** returns to the same opening.

| Round | Outrider first | Dynamiter first |
| --- | --- | --- |
| 1 | Outrider in lane 2 | Dynamiter in lane 2 |
| 2 | Dynamiter in lane 3, Deadeye on Wizard lane 2 | Outrider in lane 1 |
| 3 | Outrider in lane 1 | Dynamiter in lane 3, Deadeye on Wizard lane 1 |
| 4 | Dynamiter in lane 3. Victory with 3 Base orbs. | Outrider in lane 2 |
| 5 | | Sheriff in lane 3 |
| 6 | | Sheriff in lane 1 |
| 7 | | Sheriff in lane 3. Defeat with the Wizard Base at 4. |

The round-1 Stargazer shoots the Dynamiter before the clash. The same
lead against the ordinary opponent trades with the Skeleton and leaves
both Bases at five. The Outrider route holds Dynamiter until the Cowboy
acts second in round 2.

## Verification

- Chrome confirmed both routes, the six-to-seven-win gate, pause and
  resume, Restart, same-deal replay, and the ordinary opponent under
  **Play**. Guided play and Try Draft retained their original opponent
  with the Stargazer replay query present.
- Direct engine checks reproduced the seeded default deals, the three
  Frontier route results, Wraith Posse, the ten hunt openings, and the
  Ride Out lesson. Invalid Wizard deck lists were refused.
- The full duel suite passed all 419 tests. A separate Chrome run with
  the Stargazer query present completed all five Wraith captures and
  replayed both Wraith Posse endings.
- The production engine exactly matched Fable's 24,000 bot matches on
  seeds 81000–81999 with both first seats. Each pair below is the wins
  out of 2,000 matches from the Cowboy side.

| Cowboy deck | Normal, standard → Stargazer | Hard, standard → Stargazer |
| --- | ---: | ---: |
| Starter | 911 → 859 | 915 → 720 |
| Night Riders | 939 → 745 | 1,088 → 781 |
| Wagon Train | 927 → 980 | 972 → 842 |
