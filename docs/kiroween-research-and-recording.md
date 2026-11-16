# Kiroween research and recording plan

Ship the verified Kiro match, then give Kiro one visible follow-up. A blue cue shows which troops are about to attack. The existing life orbs show what the hit did when it lands. Film the same seeded clash before and after, and show the Kiro requirement, test, and independent Chrome review that produced the change.

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

## 2. Implementation order

| Rank | Build | Result to show |
| --- | --- | --- |
| 1 | Close out Orb Duel and select one release commit for the repo, judge link, and recording. | Kiro’s playable match, 41 passing match tests, and the eight Chrome steps tied to one release. |
| 2 | Add the **blue clash cue** from the player’s reference. | Same turn before and after. Viewers can see who is about to attack and which troop loses an orb. |
| 3 | Set up the presenter test hook and the independent `duel-qa` Workflow step. | One relevant edit triggers a test. A fresh browser session records the frame and checks it against the acceptance criterion. |
| 4 | Package the reviewer’s procedure and Chrome DevTools MCP as a local Power. | Another session can activate and replay the same check. This adds no game runtime dependency. |

**Why this slice.** The clash cue fits the existing game, works with current assets, and gives Kiro a distinct player-facing contribution to show. A summon overhaul has greater cinematic upside when representative troop models and card fronts are ready. Opening-hand balance has the clearest numerical symptom (62 of 63 no-free-summon hands lost in Fable’s bot-vs-bot run) and needs a rules decision and a second simulation.

### Acceptance and replay

1. At committed clash playback, pulse a restrained blue outline on the troops about to attack. Derive participants from the upcoming damage events. Reuse the existing 250 ms pre-clash pause as the starting point. Keep empty lanes quiet and cue troops that will be defeated in that clash too.
2. End the cue as attacks start. Orbs change at the individual impacts. Defeats clear after all clash attacks. A restart or mode switch clears the cue with the rest of the playback.
3. Add a requirement-linked property check for attacker membership and cue, attack, impact, and defeat order. Cover restart during the cue. Capture the actual failure of the new cue assertion on the baseline and its passing result after the change.
4. Replay seed `0`. Summon Sheriff in lane 1, confirm, and end phase. In the saved baseline Sheriff went from three orbs to one and the opposing Skeleton from three to two. Capture that same clash in Mac Chrome before and after. For the hero shot, use Billy or Wizard once the exact route to a visible clash is rehearsed.

### Kiro setup to record

- **Steering.** Put presentation-specific context in a file-matched steering doc for the presenter and renderer. Point to one decision it guides, such as deriving every highlight from actual committed events. [Steering scope](https://kiro.dev/docs/steering/)
- **Hook.** Set the IDE’s File Save trigger to match `src/match/presenter.js` and run `node --test tests/match/presenter.test.js`. Kiro’s workspace hook format uses `PostFileSave` under `.kiro/hooks/`. Have Kiro make a matching edit and retain the actual hook output. [Hooks](https://kiro.dev/docs/hooks/) · [Trigger support](https://kiro.dev/docs/hooks/types/)
- **Agent and Workflow.** Place `duel-qa` in `.kiro/agents/`. Give it the frozen build, acceptance criterion, seed, exact clicks, and capture permissions. Save one recipe in `.kiro/workflows/` and run it in the IDE after validation. Open the reviewer’s step transcript to show the result. [Custom agents](https://kiro.dev/docs/custom-agents/) · [Workflow patterns](https://kiro.dev/docs/workflows/patterns/)
- **MCP and Power.** Have `duel-qa` use Chrome DevTools MCP for a real inspection. Bundle the replay procedure and MCP config with a `plugin.json` manifest, then use **Powers → Add Custom Power → Import power from a folder**. Record an activation and the screenshot or console evidence. [MCP registry](https://kiro.dev/mcp/) · [Create a Power](https://kiro.dev/docs/powers/create/)

## 3. Record a 2:40 cut

| Time | Screen | Show |
| --- | --- | --- |
| 0:00–0:25 | Released game | The visible deck, a card selection, a summon into a legal lane, and the life orbs. |
| 0:25–0:48 | Same clash twice | The same seed and choices on both builds. Pause on the blue cue, then show the hit and orb loss. |
| 0:48–1:15 | Kiro Spec editor | The acceptance criterion and its task. Explain the one decision that made the outcome testable. |
| 1:15–1:40 | Kiro test and hook output | Failure of the new assertion on the baseline, passing run, and the hook triggered by the matching edit. |
| 1:40–2:05 | Kiro Workflow tab | The fresh reviewer’s transcript, Chrome tool output, build identifier, and captured frame. |
| 2:05–2:40 | Released game and repo | The duel result, a clean restart, and where judges can play and verify the evidence. |

Once the checks have run, narrate the comparison in your own words. “Troops can fire at the same time in a clash. The blue cue shows who’s about to attack, and the orb drops when the hit lands. We put that into the Kiro spec, checked it across seeded games, and replayed the same turn in Chrome.”

| Judging criterion | Evidence to put in front of the judge |
| --- | --- |
| Potential Impact | A short duel teaches a new player to find a legal summon and read life orbs directly on the board. Check that a fresh player can predict which troops will attack and see who took the hit. |
| Technological Implementation | Show one Kiro acceptance criterion, the seeded check that exercises it, and an independent browser result on the release build. |
| Design | Show the physical deck, the card reveal and summon placement, then the combat cue in the 3D scene. This is the case for Costume Contest. |
| Innovation/Idea | Show simultaneous lane attacks in a haunted Western card duel, with tribute summons that turn cards into staged 3D actors. |
| Presentation | Open on a playable turn and end on the result and restart. Make the before-and-after replay the evidence of what Kiro changed. |

[Devpost judging criteria](https://kiroween.devpost.com/#judging-criteria)

**Submission check.** Devpost requires a working app, a public GitHub repo with source, assets, instructions, an open-source license and root `.kiro/`, a Kiro write-up, and a public YouTube demo under three minutes. The earliest local commit is November 14 Pacific, inside the window. Confirm the actual start date and disclose borrowed resources. The 7:44 p.m. Chrome receipt matches the HTML hash inspected locally. Human visual review, full-board tribute, Singularity relocation, phone layout, and Safari remain open. [Submission and judging rules](https://kiroween.devpost.com/rules)

## 4. Paste into Kiro after Orb Duel closeout

```text
Take the committed Orb Duel build as the baseline. Create and implement one small Requirements-First spec named clash-telegraph. Use the committed damage events to put one brief blue cue on each troop about to attack during the existing pre-clash pause. Keep orbs impact-timed and clear the cue on restart or mode switch. Empty lanes stay quiet. A troop defeated in the clash still gets its cue, attack and impact.

Read the Orb Duel spec, presenter, match board, and relevant tests. Run the new cue assertion against the baseline before implementing it. Then run the focused presenter tests and one local Chrome replay. Use seed 0, summon Sheriff in lane 1, confirm, and end phase. Capture the cue and impact. Record the exact inputs, check results, and commit and HTML hashes. Keep edits to the spec, presentation, targeted tests, and evidence. Return the changed files, replay instructions, and any unverified conditions.
```

[Concise Kiro brag sheet](kiro-brag-sheet.md)
