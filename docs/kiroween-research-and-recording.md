# Kiroween research and recording plan

The November 16 build gives us one reproducible path from card selection to a 3D clash. Use the game, the requirements and the replay reviewer as evidence in the recording.

## 1. Research from September 30 through November 15

Kiroween 2026 opened October 30 and closes December 4 at 2 p.m. Pacific. I read six full issues of the AWS Builder Center Kiro Weekly Reading List and retrieved the November 15 preview. I also checked Kiro’s community hub, developer blog, docs, and release notes. [Devpost rules](https://kiroween.devpost.com/rules) · [Kiro community](https://kiro.dev/community/) · [Developer blog](https://kiro.dev/blog/) · [Changelog](https://kiro.dev/changelog/)

| Issue | Finding | Apply it here |
| --- | --- | --- |
| [Oct 4](https://builder.aws.com/content/3KF8lMm5mZQmBdkQFKNAFLblr0K/kiro-weekly-reading-list-4th-october-2026) | Duskline iterated on a live 3D browser game. The Kane guide connects implementation to browser evidence. | Check the actual WebGL board. Capture the build hash, inputs, and impact frame. |
| [Oct 11](https://builder.aws.com/content/3KaOedJXz7X3bKtOp40VoesUTbj/kiro-weekly-reading-list-th-october) | A small game was the proving ground for requirements, design, and tasks. Other examples use targeted steering and distinct agent roles. | Give Kiro one change with an acceptance test. Reuse the Orb Duel design. |
| [Oct 18](https://builder.aws.com/content/3KsUwW0THpSz9UcaPkopKifzaju/kiro-weekly-reading-list-18th-october-2026) | Scoped MCP tools and explicit limits were useful in unattended work. | Give the reviewer browser inspection and named checks. Keep the game source and acceptance tests read-only in that step. |
| [Oct 25](https://builder.aws.com/content/3LCkjfJIloaNwsVPRBygBll5h8C/kiro-weekly-reading-list-25th-october-2026) | PacMon tested short iterations in the browser. A Workflow practitioner used fresh reviewer sessions. | Review a frozen build from a fresh session with the spec, seed, and exact clicks. |
| [Nov 1](https://builder.aws.com/content/3LWfIgHmjUGOCCYX7sZXC0DJSn6/kiro-weekly-reading-list-1st-november-2026) | VCR Party Host found timer bugs through real play and documented a hook that never fired. Another entry found its pushed artifact differed from the reviewed one. | Capture a real hook event. Match the commit, HTML, and hosted release to the recording. |
| [Nov 8](https://builder.aws.com/content/3LpdwaZwh9sTkbCk8cAXBezlKKR/kiro-weekly-reading-list-8th-november-2026) | A separate Kiro Crew reviewer found two invitation-generator browser bugs after 117 tests passed. | Verify what the player actually sees after the seeded properties pass. Record the browser findings. |
| [Nov 15 preview](https://builder.aws.com/?trk=61b8af3d-aa07-438d-b99e-55cdb524dc02) | The preview emphasizes usage instrumentation and guardrails enforced at tool level. The full issue was unavailable in the retrieved sources. | Wire one scoped command hook and show the actual result. |

The closest references are [Duskline’s 3D playtests](https://builder.aws.com/content/3KCH1lCKDVDv4FJlPFdoAEb0vEX/building-duskline-from-an-idea-to-a-live-d-browser-game-with-kiro-and-antideploy), [VCR Party Host’s timing bugs and hook logs](https://dev.to/aiq_labs/bringing-back-the-vcr-board-game-with-kiro-a-spec-driven-build-from-the-command-line-2a6), and [Kiroween Invitation’s browser review](https://builder.aws.com/content/3LpKUiMT9UXTjR58Q0hYLsvTSv3/green-tests-were-not-enough-what-kiro-crew-found-in-my-kiroween-project).

### Recent Kiro releases worth applying

1. **Workflows, September 30, and the November 2–12 IDE updates.** Use a small recipe with an implementation step and a fresh browser-review step. Record the reviewer’s step transcript in the updated Workflow tab. Validate the workspace recipe before running it. [Launch](https://kiro.dev/blog/introducing-workflows/) · [IDE changelog](https://kiro.dev/changelog/ide/) · [Authoring](https://kiro.dev/docs/workflows/authoring/)
2. **CLI V3, launched November 3.** Reuse a workspace agent and Workflow in a fresh terminal to reproduce the check. The IDE is where we author and review the spec. Record a CLI run if it becomes part of the workflow. [CLI V3](https://kiro.dev/blog/cli-3/)
3. **Kiro’s own evaluation posts, October 20 and November 2.** The developers described independent regression checks and explicit invariants for their harness. Use the analogous setup here with a seeded presenter test and a separate check of the rendered scene. [Kiro’s fix evaluation](https://kiro.dev/blog/how-kiro-fixes-itself/) · [Harness invariants](https://kiro.dev/blog/harness-properties-in-lean/) · [Spec correctness](https://kiro.dev/docs/specs/correctness/)
4. **Approval improvements, November 10.** Keep the feature scope and command permissions small. If routine confirmations still interrupt the run, Kiro’s Approve for me mode can review those prompts. [Approve for me](https://kiro.dev/blog/introducing-approve-for-me/)
5. **Kiro Crew’s live browser review, November 5.** It can show an agent’s browser actions live and lets you take over. Use it for the review step if you already have it set up. The IDE Workflow tab covers the core recording with one app. [Crew changelog](https://kiro.dev/changelog/crew/)

## 2. What we applied on November 16

- The replay Workflow uses a fresh, seeded Chrome run with an HTML hash. Kiro completed both steps. The second step used the first step’s results to write its report.
- The installed Orb Duel Review Power loads a short review procedure. It calls the project MCP for a verdict from the actual artifact. Kiro completed a matching-build check and a stale-build check. Both used the same clean replay receipt.
- The SessionStart hook now writes its test receipt to an ignored path. The next job can begin with targeted checks and a clean tracked diff.
- Kiro moved exchange initialization off the match’s startup path and reused a single GLB decoding path. The paired Mac Chrome comparison reached the first playable frame in a median 686 ms, down from 1,109 ms before those changes.

These are the observed uses. The Kiro CLI V3 execution, Developer Center notes, and source links support the workflow story. [Overnight evidence](evidence/kiro-overnight.md) · [Kiro write-up](kiro-brag-sheet.md)

## 3. Record a 2:40 cut

| Time | Screen | Show |
| --- | --- | --- |
| 0:00–0:25 | Seed 0 or the opening of seed 60 | The deck, illustrated hand, free summon, and the first change in life orbs. |
| 0:25–0:55 | Seed 60, round 5 | Mounted Billy and the Dragon in the center lane. Let both attacks land, then show the graveyard and remaining orbs. |
| 0:55–1:16 | Kiro Spec editor | The acceptance criterion for simultaneous attacks. Show the seeded property that ties it to behavior. |
| 1:16–1:36 | Kiro agent and hook result | The agent profile, focused test run and scope of the worktree task. |
| 1:36–2:14 | Kiro Workflow and review Power | Eight observed browser checks on the matching build. Use the stale-build example to show the review catches a false release claim. |
| 2:14–2:40 | Game and public repository | The result, restart, and link the judge can play. |

| Criterion | Show in the build |
| --- | --- |
| Potential Impact | A new player can choose a legal summon and see who lost an orb. A fresh-player test will establish this. |
| Technological Implementation | Match specification, seeded properties, an independently reviewed browser receipt and measured startup improvement. |
| Design | The illustrated hand, physical deck and in-world arena, with attack and graveyard effects tied to the actual actions. |
| Innovation/Idea | A haunted-Western card duel that turns a two-tribute summon into a staged 3D clash. |
| Presentation | A real match with a clear opening move, a readable climax and a released build that matches the footage. |

The submission is due December 4, 2026, at 2 p.m. Pacific. The first judging stage checks viability, theme and use of the required tools. The public release needs the functional game link, source and assets in a public licensed GitHub repository, root `.kiro/` materials, a Kiro write-up and a public YouTube demo under three minutes. [Devpost rules](https://kiroween.devpost.com/rules)

## Replay the review in Kiro

Run `node scripts/verify-duel.mjs --browser` or start `orb-duel-replay` using Kiro CLI V3’s `/workflow run` picker. The workflow writes to `.artifacts/kiro/replay/`. Install the local Power with `kiro-cli powers install .kiro/powers/orb-duel-review`, then launch a fresh Kiro session from this checkout and ask for the **orb duel replay review**. The workspace MCP supplies `inspect_duel_replay`.

[Morning handoff and seed 60 route](morning-handoff.md)
