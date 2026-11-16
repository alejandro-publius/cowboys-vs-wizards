# Kiro match browser evidence

A Kiro task sub-agent ran `scripts/browser-match-check.mjs` on 2026-11-15 (America/Los_Angeles). The script drove headless Chrome through the DevTools protocol over Node's built-in WebSocket and played one seeded match. It is a scripted check, not a human playtest. Kiro wrote this note at closeout (8:30 PM PST) from the run's record, [browser-run.json](kiro-match-ui/browser-run.json).

## Run

| Item | Value |
| --- | --- |
| Time | 2026-11-15, 7:44:14 PM PST |
| Source | `b3c77bd` plus uncommitted Kiro work. No build input changed between the build and the commit that adds this note. |
| Page | `dist/cowboys-vs-wizards-board-duel.html`, built 7:43:26 PM PST, 25,591,171 bytes |
| Page SHA-256 | `41971491f1df4727b498d527da91265e61dd96c207dd166f3c6d5c96e94b79e5`. The run recorded it, and the built file gave the same value at 8:30 PM PST. |
| Browser | Chrome 157.0.8103.51 with `--headless=new`, 1440×900 viewport, no SwiftShader flags, no retries |
| WebGL | WebGL 2.0, ANGLE Metal renderer on Apple M1 |
| Machine | MacBookPro17,1, Apple M1, 16 GB, macOS 15.1.1, Node v26.0.0 |
| Seed | 0, pinned with `?seed=0`. Opening hand: Mounted Billy, Deadeye, Sheriff, Billy. |
| Console | 0 errors, 0 warnings |
| Timing | The script recorded a 645 ms load and counted 30.1 frames per second. An earlier run at 2:06 PM PST, on the build that still had a debug hook, counted 60.3, and this run overwrote its record. Neither figure is a performance result. |

## Task 10.1 steps

| Step | State | What the run recorded |
| --- | --- | --- |
| Generated seed shown | pending | The run always pinned seed 0. |
| Pinned `?seed=` replays | observed | "0 (pinned)" was shown and the hand equalled the engine's seed-0 hand. Both restarts and the return from the demo dealt that hand again. |
| Approved card back (task 6.4) | observed | The deck-pile image has the SHA-256 of `assets/cards/card-back.png` (`7f29fdd6…2a2f`). The Wizard hand showed 4 backs, and both deck counts were 8. |
| Select and cancel | observed | Selecting Sheriff gave "Choose a tile for Sheriff." The Cancel button cleared it, and Escape cleared a second selection. |
| Free summon | observed | Lane 1 was chosen by a canvas click at (506, 470) through `pick`, then confirmed. The lane showed "Sheriff 3/3" and 3 cards stayed in hand. |
| Tribute summon | observed | Billy (5 stars) was summoned in round 4, which the engine accepts only with one tribute. The run did not record which troop was given up. |
| Tribute cancel, full board | pending | Not exercised. |
| Deadeye | observed | Cast in round 2. Its target and orb change were not recorded. |
| Singularity with relocation | pending | The run does not record individual CPU actions. |
| End phase and CPU turn | observed | Status went from playing to cpu_turn to accepting_input. The next Cowboy phase (round 2) showed Sheriff 1/3, Skeleton 2/3 and a second Skeleton 3/3. |
| Clash timing on screen | pending | The run records states before and after playback only. Simultaneous attack starts, orbs dropping at impact, a defeated attacker finishing its attack and removals after the attacks were not observed on screen. Node Properties 2 to 4 cover this logic with a fake renderer and clock. |
| Result | observed | Defeat in round 4 ("A Base fell in round 4."), with the Cowboy Base at 0/5 and the Wizard Base at 3/5, after 6 human moves in 17.8 s of play. |
| Restart during playback | observed | Restart from the Defeat panel returned to round 1. Restart was then clicked during the round 1 clash, after impacts had landed (Skeleton 2/3, Sheriff 2/3). The new match showed round 1, empty lanes, Bases 5/5 and the same hand, and was unchanged 3 seconds later. |
| Demo and back | observed | Draw & fire, Singularity and Play exchange were enabled. Draw & fire ended at "Attack complete." with health 100 and 76. Back in the match: round 1, seed 0, 4 cards, demo controls hidden. |

Screenshots, downscaled from 1440×900 to 960×600 after capture: [Sheriff summoned](kiro-match-ui/summon-sheriff.png) and [Defeat panel](kiro-match-ui/result.png).

## Not checked

- No person has played the match, so clarity, readability and fun are unknown.
- How the Billy, Wizard, token and spell cues, the label sprites and the orbs look and feel. Two still frames are the only visual record.
- In the browser: Victory and Draw panels, a typed seed with Replay, an invalid seed, and a mode switch during playback. Node tests cover the controller and label logic behind them.
- Portrait and small screens, touch, keyboard-only play, Safari and other GPUs.
- Any seed other than 0.
- `src/render/cues.js`, `src/main.js` and `src/ui/cards.js` have no Node tests, so this run is their only check.
- A gap reported when the presenter tests were written: emptying a slot when a removal starts, instead of when it ends, would still pass them.
