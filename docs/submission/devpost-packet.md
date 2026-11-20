# Kiroween submission packet: Showdown

> Draft for Alex's review. Revised November 20, 2026 (America/Los_Angeles) by a Kiro CLI worker, against `main` at [`96adf60`](https://github.com/alejandro-publius/cowboys-vs-wizards/commit/96adf6031b6159ab34fd7751180ced507f677104), the merge of PR #166. The public site's [build manifest](https://alejandro-publius.github.io/cowboys-vs-wizards/build.json) named that commit when this was written. Fields marked **OWNER** need facts or decisions that only Alex or the team can supply. The earlier lane-duel packet (November 16–17) is kept as history at [`96adf60`](https://github.com/alejandro-publius/cowboys-vs-wizards/blob/96adf6031b6159ab34fd7751180ced507f677104/docs/submission/devpost-packet.md).

## Pitch

**Cowboys vs. Wizards: Showdown** is a haunted-Western card duel you play in a browser. You pick every attack, your troops shield your Base, and turns alternate.

Here is one decision to try. Cowboy turn 5 of the Graveyard Dragon hunt: your Ranger (2 attack, 4 life) can hit the resting Dragon or the Jack-o'-Lantern in cover. With a recorded continuation (the same bot policy plays both sides after your choice), hitting the Dragon **wins on seed 3 and loses on seed 70**. Hitting the Jack does the reverse. Both positions are playable, and what you can see differs between them.

- [Seed 3 position](https://alejandro-publius.github.io/cowboys-vs-wizards/?turn=dragon-c5): the Ranger's supporting troop is a **Dynamiter** (3/1).
- [Seed 70 position](https://alejandro-publius.github.io/cowboys-vs-wizards/?turn=dragon-c5-70): the Ranger's supporting troop is a **Covered Wagon** (1/4).

Both also open from Camp (Play, then the Experiment controls), and neither touches your saved career. If you are testing a player, let them choose before you show this section.

## The two positions

The Wizard board is the same in both: Dragon 3/4 resting and Jack-o'-Lantern 1/1 in cover. Outcomes come from the engine's recorded lines, `c15` meaning "Cowboys win on turn 15".

| | Seed 3 | Seed 70 |
| --- | --- | --- |
| Ranger's supporting troop | Dynamiter 3/1 | Covered Wagon 1/4 |
| Cowboy trap set | Bear Trap | none |
| Wizard Base | 3 | 4 |
| Ranger → Dragon | Cowboys win, turn 15 | Wizards win, turn 14 |
| Ranger → Jack (the policy's own choice) | Wizards win, turn 10 | Cowboys win, turn 17 |

Three visible things differ: the supporting troop, the trap and the Wizard Base. The recorded positions cannot single out one of them as the cause. The search notes that the trap is the difference matching the original claim: on seed 3 the Bear Trap finishes the damaged Dragon. Each result is one deterministic bot line under fixed draws. None is a forced win, and none says anything about how humans play.

**Where it comes from.**
- Policy and search: the Cowboys run `planTurn` on a view rebuilt from `viewFor(state, "cowboy")`, so they see only public information. The Wizards run the unchanged level-2 bot. Kiro CLI searched held-out seeds 64–127 with the canonical engine. Sixty seeds offered both moves, and seed 70 was the counterexample closest to seed 3. [Search protocol and results](../../experiments/showdown-dragon-strategy/rival-README.md) · [Receipt with both fixtures](../../experiments/showdown-dragon-strategy/rival-cases.json) · [Search script](../../experiments/showdown-dragon-strategy/rival-search.mjs)
- Playable positions: each link replays 7 recorded Cowboy actions from a fresh deal and checks each one against the legal actions. It refuses to open unless the engine state hash equals the fixture (`fa80caa710a1` for seed 3, `abbe27d20382` for seed 70). [Route and checks](../evidence/showdown-turn-k095.md) · [Allowlist](../../src/match/showdown-turn.js) · [Node test, 11/11](../../tests/match/showdown-turn.test.js) · PR [#165](https://github.com/alejandro-publius/cowboys-vs-wizards/pull/165)
- Kiro native integration, PR [#166](https://github.com/alejandro-publius/cowboys-vs-wizards/pull/166): the installed Orb Duel Review Power 1.3.0 played Boot Hill through its own tools, then returned `pass`, `unbound` and `stale` for matching, unfingerprinted and altered engines ([installed Power run](../evidence/showdown-installed-power.md)). The saved `independent-release-review` Workflow ran natively: `wf_5fb9b905dc2ad28d` passed on its pinned revision and `wf_3f3cc7a5856eef24` refused a mismatched one ([native release review](../evidence/showdown-native-release-workflow.md)).

## What has been played, by whom

| Kind | What happened | Evidence |
| --- | --- | --- |
| Human, maintainer | Alex played Showdown on November 19 and chose it as the entry. A Camp playtest report Alex pasted records two Trail wins (Boot Hill in 13 turns, Raven Roost in 11) and 87 active seconds. The report does not identify the build. Alex is not a first-time player, so this is not part of the first-time cohort. | The report is held by the coordinator and is not committed. [Release line](../design/release-line.md) |
| Human, first-time | **None.** Three first-time playtests are pending, so no claim about clarity or fun is made. | [Playtest guide](../../prototypes/showdown/PLAYTEST.md) |
| Scripted browser | Headless Chrome selected both targets on both seeds by mouse, keyboard and touch (375×740). It also checked retry and checked that the saved career stayed byte-identical: 29/29 over `file://` and over local HTTP. The browser's play-out step only presses End turn, so the policy outcomes in the table are checked in Node, not in the browser. | [Browser checks](../evidence/showdown-turn-k095.md#second-decision-seed-70-k-008-2026-11-20) · [Check script](../../scripts/browser-showdown-turn-check.mjs) |
| Bot | Night Watch's scheduled Crew run on November 20 played 2,000 bot games: the first player won 57.1% and the Cowboys 59.4%. | [Scheduled run receipt](../evidence/night-shift/crew-scheduled-2026-11-20.json) |
| Native Kiro | See [How Kiro was used](#how-kiro-was-used-on-showdown). | |

**Planned, not done:** a public demo release, meaning the narrated video under three minutes and its public URL. A separate worker owns the [demo script and capture](judge-demo-script.md), which still describes the lane duel at this commit.

## Project

Cowboys vs. Wizards. The entry is **Showdown**, served at the [site root](https://alejandro-publius.github.io/cowboys-vs-wizards/). Play opens the Camp, which holds the Trail of duels, rivals, Wanted hunts, packs, the deck builder, best of three, two players on one screen and the Sheriff's Ledger. Wins, rewards and card choices are saved in the browser. The Showdown build is a graybox: a flat board, text cards, life orbs and a log. The illustrated 3D models and motion belong to the [earlier build](https://alejandro-publius.github.io/cowboys-vs-wizards/3d/), which keeps the retired lane rules.

**Who it is for:** people who play strategy and card games in a browser and want decisions that matter more than reflexes.

**Player problem (a hypothesis).** We think a card-duel player cannot easily tell why one target was right on a given board. The two positions above let a player try the same target choice on two boards and see what changed. No first-time player has tried this, so it is untested.

## Who did what

- **Fable 5.2** (Claude Code) designed Showdown: rules, cards, Trail, bots and art direction ([rulebook](../../prototypes/showdown/RULEBOOK.md), PR [#142](https://github.com/alejandro-publius/cowboys-vs-wizards/pull/142)). Fable also wrote the lane engine, its CPU and the lane judge script and playtest protocol. Fable owns game design, wording rulings, balance and any promotion of the Dragon decision to an official bounty.
- **Kiro** (CLI workers and Crew) moved Showdown into the game with its Trail, Camp and saves. It built the 29-card catalog (15 Cowboy, 14 Wizard), the ten combat cues, the fair Scout bot, the property tests, the keyboard focus fixes, the hosted page split, Night Watch's Showdown mode, the `showdown-presenter` profile, the MCP seat tools, both Dragon positions, Power 1.3.0 and the Showdown release Workflow. Kiro changed no rule, card number or wording. The Scout fix changed bot planning only, and Fable accepted it. Earlier, Kiro built the lane match presentation and its spec, and imported and rigged the characters ([character evidence](../evidence/kiro-character-assets.md)).
- **Codex** coordinated the workers, wrote the always-on `build-evidence.md` steering file and independently checked frozen candidates. For example, it ran 610 repository tests and the HTTP browser checks on `4069bf9`, the head of PR #166.
- **Rachel Selbrede** (`rachelselbrede`) has 13 commits under her account, all on November 16 during the lane era. They include the rules check (PR [#58](https://github.com/alejandro-publius/cowboys-vs-wizards/pull/58), produced in a Claude Code session), running CI on every pull request (#31), the opt-in clash log, the WebKit smoke check, the docs link check, the `?cpu=` levels and the first eight-topic Kiro write-up. **OWNER:** confirm how Rachel wants to be credited, and whether she is a teammate on the form.
- **Alex** chose Showdown after playing it, directs the visuals, supplied the Tripo exports, approved the illustrated title and Sheriff idle, and merges. The title illustration came from GPT Image in ChatGPT ([title provenance](../../assets/menu/README.md), [Sheriff idle](../evidence/kiro-approved-sheriff-idle.md)). **OWNER:** confirm any other artist credits and the source of the card illustrations.

## How Kiro was used on Showdown

The authoritative answers are the [eight Devpost answers in the judge write-up](kiro-brag-sheet.md#eight-devpost-answers), and the [evidence map](../kiro-brag-sheet.md) holds older history. Below, each topic gives the Showdown use first and labels earlier lane-duel use as history.

1. **Kiro apps.** Kiro CLI workers built and checked Showdown in separate worktrees. Kiro Crew ran Night Watch on a schedule, and the Overnight Rival bot kept the seed-3 claim in memory across a context reset ([Crew receipt](../../experiments/showdown-dragon-strategy/rival-crew-receipt.json)). A first return was manual. A later scheduled one-shot completed and recalled both positions. The Goals-page reminder returned 409. [scheduled Crew receipt](../evidence/showdown-rival-checkin.md). On Showdown the Kiro IDE was not used; it ran the lane-era spec session. Kiro Web and cloud sessions were not used.
2. **Custom agents.** The `showdown-presenter` profile (PR #153) auto-allows only Showdown tests and checks. In a test session, a lane test and a source write were held for approval ([profile](../../.kiro/agents/showdown-presenter.json)). History: `duel-presenter` for lane work.
3. **Hooks.** In a fresh `showdown-presenter` session, the SessionStart hook ran 18 Showdown tests and all passed (PR [#153](https://github.com/alejandro-publius/cowboys-vs-wizards/pull/153)). On a legal Bone Fence turn the post-write hook skipped an unrelated file, caught a broken Guard cue and passed on restoration. [Guard accessibility check](../evidence/showdown-guard-access/README.md). The compaction hooks were run by hand only. History: the lane card-save and doc-link hooks.
4. **Specs.** The `showdown-first-hour` spec (PR #149) maps each line of the brief to a numbered requirement and its tests ([requirements](../../.kiro/specs/showdown-first-hour/requirements.md), [requirements-to-tests map](../requirement-test-map.md)). It was **authored retroactively**, after the code, so it is not Requirements-First. The `showdown-camp-return-focus` bugfix spec was written by a Kiro CLI worker, and native bugfix-spec generation is unverified. History: the lane match was built Requirements-First in the Kiro IDE.
5. **Steering.** The always-on `AGENTS.md` and `build-evidence.md` apply to every Showdown worker. The `rules-area.md` file is scoped to `src/game/**`, which contains the Showdown engine. Two isolated native CLI sessions exercised matching and nonmatching Showdown reads and the always-on baseline. [native steering controls](../evidence/showdown-scoped-steering.md). The activation experiment from November 17 ran on lane-era files ([experiment](../evidence/kiro-scoped-steering-hook.md#file-scoped-activation-verified-on-november-17-2026-pacific)).
6. **MCP.** `start_showdown_duel`, `observe_showdown` and `act_showdown` play through the canonical engine with the Cowboy seat's view only. A Kiro CLI session won Boot Hill in 28 legal actions, and its revealed proof replays ([MCP receipt](../evidence/kiro-showdown-mcp.md)).
7. **Property testing.** PR #154 added seven generated Showdown properties. Each caught its planted fault, and the reduced failing cases replay alone ([test](../../tests/game/showdown-properties.test.js)). The cue tests check 1,922 slot marks over 80 seeds of random legal play ([cues](../evidence/graywave-cues.md)). No product bug was found. Properties sample cases; they do not prove correctness.
8. **Powers.** In an isolated Kiro profile, installed Orb Duel Review 1.3.0 played Boot Hill in 23 actions through its own tools. With the skill loaded explicitly, it returned `pass` for a matching engine, `unbound` for an older receipt and `stale` after one file of a copied engine changed ([installed Power run](../evidence/showdown-installed-power.md)). **Pending:** automatic activation of the skill. Kiro saw it but did not load it unprompted. Alex's own installed copy is still 1.1.0.

**Workflows and Crew jobs.** The native `independent-release-review` runs are listed above. On its pinned revision the passing run recorded 167/167 Node tests and six Chrome checks. That revision predates the seed-70 position, so seed 70 was not in its sweep. A second independent run on the two-position build passed 172 tests and refused a deliberately wrong commit (PR #166). The native Night Shift Workflow also completed its staged Sheriff draft, rejection and replay. [native Sheriff review](../evidence/night-shift-native-showdown.md). Night Watch's scheduled run is the November 20 receipt above ([Night Shift evidence](../evidence/night-shift.md)).

## Implementation

The Showdown rules are plain JavaScript in `src/game/showdown/`, with no DOM, rendering or network code. The graybox page (`src/app.js`) reads only the active seat's view. Three.js and Rapier power the earlier 3D build. Current counts on `96adf60`, run for this packet: `npm test` 610/610, and `tests/match/showdown-turn.test.js` 11/11.

## Third-party tooling and attribution

- **Libraries and build.** The installed versions identify Three.js 0.180.0 and esbuild 0.28.2 as MIT, and Rapier 0.12.0 as Apache-2.0. The repository uses MIT.
- **Assets and motion (earlier 3D build).** The original Tripo exports are preserved. Blender Game Skills and Lucca Cerf's Character Factory served as references. The Sheriff idle uses Mixamo's `headShake` clip. Quaternius motion was used in a separate Billy preview. The title illustration came from GPT Image in ChatGPT. [Motion sources](../character-animation-plan.md) · [License risks](rules-check.md#risks-to-settle-before-submitting). The Showdown graybox adds no art.
- **Other AI tools:** Fable (Claude Code) and Codex, as attributed above.
- **Testing and hosting:** headless Chrome over the DevTools protocol, GitHub Actions and GitHub Pages.
- **Pre-existing work disclosure: OWNER.** The first commit (November 14, 2026) preserves an existing board demo. The rules require disclosing pre-existing work and confirming it was made after October 30. Only Alex knows when the demo and the Tripo exports were made.

## Category and bonuses

- **Category: OWNER.** The lane-era draft proposed Costume Contest on the strength of the illustrated arena. The Showdown entry is a graybox, and the illustrated art lives in the `/3d/` build. Alex should choose the category with that in mind.
- **Crew bonus:** the Night Watch app has [its own repository](https://github.com/alejandro-publius/cowboys-vs-wizards-night-watch). Its form write-up is not drafted.
- **Blog bonus:** requires a public third-party post that mentions Kiroween 2026. See the draft [build story](build-story.md), which still tells the lane-era story.
- **Social bonus:** optional. A person must write it; no agent should. Nothing has been posted.
- **Student eligibility: OWNER.** Requires current enrollment and details for every teammate. School affiliation alone is insufficient.

Official rules: https://kiroween.devpost.com/rules. Deadlines: credit requests by December 1, 2026 at 12:00 p.m. Pacific; submission by December 4, 2026 at 2 p.m. Pacific.

## URLs

- Game: https://alejandro-publius.github.io/cowboys-vs-wizards/
- Dragon positions: [seed 3](https://alejandro-publius.github.io/cowboys-vs-wizards/?turn=dragon-c5) · [seed 70](https://alejandro-publius.github.io/cowboys-vs-wizards/?turn=dragon-c5-70)
- Earlier illustrated 3D build (lane rules): https://alejandro-publius.github.io/cowboys-vs-wizards/3d/
- Source: https://github.com/alejandro-publius/cowboys-vs-wizards
- Kiro write-up: https://github.com/alejandro-publius/cowboys-vs-wizards/blob/main/docs/submission/kiro-brag-sheet.md
- Crew app: https://github.com/alejandro-publius/cowboys-vs-wizards-night-watch
- Demo video (public YouTube, under three minutes): **OWNER, PENDING.** A private scripted [85-second Showdown demo script](judge-demo-script.md) is available for review. Alex owns public publication. The rules forbid third-party trademarks in the video ([rules check](rules-check.md#risks-to-settle-before-submitting)).
- Third-party blog: **OWNER, PENDING.**

## Required form fields and owner inputs still open

- Demo video: narration, Kiro UI footage and the public YouTube URL
- Category selection; Crew, blog and social bonuses if entering them
- Personal reflection on using Kiro, and the spec-versus-direct comparison in the builder's words (none should be generated)
- Pre-existing work disclosure: when the board demo and the Tripo exports were made
- Artist credits and the source of the card illustrations; missing Tripo and Mixamo license metadata
- Team: current enrollment if claiming student status, every teammate joined on Devpost, Rachel's credit, and credit requests by December 1
- Three first-time human playtests
- Fable's approval of the first-draft Camp, mode, `/3d/` and Ledger wording, and Fable's decision on the Dragon positions ([release line](../design/release-line.md))
- Final check of the served build and these links on submission day
- Alex's approval of this packet, and confirmation that it was submitted

## History

The lane-era packet described the three-lane duel: tribute summons, simultaneous clashes such as Mounted Billy taking the Dragon from five orbs to two on seed 60, and release receipts on `892cada`. It is preserved [at `96adf60`](https://github.com/alejandro-publius/cowboys-vs-wizards/blob/96adf6031b6159ab34fd7751180ced507f677104/docs/submission/devpost-packet.md), and the judge write-up's [lane-duel section](kiro-brag-sheet.md#earlier-lane-duel-work-historical) summarizes it. None of it is Showdown testing.
