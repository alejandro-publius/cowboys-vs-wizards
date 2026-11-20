# Kiroween submission packet

> **Lane-era draft (November 16–17, 2026).** It describes the three-lane duel. The December 4 entry is Showdown; its current Kiro answers and proof are in the [judge write-up](kiro-brag-sheet.md). Kept as history.

Prepared November 16, 2026 and revised November 17, 2026 (Pacific time). Draft for the entrant's review. The latest recorded release checks ran against `892cadac5689290b8fd109ae6a51837cc6f1c31d`. Fields marked **OWNER** need facts that only the user or team can supply.

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
We wanted card decisions to happen visibly in the arena: sacrifice troops for stronger allies, move troops between lanes with spells, and see both attacks of a clash even when a troop falls. The current browser release includes a user-approved illustrated title, instructions, saved settings, local achievements, a twelve-card Cowboy deck builder and pause/resume. The deck-builder closeout added larger, readable card art (187px on desktop and 162px at phone size in Chrome checks), saved decks and keyboard controls. It was published in PR #15, and the HTML the site served was verified then. Later changes have their own release evidence; an older receipt does not cover a later build.

## Who did what
- **Kiro** (IDE, CLI and Crew) wrote the match presentation and its Requirements-First spec, the later CLI specs, the custom agent, hooks, Workflows, the review Power and MCP server, the boundary property tests, the trap-lab parity harness, Night Watch, and imported and rigged the characters (Skeleton optimization; Dragon and Mounted Billy attack clips made from the Tripo exports in Blender jobs run from Kiro CLI). [Character evidence](../evidence/kiro-character-assets.md).
- **Fable**, the model used in Claude Code sessions, wrote the rules engine and the computer opponent (the CPU), repaired keyboard focus, wrote the judge script and playtest protocol, and wrote the [rules check](rules-check.md). The rules check ran in a collaborator's Claude Code session and was committed by Rachel (`rachelselbrede`) in PR #58.
- **Codex**, the coding assistant coordinating the project, handled integration, independent re-checks, the always-on `build-evidence.md` steering file, the illustrated-menu integration, and operated the steering experiment below.
- **The user** supplied the Tripo exports and approved the illustrated title and Sheriff idle. The title illustration was generated with GPT Image in ChatGPT. [Title provenance](../../assets/menu/README.md) and [Sheriff idle evidence](../evidence/kiro-approved-sheriff-idle.md). **OWNER:** confirm any additional artist credits and the source of the card illustrations.

## Implementation and Kiro
The rules are plain JavaScript in `src/game/` and stay separate from the Three.js presentation and the Rapier scene behavior. Kiro's Requirements-First spec guided the match presentation and its seeded checks. A custom agent, hooks, saved Workflows and a review Power (an installed Kiro package that supplies the review procedure and bundles an MCP server to inspect receipts) tie each result to the HTML that was actually built. The section after this one takes the Kiro features one topic at a time.

Two historical saved Kiro Workflow runs each passed 157 tests and 12 scripted browser checks: `wf_5bd13532f5142477` on `e9aeb06` and `wf_0572a745f5194cf1` on `02b1bf8`. A later native `independent-release-review` Workflow completed 3/3 on `7506599` (222/222 tests, seed 0 8/8, seed 60 4/4, no run ID captured; [note](../evidence/kiro-independent-release-review-66.md)). Match the filmed commit to its receipt.

## How Kiro was used, topic by topic
Each topic names the file that shows the work and links one evidence note. Test counts and results belong to the commit their note names. [The feature evidence table](kiro-feature-evidence-table.md) and [the full evidence map](../kiro-brag-sheet.md) list every run and its limits.

### 1. Kiro apps: IDE, CLI, Web and Crew
Three of the four were used. The Kiro IDE ran the Requirements-First spec session that planned and built the match presentation. Kiro CLI (3.3.0 historically; 3.4.0 V3 for the latest batches) did feature work in separate worktrees, ran the hooks and Workflows, wrote the later specs and imported the characters. Kiro Crew (0.12.2) ran a browser playtest and a balance preview, and runs the separate Night Watch app. **Kiro Web was not used.** In practice the IDE was where a spec was written and reviewed task by task; the CLI ran bounded jobs that ended in a receipt; Crew ran scheduled and repeated jobs.
- Shown by: [`.kiro/specs/orb-duel/tasks.meta.json`](../../.kiro/specs/orb-duel/tasks.meta.json), the IDE's own execution history.
- Evidence: [build log](../kiro-build-log.md), which records the app each piece of work was performed in.

### 2. Custom agents
`duel-presenter`, used in Kiro CLI, is a custom agent whose shell permissions are limited to the test and replay commands, and which loads `AGENTS.md` and the evidence steering file. It was used for the card landing-target fix: when the canvas has no size, a summoned card falls back to the lane button's position. The agent file shows the agent's scope, not the quality of its output. The saved Workflows use `wf-coder`, an agent bundled with Kiro, not one defined in this repository.
- Shown by: [`.kiro/agents/duel-presenter.json`](../../.kiro/agents/duel-presenter.json).
- Evidence: [November 16 build evidence](../evidence/kiro-overnight.md#kiro-implementation-and-execution).

### 3. Agent hooks
Four hooks have a recorded run, all in Kiro CLI. At session start, `duel-presenter` ran the 19 presenter, controller and card-model tests, and all 19 passed. A file-save hook regenerated the card catalog after a card's specification changed, in a trial that set Skeleton health from 3 to 4, and three registration tests passed. A documentation save hook failed on a broken link and passed after the fix. The `PreCompact` and `PostCompact` hooks wrote and restored a receipt ID. No Kiro IDE hook run is recorded.
- Shown by: [`.kiro/hooks/sync-duel-card-specs.json`](../../.kiro/hooks/sync-duel-card-specs.json) and the hooks in [`duel-presenter.json`](../../.kiro/agents/duel-presenter.json).
- Evidence: [session-start hook output](../evidence/kiro-ui-hook.txt), [documentation hook](../evidence/kiro-doc-link-hook.md).

### 4. Spec-driven development
The card match was built from a Requirements-First spec in the Kiro IDE: requirements, a design and 10 ordered tasks, all checked. The spec work caught a real fault. Restarting with the same seed returns the engine to revision 0, so a stale scheduled action could look current; the controller now tags every timer and CPU request with a match epoch. Requirement 5.6 (a defeated troop stays on the board until every attack in the clash, including its own, has played) became a tested property. Later specs were written in Kiro CLI: the card pipeline, preview contracts, the guided first match, deck-builder readability and the trap zone. The trap-zone spec has a developer-only lab under `experiments/`; it is not in the playable game.
- Shown by: [`.kiro/specs/orb-duel/`](../../.kiro/specs/orb-duel/requirements.md) (`requirements.md`, `design.md`, `tasks.md`) and [`tests/match/scheduler.test.js`](../../tests/match/scheduler.test.js).
- Evidence: [the Spec row of the evidence table](kiro-feature-evidence-table.md).

**Spec-driven compared with direct prompting, from this project.** The two modes were used for different sizes of work.
- *Spec-driven:* the match presentation (10 tasks against numbered acceptance criteria). Writing requirements before code surfaced the same-seed restart fault, and each criterion can be traced to a test in the [requirement-test map](../requirement-test-map.md). The card pipeline and trap zone were also spec-first. The trap-zone spec was corrected to a dedicated trap card kind before any code, instead of inventing a mechanic (PR #63).
- *Direct, unspecced tasks:* small fixes were done from an issue and a regression test, with no spec: the First Spell achievement (`"cast"` vs `"spell"` mismatch, PR #62), seed range validation (PR #73), deck-builder rule constants (PR #74) and the opt-in `?pace=fast` option (PR #65).
- *Before Kiro:* the original attack demo predates the spec. **OWNER:** how it was built and how the two ways of working felt is the builder's account to write.

### 5. Steering documents
Five steering files are tracked. `build-evidence.md` (written by Codex) and `AGENTS.md` are always included and say how to record evidence and attribute work. `duel-iteration.md`, added by Kiro, loads for the match, render and interface code, the replay script and the card art. Kiro also wrote three area files with `inclusion: fileMatch`: `rules-area.md`, `rendering-area.md` and `interface-area.md`.

**What we measured.** On November 17, 2026 (Pacific), Codex ran four fresh Kiro CLI 3.4.0 V3 sessions against a fixture copied from `892cada`. Each session read one file. Each steering copy carried a unique response tag, and the prompt asked Kiro to follow the automatically supplied response-format instructions. Reading `src/game/legal.js` loaded `rules-area.md`; reading `src/render/match-camera.js` loaded `duel-iteration.md` and `rendering-area.md`; reading `src/ui/card-art.js` loaded `duel-iteration.md` and `interface-area.md`. The control, `package.json`, loaded only the always-on files. Each final answer contained exactly the tags of the files that loaded. The four turns used about 1.649 credits.

The strategy that the experiment supports is to keep always-on guidance short and put area rules behind file patterns, so they arrive only when Kiro reads the matching code. The experiment measured inclusion and a visible response change in a fixture. It did not measure code quality, IDE behavior or other paths.
- Shown by: [`.kiro/steering/`](../../.kiro/steering/build-evidence.md).
- Evidence: [file-scoped activation receipt](../evidence/kiro-scoped-steering-hook.md#file-scoped-activation-verified-on-november-17-2026-pacific).

### 6. MCP
Kiro wrote an MCP server with two tools. `inspect_duel_replay` hashes the built HTML and compares it with a run's receipt: it returned `pass` for a matching build, `stale` for a receipt paired with older HTML, and `fail` for a wrong showcase seed. `inspect_character_asset` reports a model file's hash, triangles, joints and animation clips. What it made practical: an agent can check that a receipt belongs to the build in front of it and refuse a stale one, without a person comparing hashes. The server checks hashes and receipt fields; it does not judge gameplay. Codex connected it through the workspace MCP settings.
- Shown by: [`.kiro/powers/orb-duel-review/server.mjs`](../../.kiro/powers/orb-duel-review/server.mjs) and [`.kiro/settings/mcp.json`](../../.kiro/settings/mcp.json).
- Evidence: [Power and MCP run](../evidence/kiro-overnight.md#power-and-mcp).

### 7. Property-based testing
There are two layers.
- *Presenter loops (November 16):* six seeded properties over seeds 0 to 99: selection never touches the engine, presenter fidelity, clash completeness (requirement 5.6), orb bounds, cancellation and the CPU's information limit. They covered 741 clashes and 2,734 attacks. These are seeded loops without generators or shrinking. In a one-time Codex experiment on a copy of the presenter, suppressing the animation for defeated attackers made the clash property fail at seed 0. [Clash property check](../evidence/kiro-submission-preflight.md#clash-property-check).
- *Engine and CPU boundary properties (PR #61, written by Kiro CLI):* seven properties with generators, 1,203 cases at recorded seed 45274, each tied to acceptance criteria (BP-DECK, BP-TRIBUTE, BP-REJECT, BP-SPELL, BP-CLASH, BP-REPLAY, BP-CPU). A bounded reducer (`shrink.js`) shrinks a failing input: on a planted mutant it cut 24 cards to 5 and 7 actions to 5 in 58 of 3,000 candidate runs. Kiro's note records 15/15 boundary tests and `npm test` 206/206. [Boundary properties](../evidence/kiro-boundary-properties.md).

**What generated checks added to ordinary unit tests.** The existing unit tests used hand-written examples: example clashes, hand-listed invalid actions, one replay-twice test and a hidden-information test that only reversed the opponent's hand. The boundary suite added every one-Sheriff and six-copy deck plus one step outside each limit (103 decks), about 40 invalid-action categories on generated states with byte-identical rejection checks, an independent clash oracle over 400 clashes, interleaved rejected actions in replays, and random permutations of hidden cards at all three CPU levels. Each property must reach its declared boundary categories (100 tags, all reached). Six test-only mutants, such as a rejection that advances the RNG and a CPU that reads the opponent's hand, were each caught by their property. **No product bug was found.** The only failures were harness faults during development. Properties sample; they are not proofs, and the presenter, controller and renderer have no boundary properties.

### 8. Kiro powers
The Orb Duel Review Power packages the review procedure together with the MCP server above. Version 1.1.0 is self-contained: in fresh Kiro sessions that used only the installed Power, it returned pass for matching receipts and stale for altered copies. Those inputs were copied historical browser receipts, not a new browser run. Kiro implemented the package; Codex reviewed and installed it. No registry Power was used.
- Shown by: [`.kiro/powers/orb-duel-review/plugin.json`](../../.kiro/powers/orb-duel-review/plugin.json) and its procedure, [`SKILL.md`](../../.kiro/powers/orb-duel-review/skills/review-duel-replay/SKILL.md).
- Evidence: [package proof](../evidence/kiro-power-package-fix.md).

## Third-party tooling and attribution
- **Libraries and build.** The installed versions identify Three.js 0.180.0 and esbuild 0.28.2 as MIT and Rapier 0.12.0 as Apache-2.0. The project repository uses MIT.
- **Assets and motion.** The original Tripo exports are preserved. Blender Game Skills and Lucca Cerf's Character Factory served as references. The shipped Sheriff idle uses Mixamo's `headShake` clip. Quaternius motion was used in a separate Billy preview. The title illustration came from GPT Image in ChatGPT. [Motion sources](../character-animation-plan.md) and [remaining license evidence](rules-check.md#risks-to-settle-before-submitting).
- **Other AI tools:** Fable (Claude Code) and Codex, as attributed above.
- **Testing and hosting:** headless Chrome driven over the DevTools protocol, GitHub Actions and GitHub Pages.
- **Pre-existing work disclosure:** **OWNER.** The first commit (November 14, 2026) preserves an existing board demo. The rules require disclosing pre-existing work and confirming it was made after October 30. Only the user knows when the demo and the Tripo exports were made.

## Automated checks and human testing
- **T1 lab browser automation.** Kiro CLI 3.4.0 V3 ran the developer-only T1 scenario in headless Chrome for seeds 55, 9, 2, 23, 7 and 43. Each of 68 stable points matched a Node engine mirror for public state, events, visible fields and face-down trap redaction. The six runs had zero mismatches, console errors or remote requests. These results describe scripted play against the normal CPU. [PR #136 receipt](../evidence/kiro-trap-seed-matrix-135.md).
- **Current release.** The native Kiro workflow passed 333 tests and both Chrome replays on `892cada`. A separate desktop Safari smoke check verified cancellation, summon and turn advance on the deployed build. [Release evidence](../evidence/kiro-release-review-892cada.md).
- **Earlier scripted replays:** Workflow runs on seeds 0 and 60, the menu and keyboard checks, and a Crew browser review that found developer labels on screen.
- **Human testing: none.** Zero first-time-player sessions. No agent review counts as a human observation, and no claim about clarity or fun is made.

## Why this fits the Costume Contest
The category asks for a haunting, polished interface whose spooky design improves how the app works. Here the haunted-Western dressing carries the game's information. Life orbs float above every troop and Base: each orb is one life, so a player reads health at a glance and sees it fall when a hit lands. A graveyard well beside each side's row draws in every tributed troop, defeated troop and spent spell, so the player sees where a card went and why it left the board. Each illustrated card shows its stars, which set its tribute cost, with its attack and life orbs. The Wizards' side is skeletons, a dragon and a gateway; the Cowboys' is a sheriff and a saloon, so the two sides and their Bases are told apart by look alone.

## Challenges and lessons
An animation can look convincing and still misrepresent a simultaneous attack. Passing rules tests does not catch every visible defect: a Kiro Crew browser review found developer labels on screen, and they were removed. Rigging a generated mesh also has limits, so the original exports stay untouched and new motion must come from approved sources. Older test counts and timing improvements are quoted with the commit and date they were measured on.

**Personal reflection: OWNER.** No first-person account of using Kiro is written here, and none should be generated.

## Evidence
- Playable seeded matches, and a CPU limited to public information.
- Specifications tracked in the repository, and receipts from actual hook and Workflow runs.
- The installed Power (version 1.1.0), using its bundled MCP server and no workspace MCP server, passes a receipt that matches its build and rejects one that does not. The proof used historical browser receipts and copied HTML; it is not a new browser replay. [Package proof](../evidence/kiro-power-package-fix.md).
- Night Watch, a separate Kiro Crew app that compares exact commits and drafts issue reports, is enabled at version 0.1.2 after the user's approval. A manual CLI run and an actual Crew scheduler trigger each saved a report with 65 passing rule tests and 1,000 seeds per revision. A nightly job is registered for 2 a.m. Pacific; the Mac and Crew must be running, and checks use local Git refs without fetching remote updates. The latest report after a UI reload, a future unattended clock-time run and a request through the installed Crew gateway against the Host guard (PR #70) remain unverified. [Activation evidence](../evidence/night-watch-activation.md).
- A working illustrated menu and player options.
- Custom-deck regression test: 128 distinct decks, each replayed twice; 2,199 actions in the first pass; 1,419 CPU/public-view checks. This covers correctness. It is not an estimate of balance for human players.
- The live commit and HTML digest matched `892cada` on November 17. [Deployment and release evidence](../evidence/kiro-release-review-892cada.md).

## Demo video
[Narration and shot list](judge-demo-script.md): planned 2:40, 325 spoken words, timed segments, each shot marked EXISTS or NEEDED. Narration and Kiro UI footage are not recorded yet. The rules forbid third-party trademarks in the video; see the [rules check](rules-check.md#risks-to-settle-before-submitting).

## URLs
- Game: https://alejandro-publius.github.io/cowboys-vs-wizards/ (after issue 143 slice 3 is deployed: the graybox Showdown game; Play opens the Camp. Current state: [release line](../design/release-line.md))
- Earlier illustrated 3D build (lane rules, models and motion): https://alejandro-publius.github.io/cowboys-vs-wizards/3d/
- Source: https://github.com/alejandro-publius/cowboys-vs-wizards
- Kiro usage write-up: https://github.com/alejandro-publius/cowboys-vs-wizards/blob/main/docs/kiro-brag-sheet.md
- Crew app: https://github.com/alejandro-publius/cowboys-vs-wizards-night-watch
- Current preview: [58.73-second menu and gameplay video](../evidence/gameplay-demo/menu-and-gameplay-preview.mp4); source versions are recorded in its receipt. No narration or Workflow UI footage is claimed.
- Gameplay source: [43.67-second real gameplay recording](../evidence/gameplay-demo/seed60-599450a.mp4), captured at the prior release `599450a`. It does not show the new deck page.
- Public YouTube: **OWNER, PENDING.** Do not submit a placeholder.
- Third-party blog: **OWNER, PENDING.** Review build-story.md.

## Category and bonus checks
- **Category:** Costume Contest fits the current haunted-interface direction. **OWNER:** confirm the category selected in the form.
- **Crew bonus:** the Crew app has its own repository. Its form write-up is not drafted.
- **Student eligibility:** **OWNER.** Requires current enrollment and details for every teammate. School affiliation alone is insufficient.
- **Blog bonus:** requires a public third-party post that mentions Kiroween 2026.
- **Social bonus:** optional. A person must write it; no agent should. No social post has been sent.

Official rules: https://kiroween.devpost.com/rules

Deadlines: credit requests by December 1, 2026 at 12:00 p.m. Pacific; submission by December 4, 2026 at 2 p.m. Pacific.

## First-time-player protocol
**Not run. Zero human sessions.** The full protocol is in [judge-demo-script.md](judge-demo-script.md#part-2-first-time-human-playtest-protocol): five tasks (start a match, place a troop, explain a lost orb, make a tribute summon, change and save a deck), definitions of independent, assisted and fail, the exact observations to record, and a blank results table. An agent browser review is not a human observation. Decide opening policy only after real play evidence; preserve current default meanwhile.

## Pending before final submission (owner inputs)
- Personal reflection on using Kiro, and the spec-versus-direct comparison in the builder's words
- Pre-existing work disclosure: when the board demo and the Tripo exports were made
- Human artist credits and the source of the card illustrations
- Missing Tripo and Mixamo license metadata
- Current enrollment and team facts; every teammate joined on Devpost; credit requests
- Final category and bonuses
- Narration recording, actual Kiro Workflow UI footage, and the public YouTube URL
- Third-party blog URL and social post, if entering those bonuses
- First-time human playtest
- Final UI verification and the user's visual review; supported-device checks
- Verification of the final served build and final links
- User approval of this packet, and actual submission confirmation
