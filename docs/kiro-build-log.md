# Cowboys vs. Wizards — Kiro build log

Started November 14, 2026, in Pacific time. Entry dates use America/Los_Angeles. This file records work as it happens and supplies evidence for the Kiroween submission. Codex prepared this initial log and the accompanying steering file. Kiro activity starts when a Kiro session actually performs and records work.

## Project direction

Build a short, understandable haunted-Western card duel. Players select cards from a visible hand, summon 3D characters onto three tiles per side, sacrifice troops to summon stronger characters, and watch attacks change the board. Living characters show one to five health orbs overhead. The approved card back uses brass horseshoes and an amethyst on a dark red-purple ground.

The proposed first rules use troop health of 3/4/5 orbs and damage of 1/2/3 across three summon tiers, five orbs on each base, 12-card decks and four-card opening hands. Each round from round two adds a draw. Both players act before the simultaneous clash. The orb-duel requirements review will settle details and record any changes.

## What the judges can verify

The official rubric assigns equal weight to impact, technological implementation, design, innovation, and presentation. Technological implementation asks how thoughtfully and effectively Kiro was used. The targets below are our development priorities. [Official criteria](https://kiroween.devpost.com/rules)

| Development priority | Player-visible result | Evidence to retain |
| --- | --- | --- |
| Complete first match | Draw, summon, clash, lose orbs, finish, restart | A continuous browser recording, build reference, and actual result |
| Understandable combat | A new player can identify who can attack and what the attack will do | Brief playtest notes, participant count, observed confusion, and the resulting change |
| Tactical summoning | The player weighs keeping two lanes defended against sacrificing troops for a boss | A playable example and a replay of the choice |
| Distinct faction action | Singularity moves a blocker and changes the next clash | Before/after board state, replay, and the rule that produced it |
| Reliable animation | Cards summon one character each, grip holds, damage occurs once, and the game resumes | Browser footage and relevant rule/animation test output |
| Smooth browser play | Players can load the board and use effects comfortably on the tested machine | Measured load/frame timings with hardware, browser, scene, and build identified |

## Intended Kiro work

All rows begin as planned. Update each with the entry and evidence that demonstrate actual use. Choose work according to the next gameplay need.

| Capability | Work to perform in Kiro | Evidence and current state |
| --- | --- | --- |
| IDE and feature specs | Turn the existing exchange into the orb-duel match through requirements, design, and tasks | Planned — link the spec, decisions, and first complete match |
| Steering | Carry approved art, health-orb rules, and evidence recording into later tasks | Prepared by Codex — Kiro application and impact await observation |
| Agent hooks | After a spec task, maintain one concise evidence entry. On relevant card/rule edits, run the appropriate checks | Planned — create through the installed Kiro version and capture a real trigger and result |
| Property-based testing | Exercise card ownership, legal tribute payments, orb bounds, and repeatable actions | Planned — record seed, case count, property, actual failures, and fixes |
| Custom agents | Use a combat reviewer to assess anticipation, impact, recovery, and board readability against the approved references | Planned — save agent configuration, feedback tied to frames, and the improvement implemented |
| MCP | Use browser control to summon, attack, inspect the result, and capture frames of the working game | Planned — record tool action and rendered evidence. Connect Blender when an asset task needs it |
| Powers | Apply a relevant Power to a real documentation, testing, or deployment task | Planned — record the installed Power, activation, and specific effect on the work |
| CLI or Web | Run reproducible simulations or browser checks in a second Kiro interface when useful | Planned — identify the interface and explain how it helped that task |
| Crew | Review finished-match replays or recurring balance results after the match engine exists | Planned — record actual bot activity and output if this becomes part of the project |

## First Kiro milestone

Open a requirements-first spec named `orb-duel`. Inspect the existing code and assets. Record the initial requirements and unresolved decisions, then implement the smallest playable path from selecting a card to a summoned character with health orbs. Extend that path through a complete match.

The first automation task is to create and exercise a Post Task Execution hook in Kiro. It should update the current task's log entry once, using the session's real commands and results. A task that only changes requirements can link its reviewed documents. Capture the hook's first real run. Keep routine entries short and make one entry per meaningful result.

## Entry format

Copy this block when a meaningful task starts and complete it as work finishes. Fill unavailable fields with a short explanation.

### YYYY-MM-DD — Task name

- **State** — planned, in progress, observed, or verified. State exactly what was verified.
- **Performed in** — Kiro IDE, CLI, Web, Crew, Codex, Tripo, or manual work. Include the agent/model/version when available.
- **Problem and player effect** — what failed, was unclear, or needed to work.
- **Kiro contribution** — the specific feature used and the actual work it performed.
- **Decision or experiment** — the alternatives considered and the reason for the choice.
- **Change** — files, requirement identifiers, and relevant behavior.
- **Verification** — command, environment, actual result, seed/case count where relevant, and visual review.
- **Evidence** — relative paths to selected captures, outputs, replays, and source. Add a commit or PR reference when available.
- **Result and remaining work** — what improved and what still needs checking.

### 2026-11-14 — Imported board prototype baseline

- **State** — imported source inspected. Geometry and attack-timeline checks previously passed against the matching handoff source. Full-match behavior and Kiro implementation are pending.
- **Performed in** — Codex. The user opened the extracted project in Kiro IDE. The eight GLBs derive from the project's Tripo exports.
- **Observed product** — a six-tile board, Billy and wizard figures, revolver, saloon, portal, and individual fire/Singularity/exchange controls. The runtime currently starts both figures at 100 health. The orb interface and card match remain proposed features.
- **Evidence** — [starting board render](../media/board.jpg), [recorded exchange](../media/replay.mp4), [scene source](../scene.js), [runtime](../runtime.js), and [verification code](../verify.mjs).
- **Recorded check** — `npm run check` completed with exit code 0 in `/tmp/cvw-board-duel/handoff` during the preceding audit. The source fingerprints below were compared against the opened project and matched on November 14, 2026, Pacific time. Verification used Node with placeholder image decoding. Texture, shader, and animation appearance require rendered review.
- **Measured output** — six tiles, maximum Billy lift 1.4978164082128924, staff socket drift 0, wizard foot drift 0, and 36 affected orbiting pieces. Distances use the scene's coordinate units. These measurements describe the existing prototype.
- **Asset inventory** — eight reduced GLBs. Sheriff, Skeleton Minion, Mounted Billy, and Dragon are absent from this imported asset folder. The original Sheriff export was found separately in Downloads during the earlier inventory.
- **Source control** — the opened folder has no Git repository or remote configured at this checkpoint. Link it to the intended project repository when that remote is resolved.
- **Next step** — Kiro's `orb-duel` requirements and the first selected-card-to-character interaction.

Source fingerprints at the handoff boundary use SHA-256.

| File | SHA-256 |
| --- | --- |
| `scene.js` | `968f7dfa9516aa1727c82dd1df64f3dc6fda31d3e8ece9d54d153a13d252b5b3` |
| `rig.js` | `440ad955334f6bf65dd735c8fe308d9b8ee1f54ff59941313326003b8819eadb` |
| `runtime.js` | `78b3c1c05ae53961b026c9cb1168846a7ffc11b398fee0b1477f8bd6d0249015` |
| `verify.mjs` | `9a599cf3addb2790d22d0ae46cfac615309843ed4cc9712a832d9f2f28e56d91` |
| `package.json` | `cb5df21a50405618fd66fa0b15c9c8abc1f66032704134652a76d9de1930348d` |

Earlier bot simulations discussed in chat were exploratory design work performed outside Kiro. A versioned simulation harness, saved inputs, and reproduced results can support later balance claims. Report faction results alongside draws, starting-player results, boss appearances, and round-cap endings. Describe the bot strategy and deck version with each experiment.

## Turning the record into the submission

Select three or four completed entries that explain the largest changes to the player's experience. For each, describe the original problem, the Kiro feature used, the resulting behavior, and the linked proof. A genuine failure and its measured correction can supply that story. Passing checks are also recorded accurately.

Keep the contribution of the original Codex prototype, generated artwork, Tripo exports, incorporated third-party work, and subsequent Kiro changes clear. Record licenses and attribution where those materials enter the project.

The submission needs a functional project URL, public licensed GitHub source including the root `.kiro/` directory, a Kiro write-up, and a public YouTube demonstration. The rules recommend a video under three minutes and require project access through judging. These delivery items will be checked against the final build. [Submission rules](https://kiroween.devpost.com/rules)

Kiro references for the planned work are [steering](https://kiro.dev/docs/steering/), [specs](https://kiro.dev/docs/specs/feature-specs/requirements-first/), [hooks](https://kiro.dev/docs/hooks/types/), and [property-based testing](https://kiro.dev/docs/specs/correctness/).


### 2026-11-14 — Kiro delegation brief and character-factory adaptation

- **State** — preparation and GLB structure verified; Kiro implementation not started or confirmed.
- **Performed in** — Codex with local files and Desktop Commander. User reports Kiro Pro purchased.
- **Problem and player effect** — existing requirements contain contradictory base damage, tribute and phase rules; imported character GLBs contain no embedded skeletal animations.
- **Change** — [bounded engine task](kiro-task-01.md), [ordered queue](kiro-task-queue.md), [animation plan](character-animation-plan.md), and seven source reference documents with MIT license and pinned upstream commit. These are Codex-authored preparation, not Kiro accomplishments.
- **Verification** — nine reference/license files match their upstream Git blob hashes. [Asset inventory](evidence/asset-rig-inventory.json) reads the GLB JSON structure for eight optimized exports plus original Billy/Wizard/Sheriff files; all have zero skins and animation clips. Blender version command reports 5.2.0 LTS. Existing procedural deformation still supplies demo motion; appearance was not re-evaluated.
- **Delegation result** — IDE `kiro chat` dispatch exited successfully but no new agent execution or file change was observed. CLI `whoami` reports not logged in; a device-flow login ended with `InvalidGrantException`. The user must sign into the CLI with the Pro account before reliable automated task execution. No claim that the engine milestone ran or passed.
- **Next** — execute Task 01 in Kiro, review real engine checks, then move through the queue one bounded task at a time.

### 2026-11-15 — orb-duel requirements corrected and design drafted
- **State** — observed. Spec documents written and format-validated. No game code written and no tests run in this session. Design awaits user review.
- **Performed in** — Kiro IDE spec session (model selection: Auto; exact model not shown to the session).
- **Problem and player effect** — the first requirements had a 60-second timer, a spendable star resource, a rule forbidding full-board tribute, spend-before-confirm summons and asymmetric open-lane damage. The player-facing decisions (side, seed, hand display, card art, troop animation) were also open.
- **Kiro contribution** — requirements-first spec: rewrote `requirements.md` from `docs/kiro-task-01.md`, applied the user's six approved decisions, then generated `design.md` from the approved requirements and Fable's completed jobs A and B (read from their branches without editing them).
- **Decision or experiment** — reuse Fable's `createMatch`/`applyAction` and `scripts/audit-assets.mjs` rather than build a duplicate engine or auditor. The engine commits state first and the UI shows a lagging copy so orb loss lines up with the impact animation. Seeds 14, 27 and 47 are recorded as opening-hand concerns, with no silent reshuffle or mulligan.
- **Change** — `.kiro/specs/orb-duel/requirements.md` (timer and stars removed, atomic tribute, simultaneous clash, seed generation and reuse, no hand limit, asset gaps and card reference files), `.kiro/specs/orb-duel/design.md` (new).
- **Verification** — `validate_spec_format` reported no issues for both documents. Fable's results are quoted from their evidence notes (`fable-summon.md`: 7 of 7 tests; `fable-assets.md`: 12 of 12 tests) and were not re-run here. Browser, animation and balance checks are pending.
- **Evidence** — `.kiro/specs/orb-duel/requirements.md`, `.kiro/specs/orb-duel/design.md`; Fable branches `fable/summon-rules` (0df4363) and `fable/asset-audit` (ad24258).
- **Result and remaining work** — jobs C and D (turns, clash, spells, CPU) are still unbuilt. The approved card front file is unidentified, production card textures are not imported, and the Sheriff, Mounted Billy, Skeleton and Dragon models and animation do not exist. Next step is user review of the design, then `tasks.md`.

### 2026-11-15 — orb-duel playback corrections and task plan
- **State** — observed. Spec documents written and format-validated. No code was written and no tests were run in this session.
- **Performed in** — Kiro IDE spec session (Claude Opus 5.5).
- **Problem and player effect** — the design could skip attacks from troops defeated in the same clash, let old animation or CPU callbacks reach a restarted match, and give the engine responsibility for seed generation. It also described a planned engine contract that has since been built.
- **Kiro contribution** — targeted edits to `requirements.md` (1.9–1.13 seed ownership, 5.3 and 5.6–5.8 clash presentation, new Requirement 12 on playback, input lock and cancellation, 9.2 CPU view, 11.4 restart seed) and `design.md` (Fable's actual job C and D API and event order, Player_View-only presentation, clash grouping, epoch cancellation). Generated `tasks.md` with 10 ordered tasks tagged Ready or Awaiting, plus a separate list of asset and animation dependencies.
- **Decision or experiment** — the controller keeps a match epoch, because the stale-revision check alone cannot reject an old action after a same-seed restart (both matches start at revision 0). Selection derives options from `legalActions` instead of re-implementing rules. Defeated troops finish their clash attack before removal.
- **Change** — `.kiro/specs/orb-duel/requirements.md`, `.kiro/specs/orb-duel/design.md`, `.kiro/specs/orb-duel/tasks.md` (new).
- **Verification** — `validate_spec_format` reported no issues for all three documents. Fable's API and results were read from `docs/evidence/fable-match-engine.md` (d01b513) and `fable-cpu-playtests.md` (c1ea873) and were not re-run. Browser and animation checks are pending.
- **Evidence** — the three spec documents; main checkout `codex/repo-layout` at b3c77bd, which includes Fable jobs A, C and D.
- **Result and remaining work** — the first Ready task is the selection state machine. Entry-point edits, the build embed for the card back and the `scene.js` export need coordinator sign-off and sequencing with Fable job F. The approved card front file is still unnamed, and the four new troops still need models and animation.

### 2026-11-15 — Playable orb-duel card match
- **State** — verified by 41 Node match tests and one scripted Chrome run of seed 0 (8 of 8 steps observed, 0 console errors). No person has played it yet.
- **Performed in** — Kiro IDE, requirements-first spec `orb-duel`. Tasks 1–10 ran as `spec-task-execution` sub-agents dispatched from a Claude Opus 5.5 session; the sub-agents' model was not shown. Fable's engine and CPU (jobs A, C and D, integrated at `b3c77bd`) were reused without changes.
- **Problem and player effect** — the engine could only play matches in Node. A player can now see the deck and a four-card hand, pick a card, choose tribute and a tile, and watch the troop appear with its health orbs. The player then ends the phase, watches the CPU Wizard respond and the clash resolve, sees Victory, Defeat or Draw, and can restart or open the original attack demo.
- **Kiro contribution** — spec task execution for tasks 1–10 of [tasks.md](../.kiro/specs/orb-duel/tasks.md). Property results for tasks 1.2 and 3.2–3.4 are recorded as passed in `tasks.meta.json`. Properties 5 and 6 (tasks 4.2 and 4.3) passed in the same suite but were not recorded through the property status tool. The always-on `build-evidence` steering file set the format of this entry and the evidence notes. No agent hook or MCP tool was used; the browser driver is a Node script.
- **Decision or experiment** — every timer, animation and CPU request carries a match epoch, because a restart with the same seed returns to revision 0, where the engine's stale check could accept an old action. Selection offers only options from `legalActions`. The presenter applies the engine's `before` and `after` values at each impact and computes no damage. Defeated troops leave only after every attack in their clash has finished.
- **Change**
  - New: `src/match/` (selection, scheduler, presenter, controller), `src/ui/card-model.js`, `src/ui/cards.js`, `src/render/match-board.js`, `orbs.js` and `cues.js`, `scripts/browser-match-check.mjs`, six files in `tests/match/`, and `assets/cards/card-back.png`. The card back is the approved image scaled from 1060×1484 to 530×742 with no pixel edits.
  - Edited: `src/main.js` (card match by default, "Attack demo" button or `?mode=demo`), `src/ui/layout.html` (match overlay), `scripts/build.mjs` (card-back embed) and `src/render/scene.js` (exports and `createBoardScene` only; `createDuel` is unchanged).
  - Spec closeout: the CPU handoff and browser-testing line in `design.md`, Requirement 12 in Milestone 3, and the dates of the two previous Kiro entries corrected from 2026-11-14 to 2026-11-15, because both describe Fable commits made on 2026-11-15.
- **Verification** — `node --test "tests/match/*.test.js"` passed 41 of 41 and `npm run check` passed at 12:49 PM PST. `tests/game` passed 38 of 38 and `tests/assets` 15 of 15 at 12:14 PM PST. `npm run build` at 7:43 PM PST produced the page the 7:44 PM PST Chrome run loaded, and the page's SHA-256 matched again at 8:30 PM PST. Nothing was rerun at closeout, because no build input changed after the build and no Node test or `npm run check` reads the files changed after 12:49 PM PST.
- **Evidence** — [browser run](evidence/kiro-match-browser.md), [run record](evidence/kiro-match-ui/browser-run.json), [Sheriff summoned](evidence/kiro-match-ui/summon-sheriff.png), [Defeat panel](evidence/kiro-match-ui/result.png), [Node checks](evidence/kiro-match-ui.md). Commit: the local commit on `codex/repo-layout` that adds this entry.
- **Result and remaining work** — one Cowboy-versus-CPU match plays from opening hand to result in Chrome on the test machine.
  - Unverified in the browser: Singularity relocation, full-board and cancelled tribute, Victory and Draw panels, a generated seed, and on-screen clash timing. The browser evidence lists each one.
  - Assets: the approved card front file (OQ-A), production card textures, and models, rigs and animation for Sheriff, Mounted Billy, Skeleton and Dragon, which are labelled temporary tokens for now. Billy and Wizard cue polish is also pending.
  - Balance, as a separate task: in Fable's CPU-vs-CPU run over seeds 0–999 (rules `orb-duel-draft-1`), opening hands without a free summon lost 62 of 63, and the side that started round 1 won 583 to 314 ([CPU playtests](evidence/fable-cpu-playtests.md)).
  - Several closing sub-agent runs were cancelled or failed with a network error. The last one rebuilt the page, reran the browser script and downscaled the screenshots before it stopped. This closeout used those outputs after checking the page hash.

### 2026-11-15 — Card-to-summon interaction in the Orb Duel UI
- **Work** — Kiro CLI added stack depth to the approved deck back and lift to the hand cards. A confirmed troop card flies to its chosen lane indicator over 520 ms. The flight clears with the match and respects reduced motion.
- **Integration** — Codex connected the flight to the controller’s accepted action result before committing. The UI reads the pending lane from the card model.
- **Verification** — Build and browser play-through were deferred at the user's request.
- **Assets** — Card fronts use the existing temporary text cards. OQ-A tracks identification of the approved front art.

### 2026-11-15 — Cowboy deck-to-hand draw
- **Work** — Kiro CLI connected the match's existing Cowboy draw event to a short card flight. The horseshoe back turns into the face and settles in the new hand position during the draw pause. The initial deal remains immediate and the Wizard hand stays private.
- **Integration** — Codex used the appended hand position for duplicate card names, aligned the origin with the top deck card, and added a duplicate-draw regression.
- **Verification** — Syntax check and all 19 targeted presenter, controller and card-model tests passed after integration. Browser verification is pending.

## 2026-11-15 — 3D summon landing review (Kiro CLI, custom agent)

- **Problem:** Review of the summon landing target found two gaps. `summonTarget` in `src/main.js` did not handle a canvas with zero width or height, and only checked `p.x` for a finite value. `src/ui/cards.js` used `??`, so a malformed rect would not fall back to the lane button.
- **Change (Kiro CLI):** `summonTarget` now returns `null` for zero bounds or a non-finite projected x, y or z. It still projects through `board.camera`, which `frame()` renders in match mode. `summonGeometry` uses the board rect only when its fields are finite and its size is positive. Otherwise it uses the native lane button rect. The accepted-action flow is unchanged.
- **Verification:** The SessionStart hook ran the focused tests at 2026-11-15 22:30 PST (06:30Z). Result: 19 tests, 19 pass, 0 fail, including the orb-duel Presenter fidelity, clash completeness, cancellation and CPU information properties over seeds 0-99. The hook ran before this edit and covers the Presenter and card model. It does not exercise `summonTarget` or `summonGeometry`. I did not re-run the tests.
- **Pending:** The coordinator's Chrome run and build. These will check the landing position on screen and the zero-bounds fallback.

### 2026-11-15 — Combined demo verification

Codex integrated Fable’s final Wizard and Sheriff with Kiro’s presentation work and verified build `b6d0f5f` in Chrome. All eight replay steps passed with zero console errors. The summoned card landed 0.082 CSS pixels from the selected tile center. The 19-test custom-agent hook output and final browser receipt are retained in `docs/evidence/`. See [combined demo evidence](evidence/combined-demo.md).
