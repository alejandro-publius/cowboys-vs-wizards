# Judge demo script

## Current: one closing loop, decision to reviewed candidate (owner rehearsal, about 2:16)

Written November 20, 2026 (America/Los_Angeles) by a Kiro CLI worker (`judges`, jobs K-099, K-101 and K-102) from `main` at [`ea183ee`](https://github.com/alejandro-publius/cowboys-vs-wizards/commit/ea183ee29dbdcde00105cc4db3ba8bc39eb8f4df). This is a **private rehearsal script** for Alex. Nothing here is recorded beyond segment A, and nothing has been uploaded or submitted. Fable owns the game design, rules, balance and the wording of every in-game label ([issue 143](https://github.com/alejandro-publius/cowboys-vs-wizards/issues/143)).

**The loop the video shows.** One game decision, the Kiro-native evidence behind it, and one candidate change that a separate reviewer decided:

1. **Game decision.** Showdown starts at the title screen. Play opens the Camp, and the Experiment control opens Cowboy turn 5 against the Graveyard Dragon. The same Ranger target choice reverses the bot-played result between two deals.
2. **Kiro-native evidence.** The Camp's Sheriff's Ledger shows Night Watch's run on the ruleset: 2,000 bot games, the first player won 1,142 and the Cowboys 1,188. Kiro Crew ran the same counts on its own schedule ([scheduled Crew receipt](../evidence/night-shift/crew-scheduled-2026-11-20.json), trigger `scheduled`).
3. **Reviewed candidate.** The same Ledger shows the Night Shift review of one draft, Sheriff health 3 → 4: **rejected**, because the Cowboy skew grew on both the tuning and holdout seeds. The saved `night-shift-review` Workflow ran that draft, a separate reviewer and a re-verify step natively as `wf_0756c413da3e189f` ([native Sheriff review](../evidence/night-shift-native-showdown.md)).

**Why this route.** It reuses the existing private cut for the whole game segment and adds about 50 seconds that Alex can capture himself. It ends on a candidate that was reviewed and refused, so no live rule change is implied. The Wizard preview, local earned decks, Outrider ride-or-fight and Boot Hill practice are left out of the video to keep one story. They stay in the [evidence matrix](#evidence-matrix-for-the-five-criteria) and the [judge write-up](kiro-brag-sheet.md).

### Sequence

| # | Time | Picture | Source | Caption (plain text) |
| --- | --- | --- | --- | --- |
| A | 0:00–1:21 | The existing cut from its first frame through the Ledger opening: title, **Play**, Camp, both Dragon deals, both choices, the fixed-policy caption and **Sheriff's Ledger**. | Private cut, [shot list below](#segment-a-source-the-private-dragon-cut-k-102). It ends before the cut's own closing caption at 1:21. | Keep the cut's own captions. They name the build `96adf60` and say the play is scripted. |
| B | 1:21–1:36 | In the open Ledger, scroll down to the heading **Night Shift review** and hold on its line: "cowboy-sheriff health 3 → 4: rejected. tune: faction skew 9.40 -> 13.60 pp did not improve; holdout: faction skew 11.05 -> 15.30 pp did not improve." | **OWNER capture**, the public game. Read the commit from [build.json](https://alejandro-publius.github.io/cowboys-vs-wizards/build.json) before recording. | "Recorded by Alex on build `<commit>`. Night Watch: 2,000 bot games, seeds 0–999. One draft candidate, reviewed and rejected. No card changed." |
| C | 1:36–2:01 | Kiro showing the saved run `wf_0756c413da3e189f`: steps `draft-candidate`, `independent-review` and `verify-proof`, all completed, with the reviewer's verdict **rejected**. | **OWNER capture** of the Kiro workflow view. If the run is not viewable, show the run table in the [native Sheriff review receipt](../evidence/night-shift-native-showdown.md#native-run) and change the caption to "saved receipt". | "Kiro Workflow, separate reviewer agent. Tuning seeds 0–999 and holdout 1000–1999: the Cowboy skew grew on both, so the draft was rejected. Fable and Alex decide card changes." |
| D | 2:01–2:16 | Hold on the Camp or the Ledger. | Same capture as B. | "Bot results, not human playtests. Alex completed the playtests; individual first-time responses are not documented. Play it: alejandro-publius.github.io/cowboys-vs-wizards" |

Running time is 136 seconds, inside the 100–165 second target and the three-minute limit. Segment A is the only recorded footage. B and C are new captures that only Alex should make, because they show his browser and his Kiro.

**Before recording B and C.**

- **Same review on screen.** The Ledger's review line cites the direct CLI bundle `docs/evidence/night-shift/guard-sheriff-health-3-to-4/bundle.json`. The native run `wf_0756c413da3e189f` reproduced the same four shares and the same verdict ([native Sheriff review](../evidence/night-shift-native-showdown.md#native-run)). Say "the same draft, rerun as a Kiro Workflow", not "the Workflow produced this line".
- **One log line differs from the cut.** The cut was captured on `96adf60`. Since then the graybox log reads "defeated before it struck" for a fatal Bear Trap, where the cut showed "its attack was cancelled" ([Bear Trap fix](../evidence/showdown-bear-trap.md)). The engine events and both outcomes are unchanged, so the cut stays usable. Re-recording segment A on the current build would show the new line.
- **Bands and pending gates.** Fable approved 45–55% for the first-player and Cowboy shares ([PR 168](https://github.com/alejandro-publius/cowboys-vs-wizards/pull/168)). The run on screen reads 57.1% and 59.4%, so do not describe it as balanced. The even-match package in [PR 170](https://github.com/alejandro-publius/cowboys-vs-wizards/pull/170) waits for Alex's merge gate on or after Monday, November 23. It is not in this video. Balance previews and Night Shift drafts are not live rules.
- **Pending results.** Results reported for [PR 181](https://github.com/alejandro-publius/cowboys-vs-wizards/pull/181) are a candidate until the score worker's check is integrated. Do not caption them.

### Draft narration (optional, for the owner; not recorded)

About 200 words for 136 seconds, roughly 90 words a minute, which leaves room for the held captions. No synthesized voice is used.

> This is Showdown, the Cowboys versus Wizards card duel. You pick every attack, and your troops shield your Base. Play opens the Camp. The Experiment opens turn five of the Dragon hunt. Your Ranger can hit the resting Dragon or the Jack-o'-Lantern in cover, and each target previews what happens. On this deal, hitting the Dragon lets your Bear Trap finish it. Hit the Jack, and the Dragon clears your board. On the second deal there is no trap, and the better choice flips. Fixed bots played both lines to the end. That flip is the reason to replay. Kiro checks the whole ruleset behind decisions like this. The Sheriff's Ledger shows the last Night Watch run: two thousand bot games, and the Cowboys win more than Fable's target. Kiro's Night Shift tried one fix, Sheriff health from three to four. A separate reviewer agent replayed it on a thousand deals, then on a thousand held-out deals. The Cowboy lead grew on both, so it rejected the change. Nothing reached the cards. Fable and Alex decide what does. Kiro writes the evidence. These are bot results. The human playtests are Alex's to report. Play it in your browser.

### Proof labels allowed on screen

Every number in the captions and narration comes from a receipt committed at `ea183ee`. Use no other figure without a newer integrated receipt.

| Label | Receipt at `ea183ee` |
| --- | --- |
| Both Dragon outcomes (c15 / w10 on deal 1, w14 / c17 on deal 2) | [`rival-cases.json`](../../experiments/showdown-dragon-strategy/rival-cases.json) |
| 2,000 games, 1,142 first-player and 1,188 Cowboy wins, scheduled trigger | [scheduled Crew receipt](../evidence/night-shift/crew-scheduled-2026-11-20.json) |
| Sheriff 3 → 4 rejected; skew 9.40 → 13.60 and 11.05 → 15.30 points | [native Sheriff review](../evidence/night-shift-native-showdown.md) and its [bundle](../evidence/night-shift-native-showdown/bundle.json) |
| Two Trail wins by Alex, 13 and 11 turns | [release line](../design/release-line.md) |
| Private cut, 85.367 s, SHA-256 `cd7353bf…7883` | Receipt outside git, beside the file (see [segment A](#segment-a-source-the-private-dragon-cut-k-102)) |

### Evidence matrix for the five criteria

The five criteria are equally weighted ([rules check](rules-check.md#judging-criteria-what-the-entry-has-for-each), quoting the [official rules](https://kiroween.devpost.com/rules); [contest page](https://kiroween.devpost.com/)). Counts have absolute denominators. "Rerun" means the K-101 worker repeated the check on `ea183ee` ([reproduction note](../evidence/devpost-lift-judges.md)). Everything else is a committed receipt.

| Criterion | Measured evidence | Kiro provenance | Gap (stated, not hidden) |
| --- | --- | --- | --- |
| Potential Impact | The Dragon search tested 64 held-out seeds (64–127). 60 of 64 offered both targets, and on 20 of those 60 the two targets gave different winners (rerun, byte-identical to the receipt). Alex won Boot Hill in 13 turns and Raven Roost in 11. | Kiro CLI search script and fixtures ([rival README](../../experiments/showdown-dragon-strategy/rival-README.md)) | Alex is the maintainer, not a first-time player. First-time participant count and responses are undocumented. Accessibility results in PR 181 are pending the score worker. |
| Technological Implementation | Native `night-shift-review` Workflow `wf_0756c413da3e189f`: 3 of 3 steps completed. Its reviewer compared 2,000 tuning games (seeds 0–999) and 2,000 holdout games (seeds 1000–1999) for both the current Sheriff and the draft. The draft changed the winner of 150 of 2,000 tuning games (117 toward the Cowboys) and 153 of 2,000 holdout games (119 toward the Cowboys). Property tests passed 21 of 21 on both versions. Crew's scheduled Night Watch run: 2,000 of 2,000 games decisive, 361 rule tests passed. The MCP seat tools won Boot Hill in 28 legal actions. | Kiro Workflow with separate reviewer agent; Kiro Crew scheduler `62736a74`; Showdown MCP ([MCP receipt](../evidence/kiro-showdown-mcp.md)) | The native Workflow has not yet run an **accepted** verdict. Each step calls the same local `scripts/night-review.mjs`. Power skill auto-activation is pending. Kiro Web is unused. |
| Design | Dragon turn browser check: 29 of 29 (rerun, `file://` build `ea183ee`), with mouse, keyboard and 375 px touch, and a byte-identical saved career. Sheriff's Ledger: 12 of 12 (rerun), including the rejected review on screen. Wizard preview: careful-bot wins 300/300, 300/300, 276/300 and 193/300 over its four duels ([ramp check](../evidence/showdown-wizard-ramp.md)). | Kiro CLI browser checks; Fable designed the duels | The graybox has no art. Alex's visual review of the cues, physical-device and screen-reader use are open. The Wizard ramp counts are bot games. |
| Innovation/Idea | The game shows its own balance review: the in-game Ledger shows the reviewer's verdict on a one-card, one-number draft, decided on paired tuning seeds and unseen holdout seeds. Outrider ride-or-fight: 23 decisions in 300 Bone Fence seeds, removed automatically if the rules change ([release verification](../evidence/outrider-release-verify.md)). | Night Watch (Crew app) → Night Shift reviewer → Ledger build check | Card duels are not new. The Outrider cue failed its holdout, so it is an example, not advice. |
| Presentation | Private scripted cut: 85.367 s, 1280×720 plus caption strip, hash matched in two local copies on November 20. This sequence: 136 s. | Kiro CLI captured the cut with real mouse input in headless Chrome | No voice, no B or C footage, and no public YouTube link. Do not put a placeholder in the form. |

### Owner-only gates (unchanged)

Voice and editing, the B and C captures, the YouTube upload, the Devpost form and its submission, the category, credits and pre-existing-work disclosure stay with Alex. Card changes stay with Fable and Alex. The [Devpost packet](devpost-packet.md#required-form-fields-and-owner-inputs-still-open) lists the open form fields.

---

## Segment A source: the private Dragon cut (K-102)

Written November 20, 2026 by Kiro (Kiro CLI worker, job K-102 with K-087/K-095). It describes a scripted screen capture that exists. It makes no design, rules, wording or balance decision; those stay with Fable ([issue 143](https://github.com/alejandro-publius/cowboys-vs-wizards/issues/143)).

**What the cut is.** An 85.4-second silent MP4 (H.264, 1280×720 game view above a 120-pixel caption strip). Kiro CLI drove a fresh headless Chrome profile with real mouse input. The cut is **scripted**: no human played it, and it is not playtest evidence. It is kept private, outside git (`judge-media/Showdown_Dragon_Decision.mp4`, receipt `Showdown_Dragon_Decision.receipt.json` beside it, SHA-256 `cd7353bf…7883`). Nothing has been uploaded.

**Source.** Commit [`96adf60`](https://github.com/alejandro-publius/cowboys-vs-wizards/tree/96adf6031b6159ab34fd7751180ced507f677104) (the pull request 166 merge), staged with `node scripts/stage-pages.mjs --commit <sha>` and served from loopback. The `index.html` SHA-256 is `d6b44d8a…0223`. Live Pages was at `755df56` during capture. That build changes only the playtest-report code (`src/game/showdown/playtest.js`, `src/match/showdown-playtest.js`), not the experiment turn.

**Public links** (current live build, not the pinned capture): [the game](https://alejandro-publius.github.io/cowboys-vs-wizards/), [deal 1, `?turn=dragon-c5`](https://alejandro-publius.github.io/cowboys-vs-wizards/?turn=dragon-c5), [deal 2, `?turn=dragon-c5-70`](https://alejandro-publius.github.io/cowboys-vs-wizards/?turn=dragon-c5-70), [decision and replay evidence](../../experiments/showdown-dragon-strategy/rival-README.md). The cut does not use the direct URLs. It enters normally: title, then Play, then Camp, then the Experiment control.

### Shot list (as captured)

Times are from the receipt. Each state was read from the page during capture.

| Time | On screen (scripted click in **bold**) | What changes |
| --- | --- | --- |
| 0:00 | Title screen at the root URL. **Play**. | The Camp opens. It scrolls to the Experiment section and its two controls. |
| 0:09 | **Try one Dragon turn** (deal 1, seed 3). | Cowboy turn 5. The Ranger has 4/4 orbs, beside the Dynamiter, with a Bear Trap set. The Wizards have the resting Dragon on 4/5 orbs and a Jack-o'-Lantern in cover. |
| 0:14 | **Ranger**. | Each target previews its result. The Dragon "Survives on 2 and hits back: yours drops to 1". The Jack is "Defeated, nothing reaches the Base. Its Last Stand costs yours 1 orb". |
| 0:19 | **Dragon** (choice A), then **End turn**. | The Dragon goes from 4 to 2 orbs and the Ranger from 4 to 1. On the Wizards' turn the Bear Trap cancels the Dragon's attack and the Dragon leaves the board. A new Wizard defeats the Dynamiter. |
| 0:28 | **Restart this duel**, **Ranger**, **Jack-o'-Lantern** (choice B), then **End turn**. | The Jack is defeated, the Ranger drops to 3 orbs, and the Dragon keeps 4. On the Wizards' turn a Singularity hits the Ranger. The trap only drops the Dragon to 2, so it attacks: it defeats the Ranger and its Sweep removes the Dynamiter. |
| 0:39 | **Back to camp**, **Try another Dragon turn** (deal 2, seed 70). | The same Ranger, resting Dragon and Jack, but beside a Covered Wagon, and with no trap set. |
| 0:45 | **Ranger**, **Dragon** (A), **End turn**. | The Dragon goes from 4 to 2 orbs and the Ranger from 4 to 1. On the Wizards' turn the Dragon survives on 1, its Sweep finishes the Ranger, and a new Wizard defeats the Wagon. |
| 0:55 | **Restart**, **Ranger**, **Jack** (B), **End turn**. | On turn 7 both Cowboy troops are still standing: the Ranger on 2 orbs and the Wagon on 1. |
| 1:05 | Caption only, over the deal-2 board. | Fixed-policy outcomes from [`rival-cases.json`](../../experiments/showdown-dragon-strategy/rival-cases.json). Deal 1: Dragon, Cowboys win on T15; Jack, Wizards win on T10. Deal 2 reverses this: Dragon, Wizards win on T14; Jack, Cowboys win on T17. These come from bot-versus-bot replays. The video does not play them, and they predict nothing for a human. |
| 1:14 | **Back to camp**, **Sheriff's Ledger**. | The Ledger opens on its Night Watch summary: 2,000 bot games at `e813ae8`. It is shown as supporting evidence about the bots only. |
| 1:21–1:25 | Closing caption. | The reason to replay: on these two deals the same target choice reverses the fixed-policy result. The caption reports the playtest status at capture time. |

A persistent top caption line says the capture is scripted, names the build and says it is not a human playtest. A 0.7-second yellow outline marks each scripted click. These are the only additions to the recorded frames. The video is played at recorded speed; held stretches are real page state between clicks.

### Draft narration for the cut alone (optional, for the owner; not recorded)

About 150 words for 85 seconds. The video is complete without it.

> This is Showdown, the current Cowboys versus Wizards game. Play opens the Camp. The Experiment section opens one turn five decision on two deals. Your Ranger can hit the resting Dragon or the Jack-o'-Lantern in cover, and the game shows what each will do before you commit. On this deal, hit the Dragon and your Bear Trap finishes it next turn. Hit the Jack instead, and the Dragon survives the trap and clears your board. Restart puts the same turn back. On the second deal there is no trap and a Covered Wagon stands beside the Ranger. The Dragon line now loses both troops, and the Jack line keeps them. Played to the end by fixed bots, the better choice flips between the two deals. That flip is the reason to replay. The recorded lines are played by the fixed bots.

### Open gates

- **Human voice:** not chosen or recorded. No synthesized speech is used.
- **Playtests:** Alex confirmed completion after the recording. The available report documents two Trail wins. First-time player comments about this particular decision are undocumented.
- **Public video:** no YouTube or other public upload exists. Do not put a placeholder link in the Devpost form.
- **Rendered review:** Codex checked the encoded file, sampled the Camp, both boards and the Ledger, and read the fixed-policy caption at native width. The captions distinguish scripted moves from human play. Alex’s full viewing and final editorial choice remain open.
- **Live build:** the cut shows `96adf60`. The [public manifest](https://alejandro-publius.github.io/cowboys-vs-wizards/build.json) identifies the current game.
- **Fable:** owns the wording of the Camp and experiment labels, and whether this turn becomes an official bounty.

---

## Historical: lane duel script and protocol (Fable, November 16)

> **Historical, lane duel.** Everything below scripts the earlier three-lane duel (seed 60). It was written before Showdown became the December 4 fight on November 19 and its text is unchanged apart from heading levels. The pinned copy is [`389823b`](https://github.com/alejandro-publius/cowboys-vs-wizards/blob/389823b5ab7cae0b02ea630de078756790701697/docs/submission/judge-demo-script.md). The current entry and its build labels are in the [Kiro write-up](kiro-brag-sheet.md). Part 2's protocol has not been run on either fight.

Prepared November 16, 2026 by Fable as a docs-only pass. This script has not been recorded or narrated, and the human protocol is unrun. Existing source footage is listed below; no final YouTube upload is claimed. Authorship and limits: [fable-judge-story.md](../evidence/fable-judge-story.md). Every figure and game event in Part 1 was later checked against the receipts and a replay of seed 60: [fable-story-receipt-check.md](../evidence/fable-story-receipt-check.md).

### Part 1: Demo video (lane duel)

**Runtime:** 2:40 (limit 3:00). **Narration:** 325 spoken words, about 122 words per minute (planned; not timed aloud).

**Central beats:** the seed 60 simultaneous clash between Mounted Billy and the Dragon (segment 4) and one actual saved Kiro Workflow outcome (segment 5).

#### Source footage

| ID | Footage | Status |
| --- | --- | --- |
| A | Current menu, deck edit and save, settings. First 15.03 s of [menu-and-gameplay-preview.mp4](../evidence/gameplay-demo/menu-and-gameplay-preview.mp4), runtime `e9aeb06`. Silent. | EXISTS |
| B | Seed 60 gameplay, 43.67 s, [seed60-599450a.mp4](../evidence/gameplay-demo/seed60-599450a.mp4), earlier release `599450a`. Silent. Does not show the new deck page. | EXISTS |
| S | Still of Mounted Billy facing the Dragon, [faceoff.png](../evidence/gameplay-demo/faceoff.png), thumbnail of clip B. | EXISTS |
| K1 | Screen recording of the actual saved Kiro Workflow run or its saved report in the Kiro UI, showing step names, pass counts, commit and HTML hash. | NEEDED |
| K2 | Screen recording of the actual Review Power/MCP result: `pass` for the matching page, `stale` for the same receipt with an older page. | NEEDED |
| C | Longer capture of the current title menu, How to Play and deck workbench (about 40 s), same Chrome screencast method as A. | NEEDED, optional |
| D | Seed 60 route re-captured on the current runtime with the round 5 pause before End turn, same method as B. | NEEDED, optional |
| N | Screen recording of an actual Night Watch report in Kiro Crew, with the 1,000 seeds per revision and the 65 passing rule tests readable. Reload the page first so the report on screen is the current one; that reload has not been verified yet ([activation receipt](../evidence/night-watch-activation.md)). | NEEDED, only for optional segment 6b |
| V | Recorded narration. | NEEDED |

Rules for every shot:

- Use only real browser gameplay, real menu footage and real Kiro UI or receipt footage. Create no animation, art, staged frames or mock UI.
- Play footage at recorded speed. Holding a real frame is allowed. Speed changes are not.
- While clip B is on screen, show the caption "Gameplay recorded at earlier release 599450a".
- Captions are plain text. Any designed title card needs the user's approval first.

#### Narration and shot list

| # | Time | Narration | Picture | Status |
| --- | --- | --- | --- | --- |
| 1 | 0:00–0:14 | Cowboys versus Wizards is a haunted-Western card duel that runs in a browser. You lead the Cowboys. The computer commands the Wizards. Break the enemy Base before yours falls. | A: illustrated title menu. | EXISTS |
| 2 | 0:14–0:40 | We built it for people who play strategy and card games in a browser tab. Our hypothesis: those players want to see why a round went the way it did, not read it from a log. So you build a twelve-card deck, and each troop card becomes a piece standing in one of three lanes. | A: deck edit and save. Cut to B at "each troop card becomes a piece": opening Sheriff summons. | EXISTS (C preferred for the deck portion) |
| 3 | 0:40–1:04 | This is seed sixty, a match anyone can replay. A Sheriff is free. Stronger troops cost sacrifices: one troop for Billy, two for Mounted Billy. Here both go, and Mounted Billy rides in with five life orbs. A Singularity spell then pulls him into the center lane, where the Dragon soon faces him. Position just changed the fight. | B: tribute summons, Mounted Billy enters, Singularity moves him, the Dragon is summoned opposite. Hold S on "the Dragon soon faces him". | EXISTS (D preferred) |
| 4 | 1:04–1:24 | Now the clash. Both attacks resolve together. Mounted Billy is defeated, and he still lands his hit: the Dragon drops from five orbs to two. Nothing here is a cutscene. The rules engine decided that outcome, and the arena shows both halves of it. | B: center-lane clash through the orb change, uncut. Let the hit land before "Nothing here is a cutscene". | EXISTS |
| 5 | 1:24–1:54 | That is where Kiro earned its place. An animation can look right and tell the wrong story. A Requirements-First spec defined simultaneous attacks. A saved Kiro Workflow then ran the tests and replayed scripted routes in Chrome. Its saved run passed one hundred fifty-seven tests and twelve scripted browser checks against one frozen commit, and recorded the hash of the page it tested. | K1: the spec requirement briefly, then the actual Workflow run or report with counts, commit and hash readable: `02b1bf8` for the final run `wf_0572a745f5194cf1`, or `e9aeb06` if the earlier run `wf_5bd13532f5142477` is the one shown. | NEEDED |
| 6 | 1:54–2:06 | A reviewer tool reads that receipt. Matching page: pass. Same receipt, older page: stale. The evidence names the build it belongs to. | K2: actual `pass` result, then actual `stale` result. | NEEDED |
| 6b | optional, about 0:10 | Night Watch, a separate Kiro Crew app, replays a thousand seeded matches on two revisions and reports what changed. | N: the actual report in Crew. | NEEDED, optional |
| 7 | 2:06–2:28 | What we have not done yet: watch first-time players. Automated checks show the rules hold, not that people enjoy them. Fable wrote the engine and CPU. Kiro wrote the presentation, spec and tooling. Codex integrated and verified. The art and motion were approved by a person. | Hold S, then A: settings. Plain text credits caption matching the narration. | EXISTS |
| 8 | 2:28–2:40 | Cowboys versus Wizards. Play it in your browser. | A: title menu held. Plain caption with the game URL. | EXISTS |

Words per segment (Codex word-boundary count, hyphenated words counted as one): 29, 55, 58, 44, 63, 22, 46, 8. Total 325. Segment 3 was reworded after that count and is still 58 words. Optional segment 6b is 19 words and is not in the total.

#### Before recording

1. **Check the numbers on screen.** Segment 5 says 157 tests and 12 scripted browser checks against one frozen commit. Two saved Workflow runs have those same counts: the final one, `wf_0572a745f5194cf1` on `02b1bf8` ([receipt](../evidence/kiro-final-polish-verification.md)), and an earlier one, `wf_5bd13532f5142477` on `e9aeb06` ([receipt](../evidence/kiro-closeout-release-check.md)). Show the final run if you can, and make the commit on screen match the report on screen. Still read the figures off the actual saved report while capturing K1. If the report shows different numbers, change the narration to match it.
2. **Find the in and out points.** This pass did not view the videos, so the table names clip content and gives no timecodes inside A or B.
3. **Plan for the footage shortfall.** Segments 1–4 and 7–8 need about 118 s of game picture. A and B together run 58.73 s. With existing footage only, the edit depends on holding real frames and reusing the title menu. Captures C and D remove that dependence, and D also puts the gameplay on the current runtime.
4. **Keep the pass and the stale result real.** If K2 cannot be captured, cut segment 6 and end segment 5 on the Workflow report. The video then runs about 2:28 with 303 words.
5. **Decide on Night Watch.** Optional segment 6b adds about 10 seconds, for 2:50 and 344 words, still under the 3:00 limit. Use it only with real footage N. Its line claims a report, not an unattended nightly run: the 2 a.m. job is registered, and no clock-time run has been observed.
6. **Upload last.** No public YouTube link exists. Do not put a placeholder in the Devpost form.

<a id="part-2-first-time-human-playtest-protocol"></a>

### Part 2: First-time human playtest protocol (lane duel)

**State: NOT RUN.** No human has completed this protocol. Every result cell below is blank on purpose. Agent browser reviews and automated tests do not count as sessions.

#### Setup

- **Participants:** 3 to 5 people who play browser strategy or card games and have not seen this game.
- **Build:** the public game URL, default opening, no seed parameter. Record the commit and the device and browser used.
- **Moderator script:** "This is a card game. I can't answer questions while you play. Please say what you're thinking out loud." Give no other explanation.
- **Recording:** screen and voice, with the participant's consent. Otherwise written notes only.
- **Time limit:** 3 minutes per task. Stop the session at 20 minutes.

#### Tasks

Read each task aloud, exactly as written, one at a time.

| # | Task as read to the participant | Success means |
| --- | --- | --- |
| 1 | "Start a match." | A match is on screen with the hand visible. |
| 2 | "Put one of your troops on the board." | A troop stands in a lane after the participant chose a card, picked a lane and confirmed. |
| 3 | "Play until one of your troops or your Base loses a life orb. Then tell me why it happened." | The participant names the enemy troop or spell that caused the loss. |
| 4 | "Bring out a troop that costs a sacrifice." | Billy or Mounted Billy is summoned after the participant chose the tribute troops. |
| 5 | "Go back to the main menu, change which cards are in your deck, save it, and return to play." | A different valid twelve-card deck is saved and the participant is back in a match. At least two card counts must change to preserve the total. |

#### Outcome definitions

- **Independent:** completed within the time limit with no moderator help. Opening How to Play unprompted still counts as independent. Note that it happened.
- **Assisted:** completed after exactly one neutral prompt, such as "What would you try next?" or "Is there anything on screen that might help?" A prompt that names a control or a rule makes the task a fail.
- **Fail:** not completed within 3 minutes, abandoned, needed more than one prompt, or, for task 3, gave an explanation that does not match what the game did.

#### What to record for each task

1. Outcome: independent, assisted or fail.
2. Time from the end of the instruction to success, in seconds.
3. Number of clicks or taps on things that did nothing or were not legal.
4. Whether How to Play was opened, and during which task.
5. The prompt given, word for word, if any.
6. The participant's first spoken words when they hesitated, word for word.
7. For task 3 only: their explanation, word for word, and whether they noticed that both sides attacked in the same clash.

After task 5, ask two questions and write down the answers word for word: "What was the most confusing moment?" and "What would you do differently in your next match?"

#### Results

Sessions run: **0**. Date: ____. Build commit: ____. Moderator: ____.

| Participant | Device and browser | T1 | T2 | T3 | T4 | T5 | Opened How to Play | Most confusing moment (their words) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P1 | | | | | | | | |
| P2 | | | | | | | | |
| P3 | | | | | | | | |
| P4 | | | | | | | | |
| P5 | | | | | | | | |

Per-task detail, one row per participant and task:

| Participant | Task | Outcome | Seconds | Wasted clicks | Prompt given | First words on hesitation |
| --- | --- | --- | --- | --- | --- | --- |
| | | | | | | |

#### Using the results

Report counts only, for example "3 of 4 independent on task 2". With five or fewer participants, do not report percentages or call a result proof of demand. Change the default opening or the onboarding copy only after real sessions point to a specific problem.

#### Onboarding copy check

Fable read the How to Play text in `src/ui/title-menu.js` for this protocol and changed nothing. The five steps cover summoning, tribute costs, one summon and one spell per round, lane clashes and the nine-round limit. Two things the demo relies on are not stated there:

- That both troops in a clash attack even when one is defeated. The text says only "opposing lanes clash".
- That an enemy spell can move a troop to another lane.

Task 3 is written to show whether players work these out unaided. These are observations for the user to consider, not approved copy changes.

#### Subsequent onboarding correction

Codex addressed the two copy gaps above in commit c454398 after the Fable review. How to Play now explains optional actions, casting with empty friendly lanes, Singularity, simultaneous damage even when one attacker falls, and the nine-round Base-orb tiebreak. These are existing rules, not new mechanics. The first-time human protocol remains unrun.
