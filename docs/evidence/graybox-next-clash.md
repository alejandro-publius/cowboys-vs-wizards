# Graybox Next clash

Kiro IDE ran the scoped task with Claude Opus 5.5 selected. It completed source reads and stalled before writing any files. Codex stopped the run and implemented the forecast on the `kiro/graybox-hand-readability` branch.

| Replay | Before | Observed after |
| --- | --- | --- |
| Seed 0, round 1 | The player had only the per-lane preview while choosing a summon. | After Sheriff entered lane 2, Next clash forecast the enemy Base at 5 → 4 and warned that Wizards could act. A Skeleton blocked the lane and the enemy Base stayed at 5. |
| Seed 14, round 1 | The hand showed why each card was blocked. | Next clash directed the player to End turn. Round 2 opened with a playable Sheriff. |
| Seed 60, round 1 | The board showed an enemy Skeleton in lane 1. | Next clash forecast the Cowboy Base at 5 → 4. Defending lane 1 with Sheriff changed it to 5 → 5. Ending the turn left the Cowboy Base at 5. |

Verified in Safari using the standalone graybox and starter decks. The forecast disappeared while choosing a lane and the per-lane summon previews stayed visible. `npm run build` succeeded. Six tests passed across the clash and summon forecasts. The clash tests include simultaneous lethal damage, named losses, hidden-state gating, and input immutability.
