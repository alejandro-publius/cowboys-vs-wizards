# Release line and scoreboard

Fable 5.2, Wednesday November 18, 2026, Pacific. Based on Alex's four decisions that evening and an audit of the branches at 7:45 p.m. The integration branch was `kiro/frontier-pack`. It was published to `main` at `5ee6a3a`, where 448 tests passed and both builds compiled.

This file is the one place that says what is in the game, what is waiting, and what is out. If something is not listed under "In the game", it is not in the submission.

## What we are building

Cowboys vs. Wizards: the proven parts of Yu-Gi-Oh (mostly), Magic and Pokémon, themed, quick to play and easy to read. The graybox is the game while the rules are still soft. Models, animation and the board go on top once a release is locked.

## The fight: Showdown, decided November 18

Alex played the lane duel that night and found it was not fun: strong troops did not protect the Base and he never chose an attack. He chose the Showdown fight for the deeper rules: you pick each attack, troops shield the Base, turns alternate.

Showdown is a prototype in [`prototypes/showdown/`](../../prototypes/showdown/README.md) with its own keywords, type tags, traps and 25 cards. The lane duel stays the main game until its features are moved over. Until then:

- No new lane content is written. Ride, Wraith Drift, Dragon Fire and lane previews are redesigned for Showdown or dropped when they are moved.
- The playtest of November 19 to 22 should put first-time players on Showdown as well as the first-session flow.
- Which fight is the December 4 entry is still Alex's decision.

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

The graybox is the playable entry, described honestly as the rules-first build. The existing 3D duel supplies the look in the video. No 3D work is rushed before the deadline.

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

"Seen by a person" means a first-time human player. Agent browser checks do not count. Today that column is empty for everything.

### In the game (on the integration branch)

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

### Built, not merged (clock running)

| Piece | Branch | Decision due |
| --- | --- | --- |
| Playtest kit: launcher, feedback form, offline report | `kiro/playtest-observer` | Merge now. The playtest needs it. |
| First Play opens the guided duel | `kiro/first-duel-candidate` | Nov 22, on the playtest result |
| Wraith Drift: capture lesson, two destinations, rival reply | `kiro/two-clash-wraith` and three earlier branches | Nov 25: merge one version or drop all four |
| Dragon Fire prototype pages | `kiro/dragon-fire-engine` and two earlier | Drop. The arc replaced them. |

### Parked (not in Release 1 unless reopened)

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

## Open briefs: 2 of 3

1. **First Play opens the guided duel.** Waiting on the playtest.
2. **Dragon Fire arc.** Built; waiting on a person.
3. Free. I am holding it for the fix brief on November 22.

## Only Alex can do these

| What | By |
| --- | --- |
| Line up three people who have never seen the game, and run the three-minute test with the kit | Sun Nov 22 |
| Pick the category | Sun Nov 29 |
| Write the video script and record it | Wed Dec 2 |
| Decide how the video names other tools and browsers | Wed Dec 2 |

## What I do next

- Until November 22: no new mechanics. I check tonight's Fire arc build against the acceptance cases in its brief and report what does not match.
- November 22: read the playtest results, write the cut list, write one fix brief if a stall shows up.
- After December 4: the Release 1 card list to 34, starting with six Wizard cards that need no new rule.
