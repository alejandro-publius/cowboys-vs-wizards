# Night Watch evidence

Night Watch is a Kiro Crew app that compares two exact Cowboys vs. Wizards commits on the same CPU seeds. Each report records both SHAs, the candidate’s game-rule checks, faction and starting-seat results, and any changed card stats. An alert or failed check can produce a prefilled GitHub issue draft.

## Observed on November 16, 2026

| Check | Observed result |
| --- | --- |
| Same-seed comparison | In seeds 0–999, the three-orb Skeleton baseline produced 472 Wizard wins. The four-orb proposal produced 663. The dashboard identified the +19.1 percentage-point change and displayed the Skeleton health change. |
| Rules check | A hard-coded three-orb assertion initially stopped the proposal. Codex updated the tribute test to check the actual starting health of the surviving troop. The proposal passed all 41 game-rule tests, and the full duel suite passed 107 tests. |
| Failure and issue draft | A deliberately failing rule test produced a failed report with diagnostics and a prefilled issue link. The proposal alert produced its own draft with exact revisions and results. |
| Dashboard | The installed app on Crew 0.12.2 accepted the checkout and refs, ran the comparison in Chrome, and rendered the report and issue draft action. |
| Crew schedule | In an isolated Crew profile, a command job registered for 2:00 a.m. Pacific. Triggering the registered job produced the scheduled report `34eb6c4957b1`, with 41 passing rules tests and 472 versus 663 Wizard wins. The Crew page displayed the same report as Scheduled. |
| Overlapping runs | A second request while the run lock was held returned a busy response. Saved reports continued to appear after later runs. |

Kiro CLI authored the simulator adapter and HTTP backend. Codex connected the Crew dashboard and scheduler, fixed the tribute assertion and the gateway proxy route, and ran the integration checks. [App source and setup](../../apps/night-watch/README.md)

The normal Mac Crew profile has Night Watch 0.1.1 installed. Crew’s App Store controls trust for this app before activation. The recurring job was verified in the isolated profile.
