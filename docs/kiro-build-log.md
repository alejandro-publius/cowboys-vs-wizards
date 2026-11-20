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
- **Evidence** — [starting board render](../assets/media/board.jpg), [recorded exchange](../assets/media/replay.mp4), [scene source](../src/render/scene.js), [browser entry point](../src/main.js), and [verification code](../scripts/verify-scene.mjs).
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

### 2026-11-15 — Reviewed card fronts and summon timing

Fable rendered the six approved illustrations in their reviewed gold frames from the approval sheet. The art commit is `fbbf739` and its [texture note](evidence/fable-card-front-textures.md) records the source, sizes and legibility correction.

Kiro CLI's `duel-presenter` agent wired the eight full faces into the hand, draw and summon flights, and the public card catalog (`99a4682`). A follow-up used the renderer's existing summon impact cue to time the card flight after any tributes leave (`720a2c2`). The SessionStart hook passed 19 focused tests. Codex combined both branches, kept the easing inside the flight segments, and added the browser checks for the catalog and landing.

Lucca Cerf's [BIPX cast code](https://github.com/luccacerfz/BIPX/blob/main/src/assets/hero-skill-motion.js) links one accepted event to one gesture with an explicit impact time. Its [browser VFX check](https://github.com/luccacerfz/BIPX/blob/main/tools/verify-vfx.mjs) exercises actual casts and impacts. The summon change adapts that timing idea to our existing renderer.

On `720a2c2`, 51 match tests passed and Chrome completed all eight gameplay steps with zero console errors. All eight catalog textures decoded and the viewer flipped to the original back. The illustrated Sheriff card reached the selected tile on the 350 ms landing cue, within 0.33 CSS pixels of its center. The replay also completed a Billy tribute summon, restarted during playback, and switched to and from the exchange demo.

### 2026-11-16 — Faster startup, replay review and Mounted Billy

Kiro CLI’s `duel-presenter` agent updated the match boot, replay tools,
presentation steering and Mounted Billy integration in isolated worktrees.
Kiro ran both steps of the saved replay Workflow. The local review Power loaded
and its workspace MCP validated the matching build and rejected a stale one.
Codex integrated the changes, optimized the user’s Tripo export, and ran the
browser and performance comparisons. The first playable frame reached 686 ms
median versus 1,109 ms on the same Mac before the mounted import. The optional
static web build passed the same eight seeded browser steps as the standalone
build. [Replay evidence](evidence/kiro-overnight.md) · [Kiro write-up](kiro-brag-sheet.md)

### 2026-11-16 — Summoning Circle and Crew balance trial

Kiro CLI 3.3.0 ran all four steps for the isolated Skeleton health proposal and for `review existing`. The file save regenerated the catalog automatically. The authored proposal passed three registration tests. The review-only run left a clean Git checkout.

Codex confirmed that the baseline matches every runtime card and both deck orders, fixed the per-command exit receipts, and verified the clean static release. It passed 107 Node tests, eight opening replay checks and four showdown checks. Kiro’s MCP confirmed the opening receipt and built HTML matched.

Kiro Crew 0.12.2 ran the baseline and the one-orb increase over the same 1,000 seeds each. Wizard wins rose from 472 to 663. The release candidate retains the three-orb baseline. [Card pipeline evidence](evidence/kiro-card-pipeline.md) · [Static preflight](evidence/kiro-submission-preflight.md)

### 2026-11-16 — Real Skeleton model (Kiro CLI session, America/Los_Angeles)

The published build showed a purple pawn for the Skeleton. The user's Tripo export (1,927,403 triangles, three 4096² textures, 67.7 MB) was decimated to 59,999 triangles with 1024² textures in headless Blender 5.2 (one-off scripts, not committed). `assets/models/skeleton.glb` is 3,067,712 bytes (sha256 `e0ecd861…`), static, no skin. It is fitted like the Dragon and Mounted Billy: 1.2 high, feet on the Wizard-side tile, front toward +Z (the Cowboys), three orbs. A missing model falls back to the existing token.

Kiro ran 92 focused Node tests covering feet, height, facing, orbs and the fallback. The published Skeleton build passed all 107 Node tests. Both built targets passed the eight seed-0 Chrome steps with zero console errors. Local evidence (ignored): `.artifacts/kiro/skeleton/`. The seed-0 screenshot shows the Skeleton in lane 1 with three orbs. Animation of the Skeleton remains the shared summon, hit and defeat cues only.

### 2026-11-16 — Dragon and Mounted Billy attack clips

Kiro used Blender 5.2 to attach armatures and authored a short attack for each character. One pass on Mounted Billy stretched the connected arm and reins. A second Kiro pass used a smaller recoil and checked the same camera views again. The attack tests cover each troop’s independent bones, the contact pose, return to rest, reset during playback and the fallback for a missing clip.

Codex integrated one GLB per troop and matched each exported contact pose to the engine’s existing impact. The reference inputs, measurements, published Skeleton check and final verification instructions are in the [character evidence](evidence/kiro-character-assets.md).

### 2026-11-16 — Showdown replay in the Workflow and Power (Kiro CLI session, America/Los_Angeles, 12:42 PST)

Problem: release 2550c3f validated seed 60 by hand, but `.kiro/workflows/orb-duel-replay.workflow.json` and `inspect_duel_replay` covered only the seed-0 route. Change: the Workflow gained a `verify-showdown` step between `verify-duel` and `report`, handing off through `{{previous.output}}`, and the report now covers both runs and compares the two build hashes. The MCP tool gained a fixed `showcase` target (`.artifacts/kiro/showcase/browser-run.json`) that requires seed 60, four observed steps, a hash equal to the built standalone page, and a hash equal to the seed-0 receipt. `standalone` and `web` are unchanged. `SKILL.md` documents the target.

Verification (observed, standalone build sha256 `b4e913df…`): `node scripts/verify-duel.mjs --browser` exited 0 with 112 of 112 Node tests passing and 8 of 8 Chrome steps. `node scripts/browser-match-check.mjs --showcase --summary --out-dir .artifacts/kiro/showcase` exited 0 with 4 of 4 steps, seed 60 and 0 console errors. The real MCP server returned `pass` for the standalone and showcase targets, with `sameBuild: true`; `web` returned `absent` because no web receipt exists, and an unknown target or extra input returned protocol errors. Negatives on temporary copies returned `fail` for seed 0 and for three steps, and `stale` for a changed showcase hash, a changed page and a differing seed-0 receipt hash. The real receipts were not modified.

Not verified: the saved Workflow itself was not invoked. Only the two underlying commands and the MCP server were run from the CLI, so a Workflow run remains pending. Logs (ignored): `.artifacts/kiro/showdown-workflow/`.

## November 16, Pacific — guide correction and live build identity

Kiro CLI 3.4.0 V3 completed #35 in two passes (`48ecea9`, `32ba790`). The first pass left idle tips in a hidden panel; the correction makes the existing transparent prompt visible without showing idle selection buttons. Actual Chrome checks compare guide-off to the original build at twelve steps and cover stop/restart and phone-size layout. The corrected worker branch passed 193 tests and model checks; coordinator integration passed 16 focused tests. [Guide evidence](evidence/kiro-guided-first-match.md). No human acceptance claimed.

Kiro's #54 commit `2966298` adds build.json plus independent live commit/hash verification. PR #55 merged as `4c0723d`; its real Pages build, deployment and verify-live jobs passed. [Receipt](evidence/kiro-build-identity.md). Session credit observations for ten earlier jobs are now published as exact session values with source hashes, never an account total. [Usage](evidence/kiro-session-usage-20261116.md).

The next substantial Kiro task is #56, boundary generation, failure reduction and requirement mapping. It is dispatched, not completed. User asks for alternate-prompt check-ins instead of continuous worker polling.

### 2026-11-19 — Issue 143 slice 1 integration (Kiro, America/Los_Angeles, 15:23 PST)

- **State** — verified locally on the combined branch. Not pushed or merged.
- **Performed in** — Kiro agent session (Claude Opus 5.5) as the integration worker. The five worker commits came from Kiro CLI 3.5.0 workers.
- **Change** — cherry-picked the screen (`9cbc086`), pilot kit (`122421a`), 3D starter kit (`030d129`) and save-migration experiment (`d2efc98`) onto the engine commit `9686810`. Removed the screen's temporary adapter `src/match/showdown-engine.js` and its stand-in presenter. The screen and session now import `src/game/showdown/{rules,cards,contract,presenter}.js` directly, and the screen uses the canonical `typeOf` and `has`.
- **Debugging result** — the first Chrome run on the combined build timed out after the first summon. `events.map(presentEvent)` passed the array index as the canonical `presenters` argument, so every event threw "No presenter". The fix calls `presentEvent(event)`. The browser check now asserts the canonical wording ("The Cowboys' … arrived.", "the Wizards' Base").
- **Verification** — `npm test` 512 of 512 and both GLB checks. Showdown browser check 12 of 12 on the offline and web builds (seed 0) and on seed 7. Pilot smoke check 16 of 16 on the baseline playtest ZIP. Compat experiment 11 of 11. Links 0 broken. [Receipts](evidence/kiro-143-integration/README.md) · [Screen evidence](evidence/kiro-143-showdown-graybox.md)
- **Remaining** — first-time human playtests (PLAYTEST.md) and the first Tripo models are still pending. The pilot packer refuses to pack on this branch because `prototypes/showdown/` now re-exports the moved engine. The 735cb09 playtest ZIP is kept as the baseline.

### 2026-11-19 — Issue 143 slice 1 on the PR 144 base (Kiro CLI, America/Los_Angeles, 20:38 PST)

- **State**: verified locally on branch `kiro/144-integrate`. Not pushed, commented on or merged.
- **Performed in**: a Kiro CLI integration worker session (Claude Opus 5.5).
- **Change**: on PR 144 head `6819557`, cherry-picked only the engine move `9686810`, the graybox screen `54b78ab` and the integration fixes `40d1b8c`, with no conflicts. The pilot kit, 3D starter kit and save-migration experiment named in the entry above are not on this branch. No bot, rules, card text or test-body changes. No slice 2 work.
- **Verification**: `npm test` passed 516 of 516, made up of PR 144's 507 tests (same names) and 9 new presenter/session tests, plus both GLB checks. The Showdown browser check passed 12 of 12 on the offline and web builds (seed 0, fresh Chrome profile): Play opens Boot Hill and is won by clicks, and `?mode=lanes` and `?mode=match` still load the lane duel. The PR 144 prototype browser checks passed for access, hotseat, savecode, bo3 and campaign. The onboarding check failed 2 layout checks here, and the same 2 fail on the untouched `6819557` base. That layout belongs to another worker. Rules static diff is in the receipt. [Receipts](evidence/kiro-144-slice1-integration/README.md)
- **Remaining**: prototype onboarding layout (other worker), Fable decision on the issue 143 / PR 144 bot change, and human playtests.

### 2026-11-19 — Final local integration with the onboarding layout fix (Kiro CLI, America/Los_Angeles, 20:51 PST)

- **State**: verified locally on branch `kiro/144-integrate`, code at `6f2245a`. Not pushed, commented on or merged. Slice 2 not started.
- **Performed in**: a Kiro CLI final-integration worker session (Claude Opus 5.5). The layout commit `f802687` was written by the Kiro CLI onboarding worker on `kiro/144-onboarding`.
- **Change**: cherry-picked `f802687` (`prototypes/showdown/style.css` only, no copy, DOM, script or test change) with no conflicts. No rules, bot, card text or test changes.
- **Verification**: `npm test` 516 of 516 plus both GLB checks. The offline and web graybox builds are byte-identical and unchanged. All six PR 144 Chrome checks pass on the combined `dist/showdown.html` with their original assertions, including onboarding (31 of 31), which failed 2 checks before this fix. The graybox Boot Hill and lane fallback check passed 12 of 12 on both builds. The rules files are identical to `735cb09`, and the bot trace and Scout oracle hashes match the 735cb09 prototype. [Receipts](evidence/kiro-144-final-integration/README.md)
- **Remaining**: the Fable decision on the issue 143 / PR 144 Scout bot change, and human playtests. Short phones (375×667 and smaller) still need one scroll to reach the first card, per the onboarding worker's measurements. Those measurements were not re-run here.

### 2026-11-19 — Issue 143 slice 2 graywave integration (Kiro CLI, America/Los_Angeles, 21:34 PST)

- **State**: verified locally on `kiro/graywave-integrate` (code `6ade89e`, base `github/main` `24dd11c`). Published as a topic branch with a PR labelled review-needed; not merged.
- **Performed in**: a Kiro CLI integration worker session (Claude Opus 5.5). Merged the Kiro CLI worker branches saves, camp, accept, catalog, report and cues, each once. The saves commit appears once, as the tree-identical `96b75bc`.
- **Problem**: slice 2 done-when 2. A lane-captured card was not visible or owned in the Camp. The accept worker's strict Run B failed at "collection names Captured Dragon".
- **Change**:
  - `src/game/showdown/inherited.js` keeps lane captures in a separate grow-only record, `cvw-showdown-inherited-v1`.
  - The Camp lists each owned card once, by name, with lane cards marked.
  - Progress, `migrate()`, the Trail, the deck, bounties, rewards and Scout are unchanged.
  - Run B now also requires the persisted record.
  - The cue check enters Boot Hill through the Camp.
- **Verification**:
  - `npm test` 556 of 556.
  - Card-spec check and catalog CSV round trip unchanged.
  - The six PR 144 prototype Chrome suites pass.
  - On the offline and web builds (byte-identical): graybox Showdown check 23 of 23 and Trail acceptance 16 of 16.
  - Cue check 5 of 5.
  - Compat harness: A2–A5 pass on all cases. A1 fails on 7 of 14 because the progress object is deliberately unchanged.
  - [Receipts](evidence/kiro-143-slice2-integrate/README.md)
- **Remaining**:
  - Fable F1/F2: may a lane capture count in Showdown progress before the Trail ends, and what does that bounty pay?
  - F3–F5 are also open.
  - Save-code portability of inherited cards is open.
  - Wording approval is pending.
  - Human playtests are pending.
  - The PR 147 brief orders the Scout fix `7e8e6eb` before slice 2. It is not on this branch.
  - The slice 2 Requirements-First spec has not been written.
  - `github/main` `a9aa828` (PRs 145–147) was merged in; the change was docs-only. `npm test` passed again, and the built pages kept the same hashes.

### 2026-11-19 — Judge page refresh for PR 152 (Kiro IDE, America/Los_Angeles, 21:54 PST)

- **Problem**: the judge page in PR 152 described `main` at `a9aa828` and listed #149, #150, #151 and #154 in a status table that went stale once #150, #151 and #153 merged.
- **Performed in**: a Kiro IDE agent session (Claude Opus 5.5) using the `gh` CLI for PR and CI states.
- **Change**: [docs/submission/kiro-brag-sheet.md](submission/kiro-brag-sheet.md) now describes `main` at `6c14686`, adds #150 (Scout before/after), #151 (Night Watch Showdown, balance steady) and #153 (profile) with commit-pinned evidence and CI links, and replaces the status table with pinned links for #149 (merged into the candidate branch only), #148 and #154. Demo steps unchanged.
- **Verification**: every link on the page resolved (local paths, anchors, and remote URLs with HTTP 200). The demo's four actions were replayed through `src/match/showdown-session.js` at `6c14686` in Node and gave the same events; no browser run on the new build.
- **Not verified here**: a scheduled Crew run of Night Watch on Showdown, the #148 code, and any human play.

### 2026-11-19 — Hosted /graybox/ loads Showdown without the lane duel (Kiro CLI, America/Los_Angeles, 22:02 PST)

- **State**: verified locally on branch `kiro/graywave-hosted`, rebased onto `main` `ff84403`. PR opened for review, not merged.
- **Performed in**: a Kiro CLI 3.5.0 worker session (Claude Opus 5.5).
- **Change**: `scripts/build-graybox.mjs --hosted` writes `dist/web/graybox/` with the lane duel (`src/graybox.js`) as a separate hashed file that `src/app.js`'s existing dynamic import fetches only in lane modes. The Pages workflow uses it instead of copying the offline file. The offline and `--web` outputs are byte-identical to `main`'s. No `src/` change.
- **Verification**: Showdown's first request fell from 174206 to 55327 raw bytes (58833 to 18496 gzip-9) on `main` `ff84403`. In real Chrome over local HTTP with cache disabled, the lane file was never requested during Boot Hill play, and `?mode=lanes`, `?mode=match` and the other lane modes fetched it and worked. The PR #148 head passed its own check (25 of 25) with this script. `npm test` passed 551 of 551. An ES-module splitting attempt was rejected because it showed the lane menu until the chunks arrived. [Evidence](evidence/graywave-hosted/README.md)
- **Remaining**: live Pages and WebKit checks.

### 2026-11-19 — PR 148 synced with main after #150, #154, #155, #156, #157 (Kiro CLI, America/Los_Angeles, 22:12–22:30 PST)

- **Performed in**: a Kiro CLI sync worker session (Claude Opus 5.5). Two ordinary merges into `kiro/graywave-integrate` `998645a`: `github/main` `ff84403` (merge `c1943de`), then `046dbae` (#157, merge `681ba51`), which landed during the session. No new features, rules, wording or balance changes.
- **Conflicts**: `src/ui/showdown-screen.js` click handler: kept #148's bonus-choice, Trail "again" and Camp lines, then appended #156's `pickStarted`/`refocus` lines (the resolution tested in the #156 worker report). This log: all entries kept.
- **Verification** on the tree of `681ba51` (offline graybox build, SHA-256 `602055b0…8269`): `npm test` 577 of 577; card-spec check exit 0; `browser-showdown-keyboard-check` 6 of 6; `browser-showdown-check` 23 of 23 (includes `?mode=lanes` and `?mode=match` fallback); `browser-showdown-trail-check` 16 of 16 (first two duels by clicks, rewards across reloads); cue check 5 of 5. The same `browser-showdown-check`, only changed to accept an http URL, passed 23 of 23 on the `--hosted` build served under `/cowboys-vs-wizards/graybox/`. A temporary, uncommitted extension of the keyboard check took the bonus choice by Enter (focus landed on Back to camp), reloaded, and won Raven Roost by keyboard only; the Camp after a reload showed both rewards. `src/game/showdown/rules.js`, `cards.js` and the bot are identical to main; `sim.mjs 1000` and `trail-sim.mjs` reproduce #150's "after" numbers. All bot-driven; no human play.
- **Fable F1/F2**: answered on PR 148 (F1 no, F2 no change; nothing from the lane game carries into Showdown progress). Not applied in this sync: the compat check A1 flip and the brief's second "done when" line, both of which Fable asked for in this PR.
- **Remaining**: those two Fable edits, human playtests (keyboard, screen reader, first-time). Fable says the wording stays a first draft and does not block the merge.

### 2026-11-19 — Keepsake ruling for PR 148 (Kiro CLI, America/Los_Angeles)

- **State**: committed on `kiro/graywave-keepsakes`, for PR 148's head `kiro/graywave-integrate`. Not merged.
- **Performed in**: a Kiro CLI keepsakes worker session (Claude Opus 5.5). The ruling is Fable's (PR 148 issuecomment-7031816529).
- **Problem**: compat A1 asked for lane captures in Showdown progress. Fable ruled the opposite: nothing from the lane game carries into Showdown progress; captures stay keepsakes in the separate record and the Camp; bounties pay every player.
- **Change**: `tests/game/showdown-keepsake-compat.test.js` imports the 14 A1–A5 cases from the readiness harness (`cli-progression` `d2efc98`) with A1 flipped and the real loader `createCampaign`. It adds checks for the bounty paying a veteran and a new player identically, partial hunts and Frontier cards, the reference prototype's Start over, and save codes. A `test.todo` marks the slice 3 graybox Start over. Brief slice 2 done-when 2 reworded as Fable approved. FH-R7, design, tasks, the test map and the evidence README updated; earlier text kept and labelled as history. No rule, reward or Scout change.
- **Verification**: the new file passes 18 tests with 1 todo. Mutation runs: dropping the keepsake join failed 9 tests, and adding captures to progress failed 11. `npm test` 574 pass, 0 fail, 1 todo before the main merge. Browser checks on final source are recorded in the PR 148 body.
- **Remaining**: the graybox Start over and save code (slice 3). Wording approval is Fable's. Human playtests are pending.

### 2026-11-19 — Issue 143 slice 3 Camp modes in the graybox (Kiro CLI, America/Los_Angeles, 23:05 PST)

- **State**: committed on `kiro/graywave-modes` for a PR against `main`. Not merged; the coordinator merges.
- **Performed in**: a Kiro CLI modes worker session (Claude Opus 5.5). Rulings: Fable, PR 148 issuecomment-7031816529 and issue 143 issuecomment-7031863563.
- **Problem**: slice 3 asks for rivals, bounties, packs, the deck builder with a side deck, best of three and two players in the game's Camp. The graybox had only the Trail, and no save code or Start over.
- **Change**: Camp, duel screen, a new builder and a pure best-of-three module are mounted on the canonical progress, session and save-code modules (`savecode.js` moved unchanged into `src/game/showdown/`). Two players draw from the active seat's view behind a curtain. Start over resets Showdown progress and the report only. No rule, reward, Scout, lane or 3D change.
- **Verification**: `npm test` 606/606. New `scripts/browser-showdown-modes-check.mjs` 13/13. Existing graybox checks and the six reference-page checks all pass. Receipts: [evidence note](evidence/showdown-modes-143.md).
- **Remaining**: the lane removal and the front page are separate slice 3 work. Wording is Fable's first draft. Human playtests are pending.

### 2026-11-20 — Issue 143 slice 3 release candidate (Kiro CLI, America/Los_Angeles, 23:30 PST Nov 19 onward)

- **State**: one combined branch `kiro/graywave-assemble` and one PR against `main`. Not merged; the coordinator merges after review. It supersedes PR #159 (Camp modes), which it contains.
- **Performed in**: a Kiro CLI coordinator session (Claude Opus 5.5), merging the modes, retire, topology and cleanup worker branches. Rulings: Fable, PR 148 issuecomment-7031816529 and issue 143 issuecomment-7031863563.
- **Problem**: slice 3's three parts (Camp modes, lane retirement, Showdown at the front page) were built on separate branches. The hosted build still had a lane-chunk path from #157, and the docs still said lane play was reachable from the graybox.
- **Change**: `--no-ff` merges keep the removal commit `4ebbb16` separate. `src/app.js` conflict resolved to Showdown only with the full Camp. The hosted build has no lane-chunk path, and the staged-tree check asserts none. README, AGENTS.md, CLAUDE.md, the router, Kiro steering, the duel-presenter description, the judge guide and Devpost URLs, the release line (its Nov 19 handoff replaced) and the brief's status now name `/`, `/graybox/`, `/showdown/` and `/3d/`.
- **Verification**: `npm test` 578/578; Showdown browser checks 22, 13, 16, 6 and 5 ok; staged Pages tree 8/8 with Chrome; `/3d/` menu and accessibility harnesses pass, replay 7 of 8 as on `main`. Receipts: [evidence note](evidence/showdown-slice3-release-candidate.md).
- **Remaining**: three first-time human playtests; Fable's wording approval; the live Pages deploy after merge.

### 2026-11-19 — Showdown resource audit and judge write-up refresh (Kiro CLI, America/Los_Angeles, 23:15 PST)

- **State**: committed on `kiro/graywave-showdown-audit` from `main` `4d52642`. Not merged.
- **Performed in**: a Kiro CLI audit session (Claude Opus 5.5), `sess_0e569e8c`.
- **Problem**: the judge write-up described `main` at `6c14686` and listed #148, #149 and #154 as outside `main`; all three merged and `4d52642` is live. The lane-era Devpost packet and build story read as current.
- **Change**: `docs/submission/kiro-brag-sheet.md` opens with replay commands and results on `4d52642`, adds #148/#149, #154, #156 and #157, fixes the Play → Camp → Boot Hill route, adds a five-criteria evidence/gap table and drops the unreceipted Kiro IDE fact-check claim. `devpost-packet.md` and `build-story.md` gain a lane-era banner; their text is unchanged. The 110-row resource classification for the workbook is outside the repo (`../graywave-showdown-register.json`).
- **Verification** on `4d52642`: `npm test` 595 pass, 0 fail; `showdown-properties` 16/16; offline build SHA-256 `602055b0…8269`; `browser-showdown-check` 23/23; `browser-showdown-trail-check` 16/16; `browser-showdown-keyboard-check` 6/6; `browser-showdown-cues-check` 5/5; Night Watch backend 12/12; `check-links` 0 broken. Live `build.json` names `4d52642`, and live `/graybox/` matches a local `--hosted` build byte for byte (`0f52d719…d3c4`).
- **Remaining**: human playtest, Showdown video, MCP/Power/Workflow and scheduled Night Watch on Showdown. Several register receipts (resume, parallel review, skill, usage ledger, startup measure) exist only on `kiro/video-swarm-integration`.

### 2026-11-20 — The Night Shift, integrated (Kiro CLI, America/Los_Angeles, 23:40 PST Nov 19 onward)

- **State**: one branch `kiro/graywave-night-join` from `main` `6b6caef` (after #161), PR [#163](https://github.com/alejandro-publius/cowboys-vs-wizards/pull/163) against `main`. Not merged; the coordinator merges.
- **Performed in**: a Kiro CLI coordinator session (Claude Opus 5.5). It merges the night-meter, night-review, night-ledger, showdown-mcp and showdown-audit worker branches.
- **Problem**: the meter, the reviewer and the Ledger were built on three branches with no connection between them. The meter's issues used the `kiro` label, which assigns Kiro Web. The Ledger showed an older run on `3dd47f1` and no review state.
- **Change**:
  - Camp conflict resolved to keep the slice 3 modes and the Ledger.
  - New Night Watch setting `autoIssues` (default `off`). With `lean`, a scheduled run gates each issue on `night-review.mjs check`.
  - Issues are labelled `night-watch`, never `kiro`, and text Kiro Web would read as a `/kiro` command is refused. They are deduplicated across open and closed issues, with at most two per run.
  - The Ledger reads one checked-in receipt and shows sealed reviews bound to that run.
  - The ledger browser check gained a review assertion and opt-in `--frames`.
  - Judge guide, release line and brag sheet aligned.
- **Verification**:
  - `npm test` 595/595; Night Watch 29/29; MCP plus properties 26/26.
  - Browser checks: showdown 22, ledger 12, modes 13, trail 16, keyboard 6, cues pass. Pages tree 4.
  - Real on-demand run on `e813ae8`: 2,000 games, first player 57.10%, Cowboys 59.40%.
  - Three staged scheduled runs (stub `gh`, illustrative band 45–55): created, exists, resolved.
  - Guard: Sheriff health 3→4 rejected, skew 9.40 → 13.60 pp tune and 11.05 → 15.30 pp holdout.
  - Receipts: [Night Shift evidence](evidence/night-shift.md).
- **Remaining**:
  - No clock-triggered Showdown run yet (Crew job `62736a74`) and no published issue.
  - No approved band (Fable/Alex). Ledger wording is Fable's.
  - Installed Power is still 1.1.0. Kiro Web is not used.

### 2026-11-19 — K-095 experiment turn: the seed-3 Dragon decision from Camp (Kiro CLI, America/Los_Angeles, 23:40 PST)

- **State**: one local commit on `kiro/graywave-overnight-turn`. Not merged or published.
- **Performed in**: a Kiro CLI overnight-turn worker session (Claude Opus 5.5). The decision data comes from the Dragon referee experiment (`kiro/graywave-dragon-referee` `d264466`, checkpoint `s3-C5-dragon-resting`).
- **Change**: `?turn=dragon-c5` and one optional Camp control open that Cowboy turn 5 on the normal Showdown screen. The 7 allowlisted Cowboy actions replay on the canonical engine from a fresh deal, each checked legal, with the unchanged bot playing the Wizard turns. Nothing is settled or logged. Restart and Retry replay the turn again. No rule, reward or Scout change. Wording is a draft for Fable.
- **Verification**: Node 6/6 (both choices reach the referee's T15 Cowboy and T10 Wizard results), `npm test` 584/584, new browser check 18/18, and the existing graybox browser checks all pass. Receipts: [evidence note](evidence/showdown-turn-k095.md).
- **Remaining**: native Crew browser handoff was blocked because Chrome remote debugging was not enabled. The Crew video capture, human takeover and human playtest are pending. Fable's review of the experiment and its wording is also pending.

### 2026-11-19 — Overnight QA: Camp return focus with a card offer open (Kiro agent session, America/Los_Angeles, 23:40 PST)

- **State**: committed locally on `kiro/graywave-overnight-qa` from `db80cd0`. Not merged.
- **Performed in**: a Kiro agent session using Claude Opus 5.5, with kiro-cli 3.5.0 installed. The bugfix spec was written by hand in Kiro's layout; no native bugfix-spec run took place.
- **Problem (observed, keyboard bot in headless Chrome)**: after a win with a card offer open, Enter on "Back to camp" focused the Camp's Main menu, and the next Enter left the Camp. Cause: `toCamp` fell back to a selector list, which matches in document order and does not skip disabled buttons.
- **Change**: `src/app.js` tries the claim area, then the first open duel, then any enabled button, in that order. A regression step was added to `scripts/browser-showdown-keyboard-check.mjs`, along with the spec `.kiro/specs/showdown-camp-return-focus/bugfix.md`. No rule, wording, reward or Scout change.
- **Verification**: red on base (step 4b fails, focus `#camp-home`). Green after the fix: keyboard 7/7, trail 16/16, modes 13/13, main graybox 22/22, `npm test` 578/0. [Evidence note](evidence/kiro-overnight-qa-camp-focus.md).
- **Remaining**: focus goes to `body` when a duel starts from the Camp and after the best-of-three swap. This is open as a presentation decision. Human playtests are pending.

### 2026-11-20 — Overnight check repair: turn-check Back and ledger Tab walk (Kiro CLI, America/Los_Angeles, 00:15 PST)

- **State**: one local commit on `kiro/graywave-overnight-check-repair` from `3d970ca`. Not merged or published.
- **Performed in**: a Kiro CLI session (Claude Opus 5.5) on Alex's Mac. Only the scripts were run, and no human played.
- **Problem**: two independent reviews found harness assumptions. (1) The turn check's Back step expected the title, but over HTTP Chrome's back/forward cache restores the Camp. (2) The ledger check blurred the Camp's new entry focus (Boot Hill) before tabbing, so the walk started after Boot Hill and failed in the combined release.
- **Change**: test scripts and evidence notes only. `scripts/browser-showdown-turn-check.mjs` takes a file or an HTTP(S) URL and checks the earlier root path, a closed duel, a usable title or Camp entry and an intact career. `scripts/browser-ledger-check.mjs` enters by keyboard, counts the entry focus, requires Boot Hill before the ledger summary and retraces with Shift+Tab. No app, rules or wording change.
- **Verification**: turn 18/18 on file (title) and 18/18 over HTTP at `/cowboys-vs-wizards/` with bfcache on (Camp restored). Ledger 12/12 on file and staged index, and it fails on two deliberately broken copies. Keyboard regression 7/7. [Evidence note](evidence/overnight-check-repair.md).
- **Remaining**: Fable and the coordinator still have to decide whether Back should restore the Camp or show the menu. Human playtests are pending.

### 2026-11-20 — K-008: the seed-70 Dragon decision from Camp (Kiro CLI, America/Los_Angeles, morning PST)

- **State**: one local commit on `kiro/showdown-sprint-paired` from `2fcf39b`. Not merged or published.
- **Performed in**: a Kiro CLI paired-sprint worker session (Claude Opus 5.5). Decision data from the rival search (`experiments/showdown-dragon-strategy/rival-cases.json`, case `hunt5-s70-C5-ranger`).
- **Change**: `?turn=dragon-c5-70` and a second Camp control `#camp-turn-dragon-70` open seed 70's Cowboy turn 5 on the normal Showdown screen. The prefix is the canonical policy's own 7 actions, replayed legally from a fresh deal. `dragon-c5` is unchanged. Neutral draft lesson text for Fable. No rule, reward, bounty or log change.
- **Verification**: Node turn tests 11/11 (state hash matches the fixture; A `w14`, B `c17`), `npm test` 606/606, turn browser check 29/29 on file and on staged HTTP, and the other graybox browser checks pass. [Evidence note](evidence/showdown-turn-k095.md#second-decision-seed-70-k-008-2026-11-20).
- **Remaining**: human playtests ("What made you choose that target?") are pending, as are the hosted link after a deploy and Fable's review of the wording.

## November 20 · Showdown Camp and native verification

Kiro CLI added per-duel build attribution to the Camp export. Separate workers exercised the rival’s one-shot Crew check-in, the staged Sheriff rejection and engine/UI steering controls. The release handoff links each receipt. The Devpost draft now leads with the two playable Dragon decisions and credits the earlier lane work separately.

Kiro added the Bone Fence Outrider study and the Guard targeting check. Source precedents were TradeWizard’s parallel comparison and Last Rites’ file-scoped accessibility audit. The private Dragon cut is based on the two-position build at 96adf60. The submission script describes the capture and preserves the earlier lane credits.
