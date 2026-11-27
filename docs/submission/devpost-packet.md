# Kiroween submission packet: Showdown

Draft for Alex’s review. The pitch and Built With tags below are ready to paste into Devpost. [Play the Saloon](https://alejandro-publius.github.io/cowboys-vs-wizards/?saloon=review) · [Judge walkthrough](../JUDGE-GUIDE.md) · [Demo transcript and captions](judge-demo-narration.md)

## Pitch

In Cowboys vs. Wizards, the Graveyard Dragon can burn your whole line. Win its fifth bounty hunt and you can put that same monster in your deck. This haunted Western card game starts at Boot Hill with 16 cards and a six-stop Trail. Even a first-time visitor can walk into the Night Shift Saloon, take the Ranger’s place on a recorded hunt and decide whom to shoot. [Scout the Dragon](https://alejandro-publius.github.io/cowboys-vs-wizards/?room=wanted)

At another Saloon table, Kiro CLI proposed taking an attack point from Billy. A separate reviewer used a written Kiro spec to check it. Across 100,000 held-out bot duels, the Cowboys’ win rate moved from 59.792% to 51.920%. The Saloon lets players try the proposal while the Trail keeps Billy’s original attack. Other game makers can rerun the same balance check with `node scripts/billy-balance-gate.mjs --arm candidate`. [Kiro spec](../../.kiro/specs/night-shift-balance-contract/requirements.md) · [Recorded workflow](../evidence/kiro-night-shift-native.png) · [Audit and reproduction steps](../evidence/billy-seat-audit/README.md)

## What a judge can try

| Devpost criterion | See it in Showdown |
| --- | --- |
| Potential impact | A first-time strategy player can [scout the Dragon](https://alejandro-publius.github.io/cowboys-vs-wizards/?room=wanted) and try their own move before putting a career win on the line. The [build notes](../PROJECT-STATUS.md#current-build) track the outstanding first-time player test. |
| Technological implementation | Follow one [recorded Kiro review](../evidence/kiro-contest-run.md#balance-run) from a proposed card edit to a reviewer’s decision. The [paired-seed audit](../evidence/billy-seat-audit/README.md) lets another developer repeat the larger experiment. |
| Design | The same Dragon appears as a bounty poster, an opponent and an earned deck card. [See the hunt and deck on real screens](../../README.md#from-a-wanted-poster-to-your-deck). |
| Innovation / idea | Choose a target in the Saloon’s recorded Dragon deal, reveal what happened to each choice, then [take over the Ranger’s turn](https://alejandro-publius.github.io/cowboys-vs-wizards/?turn=dragon-c5). |
| Presentation | The [judge walkthrough](../JUDGE-GUIDE.md) opens on a playable choice and links to the original Kiro evidence. The public video link is still pending. |

## Built With

Kiro, JavaScript, Node.js, Three.js, Python, fast-check, GitHub Actions, GitHub Pages.

Kiro features used here include CLI Workflows, separate preparer and reviewer agents, specs, hooks, scoped steering, a Power with MCP tools, and a scheduled Kiro Crew run. [Feature-by-feature evidence](#how-kiro-was-used-on-showdown) · [Tracked Kiro project files](../../.kiro/)

## The Kiro balance decision

| | Billy 2 attack (current card) | Billy 1 attack (proposal) |
| --- | --- | --- |
| Recorded deal: seed 726421019, Cowboys first, turn 7 | Clears the Bone Wall. Cowboys win on turn 13. | The Wall survives on 1 orb. Wizards win on turn 20. |
| Cowboy share, 100,000 Node duels on held-out seeds | 59.792% | 51.920% |
| First player's share, same duels | 59.412% | 58.136% |
| NSB-1 / NSB-2 | RED / PASS | PASS / PASS |
| Cowboy share, 10,000 games on fresh seeds | 61.04% | 52.92% |

The two versions share the first 29 events of the recorded deal. All of these results come from level-2 bots with fixed decks at `eedab93`. None of them predicts human play. An opening advantage remains under the proposal.

**Where it comes from.**
- Proposal: Kiro CLI proposed three one-number changes in an isolated worktree. The reviewer passed only Billy, with Cowboy wins of 60.75% → 50.25% on tuning seeds and 59.00% → 51.00% on holdout seeds ([Kiro run](../evidence/kiro-contest-run.md#balance-run)).
- Written gate: NSB-1 and NSB-2 in the [balance contract spec](../../.kiro/specs/night-shift-balance-contract/requirements.md). The balancing agent never edits that file. The economist review still has findings E1 and E3 open.
- Review and replay: a separate reviewer step decides. The audit Workflow `wf_27f8bf0bb063c889` completed. A read-only Kiro CLI review checked the replay ([seat audit](../evidence/billy-seat-audit/README.md) · [Billy replay](../evidence/billy-replay.md)). On November 26 we reran the gate for both arms. It re-derived the totals from all 100,000 recorded duels and verified both audit digests. The current card missed the faction target (exit 2). The proposal passed both requirements (exit 0). [Gate and recorded results](../evidence/billy-seat-audit/README.md)
- Control: in native Workflow `wf_3e26f2fcd93c25a1`, Kiro chose its own card six times and the reviewer rejected all six.

## What has been played, by whom

| Kind | What happened | Evidence |
| --- | --- | --- |
| Human, maintainer | Alex played Showdown on November 19 and chose it as the entry. His saved Camp report records two Trail wins: Boot Hill in 13 turns and Raven Roost in 11, 87 active seconds in total. The report does not identify the build. Alex is not a first-time player. | [Release line](../design/release-line.md) |
| Human, first-time | Alex confirmed that the playtests were completed. First-time participant counts and individual feedback are not documented. | [Playtest guide](../../prototypes/showdown/PLAYTEST.md) |
| Scripted browser | The illustrated Saloon was played on desktop, portrait phone and landscape phone. Fire for 2 and Fire for 1 resolve through the pinned rules. On the proposed line the player can attack or take cover on turn nine. The regression also checks an existing career save after the trial. | [Public release](https://github.com/alejandro-publius/cowboys-vs-wizards/pull/225) · [Browser checks](../../scripts/check-pages-tree.mjs) |
| Bot | The balance results in the table above. Earlier, Night Watch's scheduled Crew run on November 20 played 2,000 bot games: the first player won 57.1% and the Cowboys 59.4%. | [Seat audit](../evidence/billy-seat-audit/README.md) · [Scheduled run receipt](../evidence/night-shift/crew-scheduled-2026-11-20.json) |
| Native Kiro | See [How Kiro was used](#how-kiro-was-used-on-showdown). | |

The current 1:20 review cut follows Billy’s shot and the turn-nine choice. It shows the Kiro CLI workflow record, the actual balance spec and the held-out bot results. The 1:59 cut from the earlier release also covers Camp and the referee. [Transcript, captions and footage sources](judge-demo-narration.md)

## Project

The illustrated title opens the Night Shift Saloon, Ride or Fight?, Camp and the card gallery. In the Saloon, the performers replay Kiro’s recorded shift while the rules engine runs the player’s choices in the browser. On turn nine, attacking the Headless Horseman costs the Cowboys the duel. Taking cover from the same position wins it. The developers can also witness an active Kiro shift on their own computer. [Play the Saloon](https://alejandro-publius.github.io/cowboys-vs-wizards/?saloon=review) · [Local live feed](../evidence/kiro-saloon-live-witness.md)

Camp holds the Trail, rivals, two Wanted bounties, packs, the 16-card deck builder and local two-player games. Wins, rewards and decks share a browser save. Ride or Fight? lets a player try a second tactical decision with the Outrider. [Play Showdown](https://alejandro-publius.github.io/cowboys-vs-wizards/) · [Lightweight Camp](https://alejandro-publius.github.io/cowboys-vs-wizards/graybox/)

## Who did what

- **Fable 5.2** (Claude Code) designed Showdown: rules, cards, Trail, bots and art direction ([rulebook](../../prototypes/showdown/RULEBOOK.md), PR [#142](https://github.com/alejandro-publius/cowboys-vs-wizards/pull/142)). Fable also wrote the lane engine, its CPU, and the lane judge script and playtest protocol. Fable owns game design, wording rulings, balance, and the approval of any card change.
- **Kiro** (CLI workers, native Workflows and Crew) moved Showdown into the game with its Trail, Camp and saves. Kiro built the 29-card catalog, the combat cues, the fair Scout bot, the property tests, the `showdown-presenter` profile, the MCP seat tools and Power 1.3.0. For the contest it built the Outrider gate and its save hook, the contest task and save checks, and the Billy proposal run. It also ran the Saloon lifecycle and live-feed checks. Kiro changed no rule, card number or wording. Earlier, Kiro built the lane match presentation and its spec, and imported and rigged the characters ([character evidence](../evidence/kiro-character-assets.md)).
- **Codex** coordinated workers, wrote the always-on `build-evidence.md` steering file and checked frozen candidates independently. It staged the illustrated release, measured the fresh-seed Billy sample, integrated the playable Saloon table with both pinned engines, and recorded the November 26 demo. [Saloon implementation](https://github.com/alejandro-publius/cowboys-vs-wizards/pull/225)
- **Claude Code** (Opus 5.5) drafted the Billy Ledger interaction, its focused tests and the first verifier ([Billy replay](../evidence/billy-replay.md)). On November 23 it ran the referee and Wizard-lesson sessions ([handoff](../evidence/claude-cli-followup-20261123.md)) and wrote the recording script.
- **Rachel Selbrede** (`rachelselbrede`) has 13 commits under her account, all on November 16 during the lane era. They include the rules check (PR [#58](https://github.com/alejandro-publius/cowboys-vs-wizards/pull/58), produced in a Claude Code session), CI on every pull request (#31), the opt-in clash log, the WebKit smoke check, the docs link check, the `?cpu=` levels and the first eight-topic Kiro write-up. **OWNER:** confirm how Rachel wants to be credited, and whether she is a teammate on the form.
- **Alex** chose Showdown after playing it, asked for the illustrated Showdown as the public game, directs the visuals, supplied the Tripo exports, approved the illustrated title and Sheriff idle, and merges. The title illustration came from GPT Image in ChatGPT ([title provenance](../../assets/menu/README.md), [Sheriff idle](../evidence/kiro-approved-sheriff-idle.md)). **OWNER:** confirm any other artist credits and the source of the card illustrations.

## How Kiro was used on Showdown

The evidence files linked below are authoritative. The [judge write-up](kiro-brag-sheet.md#eight-devpost-answers) was written before the November 22–23 contest evidence. The [evidence map](../kiro-brag-sheet.md) holds older history.

1. **Kiro apps.** Kiro CLI workers built and checked Showdown in separate worktrees. Native Kiro CLI Workflows ran the balance loop and the audit. Kiro Crew ran Night Watch on a schedule, and the Overnight Rival recalled the Dragon claim after a context reset ([scheduled Crew receipt](../evidence/showdown-rival-checkin.md)). The Kiro IDE authored the Bear Trap bugfix spec ([evidence](../evidence/showdown-bear-trap.md)). Kiro Web and cloud sessions were not used.
2. **Custom agents.** The `showdown-presenter` profile auto-allows only Showdown tests and checks ([profile](../../.kiro/agents/showdown-presenter.json)). The balance loop uses separate preparer and reviewer profiles ([preparer](../../.kiro/agents/contest-balance-preparer.json), [reviewer](../../.kiro/agents/contest-balance-reviewer.json)).
3. **Hooks.** The `check-outrider-gate` `PostFileSave` hook failed a deliberate rules change ("0 fresh, 10 stale") and passed its revert. Each receipt carries the Kiro session ID and the hook event name ([receipts](../evidence/outrider-gate/hook-receipts.jsonl)). One double save missed the change; it was recorded and not counted. The native fence blocked a probe write under `src/game/` before it ran, and `PreToolUse` refused a task-checklist edit while the gate stamp was stale ([contest run](../evidence/kiro-contest-run.md)). Earlier, the Guard cue hook caught a removed cue ([Guard check](../evidence/showdown-guard-access/README.md)). IDE hook behaviour is not shown.
4. **Specs.** The [balance contract](../../.kiro/specs/night-shift-balance-contract/requirements.md) writes the gate as NSB-1 and NSB-2 and has economist and rules-lawyer reviews. The [Outrider gate](../../.kiro/specs/outrider-gate/requirements.md) (G1–G7) and the [Night Shift saloon](../../.kiro/specs/night-shift-saloon/requirements.md) specs map requirements to checks. The `showdown-first-hour` spec was **written after the code**, so it is not Requirements-First. History: the lane match was built Requirements-First in the Kiro IDE.
5. **Steering.** The always-on `AGENTS.md` and `build-evidence.md` apply to every worker. [`rules-area.md`](../../.kiro/steering/rules-area.md) is scoped to `src/game/**`. Two isolated native CLI sessions loaded it for an engine read and left it out for a UI read ([steering run](../evidence/showdown-scoped-steering.md)).
6. **MCP.** `start_showdown_duel`, `observe_showdown` and `act_showdown` play through the canonical engine with the Cowboy seat's view only. A Kiro CLI session won Boot Hill in 28 legal actions ([MCP receipt](../evidence/kiro-showdown-mcp.md)).
7. **Property testing.** Seven generated Showdown properties each caught their planted fault ([test](../../tests/game/showdown-properties.test.js)). The contest gates added four fast-check properties, run at 60 cases each, and the save hook runs them at 15 cases each ([gates](../evidence/kiro-contest-gates.md)). Properties sample cases; they do not prove correctness.
8. **Powers.** The installed Orb Duel Review 1.3.0 played Boot Hill through its own tools. With the skill loaded explicitly, it returned `pass`, `unbound` and `stale` correctly ([installed Power run](../evidence/showdown-installed-power.md)). **Pending:** automatic activation. Alex's own installed copy is 1.1.0.

**Saloon: recorded vs. live.** Public builds replay only the checked-in recording. Live mode is opt-in: `?saloon=live` on a loopback HTTP page served by `scripts/night-shift-saloon.mjs`. In one native session, nine `fs_write` events reached the screen. At a 3,000 ms poll they took 154–2,818 ms, and at 1,000 ms they took 298–827 ms. The run used one machine, headless Chrome and an undeployed candidate. The 2-second target has no approved source ([live witness](../evidence/kiro-saloon-live-witness.md)).

**Workflows.** `wf_87723b3404bba1fc` covered the balance run; its [still](../evidence/kiro-night-shift-native.png) was rendered from the CLI stream. `wf_3e26f2fcd93c25a1` ran the six-attempt control. `wf_27f8bf0bb063c889` ran the audit. Earlier, `independent-release-review` passed on its pinned revision and refused a mismatched one ([native release review](../evidence/showdown-native-release-workflow.md)).

## Implementation

The Showdown rules are plain JavaScript in `src/game/showdown/`, with no DOM, rendering or network code. The illustrated page lives in `src/ui/showdown-3d/` and is built with Three.js. The release in [PR #225](https://github.com/alejandro-publius/cowboys-vs-wizards/pull/225) passed 1,214 Node tests and 29 staged Pages checks. The browser checks include the Saloon on a short screen and an existing career save. [GitHub test run](https://github.com/alejandro-publius/cowboys-vs-wizards/actions/runs/45870764428) · [Public deployment](https://github.com/alejandro-publius/cowboys-vs-wizards/actions/runs/45871718146)

## Public repository check

On November 26, GitHub served the repository publicly and identified its root license as MIT. The filmed revision tracks 246 files under `.kiro/`. Git ignores local `.env` and `.env.*` values. A redacted Gitleaks 8.30.1 scan of the tracked release and a scan of the main branch history flagged the same five locations, including repeat appearances when branches merged. The matches were one deck name and four references to two SHA-256 identifiers used by the scout cache and referee receipts. [License](../../LICENSE) · [Ignore rules](../../.gitignore) · [Deck label](../../scripts/deck-balance.mjs) · [Scout cache](../../scripts/field-trial-scout.mjs) · [Referee receipt lookup](../../scripts/referee/hellfire-parity-probe.mjs)

## Third-party tooling and attribution

- **Libraries and build.** The lockfile pins Three.js 0.185.1, esbuild 0.28.2 and fast-check 4.11.0, all MIT. The repository uses MIT.
- **Assets and motion.** The original Tripo exports are preserved. Blender Game Skills and Lucca Cerf's Character Factory served as references. The Sheriff idle uses Mixamo's `headShake` clip. Quaternius motion was used in a separate Billy preview. The title illustration came from GPT Image in ChatGPT. [Motion sources](../character-animation-plan.md) · [License risks](rules-check.md#risks-to-settle-before-submitting). **OWNER:** confirm asset provenance for the illustrated Showdown build.
- **Other AI tools:** Fable and Claude Code, and Codex, as attributed above.
- **Testing and hosting:** headless Chrome over the DevTools protocol, GitHub Actions and GitHub Pages.
- **Pre-existing work disclosure: OWNER.** The first commit (November 14, 2026) preserves an existing board demo. The rules require disclosing pre-existing work and confirming it was made after October 30. Only Alex knows when the demo and the Tripo exports were made.

## Category and bonuses

- **Proposed category for the form — Costume Contest.** At the Saloon, the Wizard brings a change to the table. The player fires the disputed shot and can take over the duel. The haunted room gives the player a job in the review. Alex confirms the category when submitting.
- **Crew bonus.** Night Watch compares two game commits on the same deals. [Crew bonus write-up and recorded runs](night-watch-crew-writeup.md) · [Standalone app](https://github.com/alejandro-publius/cowboys-vs-wizards-night-watch)
- **Blog bonus:** requires a public third-party post that mentions Kiroween 2026. The publishable [build story](build-story.md) opens with the Billy audit. The earlier lane version is archived below its end marker.
- **Social bonus:** optional. A person must write it; no agent should. Nothing has been posted.
- **Student eligibility: OWNER.** Requires current enrollment and details for every teammate. School affiliation alone is insufficient.

Official rules: https://kiroween.devpost.com/rules. Deadlines: credit requests by December 1, 2026 at 12:00 p.m. Pacific; submission by December 4, 2026 at 2 p.m. Pacific.

## URLs

- Game: https://alejandro-publius.github.io/cowboys-vs-wizards/
- Build manifest: https://alejandro-publius.github.io/cowboys-vs-wizards/build.json
- Source: https://github.com/alejandro-publius/cowboys-vs-wizards
- Judge guide: https://github.com/alejandro-publius/cowboys-vs-wizards/blob/main/docs/JUDGE-GUIDE.md
- Crew app: https://github.com/alejandro-publius/cowboys-vs-wizards-night-watch
- Demo video (public YouTube, under three minutes) **OWNER, PENDING.** The 1:20 Saloon cut has English narration and captions. Alex reviews the cut and asset credits before publication. [Transcript and caption file](judge-demo-narration.md) The [official rules](https://kiroween.devpost.com/rules) specify permission for third-party material in the video.
- Third-party blog: **OWNER, PENDING.**

## Required form fields and owner inputs still open

- Demo video approval and public YouTube URL
- Category selection; Crew, blog and social bonuses if entering them
- Personal reflection on using Kiro, and the spec-versus-direct comparison in the builder's words (none should be generated)
- Pre-existing work disclosure: when the board demo and the Tripo exports were made
- Artist credits, the source of the card illustrations, and asset provenance for the illustrated build; missing Tripo and Mixamo license metadata
- Team: current enrollment if claiming student status, every teammate joined on Devpost, Rachel's credit, and credit requests by December 1
- Individual playtest observations for any claim about clarity or fun
- Design approval or rejection of Billy attack 2 → 1; Fable's approval of the Camp, Ledger and Saloon wording ([release line](../design/release-line.md))
- A deploy of the submitted revision, and a final check of the served build and these links on submission day
- Alex's approval of this packet, and confirmation that it was submitted

## History

- **Dragon turn-five decision (November 20 draft).** Two playable positions, [seed 3](https://alejandro-publius.github.io/cowboys-vs-wizards/?turn=dragon-c5) and [seed 70](https://alejandro-publius.github.io/cowboys-vs-wizards/?turn=dragon-c5-70), where the bots' better target flips. It was recorded against `96adf60`, with 610/610 tests run for that draft. [Search and replay](../../experiments/showdown-dragon-strategy/rival-README.md) · [route and checks](../evidence/showdown-turn-k095.md). These are bot lines, not human results.
- **Lane-era packet (November 16–17).** It covered the three-lane duel, seed 60 and the release receipts on `892cada`. It is preserved [at `96adf60`](https://github.com/alejandro-publius/cowboys-vs-wizards/blob/96adf6031b6159ab34fd7751180ced507f677104/docs/submission/devpost-packet.md) and summarized in the [lane-duel section](kiro-brag-sheet.md#earlier-lane-duel-work-historical). None of it is Showdown testing.
