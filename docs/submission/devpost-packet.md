# Kiroween submission packet
Prepared November 16, 2026. Draft, not a submitted form. Reconcile final UI and demonstration before publishing.

## Project
Cowboys vs. Wizards

## Pitch
A haunted-Western card duel in your browser. Place Cowboy troops in three 3D lanes, sacrifice weaker troops for stronger ones, and watch both sides attack at once, so you can see why each life orb was lost.

## Who it is for
People who play strategy and card games in a browser: no install, a match that fits a short break, and decisions that matter more than reflexes.

## The player problem (a hypothesis)
We think these players often cannot see why a round went the way it did. The result shows up as changed numbers or a log line, and a lane choice can feel like bookkeeping. We have not tested this with players. No human playtest has been run, and our automated checks say nothing about demand or enjoyment. The [first-time playtest protocol](judge-demo-script.md#part-2-first-time-human-playtest-protocol) is ready and unrun.

## What you can verify
We do not claim a new genre. Lane-based card duels exist. Three things can be checked directly:

1. **Positional three-lane decisions.** Each side has three lanes. A troop fights the troop opposite it, and an unblocked troop attacks the enemy Base. Tribute summons and lane-moving spells change which matchups happen.
2. **Visible simultaneous outcomes.** Opposing troops attack together. In the seed 60 route, Mounted Billy is defeated and still takes the Dragon from five orbs to two. The arena shows both results.
3. **Reproducible artifact evidence.** Seeded matches replay the same route. A saved Kiro Workflow records the hash of the HTML it tested, and the reviewer returns `stale` when a receipt is paired with a different build.

## Inspiration and behavior
We wanted card decisions to happen visibly in the arena: sacrifice troops for stronger allies, alter lanes with spells, and see both simultaneous attacks even when a troop falls. The current browser release includes a user-approved illustrated title, instructions, saved settings, local achievements, a twelve-card Cowboy deck builder and pause/resume. The reviewed closeout adds larger readable card art (187px desktop, 162px phone in Chrome checks), saved decks and keyboard controls. The closeout was published in PR #15; served HTML matches the reviewed build.

## Implementation and Kiro
Plain JavaScript rules stay separate from Three.js presentation and Rapier scene behavior. Fable wrote the engine and CPU. Kiro wrote the presentation, specification and tooling: its Requirements-First spec guided match presentation and seeded checks. A custom agent, hooks, saved Workflows and a Review Power/MCP tie results to actual built HTML. Codex coordinated integration and independent checks. The user approved the art and motion; visuals come from original Tripo exports and approved sourced motion.

The saved Kiro Workflow passed 157 tests and 12 scripted browser checks. That run is historical and belongs to frozen commit `e9aeb06`; the runtime has not changed since. It was not re-run for this document.

## Challenges and lessons
A convincing animation can misrepresent simultaneous attacks. Passing rules tests do not catch every visible defect: Crew found developer labels that were removed. Generated mesh rigging also has limits, so original exports remain untouched and new motion requires approved sources. Historical test counts and timing improvements retain their original commit/date.

## Evidence
- Playable seeded matches and CPU public-information boundary.
- Tracked specifications and actual hook/Workflow receipts.
- Matching-build pass and stale-build rejection.
- Separate Night Watch Crew app for exact-commit comparison and issue drafts. As of this draft the backend fix is at 0.1.2, the installed app is blocked, and the latest Crew review attempt timed out. Do not describe Crew as currently working until its own evidence note says so.
- Functional illustrated menu/player options.
- Custom-deck regression: 128 distinct decks replayed twice; 2,199 first-pass actions; 1,419 CPU/public-view checks. Correctness coverage, not a human balance estimate.

## Demo video
[Narration and shot list](judge-demo-script.md): 2:40, 324 spoken words, timed segments, each shot marked EXISTS or NEEDED. Narration and Kiro UI footage are not recorded yet.

## URLs
- Game: https://alejandro-publius.github.io/cowboys-vs-wizards/
- Source: https://github.com/alejandro-publius/cowboys-vs-wizards
- Kiro: https://github.com/alejandro-publius/cowboys-vs-wizards/blob/main/docs/kiro-brag-sheet.md
- Crew app: https://github.com/alejandro-publius/cowboys-vs-wizards-night-watch
- Current preview: [58.73-second menu and gameplay video](../evidence/gameplay-demo/menu-and-gameplay-preview.mp4); source versions are recorded in its receipt. No narration or Workflow UI footage is claimed.
- Gameplay source: [43.67-second real gameplay recording](../evidence/gameplay-demo/seed60-599450a.mp4), captured at the prior release `599450a`. It does not show the new deck page.
- Public YouTube: PENDING. Do not submit a placeholder.
- Third-party blog: PENDING. Review build-story.md.

## Category and bonus checks
Costume Contest fits the current haunted-interface direction; confirm the form's selected category. Crew bonus has a separate app repository. Student eligibility requires current attendance and actual teammate details; school affiliation alone is insufficient. Blog bonus requires a public third-party post mentioning Kiroween 2026. Social bonus is optional; no social post has been sent by this task.
Official rules: https://kiroween.devpost.com/rules
Deadline: December 4, 2026 at 2 p.m. Pacific.

## First-time-player protocol
**Not run. Zero human sessions.** The full protocol is in [judge-demo-script.md](judge-demo-script.md#part-2-first-time-human-playtest-protocol): five tasks (start a match, place a troop, explain a lost orb, make a tribute summon, change and save a deck), definitions of independent, assisted and fail, the exact observations to record, and a blank results table. An agent browser review is not a human observation. Decide opening policy only after real play evidence; preserve current default meanwhile.

## Pending before final submission
Narration recording; actual Kiro Workflow UI and reviewer footage; first-time human playtest; final UI verification/user visual review; supported-device checks; real public YouTube upload; third-party blog publication if entering that bonus; current enrollment/team facts; final category; actual submission confirmation.
