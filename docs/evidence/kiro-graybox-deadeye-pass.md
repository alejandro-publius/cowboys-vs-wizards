# Kiro graybox gameplay pass

November 18, 2026, Pacific. Kiro IDE with Claude Opus 5.5 authored three changes from `f527523` in separate worktrees. Codex reviewed the edit prompts, integrated the changes locally, and checked play in private browsing in Safari.

| Change | Integrated commit | Kiro session | Last recorded credit split total |
| --- | --- | --- | --- |
| Deadeye Control deck preset | `27b704d` | `sess_9dc42997-5f29-4cda-a6c4-55b4a420f2e2` | 18.843 |
| Deadeye target previews | `26ce79d` | `sess_228ecb8c-e60a-4d81-8f57-6f8e01906c80` | 23.572 |
| Decisive clash projections | `d434a50` | `sess_a919e66a-ca5d-43f1-9cfa-917f5f651dd3` | 10.622 |

The session totals come from the most recent `creditSplit` records. The account meter failed to refresh. The CLI attempt failed while creating its session directory. The entries above are from the IDE. Codex stopped the deck worker's extended smoke-check command after browser verification and shortened the repeated load notice in `1c8f04e`.

| Replay | Before | Observed in Safari |
| --- | --- | --- |
| Seed 0, deck builder | Starter opens with Mounted Billy and one Deadeye. | Loading the 12-card draft showed zero Mounted Billy and three Deadeye. The paused match still held the original hand. After Save deck and Restart, the same seed opened with two Deadeyes and zero Mounted Billy. |
| Seed 41, rounds 1–3 | Target lanes showed troop health. The player had to infer what the shot did. | Summon Sheriff in lanes 1, 2 and 3 in successive rounds. In round 3, choose Deadeye. Lane 1 showed Skeleton 1 → 0 and an open shot at the enemy Base. Lane 2 showed Skeleton 2 → 1. The chosen preview stayed through confirmation. Cancel restored the original forecast. After casting at lane 1, Sheriff survived and the full-clash forecast changed from enemy Base 5 → 4 to 5 → 3. |
| Seed 60, round 3 | Next clash forecast both Base totals. | Pass each turn. The round 3 forecast said your Base would fall from 2 to 0 and you would lose. End turn resolved to Defeat with zero Cowboy Base orbs. |

The standalone build succeeded at `1c8f04e`. The combined focused suite passed 33 of 33 tests across deck building, preset storage, selection, summon forecasts, spell previews and decisive clash forecasts. Round-limit win and draw cases were covered in the focused tests.
