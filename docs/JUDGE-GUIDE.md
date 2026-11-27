# Cowboys vs. Wizards — quick judge review

[Play](https://alejandro-publius.github.io/cowboys-vs-wizards/) · [Source](https://github.com/alejandro-publius/cowboys-vs-wizards) · [Demo narration and timestamps](submission/judge-demo-narration.md) · [Devpost packet](submission/devpost-packet.md)

## Play the frontier

1. From the Night Shift Saloon, open **Wanted**. The posters name two bosses. Choose **Scout the Graveyard Dragon**. This works on a fresh save. [Open the Saloon](https://alejandro-publius.github.io/cowboys-vs-wizards/?saloon=review) · [Direct Wanted board](https://alejandro-publius.github.io/cowboys-vs-wizards/?room=wanted)
2. Pick whom the Ranger should shoot. Reveal the recorded outcomes, switch to the second deal, or take the turn yourself. **Back to Wanted** returns you to the poster. Scouting leaves your career untouched.
3. To earn the card, start at **Camp → Boot Hill** and clear the six-stop Trail. Win five real hunts against one boss. On the fifth victory, **Build with Captured Dragon** or **Build with Captured Wraith** opens that card in the deck builder. Choose what to replace before saving your 16. [Campaign and capture images](../README.md#from-a-wanted-poster-to-your-deck)

The capture images come from a staged browser game. A legal post-Trail save supplied the starting collection. The fifth Dragon fight was won through the board controls and the 16-card deck was saved and reopened. For the full browser check, the runner plays all five hunts and checks the save after each one. [Browser acceptance script](../scripts/browser-showdown-bounty-journey.mjs)

To repeat it, stage and serve the Pages build as described in the [local build guide](../README.md#local-build). With that server running, use a second terminal in the checkout:

```sh
npm install --no-save --package-lock=false playwright-core@1.62.1
npx playwright-core install chromium
node scripts/browser-showdown-bounty-journey.mjs http://127.0.0.1:8000/
```

## Watch Kiro at work

Open the Saloon and use **Play** or **Step** at the bar to follow its recorded shift. At the balance table you can try the proposed rule and take over a losing deal. The 1:20 narrated cut follows this separate experiment. [Saloon](https://alejandro-publius.github.io/cowboys-vs-wizards/?saloon=review) · [Narration and captions](submission/judge-demo-narration.md) · [How the reviewer works](../README.md#how-kiro-reviews-a-card-change)

## The Kiro decision behind the Saloon

- **Proposal.** Kiro CLI worked in an isolated worktree at `eedab93` and proposed three one-number changes. The reviewer passed only Billy attack 2 → 1. In the reviewer's games, Cowboy wins went from 60.75% to 50.25% on tuning seeds and from 59.00% to 51.00% on holdout seeds, with 400 games per arm on each range. [Kiro run](evidence/kiro-contest-run.md#balance-run)
- **Written gate.** The rules live in the [balance contract spec](../.kiro/specs/night-shift-balance-contract/requirements.md). NSB-1 keeps each faction between 45% and 55%. NSB-2 lets the opening player's distance from 50% grow by at most 1 point. The balancing agent never edits that file, and the reviewer records the file's hash. Two of the economist review's findings, E1 and E3, are still [open](../.kiro/specs/night-shift-balance-contract/game-economist-review.md).
- **Measured.** The [seat audit](evidence/billy-seat-audit/README.md) ran 100,000 duels in the Node engine on 25,000 held-out seeds, with level-2 bots and the fixed decks from `eedab93`. Cowboy share fell from 59.792% to 51.920%. The first player's share fell from 59.412% to 58.136%, so an opening advantage remains. Rechecking the tracked outcomes for the November 26 cut reproduced both gate results. The baseline exited 2 and the candidate exited 0.
- **Independent review.** A separate reviewer step makes each decision ([workflow](../.kiro/workflows/night-shift-review.workflow.json)). The audit Workflow `wf_27f8bf0bb063c889` completed, and all four of its commands exited 0. A read-only Kiro CLI review checked the replay turn, both endings, the win totals and how the verifier hashes each pair. In a separate 10,000-game sample on fresh seeds, Cowboy share went from 61.04% to 52.92% ([Billy replay](evidence/billy-replay.md)).
- **Rules check.** On 100 frozen duels, the engine and Python referee agreed on all 5,086 played positions. The audit checked 274,273 alternate moves at 4,986 positions and classified all 6,775 disagreements. The empty-board Hellfire ruling remains open. [Referee report](evidence/claude-referee-legal-branches.md)
- **Design approval is pending.** Billy still has 2 attack.
- **Control run.** In native Workflow `wf_3e26f2fcd93c25a1`, Kiro picked the card and the number in six attempts. The reviewer rejected all six, and one of them failed only NSB-2 ([six attempts](evidence/billy-seat-audit/README.md#native-free-choice-workflow-six-proposals-six-rejections)).

## Kiro features: what was actually recorded

| Feature | Recorded | Not shown |
| --- | --- | --- |
| Specs | The [balance contract](../.kiro/specs/night-shift-balance-contract/requirements.md) (NSB-1 and NSB-2, plus economist and rules-lawyer reviews). The [Outrider gate](../.kiro/specs/outrider-gate/requirements.md) (G1–G7). The [Night Shift saloon](../.kiro/specs/night-shift-saloon/requirements.md) (five reviewer files). | No claim about whether these specs were written before the code. |
| Scoped steering | [`rules-area.md`](../.kiro/steering/rules-area.md) uses `inclusion: fileMatch` on `src/game/**`. Two isolated native Kiro CLI 3.5.0 sessions loaded it for an engine read and left it out for a UI read ([steering run](evidence/showdown-scoped-steering.md)). | Scripted single turns. No IDE run. |
| Hooks | `check-outrider-gate` on `PostFileSave`. Saving a deliberate ride-strike change failed with "0 fresh, 10 stale", and saving the revert passed with "10 fresh". Each receipt carries the Kiro session ID and the hook event name ([receipts](evidence/outrider-gate/hook-receipts.jsonl)). Separately, the native fence blocked a probe write under `src/game/` before it ran ([fence](evidence/kiro-contest-run.md#balance-run)). | IDE behaviour. Whether a failing hook is shown to the user. One double save missed the change; it was recorded and not counted. |
| Saloon: recorded vs. live | Public builds replay only the checked-in recording. Live mode is opt-in: `?saloon=live` on a loopback HTTP page served by `scripts/night-shift-saloon.mjs`. In one native session, nine Kiro `fs_write` events reached the screen. At a 3,000 ms poll, four took 154–2,818 ms. At a 1,000 ms poll, five took 298–827 ms. This was one machine running headless Chrome ([live witness](evidence/kiro-saloon-live-witness.md)). | The 2-second target has no approved source. The file-create line appeared in 0 of 9 samples. The live check ran on an undeployed local candidate. The lifecycle audit did not re-verify the recording ([audit](evidence/native-saloon-lifecycle.md)). |
| Workflows | `wf_87723b3404bba1fc` ([still rendered from the CLI stream](evidence/kiro-night-shift-native.png), not a screen recording). `wf_3e26f2fcd93c25a1`. `wf_27f8bf0bb063c889`. | |

## Submission status

The November 26 Saloon cut opens in the running game and shows the recorded Kiro workflow, the tracked spec and the measured bot result. English narration and captions run 1:20. Public YouTube publication, the Devpost submission and documented first-time-player observations are pending. [Transcript and captions](submission/judge-demo-narration.md) · [Submission packet](submission/devpost-packet.md)

## Archive

- **Dragon turn-five decision (November 20).** Two playable positions where the bots' better target flips between seeds 3 and 70. [Search and replay](../experiments/showdown-dragon-strategy/rival-README.md) · [browser checks](evidence/showdown-turn-k095.md)
- **Night Watch in the Sheriff's Ledger.** Seed-range bot checks and the Sheriff rejection. [Receipts and what has not run](evidence/night-shift.md) · [reviewer](evidence/night-shift-review.md) · [Crew app](../apps/night-watch/README.md) · [mirror](https://github.com/alejandro-publius/cowboys-vs-wizards-night-watch). No Kiro Web session was used.
- **Retired lane duel and its 3D build.** The last source is `ea183ee29dbd`. Old `/3d/` links now lead to Showdown. Lane evidence: [seed-60 route](morning-handoff.md#the-duel-to-film) · [Orb Duel spec](../.kiro/specs/orb-duel/requirements.md) · [agent](https://github.com/alejandro-publius/cowboys-vs-wizards/blob/ea183ee29dbdcde00105cc4db3ba8bc39eb8f4df/.kiro/agents/duel-presenter.json) · [replay Workflow](https://github.com/alejandro-publius/cowboys-vs-wizards/blob/ea183ee29dbdcde00105cc4db3ba8bc39eb8f4df/.kiro/workflows/orb-duel-replay.workflow.json) · [Power](../.kiro/powers/orb-duel-review/) ([1.1.0 receipt](evidence/kiro-power-package-fix.md)) · [release review `892cada`](evidence/kiro-release-review-892cada.md) · [character assets](evidence/kiro-character-assets.md) · [deck workbench](evidence/kiro-readable-deck-workbench.md) · [58.73-second preview](evidence/gameplay-demo/menu-and-gameplay-preview.mp4)
- **Playtests.** Alex won Boot Hill and Raven Roost in a recorded run. The participant count, individual first-time responses and build ID are not documented ([release line](design/release-line.md)).

## Source map

| Review question | Direct link |
| --- | --- |
| Rules and cards | [`src/game/showdown/`](../src/game/showdown/) |
| Illustrated Camp, Ledger and Saloon | [`src/ui/showdown-3d/`](../src/ui/showdown-3d/), [`src/app.js`](../src/app.js) |
| Card art | [Art direction](../prototypes/showdown/ART-DIRECTION.md) |
| Tests | [`tests/`](../tests/) |
| Kiro history | [Build log](kiro-build-log.md), [evidence map](kiro-brag-sheet.md) |
| Deployment | [Pages workflow](../.github/workflows/pages.yml) |
| Unfinished | [Project status](PROJECT-STATUS.md) |
