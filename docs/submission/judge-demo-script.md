# Judge demo script

For a new capture, open the [published Showdown title](https://alejandro-publius.github.io/cowboys-vs-wizards/), read the [live build manifest](https://alejandro-publius.github.io/cowboys-vs-wizards/build.json), and put its commit in the caption. The [latest release check](../PROJECT-STATUS.md#current-build) shows the opening board. The dated cuts below retain the commits they were filmed on.

## November 23 recording script: title to one Kiro decision

Drafted November 23, 2026 with Claude Code from Showdown revision `c8fa7f2`. The private captioned draft uses scripted Chrome footage of the two Outrider choices, the Billy replays, and the Saloon review from the local contest build at `35d7447`. This shot list guides the narrated cut. The [78-second cut](#november-22-illustrated-showdown-demo) is an earlier reference.

The cut opens on the illustrated title and plays the Ride or Fight? turn. It then opens one Kiro decision in the Sheriff's Ledger, Billy's attack 2 → 1, and replays it both ways. The candidate passed the written gate and is awaiting design approval. The cut ends with the spec, steering, and a save hook that caught a stale build. The planned runtime is 2:35.

### Before recording

1. Put the filmed build's `build.json` commit in the persistent caption. The **Ride or Fight?** plaque appears only when the Outrider gate verified `case-e` at build time (`src/app.js:168`). No plaque means no verified position, so stop.
2. In the Sheriff's Ledger the first replay button must read **Current Billy · 2 attack**. "Recorded Billy" means the live card changed and beat 5 is wrong. Stop and rewrite it.
3. Use a fresh browser profile and play footage at recorded speed. Holding a real frame is allowed. If moves are scripted, keep the Dragon cut's top caption (scripted, build, not a human playtest).
4. Labels below come from source at `c8fa7f2`. Where the filmed build differs, change this table to match the frames, never the reverse.

### Shot list

| # | Time | Picture (clicks in **bold**) | Narration (planned) | Source for each claim |
| --- | --- | --- | --- | --- |
| 1 | 0:00–0:10 | Illustrated title at the root URL, held. | Showdown is a haunted-Western card duel that runs in a browser. You choose every attack, and your troops shield your Base. | [README](../../README.md#play-showdown) |
| 2 | 0:10–0:32 | **Ride or Fight?** Lesson: "Choose the Outrider. Attack a troop, or ride past it to the Wizard Base." **Outrider**, **Wizard Base**, **End turn**. Then **Restart this duel**, **Outrider**, **Skeleton**. | Ride or Fight opens a real turn at the Bone Fence. Your Outrider can strike the Skeleton, or ride past it and hit the Wizard Base. Restart puts the same turn back, so you can try the other choice. | `src/app.js:163`. Board is Ledger "Position 1": turn 3, Outrider on 2 orbs, Skeleton on 3, Bases 5 and 4 ([still](../evidence/outrider-gate/ledger-revealed.png)) |
| 3 | 0:32–0:45 | **Back to camp**. Per source, the Camp reopens its Practice room on the Outrider control. **Back to map**, **Camp ledger**, **Sheriff's Ledger**. Hold on "Turn 7 · Seed 726421019 · Cowboys first". | Camp keeps a ledger of what the balance agents measured and proposed. Here is one decision from Kiro's balance agent: lower Billy's attack from two to one. | `src/app.js:62–78`, `camp-outpost.js`; [Kiro run](../evidence/kiro-contest-run.md), attempt 3 |
| 4 | 0:45–1:15 | **Current Billy · 2 attack**, **Next step** ×3, ending "Step 4 of 4 · The Cowboys win on turn 13." **Proposed Billy · 1 attack**, **Next step** ×3: "The Bone Wall loses 1 orb and survives with 1 orb", then "The Wizards win on turn 20." | The ledger replays one recorded deal both ways. The first twenty-nine events are identical. At two attack, Billy clears the Bone Wall and the Cowboys win on turn thirteen. At one, the Wall survives on one orb and the Wizards win on turn twenty. | [`billy-replay.data.js`](../../src/ui/billy-replay.data.js), [`billy-replay.js`](../../src/ui/billy-replay.js), [Billy replay](../evidence/billy-replay.md) |
| 5 | 1:15–1:40 | Ledger line "Billy has 2 attack in this build. Night Shift marked the one-point proposal ready for design review." Cut to a terminal: `node scripts/billy-balance-gate.mjs --arm candidate` (PASS, exit 0), then `--arm baseline` (RED, exit 2). Caption: **Evidence: passed the written gate. Card: unchanged, awaiting design approval.** | Two separate approvals. The evidence passed. In a hundred thousand paired bot duels, the proposal measured fifty-two percent Cowboy wins, inside the approved forty-five to fifty-five band. The current card measured sixty. The card itself has not changed. Billy keeps two attack until the design owners approve it. | [Billy seat audit](../evidence/billy-seat-audit/README.md); rerun below. The band is the approved one in the [release line](../design/release-line.md) (PR 168) |
| 6 | 1:40–2:02 | Kiro IDE showing three files: `.kiro/specs/night-shift-balance-contract/requirements.md` (NSB-1, NSB-2, "The balancer agent never edits this file"); `.kiro/steering/rules-area.md` front matter (`inclusion: fileMatch`, `src/game/**`); `.kiro/hooks/check-outrider-gate.json` (`PostFileSave` → `node scripts/check-outrider-gate-hook.mjs`). | That band is a written spec. The balancing agent is blocked from editing it and may change one number in a scratch copy. Steering loads by area, so rules work carries the rules guidance. Hooks run checks when a file is saved. | Spec file; [fence block](../evidence/kiro-contest-run.md); [native steering run](../evidence/showdown-scoped-steering.md) (reading an engine file loaded `rules-area.md`) |
| 7 | 2:02–2:25 | `docs/evidence/outrider-gate/hook-receipts.jsonl` lines 10–11. 21:14:00.985Z `failed`: "Ledger: stale; links none; camp none … Outrider gate: 0 fresh, 10 stale". 21:14:23.836Z `passed`: "10 fresh, 0 stale". Then [ledger-stale.png](../evidence/outrider-gate/ledger-stale.png). | One save shows why. A trial edit made a ride past troops hit for two instead of one. The save hook replayed all ten recorded positions and marked all ten stale, and the stale build left them out of the Camp. Reverting the edit restored all ten. | [Outrider gate](../evidence/outrider-gate.md) (mutation, G7, receipts 10–13); [stale build receipt](../evidence/outrider-gate/build-receipt-stale.json) |
| 8 | 2:25–2:35 | Title held, plain caption with the game URL. | Fixed bots produced every number here. First-time player results are still pending. Play Showdown at the link below. | [Three-player protocol](#three-first-time-players) |

Beat 7's receipts carry Kiro session `sess_2109871e…` and `hook_event_name: "PostFileSave"`, which a manual run lacks. The stale build was a graybox mutation build in the `ce6bdfe` era. No stale illustrated root has been filmed. "Left them out of the Camp" rests on that build's receipt and its six-check browser run.

For an optional ten-second shot after beat 6, choose **Camp** from the title, open **Night Shift saloon**, and press **Step** three times. Hold on the **Review of Kiro's proposal** notice. The replay reveals the written balance rule, measured shares, source revision, and recheck command. This recorded route and its reset passed fresh Chrome checks at 1440×900 and 390×844, with zero live feed requests.

### Where the editor finds each artifact

| ID | Artifact | Location | Status |
| --- | --- | --- | --- |
| P | 78-second illustrated cut, Pages `d0bbd14` | This checkout records only its content and revision. [Kiro contest run](../evidence/kiro-contest-run.md) says Codex recorded it from the verified Pages bytes. Ask the coordinator for the file, receipt and timecodes. | EXISTS. Location, hash and in/out points unrecorded |
| D | 85.4-second Dragon cut | `judge-media/Showdown_Dragon_Decision.mp4` and receipt, private, outside Git | EXISTS. Not used here |
| G | Beats 1–5, gameplay and Ledger | Local contest build `35d7447` | Captured in the private draft |
| T | Gate terminal (beat 5) | Rerun on camera. Needs no Git or installed dependencies (run here without either) | Text recorded below; capture NEEDED |
| S, ST, H | Spec, steering, hook (beat 6) | Paths in beat 6 | Files EXIST; capture NEEDED |
| R | Hook receipts, stale Ledger (beat 7) | `docs/evidence/outrider-gate/`: `hook-receipts.jsonl`, `ledger-stale.png`, `build-receipt-stale.json` | EXIST as text and graybox stills |
| W | Native Workflow `wf_87723b3404bba1fc` | [`kiro-night-shift-native.png`](../evidence/kiro-night-shift-native.png) | EXISTS. Rendered from the Kiro CLI 3.5.0 JSONL stream, not a screen recording |
| N | Three-attempt results card | [`kiro-night-shift-results.png`](../evidence/kiro-night-shift-results.png) | EXISTS. Designed summary card that names another AI product. Owner approval needed |
| SL | Saloon (optional) | **Camp** → **Night Shift saloon** → **Step** ×3 | Captured in the private draft |
| V | Narration | — | NEEDED, owner's voice |

### Judging criteria: claims a judge can check

| Criterion | Claim | How to audit it | Open gap |
| --- | --- | --- | --- |
| Potential Impact | One click from the title reaches a verified decision. A card's balance evidence sits in the game beside a replay anyone can step through. | `check-pages-tree.mjs --browser`: "the illustrated title opens the playable Ride or Fight? challenge" ([release checks](../evidence/illustrated-contest-release.md), `3c5bb34`) | No first-time player observations recorded for this release |
| Technological Implementation | A written spec sets the gate (NSB-1, NSB-2). A fenced agent proposes one number, and a separate reviewer decides. The gate re-derives 100,000 recorded duels before it reads the spec. | Gate commands below; [fence](../evidence/kiro-contest-run.md); [steering](../evidence/showdown-scoped-steering.md); [hook receipts](../evidence/outrider-gate/hook-receipts.jsonl) | Sheriff replay and Billy replay verifier need Git history (not rerun here) |
| Design | One supported path: title → challenge → Camp map → Camp ledger. Replay buttons never move keyboard focus. | `wireBillyReplay` in `src/ui/billy-replay.js`; `src/ui/showdown-3d/camp-outpost.js` | Safari and real-phone checks pending |
| Innovation | A position ships only while both of its choices replay exactly as measured, and the title plaque depends on that check. | [Outrider gate spec](../../.kiro/specs/outrider-gate/requirements.md) G1–G3; mutation and control in the [evidence](../evidence/outrider-gate.md) | Results assume a fixed greedy policy and the level-0 bot; the pre-registered cue was unsupported (3 of 7) |
| Presentation | Every on-screen number traces to a file above. Scripted moves are labelled. About 2:35 with narration. | This script | Captioned draft exists. Narration and upload pending |

### Patterns from competing projects

For internal editing, these patterns came from the entrants’ READMEs.

- **A measurable gate inside the product (GOLEM):** the Outrider gate and NSB rules, in beats 2, 5 and 7.
- **Visible agent activity (Séance):** the optional Saloon beat and the on-screen hook receipts.
- **Exposed review evidence (Janus):** the Ledger's "How to verify this replay" and "Check each version against the written rule" panels.

Keep competitor names out of the video. The rules bar third-party trademarks ([rules check](rules-check.md#risks-to-settle-before-submitting)). That also covers the Ledger's "Fable and Alex decide" line, the gate's "Fable/Alex" output line and browser chrome. Crop them, or leave the call to the owner.

### Do not claim

- That Billy's change was applied, or that any card is balanced.
- That bot shares predict human results.
- That the title plaque was seen disappearing on a stale illustrated build.
- That the public build shows live Kiro activity, or that the Saloon meets a two-second target.
- Any playtest count, usage or credit figure, new UI or rule change.

### Verification for this edit (November 23)

These ran in the `c8fa7f2` snapshot, which has no Git metadata and no installed dependencies. Hashes are shortened.

```text
$ node scripts/billy-balance-gate.mjs --arm baseline     # exit 2
Evidence re-derived: 100000 duels match result.json (protocol SHA-256 19505748…69b3, CSV SHA-256 94716782…706f).
NSB-1 RED: Cowboy 59.792%, Wizard 40.208%; allowed 45% to 55% inclusive
NSB-2 PASS: first-seat distance from 50% 9.412 pp (baseline 9.412 pp); allowed at most 10.412 pp (+1)
Overall RED. Do not forward this candidate.

$ node scripts/billy-balance-gate.mjs --arm candidate    # exit 0
Evidence re-derived: 100000 duels match result.json (same hashes).
NSB-1 PASS: Cowboy 51.92%, Wizard 48.08%; allowed 45% to 55% inclusive
NSB-2 PASS: first-seat distance from 50% 8.136 pp (baseline 9.412 pp); allowed at most 10.412 pp (+1)
Overall PASS. Measured match shares meet NSB-1 and NSB-2. Ready for Fable/Alex review only; not applied to any card or release.
```

Both match the [archived verdicts](../evidence/billy-seat-audit/README.md). Chrome confirmed both Outrider targets from the title challenge and both Billy replay endings from the Ledger on the local contest build. The captioned draft captured both routes. Narration is pending.

## November 22 illustrated Showdown demo

The 78-second scripted cut opens on Hellfire, shows the two Outrider choices from the same Bone Fence position, then shows the Kiro gate, the Sheriff rejection and the Night Shift balance results. The captured game is the public Pages revision `d0bbd142eb2d3ff64c491b892f12587a016d01e8`. [Play the release](https://alejandro-publius.github.io/cowboys-vs-wizards/) · [Build identity and Kiro evidence](../evidence/kiro-contest-run.md)

### Three first-time players

Verify `build.json` names the filmed revision before the session. Start each player at the illustrated title in a fresh browser profile. Say, “Open Ride or Fight? and make your first move.” Once they act, ask, “What did your move do, and why did it work?” Give the explanation and show the alternate replay only after recording their answer. Record the action, their answer in their own words, any hint, and whether they correctly explained how their chosen target was available or affected the board. Ask for consent before recording a participant.

Report the count of independent explanations out of three. Observations for this release are pending.

## November 20 Showdown turn-five Dragon decision (private cut)

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

### Draft narration (optional, for the owner; not recorded)

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
