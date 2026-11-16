# Cowboys vs. Wizards — quick judge review

[Play the release](https://alejandro-publius.github.io/cowboys-vs-wizards/) · [Source](https://github.com/alejandro-publius/cowboys-vs-wizards) · [Kiro usage and evidence](kiro-brag-sheet.md)

## Experience the game

1. **Start in the browser:** [Seed 0](https://alejandro-publius.github.io/cowboys-vs-wizards/?seed=0). Select an illustrated Sheriff card, choose a legal lane and watch the Skeleton counterattack. Life orbs change when a hit lands.
2. **See the bigger mechanic:** [Seed 60](https://alejandro-publius.github.io/cowboys-vs-wizards/?seed=60). Use two tribute summons to bring in Mounted Billy, then watch Singularity move him into the Dragon's lane. The clash is simultaneous: Billy still gets his attack even though he is defeated. [Exact five-round input route](morning-handoff.md#the-duel-to-film).
3. **Inspect the character craft:** Sheriff draws his revolver, Wizard casts, Dragon and Mounted Billy use authored attack clips, Skeleton uses an optimized model. [Asset and animation evidence](evidence/kiro-character-assets.md).
4. **Inspect the required Kiro work:** [Orb Duel Spec](../.kiro/specs/orb-duel/requirements.md), [agent](../.kiro/agents/duel-presenter.json), [steering](../.kiro/steering/), [hooks](../.kiro/hooks/), [replay Workflow](../.kiro/workflows/orb-duel-replay.workflow.json), and [Power + MCP](../.kiro/powers/orb-duel-review/). [Proof of actual runs](kiro-brag-sheet.md).
5. **Check verifiability:** [Release preflight](evidence/kiro-submission-preflight.md) links browser receipts, hashes, a property-based regression and the deployed build. The live release and historical receipts should be checked against the current commit when reviewing newer changes.

## What is distinctive

The haunted-Western visuals are attached to deterministic game rules. Cards become troops on a 3D board; legal tributes, positional spells, simultaneous damage and timed orb loss make the scene a playable duel rather than a prerecorded cinematic. Seeded routes reproduce the same meaningful showdown.

The Kiro story is testable: a Requirements-First spec, scoped agent instructions and hooks, a saved replay Workflow, an MCP artifact reviewer that can reject stale builds, and evidence of an independent browser playtest finding a visual defect that unit tests missed. The repository attributes Kiro work separately from Fable and Codex instead of presenting every contribution as Kiro's.

## Source and technical map

| Review question | Direct link |
| --- | --- |
| Where are the rules and CPU? | [`src/game/`](../src/game/) |
| Where is the event-to-animation contract? | [`src/match/`](../src/match/) |
| How are the 3D cues rendered? | [`src/render/`](../src/render/) |
| Where are the tests? | [`tests/`](../tests/) |
| What ran in Kiro? | [Brag sheet](kiro-brag-sheet.md), [Build log](kiro-build-log.md) |
| How is deployment checked? | [GitHub Actions workflow](../.github/workflows/pages.yml), [release preflight](evidence/kiro-submission-preflight.md) |
| What remains unfinished? | [Dated project status](PROJECT-STATUS.md) |

**Disclosure:** animation feel, first-time-player clarity and judging quality require human observation. Test counts and capture descriptions refer to the linked historical evidence, not to fresh checks performed by this documentation change.
