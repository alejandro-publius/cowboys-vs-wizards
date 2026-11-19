# Graveyard Dragon reward duel

Fable 5.2 designed Dragon Posse and compared its tribute timing routes. Kiro CLI implemented the shared preset and the fifth-capture showcase. Codex shared the capture tracker and fixed-deal starter between both Posse routes, then verified them independently.

Clear the five different Graveyard Dragon hunts on the Wanted board. The fifth capture still earns Bounty Hunter and unlocks Captured Dragon. It also offers **Duel with the Dragon Posse**. The showdown opens on seed 264 with Normal Wizard and a draft of 6 Sheriff, 2 Billy, 3 Deadeye, and 1 Captured Dragon. The same preset is available in Build Deck. Repeating a capture gives no new showcase.

## Two routes to record

In round one, summon Sheriff in lane 1 and end the turn. The Wizard opens round two with Skeletons in lanes 1 and 2. A one-orb Sheriff faces the first Skeleton. End the turn after the listed moves each round.

| Round | Dragon into the open lane | Keep the Sheriff |
| --- | --- | --- |
| 2 | Tribute Sheriff in lane 1 for Captured Dragon in lane 3. Deadeye Wizard lane 1. | Sheriff in lane 3. Deadeye Wizard lane 1. |
| 3 | Sheriff in lane 1. | Sheriff in lane 1. |
| 4 | Sheriff in lane 3. Deadeye Wizard lane 3. Victory with Cowboy Base 1. | Tribute lane 1 for Captured Dragon in lane 2. Deadeye Wizard lane 3. |
| 5 | | Sheriff in lane 1. |
| 6 | | Sheriff in lane 2. Deadeye Wizard lane 2. Victory with Cowboy Base 2. |

Headless Chrome cleared all ten hunts across the Wraith and Dragon routes. It verified repeated Dragon captures, the fifth-capture gate, exact preset counts, both wins, Restart, Replay and unchanged profile storage across showcase duels. Both builds and all 47 focused tests passed.

The proposed deck's score share against Normal rose from 41.5% to 51.5% and against Hard from 44.1% to 52.3%. Codex independently reproduced Fable's three-deck comparison over 12,000 bot matches, using seeds 91000–91999, both first seats and both difficulty levels. Score share counts a draw as half a win. This is a comparison of deck lists, with the extra Deadeye responsible for much of the gain. Human balance remains untested.
