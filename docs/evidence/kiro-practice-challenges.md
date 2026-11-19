# Practice the choice

Fable 5.2 designed both challenges and their seeded lines. Kiro CLI built the practice opener, How to Play entries, and result actions. Codex consolidated the menu definitions, hid seed entry in practice, and verified the four routes. Two tests pin the hands and starting boards.

Previously, the tribute decision took three precise turns to reach. Practice opens at the choice and Replay returns to it. The How to Play entries appear after seven counted wins. Practice uses the Normal Wizard and leaves all profile data untouched.

## Record both outcomes

Open the graybox with `?mode=practice-dynamiter` for Night Riders against Stargazer, or `?mode=practice-tribute` for Wagon Train against the Imp. The test links work on a fresh profile. Number lanes from left to right on each side. End the turn after each listed round.

| Challenge and opening choice | Moves after handover | Outcome |
| --- | --- | --- |
| Dynamiter, lead with Outrider | R1 Outrider 2. R2 Dynamiter 3 and Deadeye against Wizard 2. R3 Dynamiter 2. | Win in round 3. Cowboy Base 2. |
| Dynamiter, lead with Dynamiter | R1 Dynamiter 2. R2 Outrider 1. R3 Dynamiter 3 and Deadeye against Wizard 1. R4 Outrider 2. R5 Sheriff 3. R6 Sheriff 1. R7 Sheriff 3. | Loss in round 7. The Dynamiter falls before the round-one clash. |
| Tribute, block the Imp first | R4 Sheriff 3. R5 Billy 1 using tribute 1, and Lasso against Wizard 1. R6 Gatling Crew 1 using tributes 1 and 2, and Deadeye against Wizard 1. | Win in round 6. Cowboy Base stays at 5 after round 4 and finishes at 4. |
| Tribute, spend both troops now | R4 Gatling Crew 3 using tributes 1 and 2. R5 Sheriff 2 and Lasso against Wizard 2. R6 Billy 1 using tribute 2. R7 end turn. | Loss in round 7. Cowboy Base drops to 3 after round 4. |

Both builds and 41 focused tests passed. Headless Chrome played all four routes, checked restart and replay for each challenge, verified the seven-win menu gate and pause behavior, and confirmed that the direct links pin the seed. **Leave practice** returned to How to Play. The subsequent ordinary duel started with the saved deck and the default opponent.
