# Showdown device check

On November 27, 2026 UTC, Codex played the published illustrated Showdown in a fresh private window of native Safari 18.1.1 on an Apple silicon Mac running macOS 15.1.1. Codex operated Safari through macOS accessibility controls. This records desktop browser behavior for [issue #21](https://github.com/alejandro-publius/cowboys-vs-wizards/issues/21).

| Step | Observed result |
| --- | --- |
| Open the [published game](https://alejandro-publius.github.io/cowboys-vs-wizards/) and choose **Ride or Fight?** | The illustrated battlefield rendered with the Western town, Wizard side, card hand and board pieces. Safari exposed the turn number, each Base's orb count and the available card actions. |
| Inspect the opening position | On turn 3 the Wizard Base had four orbs. The Skeleton had three orbs and 1 attack. The ready Outrider had two orbs and 1 attack. The prompt offered a choice between attacking a troop and riding to the Base. |
| Play through the turn | A second Outrider appeared on the Cowboy board. The log recorded its arrival and a Deadeye hit that left the Skeleton on two orbs. |
| Activate **End turn** | The log showed the Wizards drawing, summoning Bone Wall and attacking the Outrider with the Skeleton. The Cowboy drew and regained control on turn 5. |

The private window was closed after the test. Desktop Safari exposed the action labels and updated the board and log after play. A physical phone with finger input and a first-time human player's judgement of readability and controls remain open.
