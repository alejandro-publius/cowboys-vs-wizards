# How Kiro changed Cowboys vs. Wizards

**Judge write-up and recording plan · November 17, 2026 Pacific**

Cowboys vs. Wizards is a haunted-Western browser card duel. Pick a card, place a troop in one of three lanes and watch the fight change the life orbs over the board. The playable match grew out of an attack prototype. Kiro helped turn the rules into visible actions, fix a hand that looked blank in one browser engine, and make the footage reproducible from a named build.

## The three proofs to lead with

1. **From an attack prototype to a playable match.** In the Kiro IDE, a Requirements-First spec led to a ten-task implementation of the match presentation on top of Fable's rules engine and CPU. In seed 60, Mounted Billy is defeated and still takes the Dragon from five orbs to two, as the simultaneous-clash requirement says. A deliberately broken presenter dropped the defeated attack and failed the seeded check. [Requirement 5.6](../../.kiro/specs/orb-duel/requirements.md) · [Presenter check](../evidence/kiro-submission-preflight.md#clash-property-check) · [Initial match](../evidence/kiro-match-ui.md)
2. **From blank cards to readable choices.** The earlier WebKit smoke run observed a successful summon even though the hand showed blank tan cards. Kiro traced the layering fault, fixed the CSS and compared actual pixels against the intended art. The original WebKit check went from **0/6 to 6/6**. These were desktop Playwright WebKit runs. [Original screenshots and results](../evidence/kiro-webkit-card-fix.md)
3. **From a green run to evidence tied to a build.** Kiro CLI ran the three-stage native release Workflow on `f76ff60`. It recorded **333/333 tests**, an **8/8** opening replay and a **4/4** showdown replay, with zero console errors. The generated manifest matched a separate HTML hash. In a separate installed-only Kiro session, Orb Duel Review 1.1.0 returned **pass** for matching historical HTML and **stale** when the same receipt was paired with changed HTML. [Frozen Workflow](../evidence/kiro-release-review-892cada.md#corrected-native-workflow-and-replay-review) · [Installed Power and MCP](../evidence/kiro-power-package-fix.md#actual-installed-only-verification)

## Eight Devpost answers

| Topic | What we did and what it changed |
| --- | --- |
| 1. Kiro apps | We used **IDE** for the ten-task match spec, **CLI** for scoped feature work and repeatable checks, and **Crew** for browser review and recurring balance jobs. Kiro Web remains unused. [Build log](../kiro-build-log.md) |
| 2. Custom agents | The `duel-presenter` profile loads the scoped game guidance and limits shell access to named checks. Kiro used this profile to land a summoned card on the chosen 3D tile and to handle invalid canvas bounds. [Profile](../../.kiro/agents/duel-presenter.json) · [Recorded jobs](../evidence/kiro-overnight.md) |
| 3. Hooks | SessionStart ran 19 targeted checks. A card-save trial rebuilt the catalog from edited card data. The docs-save hook recorded one broken link, then zero after correction. Compaction hooks preserved a receipt identifier. Those executions were in CLI. [19-test output](../evidence/kiro-ui-hook.txt) · [Card pipeline](../evidence/kiro-card-pipeline.md) · [Paired save receipts](../evidence/parallel-closeout-2200/hook-recheck.jsonl) · [Continuity](../evidence/kiro-continuity-usage.md) |
| 4. Specs | We wrote requirements, design and tasks before the match presentation. The restart requirement exposed a risk of a queued move surviving a reset to the same seed; the controller now gives each match its own epoch. For the small First Spell fix, we used an issue and a failing regression check. [Requirements-to-tests map](../requirement-test-map.md) · [First Spell](../evidence/kiro-first-spell-fix.md) |
| 5. Steering | We kept evidence guidance always on and loaded rules, rendering or interface guidance by file pattern. Four real CLI sessions read one file each. Three matching reads loaded the intended scoped guidance and the `package.json` control loaded only the always-on context. The answer tags verified activation in the fixture. [Experiment](../evidence/kiro-scoped-steering-hook.md#file-scoped-activation-verified-on-november-17-2026-pacific) |
| 6. MCP | Kiro authored a project MCP server. `inspect_duel_replay` matches a browser receipt to its HTML. `inspect_character_asset` reports GLB hashes, triangles, joints and clips. This let us check build identity and model structure by calling tools. [Server](../../.kiro/powers/orb-duel-review/server.mjs) · [Kiro-side calls](../evidence/kiro-public-evidence/06-power-mcp-calls.json) |
| 7. Property testing | Hand-written examples covered named moves. Kiro added seven generated boundary properties, **1,203 cases** at seed 45274 and six planted faults that the tests caught. A failing demonstration shrank from 24 to 5 cards and from 7 to 5 actions. The deliberately broken inputs exercised the tests. [Boundary evidence](../evidence/kiro-boundary-properties.md) |
| 8. Powers | The installed Orb Duel Review Power bundles the review instructions and the MCP server. Kiro repaired version 1.1.0 for an installed-only run. Matching opening and showdown copies returned pass; changed copies returned stale with the same receipts. This reproduction reused historical browser runs. [Package proof](../evidence/kiro-power-package-fix.md) |

**Crew & Workflows.** Night Watch 0.1.2 ran a manual trial and a real Crew scheduler trigger, each checking 1,000 seeds per revision and passing 65 rules tests. Its scheduled report is separate from the local release Workflow. A contributor-review Workflow and a bounded lore-review Workflow also ran with recorded inputs and outcomes. [Night Watch](../evidence/night-watch-activation.md) · [Contributor review](../evidence/parallel-closeout-2200.md) · [Lore review](../evidence/kiro-lore-review-loop.md)

**Attribution.** Kiro built the documented spec, presentation and tooling. Fable built the original rules and CPU. Rachel contributed the rules review. Codex coordinated, integrated and independently checked results. Alejandro directed the visuals, supplied Tripo exports and approved specific art and motion. Check the [submission packet](devpost-packet.md#who-did-what) for individual claims. Alejandro's personal account of the workflow is still to be recorded.

## Main video · 2:35 running order

| Time | Picture and sound | Evidence |
| --- | --- | --- |
| 0:00–0:12 | Begin on the game. Play a Sheriff and show a life orb change. Say “A card becomes a troop, and you can see why it won or lost.” | Seed 0 first move |
| 0:12–0:47 | Cut to seed 60. Select two tributes, summon Mounted Billy and use Singularity to move him into the center. Hold long enough to orient the viewer. | Seed 60 game capture |
| 0:47–1:11 | Let Billy and the Dragon finish both attacks. Show the Dragon going from five orbs to two. Cut to the exact spec line and the check for the defeated attacker. | Requirement 5.6 and replay |
| 1:11–1:35 | Put the actual blank-hand and fixed-hand captures side by side. Say “The game could pass the click test with a blank hand. We fixed the layering and added a pixel check.” | WebKit 0/6 → 6/6 |
| 1:35–2:13 | Show the native Workflow running or its saved output, the frozen commit and the two replay counters. Switch to the installed Power. Show the same receipt pass and go stale on a changed page. | Label each revision and the historical Power inputs |
| 2:13–2:35 | Return to the game result and a rematch. Put the playable URL on screen. Keep the fuller feature clips in the build story. | Final video and served build to match before submission |

Rules call for project footage and a public YouTube demo under three minutes. The [official judging criteria](https://kiroween.devpost.com/) ask how skillfully and impactfully Kiro was used. The main cut gives judges a complete battle and three visible changes. The proof reel below is for review and the build story. [Official rules](https://kiroween.devpost.com/rules) · [2025 winner comparisons](kiroween-competitive-benchmark.md) · [Official Kiro video library](https://kiro.dev/videos/)

## Recording register

| Clip | Start with | Capture the Kiro moment | End with | Footage state |
| --- | --- | --- | --- | --- |
| K01 · IDE Spec | Attack prototype, if a historical build can be reproduced | Open the actual Orb Duel spec, requirement 5.6 and task history | Seed 60: defeated Billy still hits | Game footage exists. IDE action and prototype comparison pending. |
| K02 · Scoped agent | Summon card needs a precise landing target | Show the `duel-presenter` profile and run a named check in an isolated checkout | Accepted card lands on the selected tile; cite the historic measured alignment | Saved checks and original game footage. Fresh agent footage pending. |
| K03 · Save hooks | Broken Markdown link in a scratch document | Save in Kiro, show PostFileSave failure, remove the link and save again | Actual verdict changes from failed to passed | Original paired receipt excerpt in proof reel. Native session recording pending. |
| K04 · Steering | Read `package.json` in a fresh session | Repeat with a rules or render file; show included guidance in the event output | Scoped guidance loads only for matching files | Four original CLI runs recorded as text. Capture UI or terminal replay. |
| K05 · Generated tests | Hand-written case or intentionally dropped hit | Show the planted fault caught and the shrunk boundary input | A small reproducible case that can be fixed and replayed | Saved results. Native run footage pending. |
| K06 · WebKit fix | Blank tan hand | Show the changed selector and six-state pixel comparison | Illustrated and readable cards in the same browser engine | Original before/after browser stills in proof reel. |
| K07 · Workflow | Freeze a known build | Show the recipe, run stages, replay counts and HTML hash | One exact identifier for the tested output | Saved run excerpt in proof reel. Native Workflow UI pending. |
| K08 · Power and MCP | Same browser receipt on two HTML copies | Activate the installed review Power and show two calls | Matching build passes and altered build is stale | Workspace MCP response excerpts in proof reel. Installed-only records exist. Native Power footage pending. |
| K09 · Crew | A candidate whose balance depends on many openings | Open a real current Night Watch report and show the compared revisions | 1,000 matching seeds per revision and a concise triage report | Manual and scheduler receipts exist. Fresh Crew report screen pending. |
| K10 · Guided first match | Plain opening recorded at an identified version | Show the CLI spec or task that added the guided route | Same player action with visible guidance, then normal play | Guided route verified in desktop Safari. Paired footage and human observations pending. |
| K11 · Player pacing | Same seed in default mode | Show Kiro's opt-in pacing change and paired timing receipt | Same game events in fast mode, with measured values on screen | Paired Chrome samples recorded. Split-screen footage pending. [Timing](../evidence/kiro-browser-pace-125.md) |
| K12 · Trap lab | BASE replay on a listed seed | Show the CLI spec, parity matrix and matching seed in T1 | One legible facedown trap decision in the lab | Developer lab and seeded receipts exist. Paired human exports and footage pending. [Seed matrix](../evidence/kiro-trap-seed-matrix-135.md) |
| K13 · Choose the opening rules | Show the graybox opening and ask whether protecting both Bases for round one would make it fairer | Open Kiro's Requirements-First spec. Show the comparison criterion, then run the frozen paired seeds with both first seats | Kiro's shield removed 74 round-one Base damage across 1,024 Normal matches. First-seat advantage barely moved, and adding the shield to Both changed no match. Show the ruled-out variant and return to the current build | Kiro IDE run and matching rerun receipts. Native footage pending. [Card design evidence](../evidence/codex-card-rd.md#round-one-base-shield) |

Keep the clip's seed, source revision and original receipt together. Use a single pair of builds and the same inputs for comparisons. Preserve historical labels on archive footage. For an intentionally broken fixture, say that on screen.

### Optional board-readability insert

Start with Alejandro's brief about stripping the board back. Replay the same move in the late graybox experiment and the finished arena: select Sheriff, choose the center lane, confirm, and show all three life orbs. The comparison preview includes the original arena, a quiet stage with the original bases and characters, and the game's existing placeholder tokens. Use the quiet stage to see whether the scenery can recede while the saloon, gateway and troops still identify the two sides. Label the graybox as a follow-up experiment. The prototype and its focused checks were done by Codex. Attribute any later implementation to the tool that actually runs it.

## Recovered handoffs

- **Kiroween Project Help.** The original numbered brag sheet recorded the first playable Kiro match at `64e3614`, attack cue `1f4c7cd`, summon flight `415af3c`, graveyards `daf61d6` and the narrower custom-agent landing fix. Carry those forward when cutting the first-match and presentation clips. [Project Help chat](https://chatgpt.com/c/6af8b6f3-3e7c-83e8-a60c-1c8cd20c5cb8) · [Historical evidence map](../kiro-brag-sheet.md)
- **Overnight and headless work.** Recovered workflow originals, installed Power results, doc-save and compaction receipts, Crew activation and browser checks now have concrete clip assignments. [Originals index](../evidence/kiro-public-evidence/index.md) · [Resource progress workbook](https://chatgpt.com/library?file_id=libfile_fde3_f-53b84fb60ab481919c1b39eb82e00a9a_c938da7bdb20819184c509fd2d482d25&account_id=personal)
- **Project Help Summary.** Keep changes text and code first. Use the researched winning entries as examples of showing one complete journey, with the feature examples as supporting proof. [Competitive benchmark](kiroween-competitive-benchmark.md)

Current open evidence includes owner narration, native Kiro footage, a first-time player session, physical iPhone and VoiceOver checks, and verification of the final served build. The trap comparison is an experiment. Keep the build identities and the tester's actual experience visible when recording.
