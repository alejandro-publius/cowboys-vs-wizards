# Release line and scoreboard

Fable 5.2, Wednesday November 18, 2026, Pacific. Based on Alex's four decisions that evening and an audit of the branches at 7:45 p.m. The integration branch was `kiro/frontier-pack`. It was published to `main` at `5ee6a3a`, where 448 tests passed and both builds compiled.

**Updated Thursday November 19** after Alex played Showdown and chose it for the December 4 entry, and after pull requests 139 to 145 merged.

## Current status, November 20 (supersedes the November 19, 10:15 p.m. handoff)

Added by Kiro (Kiro CLI, coordinator job `graywave-assemble`) from GitHub `main` `4d52642`, the merge of pull request 148; milestones refreshed by job `graywave-night-join` from `main` `6b6caef`. It records state and quotes Fable's decisions; it makes none. Fable's text further down is unchanged and reads as of its own date. Where it differs, this section and the latest Fable comment on [issue 143](https://github.com/alejandro-publius/cowboys-vs-wizards/issues/143) are current. The 10:15 p.m. handoff that stood here is replaced: slices 2 and 3 are on main.

**Target.** Showdown is the December 4 fight and the game being built. It is the only game in the graybox.

**Experiment for Fable.** Camp opens two save-isolated experiments. In the [first position](https://alejandro-publius.github.io/cowboys-vs-wizards/?turn=dragon-c5) the Ranger fights alongside the Dynamiter. In the [second Dragon position](https://alejandro-publius.github.io/cowboys-vs-wizards/?turn=dragon-c5-70) it fights alongside the Covered Wagon. Compare the Dragon and Jack as targets on each deal. [Decision and replay evidence](../../experiments/showdown-dragon-strategy/rival-README.md). Fable owns promotion into an official bounty.

**November 20 sprint handoff.** Camp records the finishing build per duel, including offline play. Untagged history stays unattributed. The scheduled rival recalled the two Dragon targets. Native Night Shift rejected the staged Sheriff buff on both the tuning and holdout sets. Two native steering controls confirmed different guidance for engine and UI reads. [Camp export and migration check](../evidence/showdown-build-identity-k087.md) · [scheduled Crew receipt](../evidence/showdown-rival-checkin.md) · [native Sheriff review](../evidence/night-shift-native-showdown.md) · [native steering controls](../evidence/showdown-scoped-steering.md).

**Milestones.**

| State | What |
| --- | --- |
| Merged to `main` | Pull requests 144 to 161, including slice 1 (144), the 29-card catalog (145), slice 2's Trail and Camp (148), the hosted graybox bootstrap (157) and slice 3 (161, `6b6caef`: Camp modes, lane retirement, Showdown at `/`) |
| Night Shift integration | The Night Shift ([pull request 163](https://github.com/alejandro-publius/cowboys-vs-wizards/pull/163), `kiro/graywave-night-join`): the Sheriff's Ledger at the end of the Camp, Night Watch's target-band check with an opt-in scheduled issue path, and the Night Shift reviewer. Also the Showdown MCP seat tools and the judge write-up refresh. It changes no card, rule, reward or wording. Receipts and what has not run: [Night Shift evidence](../evidence/night-shift.md). |
| Overnight strategy replay | [PR 162](https://github.com/alejandro-publius/cowboys-vs-wizards/pull/162) contains the Ranger’s decision, Crew memory receipt, held-out reversal and reward-focus regression. |
| Pending, human | Three first-time playtests (below). Fable's approval of first-draft wording: the Camp and mode labels, the `/3d/` label and the Sheriff's Ledger text. Fable/Alex: whether Night Watch gets a target band, and any card change a Night Shift review proposes. |

**Site layout after slice 3** (built by `node scripts/stage-pages.mjs`, checked by `node scripts/check-pages-tree.mjs`):

| Path | What |
| --- | --- |
| `/` | The graybox game. Play opens the Showdown Camp. |
| `/graybox/` | The same file, for existing links |
| `/showdown/` | The Showdown reference page |
| `/3d/` | The earlier illustrated 3D build on the lane rules, labelled as the earlier build. It holds the models, board and motion. |

**Lane play.** No lane play is reachable from the graybox, by menu or URL. An old `?mode=` address opens the Showdown menu. The lane rules stay only where the 3D page (`src/main.js`) imports them, as Fable ruled on [issue 143](https://github.com/alejandro-publius/cowboys-vs-wizards/issues/143#issuecomment-7031863563). Lane evidence and specs stay as history.

**Keepsakes** (Fable on [pull request 148](https://github.com/alejandro-publius/cowboys-vs-wizards/pull/148#issuecomment-7031816529)): "**Nothing from the lane game carries into Showdown progress.**" A lane capture shows in the Camp as a keepsake and is not equippable. Start over resets Showdown progress only, and keepsakes stay out of save codes.

**Where future decisions appear.** Fable posts game decisions as comments on [issue 143](https://github.com/alejandro-publius/cowboys-vs-wizards/issues/143), or on the pull request they concern. Agents read the latest Fable comment there before starting Showdown work.

**Canonical base and branch ownership.** Branch from the current GitHub `main`, one branch and one worktree per worker. A worker edits only its assigned paths and never another worker's branch. Pull requests go to `main`. The coordinator merges, and no agent merges its own pull request.

**Held drafts.** [Pull request 10](https://github.com/alejandro-publius/cowboys-vs-wizards/pull/10) (Wizard Firebolt and burning reaction) is held because its release gate is unmet: it needs approved Firebolt card art, a clip chosen by Alex, rendered frame review and seed 0 and 60 replays. [Pull request 53](https://github.com/alejandro-publius/cowboys-vs-wizards/pull/53) (Billy's sourced pistol idle) is held because review found the supporting hand misses the grip. Both are 3D lane-build work and stay drafts.

**Human playtests (the remaining gate).** No first-time player has played Showdown or the lane duel. Alex's own play chose the fight but does not count. The three first-time tests in [the playtest guide](../../prototypes/showdown/PLAYTEST.md) are still pending. Bot and browser checks support flow, storage and privacy claims only, not clarity or fun.

This file is the one place that says what is in the game, what is waiting, and what is out. If something is not listed under "In the game", it is not in the submission.

## What we are building

Cowboys vs. Wizards: the proven parts of Yu-Gi-Oh (mostly), Magic and Pokémon, themed, quick to play and easy to read. The graybox is the game while the rules are still soft. Models, animation and the board go on top once a release is locked.

## The fight: Showdown, decided November 18

Alex played the lane duel that night and found it was not fun: strong troops did not protect the Base and he never chose an attack. He chose the Showdown fight for the deeper rules: you pick each attack, troops shield the Base, turns alternate.

**Showdown is the fight in the December 4 entry.** Alex played it on November 19 and liked it a lot more than the lane duel.

- Its engine is in the game (`src/game/showdown/`, pull request 144). Play in the graybox opens its first duel, Boot Hill.
- The Trail, rivals, bounties, packs and the deck builder are still only on the [Showdown page](../../prototypes/showdown/README.md). Moving the Trail in is slice 2 of the [integration brief](showdown-integration-kiro-brief.md).
- The lane duel stays reachable at `?mode=lanes` until slice 3 retires it. No new lane content is written. *(Kiro, November 20: slice 3 retires it; see Current status above.)*

## Three finish lines, in order

Alex chose all three scopes. They are built one after another, never together.

| Release | Scope | Locked when |
| --- | --- | --- |
| **1. Skeleton** | About 34 cards, 17 a side. You play Cowboys against the AI. Bounties, deck building, three or four rivals. | Every card has a job, a counter and a seeded check, and first-time players can finish the first session unassisted. |
| **2. Either faction** | The same cards. You can play Wizards against an AI Cowboy. | Wizard deck building, unlocks and one Wizard first session pass the same checks. |
| **3. Two players** | Two people duel each other. | Decided after Release 2. No work before then. |

The 3D skin starts for a release only after that release is locked. It follows the presentation prompt: every card and event gets a named slot, and a model is a data change.

Release 1 will not reach 34 cards by December 4. The entry is a snapshot of it.

## December 4: submit the skeleton

The graybox is the playable entry, described honestly as the rules-first build. Its fight is Showdown. The existing 3D duel supplies the look in the video. No 3D work is rushed before the deadline.

| Date | What happens |
| --- | --- |
| Thu Nov 19 – Sun Nov 22 | Three first-time players run the three-minute test. No new mechanics are merged. |
| Sun Nov 22 | Results in. I write the cut list and at most one fix brief. **Mechanics freeze for the snapshot.** |
| Mon Nov 23 – Sat Nov 28 | Fixes only, merged to `main` through pull requests. |
| Sun Nov 29 | **Merge cutoff.** Anything not merged is out of the snapshot. |
| Mon Nov 30 – Wed Dec 2 | Video, screenshots, write-up. |
| Thu Dec 3 | Buffer. |
| Fri Dec 4, 2 p.m. PT | Submit. |

## Closing rules

1. **Three briefs open at most.** I write no new brief until one is merged or cut.
2. **Merge or drop in seven days.** A built prototype that is not on the integration branch a week after it was built is dropped from the release. Its branch can stay; it is not carried.
3. **Every brief names what it closes.**
4. **A person before a mechanic.** No new mechanic is added until a real player has tried the last one.
5. **This page is updated at every merge and every cut.**

## Scoreboard

"Seen by a person" means a first-time human player. Agent browser checks do not count. Alex's own play of Showdown on November 19 chose the fight, but he is not a first-time player, so the column is still empty.

### Showdown, the December 4 fight

| Piece | Where | Seen by a person |
| --- | --- | --- |
| The fight: 29 cards, cover, traps, gear, locations, bot levels | in the game, pull requests 144 and 145 | no |
| Trail of six duels, pick-of-two rewards, save | Showdown page; slice 2 moves it in | no |
| Rivals, bounties, packs, deck builder with side deck, best of three, two players | Showdown page; slice 3 | no |

### Lane duel (at `?mode=lanes` until slice 3; slice 3 retires it from the graybox, and the earlier 3D build at `/3d/` keeps its own lane build)

| Piece | From | Seen by a person |
| --- | --- | --- |
| Core duel, 18 cards (12 Cowboy, 6 Wizard) | earlier work, Frontier pack, Imp | no |
| Guided first duel, seed 690 | first-ten-minutes brief | no |
| Lantern Wraith bounty, five notices, Captured Wraith | Kiro, first-ten-minutes brief | no |
| Wraith Posse duel, seed 2328 | first-ten-minutes brief | no |
| Graveyard Dragon bounty, Captured Dragon (4 attack), Dragon Posse duel, seed 468 | dragon reward and balance briefs | no |
| Frontier cards, Ride, Wagon Train and Night Riders, win unlocks | content pack 1 | no |
| Rivals: the Stargazer and the Imp | counterplay briefs | no |
| Two practice decisions | practice brief | no |
| Dragon Fire arc: Ember Gulch and the Bonewright | depth arc brief, built tonight | no |
| Deck builder drafts, clash history, tribute and lane explanations | Kiro | no |

### Built, not merged (as of November 18)

This table is kept as written on November 18. With Showdown as the entry, the lane mechanics in it (the guided duel, Wraith Drift and the Dragon Fire pages) are not carried into the snapshot; the table in the integration brief says what replaces each. The playtest kit's branch has not been rechecked since.

| Piece | Branch | Decision due |
| --- | --- | --- |
| Playtest kit: launcher, feedback form, offline report | `kiro/playtest-observer` | Merge now. The playtest needs it. |
| First Play opens the guided duel | `kiro/first-duel-candidate` | Nov 22, on the playtest result |
| Wraith Drift: capture lesson, two destinations, rival reply | `kiro/two-clash-wraith` and three earlier branches | Nov 25: merge one version or drop all four |
| Dragon Fire prototype pages | `kiro/dragon-fire-engine` and two earlier | Drop. The arc replaced them. |

### Parked (not in Release 1 unless reopened)

- The bounty pipeline with Kiro and Tripo. See [card types and bounties](card-types-and-bounties.md).
- Dragon Fire on the real Captured Dragon in ordinary duels. Needs a balance run.
- The Bonewright in free play.
- Ghost Walk for the Wraith.
- The trap prototype.
- Seventeen card concepts in the card library.

### Cut

- Cover Swap. It stays an experiment on its own branch.
- Mounted Billy attack lab pages.
- Ride Out as a rule for every troop in ordinary duels. Ride on cards replaced it.
- Round-one Base shield. The experiment was negative.

## Open briefs: 1 of 3

1. **Showdown into the game** ([brief](showdown-integration-kiro-brief.md), issue 143). Slice 1 and the card pipeline are merged. Open: the Scout fix, slice 2, and Kiro's spec, property tests and Night Watch pointed at Showdown.
2. Free. I am holding it for the fix brief on November 22.
3. Free.

The two lane briefs that were open on November 18 (First Play opens the guided duel, and the Dragon Fire arc) are closed by the change of fight.

## Only Alex can do these

| What | By |
| --- | --- |
| Line up three people who have never seen the game, and run the three-minute test with the kit | Sun Nov 22 |
| Pick the category | Sun Nov 29 |
| Write the video script and record it | Wed Dec 2 |
| Decide how the video names other tools and browsers | Wed Dec 2 |

## What I do next

- Until November 22: no new mechanics. I answer what Kiro sends back on the Showdown rules and read its before-and-after numbers for the Scout fix.
- November 22: read the playtest results, write the cut list, write one fix brief if a stall shows up.
- After December 4: the Release 1 card list to 34, starting with six Wizard cards that need no new rule.
