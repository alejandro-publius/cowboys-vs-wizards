# Project status — observed November 16, 2026

**Snapshot:** public `main` at `1596b02`. This page summarizes tracked source and existing evidence. It is **not** a claim that these checks were rerun while preparing this documentation. Inspect current HEAD, the latest Actions run, and the actual rendered game when the branch changes.

## Built and available

| Area | State and proof |
| --- | --- |
| Public browser game | [GitHub Pages](https://alejandro-publius.github.io/cowboys-vs-wizards/) with `?seed=0`, `?seed=60` and `?mode=demo`; [deployment workflow](../.github/workflows/pages.yml) |
| Rules and CPU | Seeded match, legal moves, tributes, Deadeye/Singularity, simultaneous clashes, hidden-information CPU in `src/game/`; tests in `tests/game/` |
| Presentation | Illustrated hand, 3D lanes, orbs, animated cues, graveyard, restart in `src/ui/`, `src/render/`, `src/match/` |
| Characters | Sheriff procedural draw/fire; Wizard cast; optimized Skeleton mesh; Dragon and Mounted Billy GLB attack clips; [character evidence](evidence/kiro-character-assets.md) |
| Kiro usage | Orb Duel Spec, steering, hooks, agent, saved Workflow, Power + review MCP, artifact hash checks; [actual evidence](kiro-brag-sheet.md) |
| Verification | Existing browser receipts and test counts: [release preflight](evidence/kiro-submission-preflight.md); [character release](evidence/kiro-character-assets.md). Always distinguish past receipts from a new test run |

## Next valuable work (proposed, not shipped)

1. **New-player clarity / recording.** Observe a first-time player, make the opening legible, capture the real seeded playthrough and publish the short public demo required by Kiroween. [Recording plan](kiroween-research-and-recording.md).
2. **Fire-reaction acting.** For a burning target (including Sheriff when applicable), look down toward the feet, raise both arms, recoil and then resolve into recovery or defeat. This is a requested next animation, **not a verified shipped feature**. Scope to cue/rig/presenter-owned code and validate before/impact/after frames in the browser without changing engine damage.
3. **Additional readable spell moments.** Study [Small Magic](https://patch.gg/play/blendi/small-magic) as a presentation reference; pick one small spell at a time. Decide rules, costs, targeting and acceptance tests **before** adding new card mechanics. Prefer new VFX that reuse existing events when possible.
4. **Art known limitations.** The Sheriff has a fused open gun hand and no holster on its original mesh; [measured integration note](evidence/fable-sheriff-integration.md). The selected Dragon wing root has known distortion under some frames; attempted smoothing made the silhouette worse, so the released rig was retained. [Comparison](evidence/dragon-wing-root-skinning.md).

## Important document semantics

- [README](../README.md) and [Judge guide](JUDGE-GUIDE.md): public presentation.
- [AGENTS.md](../AGENTS.md) and [Agent router](AGENT-ROUTER.md): coding constraints and just-in-time navigation.
- [Orb Duel Spec](../.kiro/specs/orb-duel/): Kiro's technical requirements, design and completed implementation checklist.
- [Kiro build log](kiro-build-log.md), [evidence folder](evidence/): historical record; don't inject all of it into each new model session.
- [Fable tasks](fable-tasks.md), [old Kiro queue](kiro-task-queue.md): historical dispatches. Their old "not started" labels do not describe today's game.

### Updating this snapshot

Update the date and HEAD after a meaningful integration milestone, point to the commit/test/browser receipt, and mark any **proposed** feature as **implemented** only after code and checks exist. Don't append every worker transcript here.
