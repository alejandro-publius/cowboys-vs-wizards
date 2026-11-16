# How we used Kiro on Cowboys vs. Wizards

1. **IDE and CLI.** In the IDE, Kiro turned the attack prototype into a complete card match using Fable’s rules and CPU. Kiro CLI ran focused tasks for the card presentation, arena loading and the Mounted Billy import. Each task had its own worktree.
2. **Custom agents.** The CLI’s `duel-presenter` profile shares the game’s steering and runs its existing checks on session start. Kiro used it to land a card on the chosen 3D tile at the summon cue and to fit the new troop without changing the engine.
3. **Agent hooks.** The SessionStart hook runs the presenter, controller and card model suites. Its observed run passed 19 tests. New runs write to `.artifacts/kiro/ui-hook.txt`, allowing another agent to start without generating a tracked diff. [Original hook receipt](evidence/kiro-ui-hook.txt)
4. **Spec-driven development.** Kiro’s Requirements-First spec defines legal card and tribute selection, one to five troop orbs and simultaneous lane clashes. Its ten-task plan connects that design to the browser. The spec’s requirement that a defeated troop finishes its clash became an automated presenter check. [Orb Duel requirements](../.kiro/specs/orb-duel/requirements.md)
5. **Steering.** The general steering records the seed, commands, actual results and attribution. Kiro added presentation-specific steering that loads for relevant paths and points agents to the existing engine, cancellation and card-art contracts. [Presentation steering](../.kiro/steering/duel-iteration.md)
6. **MCP.** Kiro CLI called the workspace’s read-only `inspect_duel_replay` tool. It verified eight observed steps and zero errors on the matching build, then rejected the same clean report paired with an older HTML file as stale.
7. **Property-based testing.** Kiro exercised display fidelity, simultaneous attacks, one-to-five orb bounds, public-information limits and stale playback across seeds 0–99. The seed and test name make a reproduced failure actionable. [Property and match test evidence](evidence/kiro-match-ui.md)
8. **Powers.** Kiro loaded our locally installed Orb Duel Review Power. Its procedure tells a new review session to consult the workspace MCP, inspect the actual artifact hash and explain the verdict. Both the Power load and the tool call ran in the same Kiro sessions for the matching and stale cases.
9. **Workflows.** The saved `orb-duel-replay` recipe runs verification in one Kiro step and assembles the receipt in another. The November 16 run finished both steps on `0e33ccc` with 104 passing Node tests and eight observed Chrome checks. [Workflow recipe](../.kiro/workflows/orb-duel-replay.workflow.json)

## Evidence to show

| Screen | What the judge sees |
| --- | --- |
| Game with the known seed | A card moves from hand to the board. The center-lane clash removes orbs at impact. |
| Kiro Spec and presenter test | The requirement that both attackers finish a simultaneous clash, tied to a deterministic test. |
| Kiro Workflow and replay receipt | The exact revision, observed checks and browser build hash. |
| Kiro Power and MCP tool response | The matching build passes. The same report presented with an old build is rejected. |

Fable built the rules, CPU and balance simulations. Kiro built the playable interface, verified it through its Workflow and improved the presentation and loading. Codex integrated the branches, optimized the Tripo exports, measured the browser performance and configured the review connection. See the [build log](kiro-build-log.md) and [overnight evidence](evidence/kiro-overnight.md) for individual changes.

[Research and recording plan](kiroween-research-and-recording.md) · [Kiroween official rules](https://kiroween.devpost.com/rules)
