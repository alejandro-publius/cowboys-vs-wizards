# Kiro task queue

**Scheduling update:** the user assigned initial implementation to the signed-in Fable session. Use `fable-tasks.md` for active ownership and status. Do not run a duplicate engine worker in Kiro. After engine commits exist, Kiro can reconcile requirements and implement a bounded UI milestone. Record each tool’s actual contribution.

Prepared by Codex. Run one bounded task at a time, inspect the result and relevant checks, then send the next. Do not execute this entire queue in a single prompt. Numeric balance remains a playable draft.

| Order | Deliverable | Finish condition | State |
| --- | --- | --- | --- |
| 1 | Correct rules and headless orb-duel engine | Seeded complete matches; tribute, simultaneous damage, unique ownership and stale actions checked | Rule brief: `kiro-task-01.md`; initial implementation assigned in Fable queue, not yet run |
| 2 | Visible deck, four-card hand, selection and atomic sacrifice confirmation | Browser interaction produces exactly one valid action and can cancel without changes | Waiting for engine |
| 3 | Summons and 1–5 health orbs | Correct slots and visible health from engine state, with roster asset gaps stated | Waiting for engine/UI and assets |
| 4 | Wizard rig and one readable cast | Rendered grip/floor review and post-GLB-import verification | Static mesh verified; see `character-animation-plan.md` |
| 5 | Billy rig, shot and hit/defeat reactions | Damage/event alignment verified once per action in browser | Waiting for per-character pass |
| 6 | Full match, restart, performance and presentation | Recorded continuous match; repeatable tests; measured browser timings | Waiting for integration |
| 7 | Submission evidence and genuine automation | Log links to actual Kiro work, verified hook runs and test/browser evidence | Log exists; Kiro implementation still pending |

Firebase is a possible later extension, not part of this queue's current gameplay milestone. Do not use premium-model overrides or Crew/critic loops by default. Report the installed model used when visible; do not invent credit estimates.

## Earlier Kiro dispatch (superseded by active Fable queue)

In a Kiro agent chat opened on this project, send:

> Read docs/kiro-task-01.md and execute only that task. Run its checks, append actual results to docs/kiro-build-log.md, and stop. Preserve the current board demo.

CLI automation needs a successful `kiro-cli login` using the same sign-in account as the user's Kiro Pro subscription. IDE sign-in alone did not authenticate the installed CLI when checked. A device-flow attempt returned `InvalidGrantException`; no task completion should be inferred from the launcher exiting successfully.
