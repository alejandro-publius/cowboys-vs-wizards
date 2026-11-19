# Frontier pack

Fable 5.2 authored the six cards, deck counts, unlock order, Ride rule and
acceptance routes. Kiro CLI implemented the card pipeline, copy limits, rules,
grant thresholds, deck builder, Ride controls and historical simulation fix.
Codex integrated the play paths, checked entitlement at the match boundary,
and independently verified the deal outcomes and browser controls.

## Play and record

```sh
node scripts/build-graybox.mjs
```

Open `dist/cowboys-vs-wizards-board-duel.html?seed=244&cpu=normal`. Use a
profile with six counted duel wins. Open Build Deck, load Night Riders and
save. Play this deal against the Normal Wizard. Use the duel menu to replay
the same seed for the second route. Try Draft also works and leaves the saved
deck alone. At seven wins, Wagon Train is available.

| Round | Night Riders through round 3 |
| --- | --- |
| 1 | Sheriff in lane 1. |
| 2 | Sheriff in lane 2, then Deadeye on Wizard lane 1. |
| 3 | Ranger in lane 1, paying the Sheriff in lane 2 as tribute. |

In round 4 the Ranger is in lane 2 with two orbs. Play these two routes
from that same position.

| Round | Ride | Hold |
| --- | --- | --- |
| 4 | Ride from lane 2 to lane 1, then Deadeye on Wizard lane 1. | Outrider in lane 1, then Deadeye on Wizard lane 1. |
| 5 | Outrider in lane 2. | Dynamiter in lane 3. |
| 6 | Sheriff in lane 3, then Lasso on Wizard lane 1. The Cowboy wins with two Base orbs. | Sheriff in lane 2. |
| 7–9 | | Dynamiter in lane 3. Next round, Outrider in lane 2 and Lasso on Wizard lane 2. Last round, Ranger in lane 1, paying lane 1 as tribute. The match draws. |

Wagon Train at seed 6 starts with Sheriff, Covered Wagon, Deadeye and Billy.
Place Covered Wagons in lanes 1 and 2 in rounds 1 and 2. In round 2 cast
Deadeye on Wizard lane 1. In round 3 pay both Wagons to summon Gatling Crew
in lane 1. In round 4 place Sheriff in lane 2 and cast Lasso on Wizard lane 2.
In round 5 tribute the Sheriff for Billy in lane 2 and end the phase to win
with four Base orbs.

## Verification

- `node scripts/verify-duel.mjs` passed 415 tests and both GLB structure
  checks on the local Frontier branch at `3099463`. Both build recipes
  compiled.
- Chrome displayed four collectible cards at one counted win and granted
  Lasso at two. Night Riders appeared at six and Wagon Train at seven.
  Loading a preset kept the saved deck unchanged. Saving Night Riders and
  choosing Play dealt the expected four cards. The round-4 Ride control
  moved the Ranger to lane 1 and then hid for the rest of that turn. Chrome
  reached Victory in round 6 on the Ride route and Draw in round 9 on the
  Hold route. The Wagon Train run also reached Victory in round 5 in
  Chrome, including both tributes for Gatling Crew.
- Engine replays reproduced all three scripted outcomes. Starter deck IDs,
  guided seed 690, Wraith Posse seed 2328, and all ten fight openings matched
  `91c7d7a`. Each bounty reward still needed five distinct clears.
- Bot screens used seeds 72000–72999 with both first seats and 2,000 matches
  per row. Each draw counts as half a win. These runs measure bot play.

| Deck | Normal win share | Hard win share | Normal mean rounds | Hard mean rounds | Exact no-free-opener chance |
| --- | ---: | ---: | ---: | ---: | ---: |
| Starter | 50.20% | 49.88% | 7.30 | 5.81 | 3.03% |
| Wagon Train | 52.55% | 53.85% | 5.99 | 5.43 | 7.07% |
| Night Riders | 53.60% | 57.15% | 5.43 | 5.19 | 1.01% |

```sh
node --input-type=module -e 'import {NIGHT_RIDERS} from "./src/game/deck-presets.js"; console.log(JSON.stringify(NIGHT_RIDERS.counts))' > /tmp/frontier-night-riders.json
node scripts/screen-cowboy-decks.mjs --candidate /tmp/frontier-night-riders.json --from 72000 --count 1000
```

Use `WAGON_TRAIN` in the first command to screen Wagon Train. Human
playtesting here should focus on how often a lane move feels worth the summon
and how quickly Dynamiter punishes an undefended lane.
