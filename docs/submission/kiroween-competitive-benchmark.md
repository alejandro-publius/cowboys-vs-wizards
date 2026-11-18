# Kiroween 2026 competitive benchmark (issue #80)

## November 17 follow-up on the judging rubric

Devpost lists five equally weighted criteria worth ten points each. The 2026 gallery was unpublished when checked, so the historical examples below use the 2025 award labels on individual entries. Use the criteria as acceptance targets. [2026 rules](https://kiroween.devpost.com/rules) · [2026 gallery](https://kiroween.devpost.com/project-gallery) · [2025 gallery](https://kiroween-2025.devpost.com/project-gallery)

| 2025 entry | What the submission puts in front of the judge | Application to this duel |
| --- | --- | --- |
| [InteractionKit](https://devpost.com/software/kiro-interactionkit), first overall | A defined audience of builders who want working gesture input. The template leads to a demonstrable experience. | Name the audience in the first sentence. Show the first legal move before explaining the architecture. |
| [UnitSet](https://devpost.com/software/unitset), second overall | One complete path from sketch to editable component, code inspection and export. | Show card choice, board consequence and the next decision in a continuous gameplay cut. |
| [SpookBnB](https://devpost.com/software/spookbnb-when-dark-mode-gets-truly-dark), third overall | A familiar dark-mode toggle changes the entire interaction into a flashlight-guided escape room. | Show the game rule through the visual effect. In the showdown, keep the surviving Dragon and its falling life orbs visible through the impact. |
| [Seance](https://devpost.com/software/seance), Best Costume Contest | The haunted book is the interaction. Answers advance its pages and wrong answers interrupt progress. | Keep the Western treatment attached to card choice, tribute and damage. Give new players one guided route inside the existing instructions. |
| [Type To Death](https://devpost.com/software/type-to-death), Social Blitz winner | A horror typing mechanic has an explicit purpose the viewer can recognize quickly. | Give the duel an equally concrete hook. Play a card, watch it take a lane, then see the cost of the next move. |

| Criterion | Evidence to have ready before submission |
| --- | --- |
| Potential Impact | Observe three to five first-time strategy or card-game players. Record time to first legal summon, whether they can explain their first lost orb and tribute, and whether they would play again. |
| Technological Implementation | Show one real chain from Requirements-First spec to simultaneous-clash test, then the frozen Kiro workflow and the replay reviewer's pass and stale verdicts. Link the exact inputs and receipts. |
| Design | Use the guided opening and inspect the hand, lane controls and hit feedback at desktop and phone sizes. Record a real iPhone and VoiceOver session. Review sourced character motion at the normal camera distance. |
| Innovation/Idea | Show how tribute, Singularity and simultaneous damage combine in the same seed-60 clash. The visible proof is Billy landing his attack despite being defeated. |
| Presentation | Begin with action in the first fifteen seconds. Use real footage from the chosen candidate, explain why the rules matter, and show the Kiro proof alongside the result. Upload an approved cut shorter than three minutes to public YouTube. |

The official [Build With Kiro overview](https://kiro.dev/videos/PO3M2TKCUb0/) describes the path from planning to implementation and checks. [Working With Kiro workflows](https://kiro.dev/videos/b4U9PlBI5qM/) explains inspecting and refining a reusable recipe before saving it. The [Gofer AI winning-team interview](https://kiro.dev/videos/yTVWICb6ZI4/) describes cutting features after a pivot so the core pipeline could ship. For this entry that means putting the clear, reproducible duel and its release checks first. The [Crew tutorial](https://kiro.dev/videos/JjVbje4kAlY/) shows the value of automated triage when it reports actionable findings. Night Watch already has a scoped purpose in the form of seeded balance reports. Its naturally scheduled run and a fresh dashboard check still need evidence.

### Reconciliation with the resource audit

- Steering activation now has matching and non-matching cases. The default and fast Chrome pacing measurements are recorded. [Steering](../evidence/kiro-scoped-steering-hook.md) · [Pacing #125](../evidence/kiro-browser-pace-125.md)
- The corrected native release workflow completed on the previous candidate, and the Power's project-bound MCP server verified the current receipts from that run. A new gameplay build needs fresh release receipts. [Frozen rerun and MCP comparison](../evidence/kiro-release-review-892cada.md#corrected-native-workflow-and-replay-review)
- A narrated review cut exists. The public YouTube cut, owner narration and visual sign-off are still open. The shipped build and the new guided entry must be cited accurately in the final shot list.
- The local T1 and BASE lab is available for a paired human test. The released-game onboarding test is a separate first-time-player task. Keep participant notes about both flows before drawing conclusions about clarity.

The sections below retain the original six-repository snapshot.

Written November 17, 2026 (America/Los_Angeles) by Kiro CLI 3.4 in an isolated worktree off `main` at `e214e8d`. Text-only. It changes no game source, art, test, or spec. Evidence and method: [kiro-competitive-research.md](../evidence/kiro-competitive-research.md).

**Scope limit.** This reviews six public repositories, not the field. It makes no estimate of any score, ranking, or prize chance. Official rules: <https://kiroween.devpost.com/rules>. The page answered HTTP 200 to a plain request, but the rule quotations used here come from the pasted text recorded in [rules-check.md](rules-check.md), because the site is documented there as blocking automated readers. Kiro could not resolve the two optional 2025 references by bare GitHub repo name; that does not invalidate their Devpost submissions. The coordinator independently verified the public [InteractionKit](https://devpost.com/software/kiro-interactionkit) and [SpookBnB](https://devpost.com/software/spookbnb-when-dark-mode-gets-truly-dark) project pages. These are **historical design references**, not part of the six-repository 2026 sample.

## 1. Current shipped facts (ours)

Each fact below comes from the repository on `main` at `e214e8d`. See [README](../../README.md), [PROJECT-STATUS](../PROJECT-STATUS.md), [JUDGE-GUIDE](../JUDGE-GUIDE.md).

- Browser card duel: three lanes per side, tribute summons, one to five life orbs per living troop, a seeded rules engine in `src/game/`, a hidden-information CPU.
- Public, free URL on GitHub Pages with `?seed=0` (opening) and `?seed=60` (Mounted Billy against the Dragon, simultaneous clash). A seed reproduces an opening only with the same deck.
- Kiro work with receipts: Orb Duel Spec, steering, hooks, a custom agent, a saved Workflow, a review Power with MCP, and a build log that separates Kiro, Codex, and Fable work ([brag sheet](../kiro-brag-sheet.md)).
- Unfinished, stated in our own documents: no human first-time playtest has been run ([judge script](judge-demo-script.md)); existing gameplay footage is recorded, but the **final narrated demo is not assembled and publicly uploaded**; Safari and real phone review is pending; the player problem is labelled a hypothesis ([rules-check.md](rules-check.md)).

## 2. What six public repositories show

Snapshot taken November 17, 2026. "Latest" is the newest commit on `main` at that time. Each row is my reading of that repository's own README and file tree. I did not run any of these games.

| Repository (latest commit) | Hook | Player loop | Public proof | Kiro evidence in the repo |
| --- | --- | --- | --- | --- |
| [DragonKingIO/slice-and-shout](https://github.com/DragonKingIO/slice-and-shout) (`e63971a`, 5 commits) | Webcam hand tracking plus a shout into the microphone; video stays on the device | Swipe pumpkins, never ghosts, shout to clear ghosts, three lives, speed rises | README only; no homepage set; built-in auto-play demo mode for recording | `.kiro` has 3 specs, 1 save hook, 1 steering file. No log, no tests in the tree |
| [Lainholic/kiroween-dinosaur-mud-3d](https://github.com/Lainholic/kiroween-dinosaur-mud-3d) (`dfbafa6`, 2 commits) | Text-adventure parser beside a 3D viewport, with an AI narrator over deterministic combat | Type commands through five rooms, shoot or stun, restore power | README links a 1:34 YouTube demo; no live URL set | 15 files under `.kiro`, including a `verification-report.md` generated by a test script; 25 test-related files |
| [roeku/lantern](https://github.com/roeku/lantern) (`b98d38d`, 8 commits) | Camcorder horror: the monster exists only on tape and looking through the lens gets you caught | Find 3 tapes, play them at the counter, get out; crouch to hide | README only in the tree reviewed; no demo URL found | Evidence table in `docs/kiro-evidence.md`; a "property bugs caught" section; 7 steering files; hook that runs sim tests on save |
| [Rafa-Innerchispa/ghostbridge-kiroween-2026](https://github.com/Rafa-Innerchispa/ghostbridge-kiroween-2026) (`c5f01f7`, 51 commits) | Not a game. A local lab that turns synthetic building signals into explainable incidents with a verifiable hash chain | Numbered click-through scenarios (nine steps in the README) | Browser edition published from `docs/` via Pages, per its README | 19 `.kiro` files, four Kiro-developed pull requests listed as merged, hook that runs tests on save |
| [dismality/last-rites](https://github.com/dismality/last-rites) (`873c1b4`, 100+ commits) | First-person cemetery survival; light is a resource; fair, telegraphed scares | Dig by day, survive by night, five relics, five nights, three endings | Vercel site returned HTTP 200. The README still shows `YOUR-DEPLOY-URL` and `YOUR-VIDEO` placeholders | 65 `.kiro` files: six hooks, eight steering docs, an MCP config, a dated Kiro log that labels work done outside Kiro. 334 test-related files |
| [LMH-gh/civkiro-1991-kiroween2026](https://github.com/LMH-gh/civkiro-1991-kiroween2026) (`bd1ef43`, 5 commits) | A spec-driven-development workbench, not a strategy game | Open the page and use a login shortcut the README provides | Pages site returned HTTP 200 | `.kiro` has 1 spec, 1 hook, 1 steering file in the tree, while the README lists more. Repository name and description say CivKiro; the README is titled NecroSpec Studio |

GitHub source repositories for the older InteractionKit and SpookBnB entries were not identified by Kiro. Their public Devpost project pages were independently verified by the coordinator, but they were not included in this 2026 GitHub sample.

## 3. Contrast with our three-lane seeded duel

What I observed in the six repositories, and what that suggests for us (observation, not a score claim):

1. **Most hooks are a sensor or a camera view.** Ours is a rules-first card duel where a seed reproduces a showdown. That is a different kind of hook. Among these six, only one other entry (Lantern) lists a property-test bug it found, and only Last Rites and Lantern keep a dated Kiro log with the same attribution habit as ours.
2. **Several READMEs state the play loop in one or two sentences.** Ours takes longer to explain: tribute costs, spell timing, simultaneous resolution. The seed 60 link is our shortcut.
3. **Public proof differs widely.** One has a 1:34 video, one has a live site with placeholder links in its README, two have working Pages sites, one has nothing but a README. Ours has a live site and footage, but the assembled video is not uploaded.
4. **Human evidence is rare in these six.** None of the READMEs reviewed shows a first-time-player observation. That does not make our gap smaller. Our own documents list it as the top open item.

## 4. Gaps in our entry

Open items taken from our own documents, not from competitors:

| Gap | Source |
| --- | --- |
| No observed human playtest | [judge script](judge-demo-script.md), [PROJECT-STATUS](../PROJECT-STATUS.md) |
| Existing gameplay footage is recorded, but the final narrated video is unfinished/unpublished; the required Kiro UI shots (K1, K2) are not captured | [judge script](judge-demo-script.md) |
| Write-up questions unanswered: compare apps, hooks' benefit, spec versus vibe coding, steering strategy, property-testing catches | [rules-check.md](rules-check.md) |
| Third-party disclosure paragraph and trademark wording in the video | [rules-check.md](rules-check.md) |
| First minute is rules-dense for a new player | proposal below; needs observation to confirm |

## 5. Two-minute player journey (proposal, existing screens only)

Uses only shipped features: the title menu, `?seed=0`, the guided first match (`?guide=1`), and `?seed=60`.

| Time | Player does | What they should be able to say afterward |
| --- | --- | --- |
| 0:00 | Open the URL and press Play. Sees the title menu | "A haunted-Western card game" |
| 0:15 | Seed 0: the Sheriff costs nothing. Pick the card, pick a lane | "A card becomes a character in a lane" |
| 0:40 | End turn. Watch the Skeleton hit back. An orb disappears | "Orbs are health, and hits land at the same time" |
| 1:10 | Play a second card. Read why a stronger card is not yet allowed | "Strong cards cost my own troops" |
| 1:40 | Finish the round and see both sides' orbs | "I know what I would do next round" |
| 2:00 | Stop. Optional link to seed 60 | |

## 6. Judge demo outline, under three minutes (proposal)

This compresses the existing [2:40 script](judge-demo-script.md) and does not replace it. Time budget is planned, not rehearsed.

| Time | Beat | Footage |
| --- | --- | --- |
| 0:00–0:15 | One-line premise and the title menu | Existing menu footage |
| 0:15–0:50 | Seed 60: two tributes, Mounted Billy enters, Singularity moves him | Existing seed 60 clip |
| 0:50–1:10 | The simultaneous clash; the defeated Billy still hits | Same clip |
| 1:10–1:50 | One actual saved Kiro Workflow result and the review Power's pass and stale outcomes | K1 and K2, **not yet recorded** |
| 1:50–2:20 | What is unproven: no first-time player yet; who built which part | Plain caption |
| 2:20–2:40 | URL and close | Menu held |

Leave a margin below 3:00 for a limit that is "less than three (3) minutes" ([rules-check.md](rules-check.md)).

## 7. Proposed success metrics for 3 to 5 human playtesters

Proposals. No playtest has been run. Five people cannot support a rate claim, so report counts and quotes only. Use the existing [protocol](judge-demo-script.md#part-2-first-time-human-playtest-protocol) for the script and record notes under `docs/evidence/`.

| Metric | How to observe | Signal worth a text change |
| --- | --- | --- |
| Time to first legal summon | Stopwatch from page load, no help | Two or more of five need over 90 seconds |
| Help requests before the first summon | Count questions | Same question from two people |
| Can explain a tribute in their own words after round 2 | Ask, then record verbatim | Two or more cannot |
| Can say why an orb disappeared | Ask after the first clash | Two or more cannot |
| Finishes round 3 unprompted | Observer note | Anyone quits before it |
| Would play another round (yes, no, why) | Ask last, record the reason | Reasons, not counts |

Treat results as observations about those people only. Do not call them a fun rating.

## 8. Prioritised gameplay text changes (proposals, no 3D, no rules changes)

Text in docs and existing UI strings only. Each needs the playtest above before it ships, and the user decides. None changes a card number or a rule.

| Priority | Proposal | Reason |
| --- | --- | --- |
| 1 | Lead the judge guide and `?seed=0` hint with one sentence: "Cards cost your own troops; the Sheriff is free." | Tribute is the least obvious rule and the first thing the 2:00 journey needs |
| 2 | Name the "why not allowed" reason when a card is unplayable (not enough troops to sacrifice) | Section 5, 1:10 step; check whether this text already exists before editing |
| 3 | After a clash, one plain line per lane in the clash log: who hit whom for how many orbs | Supports "why did an orb disappear"; the screen-reader log already exists |
| 4 | Shorten the first How to Play page to the three beats in section 5 | Verify against what the page shows today |
| 5 | Answer the open write-up questions in the packet, in the builder's own words | [rules-check.md](rules-check.md) lists them |

## 9. Boundaries

- **Trap A/B study (#78).** Trap slots stay deferred in [kiro-closeout-queue.md](../kiro-closeout-queue.md). This document makes no recommendation on traps and does not anticipate that study's outcome.
- **User-approved visual gates.** Nothing here creates, changes or approves art, poses, effects or animation. Any such idea goes to the user first, per `AGENTS.md`.
- **No copying.** No competitor art, text, assets or code was copied. Descriptions above are paraphrased from README text.
- **No prize or score estimate.** The rules weight five criteria equally ([rules-check.md](rules-check.md)). This comparison does not apply those weights to any entry.
