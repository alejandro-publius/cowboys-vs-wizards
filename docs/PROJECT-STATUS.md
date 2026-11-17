# Project status — observed November 16, 2026

**Historical deployed snapshot:** November 16 closeout integration, published in PR #15 at `c5ef69b`, with game/UI frozen at `e9aeb06` and later evidence additions plus the separate Night Watch fix. [Deployed HTML identity](evidence/kiro-closeout-deployment.md) matches the reviewed build. [Active closeout ledger](kiro-closeout-queue.md) records finished work and service/human blockers. Historical checks below retain their original commits; inspect Pages and current main for deployment status.

**Current notes (Nov 16, Pacific):** Runtime frozen at `e9aeb06` is historical. `c454398` changed How to Play text, and the combined candidate 02b1bf8 now passes 11 menu and 9 keyboard checks ([web evidence](evidence/final-polish-web.md)). Installed Power is 1.1.0 (installed-only pass/pass, stale/stale on copied historical receipts, no new browser run: [receipt](evidence/kiro-power-package-fix.md)). Installed Night Watch 0.1.2 is enabled with saved human approval; a manual run and a real Crew-triggered scheduled run each passed 65 rule tests and 1,000 seeds per revision. Nightly checks are registered for 2 a.m. Pacific ([activation receipt](evidence/night-watch-activation.md)); latest-report UI reload and future clock-time execution remain unobserved. Fable completed a 2:40 [demo script](submission/judge-demo-script.md) and a blank human playtest protocol. [Reconciliation](evidence/kiro-docs-reconciliation.md).

**Final candidate verification:** Kiro native Workflow wf_0572a745f5194cf1 completed on 02b1bf8 in 179 seconds: 157 tests, two model-structure checks, 8/8 seed-0 and 4/4 seed-60 steps, zero console errors. [Original run evidence](evidence/kiro-final-polish-verification.md). Codex independently passed 11 menu and 9 keyboard checks on the web build. Publication is tracked in PR #17; this verification does not claim human or real-device testing.

## Built and available

| Area | State and proof |
| --- | --- |
| Illustrated main menu | User-approved pixel artwork, five functional entry points, saved preferences, actual achievement tracking, Cowboy deck builder and pause/resume. [Source and checks](evidence/approved-title-menu.md) |
| Readable deck workbench | Kiro implementation with Codex visual/readability corrections; 187px desktop/162px phone artwork, 16px minimum text, 44px controls, save/reload and keyboard checks. [Evidence](evidence/kiro-readable-deck-workbench.md). User visual acceptance remains separate. |
| Public browser game | [GitHub Pages](https://alejandro-publius.github.io/cowboys-vs-wizards/) with `?seed=0`, `?seed=60` and `?mode=demo`; [deployment workflow](../.github/workflows/pages.yml) |
| Opt-in opening balance preview | Kiro's `?opening=both&first=wizard&seed=14` comparison is merged, but is **not** the default policy. [PR #9](https://github.com/alejandro-publius/cowboys-vs-wizards/pull/9) · `tests/game/opening-policy.test.js`; 115 Node tests, 8/8 seed-0 Chrome and 4/4 seed-60 Chrome checks passed before merge. |
| Keyboard focus | Fable repaired focus after lane selection, Cancel and summon playback; 9/9 combined-candidate keyboard checks pass. [Evidence](evidence/final-polish-web.md) |
| Rules and CPU | Seeded match, legal moves, tributes, Deadeye/Singularity, simultaneous clashes, hidden-information CPU in `src/game/`; tests in `tests/game/` |
| Presentation | Illustrated hand, 3D lanes, orbs, animated cues, graveyard, restart in `src/ui/`, `src/render/`, `src/match/` |
| Characters | User-approved sourced Sheriff idle with runtime cue blending (PR #13); existing Sheriff draw/fire; Wizard cast; optimized Skeleton mesh; Dragon and Mounted Billy GLB attack clips; [character evidence](evidence/kiro-character-assets.md) |
| Kiro usage | Orb Duel Spec, steering, hooks, agent, saved Workflow, Power + review MCP, artifact hash checks; [actual evidence](kiro-brag-sheet.md) |
| Optional Crew extension | [Night Watch](../apps/night-watch/README.md) compares exact commits over matching seeded matches and can generate issue drafts; [observed Crew evidence](evidence/kiro-night-watch.md). Not part of the browser game. |
| Closeout verification | Kiro's actual saved Workflow passed 157 tests, two model-structure checks, 8/8 opening and 4/4 showdown steps. [Final run evidence](evidence/kiro-closeout-release-check.md). Codex separately measured current startup [timings](evidence/kiro-closeout-performance.md). |
| Historical verification | PR #13 candidate: 136 Node tests, sourced-asset checks and web build passed; seeded web replay observed 8/8 steps. [Sheriff transition evidence](evidence/sheriff-transition-blend.md). Existing browser receipts and test counts: [release preflight](evidence/kiro-submission-preflight.md); [character release](evidence/kiro-character-assets.md). Always distinguish past receipts from a new test run |

## Next valuable work (proposed, not shipped)

1. **New-player clarity / public demo.** Run the blank [playtest protocol](submission/judge-demo-script.md#part-2-first-time-human-playtest-protocol) with a real first-time player and publish the final assembled demo. [Real 43.67-second gameplay footage](evidence/gameplay-demo/seed60-599450a.mp4) is captured at `599450a`; new deck/Workflow footage and public YouTube upload remain separate. [Recording plan](kiroween-research-and-recording.md).
2. **Fire-reaction acting.** [Draft PR #10](https://github.com/alejandro-publius/cowboys-vs-wizards/pull/10) contains the procedural Firebolt prototype. Release integration needs a Tripo or licensed GitHub clip selected by the user, the Firebolt card illustration, and a passing Chrome catalog review. Integrate the chosen clip at impact and review the before, impact and recovery frames.
3. **Additional readable spell moments.** Use [Small Magic](https://patch.gg/play/blendi/small-magic) as a presentation reference. Choose one spell and agree on its visual direction with the user. Set rules, costs, targeting and acceptance tests before adding card mechanics. Connect the chosen effect to existing events where possible.
4. **Art known limitations.** The Sheriff has a fused open gun hand and no holster on its original mesh; [measured integration note](evidence/fable-sheriff-integration.md). The selected Dragon wing root has known distortion under some frames; attempted smoothing made the silhouette worse, so the released rig was retained. [Comparison](evidence/dragon-wing-root-skinning.md).

## Important document semantics

- [README](../README.md) and [Judge guide](JUDGE-GUIDE.md): public presentation.
- [AGENTS.md](../AGENTS.md) and [Agent router](AGENT-ROUTER.md): coding constraints and just-in-time navigation.
- [Orb Duel Spec](../.kiro/specs/orb-duel/): Kiro's technical requirements, design and completed implementation checklist.
- [Kiro build log](kiro-build-log.md), [evidence folder](evidence/): historical record; don't inject all of it into each new model session.
- [Active Kiro closeout queue](kiro-closeout-queue.md): current ownership, results and blockers.
- [Fable tasks](fable-tasks.md), [old Kiro queue](kiro-task-queue.md): historical dispatches. Their old "not started" labels do not describe today's game.

### Updating this snapshot

Update the date and HEAD after a meaningful integration milestone, point to the commit/test/browser receipt, and mark any **proposed** feature as **implemented** only after code and checks exist. Don't append every worker transcript here.
