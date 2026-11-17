# Demo script and build story checked against the receipts

Work by Fable (Claude Fable 5.2, in a collaborator's Claude Code session), 2026-11-16 Pacific, on branch `rachel/story-receipt-check`, based on `main` at `ead95f0`. Docs only: `docs/submission/judge-demo-script.md` (Part 1 only), `docs/submission/build-story.md`, and this note. Part 2 of the script, the human playtest protocol, was not touched and is still unrun.

This follows [the earlier Fable pass](fable-judge-story.md), which wrote both texts and recorded that two of their figures were taken from a task brief and not verified. This pass verified them.

## What was executed

| Command | Result |
| --- | --- |
| `node scripts/play-match.mjs --seed 60` | Exit 0. The trace of the seed 60 match, used below to check each game event the texts describe. The showcase route replays this match's Cowboy actions through round 5 (`scripts/browser-match-check.mjs --showcase`). |
| File reads | The receipts named in the table, both submission texts, and the How to Play text. |

No video was viewed or decoded, no browser was run, and no Kiro tool was run. The Workflow, Power and Night Watch figures were checked against their written receipts, not reproduced.

## Claims checked

| Claim in the texts | Receipt | Verdict |
| --- | --- | --- |
| Saved Workflow passed 157 tests and 12 scripted browser checks against one frozen commit, and recorded the page's hash | [Final run](kiro-final-polish-verification.md): `wf_0572a745f5194cf1` on `02b1bf8`, 157 of 157, seed 0 8 of 8, seed 60 4 of 4, 0 console errors, one HTML SHA-256 in both receipts. [Earlier run](kiro-closeout-release-check.md): `wf_5bd13532f5142477` on `e9aeb06`, same counts. | **True of both runs. The texts named only the earlier commit.** Build story now names the final run and mentions the earlier one. The script's shot note and its "Before recording" step now name both, so the commit on screen matches whichever report is filmed. Narration unchanged. |
| A Sheriff is free; Billy costs one troop, Mounted Billy two | How to Play text; trace rounds 3 and 4 (tribute lane 0, then lanes 1 and 2) | True. |
| Mounted Billy enters with five life orbs | Trace round 4: Singularity hits him `5->4` on the turn he is summoned | True. |
| A Singularity spell pulls him "face to face with the Dragon" (script) or "into the Dragon's lane" (story) | Trace: Singularity moves him to the center lane in **round 4**. The Dragon is summoned into that lane in **round 5**. | **Out of order.** When the spell lands the lane opposite holds a Skeleton, not the Dragon. Both texts now say he is pulled to the center lane and the Dragon is then summoned opposite. The script segment is still 58 words. |
| In the clash he is defeated and still takes the Dragon from five orbs to two | Trace round 5: `Mounted Billy>Dragon 5->2; Dragon>Mounted Billy 3->0; defeated: Mounted Billy` | True. |
| Preview video is 58.73 s: 15.03 s of menu at `e9aeb06`, then 43.67 s of seed 60 at `599450a`, silent | [`menu-and-gameplay-preview.json`](gameplay-demo/menu-and-gameplay-preview.json), [`seed60-599450a.json`](gameplay-demo/seed60-599450a.json) | True. |
| Reviewer returns pass for a matching page and stale for the same receipt with an older page; Power is 1.1.0 and bundles its MCP server | [Package receipt](kiro-power-package-fix.md); the Power row of the [evidence map](../kiro-brag-sheet.md) | True. The inputs were copied historical receipts, as the story already says. |
| Night Watch 0.1.2 enabled; a manual run and a Crew scheduler trigger each saved a report with 65 passing rule tests and 1,000 seeds per revision; nightly job registered for 2 a.m. Pacific; fresh report after a reload and an unattended run not verified | [Activation receipt](night-watch-activation.md) | True as written in the story. |
| Hooks: session start runs named checks, a save hook regenerates the card catalog, compaction hooks keep a receipt ID | Agent hooks row of the [evidence map](../kiro-brag-sheet.md); `.kiro/agents/duel-presenter.json`, `.kiro/hooks/sync-duel-card-specs.json` | True. |
| Summoning Circle trial: a four-orb Skeleton changed simulated outcomes and stayed a proposal | [Card pipeline note](kiro-card-pipeline.md#summoning-circle-workflow) | True. |
| A Crew browser review found developer labels over Skeleton pieces, which were removed | [Preflight note](kiro-submission-preflight.md#kiro-crew-browser-playtest) | True. |
| Deck-builder criteria name "typed rules" | `.kiro/specs/deck-builder-readability/requirements.md`: name, attack, life, tribute cost and rules text "SHALL be typed text in the page", at least 16px | True, but "typed rules" does not say that to a reader. Reworded to "rules written as page text of at least 16px". |
| No first-time player has been observed; the playtest protocol is unrun | Part 2 of the script: sessions run 0 | True. Left as is. |

## What else changed

- **Build story, one new paragraph:** the [WebKit check](webkit-smoke.md) saw all seven of its steps while every hand card was drawn blank. It is a second case of the story's own point, that passing checks miss visible defects. It is worded as an open finding, not confirmed in Safari, and no fix is claimed.
- **Build story, the hypothesis paragraph:** it said "hypothesis" twice in a row. It now says once that the hypothesis is untested. The statement that no first-time player has been observed is kept.
- **Script, optional segment 6b and footage N:** the current plan for the video includes Night Watch, and the script had no place for it. The added line is 19 words and claims only what the activation receipt shows: a report over 1,000 seeded matches on two revisions. It is marked optional and is not in the 325-word total. With it the video runs about 2:50 and 344 words.

## Not checked, and left for the editor

- **The in and out points inside clips A and B.** This pass, like the first, did not view the videos.
- **Whether the K1 footage will show the final run or the earlier one.** The script now covers both.
- **`docs/submission/devpost-packet.md` still names only `e9aeb06` for the 157 and 12 figures.** It was not in this pass's scope. The same one-sentence change would bring it in line.
- **The spoken length.** 325 words at about 122 words a minute is a plan; nobody has timed it aloud.
