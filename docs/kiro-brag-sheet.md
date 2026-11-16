# How we used Kiro on Cowboys vs. Wizards

Evidence through November 15, 2026. The commit table identifies the builds each claim applies to.

1. **Kiro IDE and CLI.** The IDE Spec session turned the attack prototype into a playable match using Fable’s rules and CPU. Kiro CLI ran the reusable replay Workflow and implemented the later board and card presentation changes.
2. **Agents.** Kiro’s built-in Spec agent dispatched the ten implementation tasks. The replay Workflow used two `wf-coder` step sessions. A run by a project-defined agent is evidence to collect.
3. **Agent hooks.** The proposed presenter File Save hook would run `node --test tests/match/presenter.test.js`. Record the hook firing and its exit status when implemented.
4. **Spec-driven development.** Kiro revised the requirements for 1–5 troop orbs, tribute costs, and simultaneous clashes. It wrote `requirements.md`, `design.md`, and a ten-task plan, then ran the format validator. The requirement that a defeated attacker can still finish its clash attack became a presenter test.
5. **Steering.** Codex prepared `.kiro/steering/build-evidence.md`. Kiro used it to record seeds, commands, observed results, and who did the work in the build log and evidence notes.
6. **MCP.** Desktop Commander gave Codex access to the local Kiro UI. The Chrome replay used a Node script and the DevTools Protocol. A Kiro session using an MCP tool directly is evidence to collect.
7. **Property-based testing.** The 41 passing match tests included seeded properties over seeds 0–99 for selection isolation, display fidelity, simultaneous attacks, orb bounds, stale playback, and the CPU’s public-information limit.
8. **Powers.** We inspected Build with Firebase in the IDE. Record a Power activation that contributes to the game before claiming its use in the submission.

## Recorded game and Workflow changes

| Commit | Work and evidence |
| --- | --- |
| `64e3614` | Kiro built the hand, approved card back, legal card and tribute selection, canvas placement, CPU turns, queued combat, impact-timed orbs, results, and restart. Seed 0 completed all eight scripted Chrome steps with zero console errors. See `docs/evidence/kiro-match-browser.md` and `docs/evidence/kiro-match-ui.md`. |
| `a785378` | Codex wrote the `orb-duel-replay` Workflow recipe and isolated its output. Kiro CLI ran both steps, with six passing presenter tests and a fresh Chrome replay that observed all eight steps with zero console errors. Its HTML hash matched the original closeout build. See `docs/evidence/kiro-workflow-replay.md`. |
| `1f4c7cd` | Kiro added a blue pulse for the actual attacking troops during the existing clash pause. |
| `415af3c` | Kiro added stack depth, card selection lift, and flight from a confirmed troop card to the chosen lane indicator. Codex connected the flight to the controller’s accepted action result. |
| `daf61d6` | Kiro added two board graveyards that absorb cards as defeats, tributes, and spells enter discard. See `docs/evidence/kiro-duel-graveyards.md`. |
| `c2a7dc6` | Kiro added the Cowboy deck-to-hand draw and flip. Codex fixed duplicate copies and deck alignment, then ran 19 passing targeted tests. See `docs/kiro-build-log.md`. |

The scripted Chrome evidence applies to `64e3614`. Browser verification for the later visual changes is deferred. We used Agent Focus to inspect the active IDE session and looked at Extensions, Powers, and Memory settings.

**Attribution.** Fable authored the rules, CPU, and balance simulations. Kiro authored the playable interface, its verification, and the visual changes listed above. Codex authored the replay recipe, built separate hosted playtest work, and adapted Lucca Cerf’s Character Factory material for the asset workflow.

[Research, implementation, and recording plan](kiroween-research-and-recording.md) · [Kiroween submission rules](https://kiroween.devpost.com/rules)
