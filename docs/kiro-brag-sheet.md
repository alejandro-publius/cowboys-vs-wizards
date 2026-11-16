# How we used Kiro on Cowboys vs. Wizards

Evidence through November 15, 2026. Update these eight entries from the release evidence before submitting to Devpost.

1. **Kiro IDE.** We used the IDE to turn the 3D attack prototype into a playable card duel on top of Fable’s rules and CPU. Kiro built the hand, legal card and tribute selection, board interaction, queued combat, impact-timed orb loss, and restart. The seed-0 Chrome run completed eight scripted steps with zero console errors, including reaching a result and restarting during clash playback. See `docs/evidence/kiro-match-ui/browser-run.json` and `src/match/`.
2. **Custom agents.** The recorded work used Kiro’s built-in Spec agent. Next, give a workspace `duel-qa` agent a frozen build and a fixed sequence of clicks. Have it return a Chrome capture, the build hash, and any visual or timing discrepancy it reproduces.
3. **Agent hooks.** Next, have a File Save command hook run `node --test tests/match/presenter.test.js` when Kiro edits the presenter. Show the actual trigger, exit status, and result.
4. **Spec-driven development.** We revised the requirements to use 1–5 life orbs per troop and use stars for tribute costs. Kiro then based its design and ten-task plan on the existing engine. One acceptance criterion governed both the presentation and the tests. A defeated troop still finishes its attack in a simultaneous clash. See `.kiro/specs/orb-duel/` and `tests/match/presenter.test.js`.
5. **Steering.** We placed durable game and evidence constraints in `.kiro/steering/build-evidence.md`. The spec and tests carry the seeds, action invariants, and orb bounds. For the next task, capture the steering file Kiro loads and the design decision it guides.
6. **MCP.** Kiro’s baseline browser script drove Chrome through the DevTools Protocol. Next, have `duel-qa` use Chrome DevTools MCP to inspect an actual clash and capture the frame and console output directly from Kiro.
7. **Property-based testing.** Kiro’s 41 match tests include deterministic property checks over seeds 0–99. They cover cancellation, display fidelity, simultaneous attacks, orb bounds, and the CPU’s public-information limit. See `tests/match/`, `.kiro/specs/orb-duel/tasks.meta.json`, and `docs/evidence/kiro-match-ui.md`.
8. **Powers.** Next, install a small Duel Replay Power that bundles the replay procedure and Chrome DevTools MCP. Record an activation and the Chrome artifact it produces so someone else can rerun the check.

**Attribution.** Fable built the engine, CPU, and seeded balance simulations. Kiro built the Mac match interface and its verification. Codex developed a separate hosted playtest and adapted Lucca Cerf’s Character Factory material for the asset workflow. The Chrome receipt identifies an uncommitted Kiro build on `b3c77bd`. Update the evidence against the release commit and matching hosted build.

[Research, implementation, and recording plan](kiroween-research-and-recording.md) · [Kiroween submission rules](https://kiroween.devpost.com/rules)
