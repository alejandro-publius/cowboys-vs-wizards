# Judge demo script and first-time playtest protocol

Prepared November 16, 2026 by Fable as a docs-only pass. Nothing here has been recorded, narrated, uploaded or played by a human yet. Authorship and limits: [fable-judge-story.md](../evidence/fable-judge-story.md).

## Part 1: Demo video

**Runtime:** 2:40 (limit 3:00). **Narration:** 324 spoken words, about 121 words per minute.

**Central beats:** the seed 60 simultaneous clash between Mounted Billy and the Dragon (segment 4) and one actual saved Kiro Workflow outcome (segment 5).

### Source footage

| ID | Footage | Status |
| --- | --- | --- |
| A | Current menu, deck edit and save, settings. First 15.03 s of [menu-and-gameplay-preview.mp4](../evidence/gameplay-demo/menu-and-gameplay-preview.mp4), runtime `e9aeb06`. Silent. | EXISTS |
| B | Seed 60 gameplay, 43.67 s, [seed60-599450a.mp4](../evidence/gameplay-demo/seed60-599450a.mp4), earlier release `599450a`. Silent. Does not show the new deck page. | EXISTS |
| S | Still of Mounted Billy facing the Dragon, [faceoff.png](../evidence/gameplay-demo/faceoff.png), thumbnail of clip B. | EXISTS |
| K1 | Screen recording of the actual saved Kiro Workflow run or its saved report in the Kiro UI, showing step names, pass counts, commit and HTML hash. | NEEDED |
| K2 | Screen recording of the actual Review Power/MCP result: `pass` for the matching page, `stale` for the same receipt with an older page. | NEEDED |
| C | Longer capture of the current title menu, How to Play and deck workbench (about 40 s), same Chrome screencast method as A. | NEEDED, optional |
| D | Seed 60 route re-captured on the current runtime with the round 5 pause before End turn, same method as B. | NEEDED, optional |
| V | Recorded narration. | NEEDED |

Rules for every shot:

- Use only real browser gameplay, real menu footage and real Kiro UI or receipt footage. Create no animation, art, staged frames or mock UI.
- Play footage at recorded speed. Holding a real frame is allowed. Speed changes are not.
- While clip B is on screen, show the caption "Gameplay recorded at earlier release 599450a".
- Captions are plain text. Any designed title card needs the user's approval first.

### Narration and shot list

| # | Time | Narration | Picture | Status |
| --- | --- | --- | --- | --- |
| 1 | 0:00–0:14 | Cowboys versus Wizards is a haunted-Western card duel that runs in a browser. You lead the Cowboys. The computer commands the Wizards. Break the enemy Base before yours falls. | A: illustrated title menu. | EXISTS |
| 2 | 0:14–0:40 | We built it for people who play strategy and card games in a browser tab. Our hypothesis: those players want to see why a round went the way it did, not read it from a log. So you build a twelve-card deck, and every card becomes a troop standing in one of three lanes. | A: deck edit and save. Cut to B at "every card becomes a troop": opening Sheriff summons. | EXISTS (C preferred for the deck portion) |
| 3 | 0:40–1:04 | This is seed sixty, a match anyone can replay. A Sheriff is free. Stronger troops cost sacrifices: one troop for Billy, two for Mounted Billy. Here both go, and Mounted Billy rides in with five life orbs. Then a Singularity spell pulls him into the center lane, face to face with the Dragon. Position just changed the fight. | B: tribute summons, Mounted Billy enters, Singularity moves him. Hold S on "face to face with the Dragon". | EXISTS (D preferred) |
| 4 | 1:04–1:24 | Now the clash. Both attacks resolve together. Mounted Billy is defeated, and he still lands his hit: the Dragon drops from five orbs to two. Nothing here is a cutscene. The rules engine decided that outcome, and the arena shows both halves of it. | B: center-lane clash through the orb change, uncut. Let the hit land before "Nothing here is a cutscene". | EXISTS |
| 5 | 1:24–1:54 | That is where Kiro earned its place. An animation can look right and tell the wrong story. A Requirements-First spec defined simultaneous attacks. A saved Kiro Workflow then ran the tests and replayed scripted routes in Chrome. Its saved run passed one hundred fifty-seven tests and twelve scripted browser checks against one frozen commit, and recorded the hash of the page it tested. | K1: the spec requirement briefly, then the actual Workflow run or report with counts, commit `e9aeb06` and hash readable. | NEEDED |
| 6 | 1:54–2:06 | A reviewer tool reads that receipt. Matching page: pass. Same receipt, older page: stale. The evidence names the build it belongs to. | K2: actual `pass` result, then actual `stale` result. | NEEDED |
| 7 | 2:06–2:28 | What we have not done yet: watch first-time players. Automated checks show the rules hold, not that people enjoy them. Fable wrote the engine and CPU. Kiro wrote the presentation, spec and tooling. Codex integrated and verified. The art and motion were approved by a person. | Hold S, then A: settings. Plain text credits caption matching the narration. | EXISTS |
| 8 | 2:28–2:40 | Cowboys versus Wizards. Play it in your browser. | A: title menu held. Plain caption with the game URL. | EXISTS |

Words per segment: 29, 54, 58, 44, 63, 22, 46, 8. Total 324.

### Before recording

1. **Check the numbers on screen.** Segment 5 says 157 tests and 12 scripted browser checks at `e9aeb06`. Read those figures off the actual saved Workflow report while capturing K1. If the report shows different numbers, change the narration to match it.
2. **Find the in and out points.** This pass did not view the videos, so the table names clip content and gives no timecodes inside A or B.
3. **Plan for the footage shortfall.** Segments 1–4 and 7–8 need about 118 s of game picture. A and B together run 58.73 s. With existing footage only, the edit depends on holding real frames and reusing the title menu. Captures C and D remove that dependence, and D also puts the gameplay on the current runtime.
4. **Keep the pass and the stale result real.** If K2 cannot be captured, cut segment 6 and end segment 5 on the Workflow report. The video then runs about 2:28 with 302 words.
5. **Upload last.** No public YouTube link exists. Do not put a placeholder in the Devpost form.

## Part 2: First-time human playtest protocol

**State: NOT RUN.** No human has completed this protocol. Every result cell below is blank on purpose. Agent browser reviews and automated tests do not count as sessions.

### Setup

- **Participants:** 3 to 5 people who play browser strategy or card games and have not seen this game.
- **Build:** the public game URL, default opening, no seed parameter. Record the commit and the device and browser used.
- **Moderator script:** "This is a card game. I can't answer questions while you play. Please say what you're thinking out loud." Give no other explanation.
- **Recording:** screen and voice, with the participant's consent. Otherwise written notes only.
- **Time limit:** 3 minutes per task. Stop the session at 20 minutes.

### Tasks

Read each task aloud, exactly as written, one at a time.

| # | Task as read to the participant | Success means |
| --- | --- | --- |
| 1 | "Start a match." | A match is on screen with the hand visible. |
| 2 | "Put one of your troops on the board." | A troop stands in a lane after the participant chose a card, picked a lane and confirmed. |
| 3 | "Play until one of your troops or your Base loses a life orb. Then tell me why it happened." | The participant names the enemy troop or spell that caused the loss. |
| 4 | "Bring out a troop that costs a sacrifice." | Billy or Mounted Billy is summoned after the participant chose the tribute troops. |
| 5 | "Go back to the main menu, change one card count in your deck, save it, and return to play." | The deck is saved with a changed count and the participant is back in a match. |

### Outcome definitions

- **Independent:** completed within the time limit with no moderator help. Opening How to Play unprompted still counts as independent. Note that it happened.
- **Assisted:** completed after exactly one neutral prompt, such as "What would you try next?" or "Is there anything on screen that might help?" A prompt that names a control or a rule makes the task a fail.
- **Fail:** not completed within 3 minutes, abandoned, needed more than one prompt, or, for task 3, gave an explanation that does not match what the game did.

### What to record for each task

1. Outcome: independent, assisted or fail.
2. Time from the end of the instruction to success, in seconds.
3. Number of clicks or taps on things that did nothing or were not legal.
4. Whether How to Play was opened, and during which task.
5. The prompt given, word for word, if any.
6. The participant's first spoken words when they hesitated, word for word.
7. For task 3 only: their explanation, word for word, and whether they noticed that both sides attacked in the same clash.

After task 5, ask two questions and write down the answers word for word: "What was the most confusing moment?" and "What would you do differently in your next match?"

### Results

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

### Using the results

Report counts only, for example "3 of 4 independent on task 2". With five or fewer participants, do not report percentages or call a result proof of demand. Change the default opening or the onboarding copy only after real sessions point to a specific problem.

### Onboarding copy check

Fable read the How to Play text in `src/ui/title-menu.js` for this protocol and changed nothing. The five steps cover summoning, tribute costs, one summon and one spell per round, lane clashes and the nine-round limit. Two things the demo relies on are not stated there:

- That both troops in a clash attack even when one is defeated. The text says only "opposing lanes clash".
- That an enemy spell can move a troop to another lane.

Task 3 is written to show whether players work these out unaided. These are observations for the user to consider, not approved copy changes.
