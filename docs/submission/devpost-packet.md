# Kiroween submission packet
Prepared November 16, 2026. Draft, not a submitted form. Reconcile final UI and demonstration before publishing.

## Project
Cowboys vs. Wizards

## Pitch
A haunted-Western card duel where gunslingers, skeletons and dragons clash across three 3D lanes. Build a Cowboy deck, sacrifice troops for stronger summons, and watch the Wizard CPU answer through attacks and life orbs.

## Inspiration and behavior
We wanted card decisions to happen visibly in the arena: sacrifice troops for stronger allies, alter lanes with spells, and see both simultaneous attacks even when a troop falls. The current browser release includes a user-approved illustrated title, instructions, saved settings, local achievements, a twelve-card Cowboy deck builder and pause/resume. A more readable deck layout is being implemented separately; do not call it shipped until integrated.

## Implementation and Kiro
Plain JavaScript rules stay separate from Three.js presentation and Rapier scene behavior. Fable wrote the engine and CPU. Kiro's Requirements-First spec guided match presentation and seeded checks. A custom agent, hooks, saved Workflows and a Review Power/MCP tie results to actual built HTML. Codex coordinated integration and independent checks. User-approved art, original Tripo exports and approved sourced motion guide the visuals.

## Challenges and lessons
A convincing animation can misrepresent simultaneous attacks. Passing rules tests do not catch every visible defect: Crew found developer labels that were removed. Generated mesh rigging also has limits, so original exports remain untouched and new motion requires approved sources. Historical test counts and timing improvements retain their original commit/date.

## Evidence
- Playable seeded matches and CPU public-information boundary.
- Tracked specifications and actual hook/Workflow receipts.
- Matching-build pass and stale-build rejection.
- Separate Night Watch Crew app for exact-commit comparison and issue drafts.
- Functional illustrated menu/player options.
- Custom-deck regression: 128 distinct decks replayed twice; 2,199 first-pass actions; 1,419 CPU/public-view checks. Correctness coverage, not a human balance estimate.

## URLs
- Game: https://alejandro-publius.github.io/cowboys-vs-wizards/
- Source: https://github.com/alejandro-publius/cowboys-vs-wizards
- Kiro: https://github.com/alejandro-publius/cowboys-vs-wizards/blob/main/docs/kiro-brag-sheet.md
- Crew app: https://github.com/alejandro-publius/cowboys-vs-wizards-night-watch
- Public YouTube: PENDING. Do not submit a placeholder.
- Third-party blog: PENDING. Review build-story.md.

## Category and bonus checks
Costume Contest fits the current haunted-interface direction; confirm the form's selected category. Crew bonus has a separate app repository. Student eligibility requires current attendance and actual teammate details; school affiliation alone is insufficient. Blog bonus requires a public third-party post mentioning Kiroween 2026. Social bonus is optional; no social post has been sent by this task.
Official rules: https://kiroween.devpost.com/rules
Deadline:December 4, 2026 at 2 p.m. Pacific.

## First-time-player protocol
Give a new player the public game without coaching. Ask them to start, summon one troop, explain a lost orb, return to the menu and change their deck. Record success, hesitation and their own words. An agent browser review is not a human observation. Decide opening policy only after real play evidence; preserve current default meanwhile.

## Pending before final submission
Final UI verification/user visual review; supported-device checks; real public YouTube upload; third-party blog publication if entering that bonus; current enrollment/team facts; final category; actual submission confirmation.
