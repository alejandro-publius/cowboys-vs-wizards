# Cowboys vs. Wizards — quick judge review

[Play](https://alejandro-publius.github.io/cowboys-vs-wizards/) · [Source](https://github.com/alejandro-publius/cowboys-vs-wizards) · [Demo script](submission/judge-demo-script.md) · [Devpost packet](submission/devpost-packet.md)

## One-minute walkthrough

Start on the [published illustrated title](https://alejandro-publius.github.io/cowboys-vs-wizards/). The current release check records the Git commit, the served HTML checksum and a screenshot of the opening challenge. To play that version offline, check out the recorded commit and run `npm run build -- --diorama --contest`. Open `dist/cowboys-vs-wizards-showdown-3d.html`. [Verified release](PROJECT-STATUS.md#current-build) · [Live build manifest](https://alejandro-publius.github.io/cowboys-vs-wizards/build.json)

| # | Time | Click (**bold**) | What you should see | Source |
| --- | --- | --- | --- | --- |
| 1 | 0:00–0:20 | On the title: **Ride or Fight?**, **Outrider**, **Wizard Base**, **End turn**. Then **Restart this duel**, **Outrider**, **Skeleton**. | One real turn at the Bone Fence: turn 3, Outrider on 2 orbs, Skeleton on 3, Bases at 5 and 4. You can try both decisions from the same position. The challenge only appears if the Outrider gate verified this position when the page was built. | [Gate evidence](evidence/outrider-gate.md) · [Ledger still](evidence/outrider-gate/ledger-revealed.png) |
| 2 | 0:20–0:45 | **Back to camp**, **Back to map**, **Camp ledger**, **Sheriff's Ledger**. Then **Current Billy · 2 attack** and **Next step** ×3. Then **Proposed Billy · 1 attack** and **Next step** ×3. | A recorded Kiro balance decision: seed 726421019, Cowboys first, turn 7. Both versions share the first 29 events. With 2 attack, Billy clears the Bone Wall and the Cowboys win on turn 13. With 1 attack, the Wall survives on 1 orb and the Wizards win on turn 20. The Ledger states that Billy still has 2 attack in this build. If the button reads "Recorded Billy", the live card has changed. | [Billy replay](evidence/billy-replay.md) · [`billy-replay.js`](../src/ui/billy-replay.js) |
| 3 | 0:45–1:00 | **Back to map**, **Night Shift saloon**, **Step** ×3. | Labelled "Recorded Kiro shift". Step 3 posts "Review of Kiro's proposal: Billy attack 2 → 1" with the written rule, the measured shares, the source revision and the command to recheck it. | [`night-shift-saloon.js`](../src/ui/showdown-3d/night-shift-saloon.js) · [test](../tests/match/saloon-showcases.test.js) |

The demo script records two Chrome runs. One covered both Outrider choices and both Billy endings. The other covered the Saloon route and its reset at 1440×900 and 390×844. The [published Saloon link](https://alejandro-publius.github.io/cowboys-vs-wizards/?saloon=review) opens the validated review directly. In Chrome the link focused **Back to map**, supported replay reset, and made zero live-feed requests at both widths.

## The Kiro decision behind steps 2 and 3

- **Proposal.** Kiro CLI worked in an isolated worktree at `eedab93` and proposed three one-number changes. The reviewer passed only Billy attack 2 → 1. In the reviewer's games, Cowboy wins went from 60.75% to 50.25% on tuning seeds and from 59.00% to 51.00% on holdout seeds, with 400 games per arm on each range. [Kiro run](evidence/kiro-contest-run.md#balance-run)
- **Written gate.** The rules live in the [balance contract spec](../.kiro/specs/night-shift-balance-contract/requirements.md). NSB-1 keeps each faction between 45% and 55%. NSB-2 lets the opening player's distance from 50% grow by at most 1 point. The balancing agent never edits that file, and the reviewer records the file's hash. Two of the economist review's findings, E1 and E3, are still [open](../.kiro/specs/night-shift-balance-contract/game-economist-review.md).
- **Measured.** The [seat audit](evidence/billy-seat-audit/README.md) ran 100,000 duels in the Node engine on 25,000 held-out seeds, with level-2 bots and the fixed decks from `eedab93`. Cowboy share fell from 59.792% to 51.920%. The first player's share fell from 59.412% to 58.136%, so an opening advantage remains. The gate exits 2 (RED) on the baseline and 0 (PASS) on the candidate. That output was recorded at `c8fa7f2` and matches the archive. This edit did not rerun it.
- **Independent review.** A separate reviewer step makes each decision ([workflow](../.kiro/workflows/night-shift-review.workflow.json)). The audit Workflow `wf_27f8bf0bb063c889` completed, and all four of its commands exited 0. A read-only Kiro CLI review checked the replay turn, both endings, the win totals and how the verifier hashes each pair. In a separate 10,000-game sample on fresh seeds, Cowboy share went from 61.04% to 52.92% ([Billy replay](evidence/billy-replay.md)).
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

A captioned private demo shows both Outrider choices, both Billy endings, and the recorded Saloon review. Narration, public video upload, and documented first-time player observations are pending. [Demo script](submission/judge-demo-script.md)

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
