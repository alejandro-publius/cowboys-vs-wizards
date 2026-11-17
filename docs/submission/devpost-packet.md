# Kiroween submission packet
Prepared November 16, 2026. Draft, not a submitted form. Reconcile final UI and demonstration before publishing.

## Project
Cowboys vs. Wizards

## Pitch
A haunted-Western card duel in your browser. Place Cowboy troops in three 3D lanes, sacrifice weaker troops for stronger ones, and watch both sides attack at once, so you can see why each life orb (one point of a troop's or Base's life) was lost.

## Who it is for
People who play strategy and card games in a browser: no install, a match that fits a short break, and decisions that matter more than reflexes.

## The player problem (a hypothesis)
We think these players often cannot see why a round went the way it did. The result shows up as changed numbers or a log line, and a lane choice can feel like bookkeeping. We have not tested this with players. No human playtest has been run, and our automated checks say nothing about demand or enjoyment. The [first-time playtest protocol](judge-demo-script.md#part-2-first-time-human-playtest-protocol) is ready and unrun.

## What you can verify
We do not claim a new genre. Lane-based card duels exist. Three things can be checked directly:

1. **Positional three-lane decisions.** Each side has three lanes. A troop fights the troop opposite it, and an unblocked troop attacks the enemy Base. Tribute summons (sacrificing your own troops to bring out a stronger one) and spells that move a troop to another lane change which matchups happen.
2. **Visible simultaneous outcomes.** Opposing troops attack together. Matches are seeded: a seed is a number that makes a match repeatable. In the match that starts from seed 60, Mounted Billy is defeated and still takes the Dragon from five orbs to two. The arena shows both results.
3. **Evidence tied to the build it came from.** Seeded matches replay the same route. A saved Kiro Workflow runs browser checks and writes a receipt: a record of the run that includes the hash (a fingerprint) of the HTML it tested. The review tool returns `stale` when a receipt is paired with a different build.

## Inspiration and behavior
We wanted card decisions to happen visibly in the arena: sacrifice troops for stronger allies, move troops between lanes with spells, and see both attacks of a clash even when a troop falls. The current browser release includes a user-approved illustrated title, instructions, saved settings, local achievements, a twelve-card Cowboy deck builder and pause/resume. The deck-builder closeout added larger, readable card art (187px on desktop and 162px at phone size in Chrome checks), saved decks and keyboard controls. It was published in PR #15, and the HTML the site serves was verified. The later changes to the instructions text and the keyboard review have their own release evidence; an older receipt does not cover a later build.

## Implementation and Kiro
The rules are plain JavaScript and stay separate from the Three.js presentation and the Rapier scene behavior. Fable, the model used in our Claude Code sessions, wrote the rules engine and the computer opponent (the CPU). Kiro wrote the presentation, the specification and the tooling. Its Requirements-First spec guided the match presentation and the seeded checks. A custom agent, hooks, saved Workflows and a review Power (an installed Kiro package that supplies the review procedure and bundles an MCP server to inspect receipts) tie each result to the HTML that was actually built. Codex, the coding assistant coordinating the project, handled integration and independent checks. The user approved the art and motion; visuals come from original Tripo exports and approved sourced motion. The section after this one takes the Kiro features one topic at a time.

The saved Kiro Workflow passed 157 tests and 12 scripted browser checks. That run is historical and belongs to frozen commit `e9aeb06`; later changes to the game need their own checks. The run was not repeated for this document.

## How Kiro was used, topic by topic
Each topic names the file that shows the work and links one evidence note. Test counts and results belong to the commit their note names. [The full evidence map](../kiro-brag-sheet.md) has every run and its limits.

### 1. Kiro apps: IDE, CLI, Web and Crew
Three of the four were used. The Kiro IDE ran the Requirements-First spec session that planned and built the match presentation. Kiro CLI (3.3.0) did feature work, ran the hooks and Workflows, and imported the characters. Kiro Crew (0.12.2) ran a browser playtest and a balance preview, and runs the separate Night Watch app. **Kiro Web was not used.**
- Shown by: [`.kiro/specs/orb-duel/tasks.meta.json`](../../.kiro/specs/orb-duel/tasks.meta.json), the IDE's own execution history.
- Evidence: [build log](../kiro-build-log.md), which records the app each piece of work was performed in.

### 2. Custom agents
`duel-presenter` is a custom agent whose shell permissions are limited to the test and replay commands, and which loads `AGENTS.md` and the evidence steering file. It was used for the card landing-target fix: when the canvas has no size, a summoned card falls back to the lane button's position. The agent file shows the agent's scope, not the quality of its output. Both saved Workflows use `wf-coder`, an agent bundled with Kiro, not one defined in this repository.
- Shown by: [`.kiro/agents/duel-presenter.json`](../../.kiro/agents/duel-presenter.json).
- Evidence: [November 16 build evidence](../evidence/kiro-overnight.md#kiro-implementation-and-execution).

### 3. Agent hooks
Three kinds of hook have a recorded run. At session start, `duel-presenter` ran the 19 presenter, controller and card-model tests, and all 19 passed. A file-save hook regenerated the card catalog after a card's specification changed, in a trial that set Skeleton health from 3 to 4, and three registration tests passed. The `PreCompact` and `PostCompact` hooks wrote and restored a receipt ID. The save-hook run was in Kiro CLI in an isolated worktree; no Kiro IDE hook run is recorded.
- Shown by: [`.kiro/hooks/sync-duel-card-specs.json`](../../.kiro/hooks/sync-duel-card-specs.json) and the hooks in [`duel-presenter.json`](../../.kiro/agents/duel-presenter.json).
- Evidence: [session-start hook output](../evidence/kiro-ui-hook.txt).

### 4. Spec-driven development
The card match was built from a Requirements-First spec in the Kiro IDE: requirements, a design and 10 ordered tasks, all checked. The spec caught a real fault. Restarting with the same seed returns the engine to revision 0, so a stale scheduled action could look current; the controller now tags every timer and CPU request with a match epoch. Requirement 5.6, simultaneous clashes, became a tested property. A second spec covers the card pipeline and a third covers the deck builder's readability.
- Shown by: [`.kiro/specs/orb-duel/`](../../.kiro/specs/orb-duel/requirements.md) (`requirements.md`, `design.md`, `tasks.md`) and [`tests/match/scheduler.test.js`](../../tests/match/scheduler.test.js).
- Evidence: [the Spec row of the evidence map](../kiro-brag-sheet.md#feature-evidence).

### 5. Steering documents
Two steering files are tracked. `build-evidence.md` is always included and says how to record evidence; Codex wrote it. `duel-iteration.md`, added by Kiro, loads only for the match, render and interface code, the replay script and the card art. No recorded run isolates what a steering file changed, so we claim that steering shaped the work, not a measured effect.
- Shown by: [`.kiro/steering/build-evidence.md`](../../.kiro/steering/build-evidence.md) and [`.kiro/steering/duel-iteration.md`](../../.kiro/steering/duel-iteration.md).
- Evidence: [the Steering row of the evidence map](../kiro-brag-sheet.md#feature-evidence).

### 6. MCP
Kiro wrote an MCP server with two tools. `inspect_duel_replay` hashes the built HTML and compares it with a run's receipt: it returned `pass` for a matching build, `stale` for a receipt paired with older HTML, and `fail` for a wrong showcase seed. `inspect_character_asset` reports a model file's hash, triangles, joints and animation clips. The server checks hashes and receipt fields; it does not judge gameplay. Codex connected it through the workspace MCP settings.
- Shown by: [`.kiro/powers/orb-duel-review/server.mjs`](../../.kiro/powers/orb-duel-review/server.mjs) and [`.kiro/settings/mcp.json`](../../.kiro/settings/mcp.json).
- Evidence: [Power and MCP run](../evidence/kiro-overnight.md#power-and-mcp).

### 7. Property-based testing
Six properties run over seeds 0 to 99: selection never touches the engine, presenter fidelity, clash completeness, orb bounds, cancellation and the CPU's information limit. The recorded output covers 741 clashes and 2,734 attacks. In a one-time Codex experiment on a copy of the presenter, suppressing the animation for defeated attackers made the clash property fail at seed 0. These are seeded loops, not a property-testing library: there are no generators and no shrinking.
- Shown by: [`tests/match/presenter.test.js`](../../tests/match/presenter.test.js), with `selection.test.js` and `controller.test.js` beside it.
- Evidence: [clash property check](../evidence/kiro-submission-preflight.md#clash-property-check).

### 8. Kiro powers
The Orb Duel Review Power packages the review procedure together with the MCP server above. Version 1.1.0 is self-contained: in fresh Kiro sessions that used only the installed Power, it returned pass for matching receipts and stale for altered copies. Those inputs were copied historical browser receipts, not a new browser run. Kiro implemented the package; Codex reviewed and installed it.
- Shown by: [`.kiro/powers/orb-duel-review/plugin.json`](../../.kiro/powers/orb-duel-review/plugin.json) and its procedure, [`SKILL.md`](../../.kiro/powers/orb-duel-review/skills/review-duel-replay/SKILL.md).
- Evidence: [package proof](../evidence/kiro-power-package-fix.md).

## Why this fits the Costume Contest
The category asks for a haunting, polished interface whose spooky design improves how the app works. Here the haunted-Western dressing carries the game's information. Life orbs float above every troop and Base: each orb is one life, so a player reads health at a glance and sees it fall when a hit lands. A graveyard well beside each side's row draws in every tributed troop, defeated troop and spent spell, so the player sees where a card went and why it left the board. Each illustrated card shows its stars, which set its tribute cost, with its attack and life orbs. The Wizards' side is skeletons, a dragon and a gateway; the Cowboys' is a sheriff and a saloon, so the two sides and their Bases are told apart by look alone.

## Challenges and lessons
An animation can look convincing and still misrepresent a simultaneous attack. Passing rules tests does not catch every visible defect: a Kiro Crew browser review found developer labels on screen, and they were removed. Rigging a generated mesh also has limits, so the original exports stay untouched and new motion must come from approved sources. Older test counts and timing improvements are quoted with the commit and date they were measured on.

## Evidence
- Playable seeded matches, and a CPU limited to public information.
- Specifications tracked in the repository, and receipts from actual hook and Workflow runs.
- The installed Power (version 1.1.0), using its bundled MCP server and no workspace MCP server, passes a receipt that matches its build and rejects one that does not. The proof used historical browser receipts and copied HTML; it is not a new browser replay. [Package proof](../evidence/kiro-power-package-fix.md).
- Night Watch, a separate Kiro Crew app that compares exact commits and drafts issue reports, is enabled at version 0.1.2 after the user's approval. A manual CLI run and an actual Crew scheduler trigger each saved a report with 65 passing rule tests and 1,000 seeds per revision. A nightly job is registered for 2 a.m. Pacific; the Mac and Crew must be running, and checks use local Git refs without fetching remote updates. The latest report after a UI reload and a future unattended clock-time run remain unverified. The earlier browser-review timeout is separate and unresolved. [Activation evidence](../evidence/night-watch-activation.md).
- A working illustrated menu and player options.
- Custom-deck regression test: 128 distinct decks, each replayed twice; 2,199 actions in the first pass; 1,419 CPU/public-view checks. This covers correctness. It is not an estimate of balance for human players.

## Demo video
[Narration and shot list](judge-demo-script.md): planned 2:40, 325 spoken words, timed segments, each shot marked EXISTS or NEEDED. Narration and Kiro UI footage are not recorded yet.

## URLs
- Game: https://alejandro-publius.github.io/cowboys-vs-wizards/
- Source: https://github.com/alejandro-publius/cowboys-vs-wizards
- Kiro usage write-up: https://github.com/alejandro-publius/cowboys-vs-wizards/blob/main/docs/kiro-brag-sheet.md
- Crew app: https://github.com/alejandro-publius/cowboys-vs-wizards-night-watch
- Current preview: [58.73-second menu and gameplay video](../evidence/gameplay-demo/menu-and-gameplay-preview.mp4); source versions are recorded in its receipt. No narration or Workflow UI footage is claimed.
- Gameplay source: [43.67-second real gameplay recording](../evidence/gameplay-demo/seed60-599450a.mp4), captured at the prior release `599450a`. It does not show the new deck page.
- Public YouTube: PENDING. Do not submit a placeholder.
- Third-party blog: PENDING. Review build-story.md.

## Category and bonus checks
- **Category:** Costume Contest fits the current haunted-interface direction. Confirm the category selected in the form.
- **Crew bonus:** the Crew app has its own repository.
- **Student eligibility:** requires current attendance and actual teammate details. School affiliation alone is insufficient.
- **Blog bonus:** requires a public third-party post that mentions Kiroween 2026.
- **Social bonus:** optional. No social post has been sent by this task.

Official rules: https://kiroween.devpost.com/rules

Deadline: December 4, 2026 at 2 p.m. Pacific.

## First-time-player protocol
**Not run. Zero human sessions.** The full protocol is in [judge-demo-script.md](judge-demo-script.md#part-2-first-time-human-playtest-protocol): five tasks (start a match, place a troop, explain a lost orb, make a tribute summon, change and save a deck), definitions of independent, assisted and fail, the exact observations to record, and a blank results table. An agent browser review is not a human observation. Decide opening policy only after real play evidence; preserve current default meanwhile.

## Pending before final submission
- Narration recording
- Actual Kiro Workflow UI and reviewer footage
- First-time human playtest
- Final UI verification and the user's visual review
- Supported-device checks
- Real public YouTube upload
- Third-party blog publication, if entering that bonus
- Current enrollment and team facts
- Final category
- Actual submission confirmation
