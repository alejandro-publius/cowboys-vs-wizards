# A lane choice in the guided opener

November 18, 2026, Pacific. Kiro IDE with Claude Opus 5.5 implemented the graybox opener in session `sess_e4228fbe-3856-4f3e-bf55-bd732830717a`. The IDE showed 4.64 estimated credits for the turn. Codex reviewed the changes and integrated them in `d21e247`.

The [launch-deck study](clash-royale-launch-decks.md) found that the old seed-0 guided opener showed the same immediate payoff in all three lanes. **How to Play → Start guided duel** now opens seed 60 with the starter deck and Normal Wizard policy. The Wizard has already played a Skeleton. One guided sentence cues the player to block it or attack through an open lane.

| Safari check | Observed |
| --- | --- |
| Guided entry with `?seed=14&cpu=hard` in the URL | Seed 60, a Skeleton in lane 1, and the block-or-trade tip. |
| Sheriff in lane 1, then End turn | The projected Bases stayed at five. Round 2 opened with both Bases at five and Sheriff at two life. |
| Restart, Sheriff in lane 2, then End turn | Restart restored the opening tip. The forecast showed both Bases falling from five to four. Round 2 opened with both at four. |
| Ordinary `?mode=match&deck=starter&seed=0&guide=1` | Seed 0 and the original generic opening guidance. |

`npm run build` succeeded. The focused guide, card model, summon forecast and clash forecast suites passed 22 of 22 tests. The replays establish the playable choice and outcome. First-time player feedback remains open.
