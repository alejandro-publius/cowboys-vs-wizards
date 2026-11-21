# Cowboys vs. Wizards — quick judge review

[Play the release](https://alejandro-publius.github.io/cowboys-vs-wizards/) · [Source](https://github.com/alejandro-publius/cowboys-vs-wizards) · [Kiro usage and evidence](kiro-brag-sheet.md)

## Experience the game

The game is **Showdown**, the one supported game, served at the [site root](https://alejandro-publius.github.io/cowboys-vs-wizards/). The first click is **Play**, which opens the Camp. In the Camp, click **Boot Hill**, the first Trail duel, or open a fixed practice deal: [deal 0](https://alejandro-publius.github.io/cowboys-vs-wizards/?practice=0) or [deal 60](https://alejandro-publius.github.io/cowboys-vs-wizards/?practice=60). Current paths and the remaining human gate are in the [release line](design/release-line.md). Commands that replay the current build are in the [judge write-up](submission/kiro-brag-sheet.md#proof-on-the-current-build). Card art briefs for all 29 cards are in the [art direction](../prototypes/showdown/ART-DIRECTION.md) ([coverage](../README.md#card-art-library)).

- **The Night Shift loop.** At the end of the Camp, open **Sheriff's Ledger**. It lists all 29 cards and the latest Night Watch check of the ruleset: commit, seeds 0–999, 2,000 bot games, first-player and Cowboy shares. It also shows the Night Shift review of one draft one-card, one-number candidate for that run, with its verdict. Night Watch (the [Crew app in this repository](../apps/night-watch/README.md)) measures. The [reviewer](evidence/night-shift-review.md) checks a candidate on paired and holdout seeds. Nothing is applied to the cards; Fable and Alex decide. [Receipts and what has and has not run](evidence/night-shift.md) (pull request [#163](https://github.com/alejandro-publius/cowboys-vs-wizards/pull/163), open).

**Earlier lane duel and illustrated 3D build (retired, history).** The earlier three-lane game and its 3D build are retired. Old `/3d/` links, including the ones in steps 1 and 2, now lead to Showdown. The last playable source is `main` commit `ea183ee29dbd`; build it from a checkout of that commit to replay these steps. The rest of this guide describes that build and its evidence, kept as recorded.

1. **Play a guided opening (history).** [Seed 0 with the starter deck and hints](https://alejandro-publius.github.io/cowboys-vs-wizards/3d/?seed=0&deck=starter&guide=1) opened the guided lane duel. Press Play, select Sheriff, pick a lit lane, then confirm the summon. End the turn and watch each life orb disappear at impact.
2. **See the bigger mechanic (history):** [Seed 60](https://alejandro-publius.github.io/cowboys-vs-wizards/3d/?seed=60). Use two tribute summons to bring in Mounted Billy, then watch Singularity move him into the Dragon's lane. The clash is simultaneous: Billy still gets his attack even though he is defeated. [Exact five-round input route](morning-handoff.md#the-duel-to-film).
3. **Inspect the character craft:** Sheriff draws his revolver, Wizard casts, Dragon and Mounted Billy use authored attack clips, Skeleton uses an optimized model. [Asset and animation evidence](evidence/kiro-character-assets.md).
4. **Inspect the required Kiro work:** [Orb Duel Spec](../.kiro/specs/orb-duel/requirements.md), [agent](https://github.com/alejandro-publius/cowboys-vs-wizards/blob/ea183ee29dbdcde00105cc4db3ba8bc39eb8f4df/.kiro/agents/duel-presenter.json), [steering](../.kiro/steering/), [hooks](../.kiro/hooks/), [replay Workflow](https://github.com/alejandro-publius/cowboys-vs-wizards/blob/ea183ee29dbdcde00105cc4db3ba8bc39eb8f4df/.kiro/workflows/orb-duel-replay.workflow.json), and [Power + MCP](../.kiro/powers/orb-duel-review/). [Proof of actual runs](kiro-brag-sheet.md).
5. **Check verifiability.** [Release evidence](evidence/kiro-release-review-892cada.md) binds the live SHA to the served page and identifies the later native workflow and MCP comparison. [Competitive benchmark](submission/kiroween-competitive-benchmark.md) maps the demo to the five judging criteria.

## Demo script and playtest protocol

[Current Showdown demo script and playtest protocol](submission/judge-demo-script.md). Alex completed the playtests. His recorded run won Boot Hill and Raven Roost. Participant count, individual first-time responses and the original build ID are undocumented. The scripted Dragon cut is private, and the public submission video is still pending.

## Menu, decks and current evidence

The retired illustrated main menu opened instructions, saved settings, achievements and the deck workbench. A player built a twelve-card Cowboy deck with large illustrated choices, selected a card to read its rules, adjusted counts and saved. [Readability checks](evidence/kiro-readable-deck-workbench.md) include desktop and phone-sized Chrome views of that build; actual phone/Safari review was not done. Showdown's deck builder is in the Camp.

[Watch the menu and gameplay preview](evidence/gameplay-demo/menu-and-gameplay-preview.mp4) (58.73 seconds: current deck/menu, then real gameplay recorded at `599450a`). [Current closeout ledger](kiro-closeout-queue.md) distinguishes newly checked work, historical receipts and remaining blockers. Night Watch lives in this repository at [`apps/night-watch`](../apps/night-watch/README.md). The separate [Night Watch repository](https://github.com/alejandro-publius/cowboys-vs-wizards-night-watch) is a submission mirror. Its Showdown runs so far are on-demand and staged; no clock-triggered scheduled Showdown run has completed, and no Kiro Web session has been used ([status](evidence/night-shift.md#what-ran-and-what-did-not)).

## What is distinctive

The haunted-Western visuals are attached to deterministic game rules. In the retired 3D build, cards became troops on a 3D board; legal tributes, positional spells, simultaneous damage and timed orb loss made the scene a playable duel rather than a prerecorded cinematic. Showdown keeps the seeded engine: the same seed reproduces the same deal, and the 3D layer will be rebuilt on it once the rules are locked.

The Kiro story is testable: a Requirements-First spec, scoped agent instructions and hooks, a saved replay Workflow, an MCP artifact reviewer (installed Power 1.1.0 passed and rejected stale copied receipts, without a new browser run: [receipt](evidence/kiro-power-package-fix.md)) that can reject stale builds, and evidence of an independent browser playtest finding a visual defect that unit tests missed. The repository attributes Kiro work separately from Fable and Codex instead of presenting every contribution as Kiro's.

## Source and technical map

| Review question | Direct link |
| --- | --- |
| Where are the rules and cards? | [`src/game/showdown/`](../src/game/showdown/) |
| Where is the Camp and match flow? | [`src/match/`](../src/match/) (`showdown-*.js`) |
| Where is the card art library? | [Art direction](../prototypes/showdown/ART-DIRECTION.md), generated by `node prototypes/showdown/export-art.mjs` |
| Where are the tests? | [`tests/`](../tests/) |
| What ran in Kiro? | [Brag sheet](kiro-brag-sheet.md), [Build log](kiro-build-log.md) |
| How is deployment checked? | [GitHub Actions workflow](../.github/workflows/pages.yml), [release preflight](evidence/kiro-submission-preflight.md) |
| What remains unfinished? | [Dated project status](PROJECT-STATUS.md) |

**Disclosure:** animation feel, first-time-player clarity and judging quality require human observation. Test counts and capture descriptions refer to the linked historical evidence, not to fresh checks performed by this documentation change.
