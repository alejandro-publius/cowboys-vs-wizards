# Project status

The [Showdown release line](design/release-line.md#current-status-november-20-supersedes-the-november-19-1015-pm-handoff) tracks the supported game and its current release decisions. The lane build described below was retired on November 20. Its final playable source is [archived in Git](https://github.com/alejandro-publius/cowboys-vs-wizards/tree/ea183ee29dbdcde00105cc4db3ba8bc39eb8f4df).

## November 23, 2026 integration

- The Night Shift Saloon shows recorded Kiro work in Camp. The `?saloon=review` link opens Billy’s archived balance decision. The room also preserves the rules desk, card forge and agent arena records. Live Kiro activity is available on a local witness build. [Judge walkthrough](JUDGE-GUIDE.md) · [Live witness evidence](evidence/kiro-saloon-live-witness.md)
- The balance contract and separate reviewer now back the Billy replays and the scorecard. A 100,000-duel bot audit moved Cowboy wins from 59.792% to 51.920% under the proposed one-point attack cut. Design approval is pending. The Sheriff’s fourth-orb increase failed its separate balance review. [Billy audit](evidence/billy-seat-audit/README.md) · [Sheriff verdict](evidence/night-shift/guard-sheriff-health-3-to-4/README.md)
- Boot Hill Poker runs in a browser or terminal as an experiment. It and Showdown use the shared paired-cohort audit. The kit also has a seeded generator tested for equivalent outcomes before runtime adoption. [Frontier Kit](../packages/frontier-kit/README.md) · [Poker](../experiments/boot-hill-poker/README.md)
- The independent referee and Wizard lesson have seeded Node and browser checks. The browser checker distinguishes timeouts from settled disagreements. Empty-board Hellfire still needs a rule decision, and the historical referee gate has zero qualifying cases out of five. [Referee and Wizard evidence](evidence/claude-cli-followup-20261123.md)
- A private captioned demo shows both Outrider choices, both Billy replay endings and the recorded Saloon decision. Narration, a public video link and documented first-time player observations are pending. [Demo script](submission/judge-demo-script.md) · [Devpost draft](submission/devpost-packet.md)

## November 16, 2026 snapshot

**Current integration (November 16, Pacific):** PR #55 is on main at `4c0723d`: build identity and post-deploy verification are live, with recovered actual CLI session credit records. [Live deployment receipt](evidence/kiro-build-identity.md). This guide integration adds Kiro's opt-in `?guide=1` implementation after correcting hidden idle tips. [Guide receipts](evidence/kiro-guided-first-match.md).

**Verification:** Kiro's corrected guide branch passed 193 Node tests and model-structure checks; its Chrome check compared guide-off behavior against the original `965bd709` build at 12 steps, and checked visible tips, controls, restart and 390px layout. Coordinator integration passed 16 focused guide/model/link tests. PR CI and Pages results belong to the integration PR; these historical and current counts are separate.

**Open work:** Kiro owns the larger boundary-properties and traceability batch [#56](https://github.com/alejandro-publius/cowboys-vs-wizards/issues/56), dispatched without constant polling. Guide human feedback remains uncollected. Billy's sourced-animation draft #53 still needs acceptable hand grip; the rest of the roster is unfinished. Real Safari/iPhone, first-time human playtests, narrated public video/blog and actual submission remain open.

**Historical milestones:** Earlier release and Workflow counts below retain their original dates and source revisions. [02b1bf8 verification](evidence/kiro-final-polish-verification.md), [menu/keyboard checks](evidence/final-polish-web.md), [Power 1.1.0](evidence/kiro-power-package-fix.md) and [Night Watch activation](evidence/night-watch-activation.md) remain inspectable; they are not new runs on current main.

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
