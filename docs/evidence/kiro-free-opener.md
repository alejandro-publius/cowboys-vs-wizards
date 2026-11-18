# A playable free-opener trial

The graybox now accepts `opening=freeOpener` for an ordinary duel. An opening hand that has no free summon swaps its last card for the top free troop in its own deck. Hand size stays at four. The default and guided openings use their existing rules.

Build with `npm run build`. Open `dist/cowboys-vs-wizards-board-duel.html` and use these query strings for the before-and-after capture.

| Start | Query string | Observed in Safari |
| --- | --- | --- |
| Ordinary | `?mode=match&seed=14&deck=starter` | Three Billy cards and one Mounted Billy. The only available turn action is End turn. |
| Free opener | `?mode=match&seed=14&deck=starter&opening=freeOpener` | The last Billy becomes a Sheriff. Select Sheriff, lane 1, and Summon to make a legal turn-one play. |

In the variant, passing from that summon reached defeat in round 4. **Replay this deal** returned to the seed-14 round-one board with an empty lane 1, the playable Sheriff, and the experiment label. Opening **How to Play → Start guided duel** with `?seed=14&cpu=hard&opening=freeOpener` still produced the seed-60 Skeleton lesson without the label.

Kiro Opus 5.5 implemented the trial and parser tests in an isolated worktree. Kiro reported 4.23 estimated credits. The coordinator widened the experiment label across the board header and independently checked the build, all seven focused tests, and the player routes in Safari. The full test run passed 353 of 356 tests. Three release-serving tests were blocked because this environment disallows binding to localhost.

Seed 14 demonstrates the first-turn choice. The trial leaves the balance decision for human play.
