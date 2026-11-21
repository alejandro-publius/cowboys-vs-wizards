# Showdown: Wizard campaign and Release 3 scope

Fable 5.2, November 20, 2026. Companion to my [remaining-design handoff](showdown-remaining-handoff.md). Read from `c3dcab6`; nothing was run. **All of it is proposed and nothing is live.** It opens no brief, and no build starts before Release 1 locks ([release line](release-line.md)).

## Wizard campaign (Release 2)

**First decision.** A Cowboy first chooses which enemy to hit. A Wizard first chooses **what to pay with, and what comes back.** The Wizard card costs one tribute and raises the last Undead in the graveyard with 1 orb ([rules.js](../../src/game/showdown/rules.js), line 253). Pay with an Undead and it returns. Pay with anything else and an earlier casualty returns. With three slots full, nothing returns.

**Loop.** Camp gains a side switch. The track is four duels against an AI Cowboy, and the Wizards open each. Offers, grit and deck swaps work as on the Trail. Winning duel 4 ends it: Camp says so, and the Wizard deck builder and Open range from the Wizard seat open.

| Duel | AI Cowboy deck | Level | Cowboy Base | First win pays (replaces) |
| --- | --- | --- | --- | --- |
| 1 | `cowboy-sheriff` ×16 | 0 | 3 | `wizard-raven-familiar` ×2 (`wizard-skeleton`) |
| 2 | `deckAfter(2)` | 0 | 4 | `wizard-bone-wall` ×2 (`wizard-skeleton`) |
| 3 | `deckAfter(4)` | 1 | 4 | `wizard-imp` ×1 (`wizard-skeleton`), `wizard-hex` ×1 (`wizard-singularity`) |
| 4 | `DECKS.cowboy` | 1.5 | 4 | `wizard-dragon` ×1 (`wizard-wizard`) |

Opponents are the decks a Cowboy owns along the Trail ([trail.js](../../src/game/showdown/trail.js)), so no deck list is new. Raven Familiar comes first: it draws a card, then pays for the Wizard while a fallen Skeleton returns. Duel 3 is a person's first Bear Trap from the receiving side, and relies on the log fixed in [PR 176](https://github.com/alejandro-publius/cowboys-vs-wizards/pull/176) (not re-read).

- **Starter:** `wizard-skeleton` ×10, `wizard-wizard` ×3, `wizard-singularity` ×3.
- **Progression:** the shipped `pool` rule with the side swapped: 35 copies of 11 types, by my reading of [cards.csv](../../prototypes/showdown/cards.csv). Neither side's wins pay the other's cards. Five types (Jack-o'-Lantern, Headless Horseman, Hellfire, Bone Armor, Boneyard) come only from offers and packs after duel 4. Lantern Wraith is not earnable.
- **Saves:** Wizard progress is a second object of the same shape under its own key. Wizard play never writes `cvw-showdown-save-v2`, because `migrate` in [progress.js](../../src/game/showdown/progress.js) resets a save that holds a non-Cowboy card. Each side keeps its own offer. The save version, `migrate` and Cowboy save codes do not change.

**Fixture** (legal by reading, any seed): `createShowdown(seed, {first: "wizard", decks: {wizard: {"wizard-wizard": 16}}, opening: {wizard: [{type: "wizard-skeleton", health: 1}, {type: "wizard-skeleton", health: 3}]}})`

**Pass.**
1. On the fixture, summoning with tribute `[0]` emits `tribute`, `summon`, `raise`, and leaves the Wizard, the 3-orb Skeleton and a 1-orb Skeleton. With a third Skeleton in `opening`, no `raise`.
2. A Cowboy save with a pending offer and 2 packs is byte-identical, stored string and save code, after a Wizard duel 1 win.
3. Wizard-seat sim, seeds 0 to 299: the careless policy wins duel 1 at least 295 times (Boot Hill: 298), and wins fall with each duel.

## The six Wizard cards

The [roadmap](card-library-roadmap.md) names Familiar, Gargoyle, Imp, Hex, Bone Golem and Cursed Gunman. Showdown already ships four of those jobs: Raven Familiar, Bone Wall, Imp, and Hex as a trap. Bone Golem and Cursed Gunman are lane-era concepts without stats. The campaign uses the 14 shipped Wizard cards and needs neither, so "six" in my handoff is stale.

## Release 3 ruling

- **Live:** two people on one screen, one game or best of three, with a curtain between turns ([showdown-session.js](../../src/match/showdown-session.js)). Both seats get the fixed even-match decks (the label says "starter deck"), and nothing is saved.
- **Missing:** playing a deck you built. That needs a Wizard collection, so it follows Release 2.
- **Ruling (proposed):** Release 3 is "bring your own deck" on one screen, with decks from the local saves or a pasted save code. Play across two devices does not exist and is not added here; the [integration brief](showdown-integration-kiro-brief.md) rules network play out. Only Alex can add it.

## Art timing, resolved

My handoff named two events as if they were one.

- **A Showdown skin may start** when Release 1 locks, for that release's content only.
- **The lane engine may retire** when a Showdown-driven 3D page ships and nothing imports the lane files. That ends the skin work and does not wait for Release 3. My list order was priority, not a gate.

Text and code stay the source: the skin reads `viewFor` and the events, and no rule waits on art.

## Who decides

| State | What |
| --- | --- |
| Ready to prototype once Release 1 locks | The side switch, the second save, a Wizard-seat sim, the fixture and the three checks |
| Alex decides | Every number and reward above; the Dragon as final pay (its cost is open; fallback `wizard-headless-horseman` ×1); whether the switch appears on a new save or after Boot Hill (I'd pick after); duel names; Release 3's scope; when art starts |
| Deliberately later | Networking, Wizard rivals and bounties, a Wizard save code, Bone Golem and Cursed Gunman |

Not checked: no test, sim or build ran, and no person has seen this.

## Independent checks of the proposed fixture

Codex replayed both opening boards against the shipped engine for seeds 0 through 79. With two Skeletons, the legal tribute of slot 0 summoned the Wizard and raised a 1-orb Skeleton. With three Skeletons, the same tribute produced no Raise event. The current catalog has 14 Wizard types and 35 earnable copies across 11 types. The proposed third opponent’s deck contains one Bear Trap. The four-duel campaign and its win-rate targets still await prototyping. These were automated checks of the proposal.
