# Cowboys vs. Wizards — quick judge review

[Play the release](https://alejandro-publius.github.io/cowboys-vs-wizards/) · [Earlier illustrated 3D build](https://alejandro-publius.github.io/cowboys-vs-wizards/3d/) · [Source](https://github.com/alejandro-publius/cowboys-vs-wizards) · [Kiro usage and evidence](kiro-brag-sheet.md)

## Experience the game

*Kiro, November 20 (issue 143 slice 3, once merged and deployed):* the site root is now the graybox Showdown game; Play opens its Camp. Current paths and the remaining human gate are in the [release line](design/release-line.md). Steps 1 to 3 below describe the earlier illustrated 3D lane build, so their links now point at `/3d/`. The rest of this guide is unchanged history.

1. **Play a guided opening.** [Open seed 0 with the starter deck and hints](https://alejandro-publius.github.io/cowboys-vs-wizards/3d/?seed=0&deck=starter&guide=1). Press Play, select Sheriff, pick a lit lane, then confirm the summon. End the turn and watch each life orb disappear at impact.
2. **See the bigger mechanic:** [Seed 60](https://alejandro-publius.github.io/cowboys-vs-wizards/3d/?seed=60). Use two tribute summons to bring in Mounted Billy, then watch Singularity move him into the Dragon's lane. The clash is simultaneous: Billy still gets his attack even though he is defeated. [Exact five-round input route](morning-handoff.md#the-duel-to-film).
3. **Inspect the character craft:** Sheriff draws his revolver, Wizard casts, Dragon and Mounted Billy use authored attack clips, Skeleton uses an optimized model. [Asset and animation evidence](evidence/kiro-character-assets.md).
4. **Inspect the required Kiro work:** [Orb Duel Spec](../.kiro/specs/orb-duel/requirements.md), [agent](../.kiro/agents/duel-presenter.json), [steering](../.kiro/steering/), [hooks](../.kiro/hooks/), [replay Workflow](../.kiro/workflows/orb-duel-replay.workflow.json), and [Power + MCP](../.kiro/powers/orb-duel-review/). [Proof of actual runs](kiro-brag-sheet.md).
5. **Check verifiability.** [Release evidence](evidence/kiro-release-review-892cada.md) binds the live SHA to the served page and identifies the later native workflow and MCP comparison. [Competitive benchmark](submission/kiroween-competitive-benchmark.md) maps the demo to the five judging criteria.

## Demo script and playtest protocol

[2:40 judge demo script and first-time playtest protocol](submission/judge-demo-script.md), written by Fable (`e65431c`) and fact-checked by Codex (`b2c8936`). The script is unrecorded and untimed aloud. The protocol is blank: no human has run it, and no player feedback exists yet. How to Play text changed in `c454398`; the combined candidate now passes 11 menu and 9 keyboard checks ([web evidence](evidence/final-polish-web.md)).

## Menu, decks and current evidence

The illustrated main menu opens instructions, saved settings, achievements and the deck workbench. Build a twelve-card Cowboy deck with large illustrated choices, select a card to read its rules, adjust counts and save. [Readability checks](evidence/kiro-readable-deck-workbench.md) include desktop and phone-sized Chrome views; actual phone/Safari review is still pending.

[Watch the menu and gameplay preview](evidence/gameplay-demo/menu-and-gameplay-preview.mp4) (58.73 seconds: current deck/menu, then real gameplay recorded at `599450a`). [Current closeout ledger](kiro-closeout-queue.md) distinguishes newly checked work, historical receipts and remaining blockers. [Night Watch source](https://github.com/alejandro-publius/cowboys-vs-wizards-night-watch) is a separate app. Night Watch is installed at 0.1.2. Separately, the Crew relay answered a basic no-tool chat; Night Watch itself remains disabled pending human trust approval, so its UI report and real schedule remain unverified ([receipt](evidence/kiro-crew-repair.md)). No unattended scheduled operation is claimed.

## What is distinctive

The haunted-Western visuals are attached to deterministic game rules. Cards become troops on a 3D board; legal tributes, positional spells, simultaneous damage and timed orb loss make the scene a playable duel rather than a prerecorded cinematic. Seeded routes reproduce the same meaningful showdown.

The Kiro story is testable: a Requirements-First spec, scoped agent instructions and hooks, a saved replay Workflow, an MCP artifact reviewer (installed Power 1.1.0 passed and rejected stale copied receipts, without a new browser run: [receipt](evidence/kiro-power-package-fix.md)) that can reject stale builds, and evidence of an independent browser playtest finding a visual defect that unit tests missed. The repository attributes Kiro work separately from Fable and Codex instead of presenting every contribution as Kiro's.

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
