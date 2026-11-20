# Showdown into the game: brief for Kiro

Fable 5.2, November 18, 2026. This hands the Showdown engine to Kiro for integration, the way the lane engine was handed over. The engine, its tests and a working reference screen are in [`prototypes/showdown/`](../../prototypes/showdown/README.md). The decision to change the fight is recorded in the [release line](release-line.md).

## What is decided

- The game's fight becomes Showdown: the player chooses every attack, troops shield the Base, turns alternate.
- A new player's first hour is the Trail: easy wins first, one new idea per duel, a new card on every first win. It is not an even match.
- Fable owns the rules, the progression numbers and the contract below. Kiro owns integration, the screens, the card pipeline, the presenter, the property tests and the checks.
- Showdown is the fight in the December 4 entry. Alex played it on November 19 and chose it over the lane duel. The [playtest](../../prototypes/showdown/PLAYTEST.md) now tunes the fight; it no longer decides whether it ships.

## Status on November 19

Slice 1 and the card pipeline are merged (pull requests 144 and 145): the engine is in `src/game/showdown/`, the graybox's Play opens Boot Hill, and the lane duel is at `?mode=lanes`. Next, in this order: the Scout fix below, then slice 2. The three jobs under [Kiro's own tools, pointed at Showdown](#kiros-own-tools-pointed-at-showdown) can run beside slice 2.

## What is not decided

- Keyword wording and the six frame looks. They are first drafts.

Alex approved the eleven new card names as written on November 18, so they can go through the card pipeline.

## The contract

Everything a screen needs is in `prototypes/showdown/contract.js`, and `contract.test.js` holds the engine to it.

- **`viewFor(state, side)`** is the only state a screen may draw from. It lists that side's own hand and traps and gives counts for the other side's. Neither deck's order is in it.
- **`EVENTS`** lists every event `applyAction` can return, the fields each carries and what a player must see happen. There are sixteen. A presenter handles all sixteen and throws on anything else, as the current presenter does.
- **Actions** are plain objects: `summon`, `spell`, `gear`, `location`, `set`, `attack`, `cover`, `end`. `legalActions(state)` is the complete list at any moment; a screen offers nothing else.
- **Progress** is one plain object (`progress.js`: `newSave`, `settle`, `choose`, `openPack`, `withDeck`, `migrate`). Every function returns a new object and none touches storage.

## Slices, in order

Each slice ends in something a person can open and something a test proves. Do not start a slice before the one above it is merged.

### 1. The fight

- Move the engine (`cards.js`, `rules.js`, `contract.js`) into `src/game/` as pure modules. Their tests move with them.
- Draw the duel in the graybox from `viewFor` and `EVENTS`, using the card frames from pull request 139.
- Keep the lane duel reachable (for example `?mode=lanes`) until slice 3. Delete nothing yet.

**Done when**

1. `rules.test.js` and `contract.test.js` pass against the moved engine with only their import paths changed.
2. A test fails if the presenter has no handler for an `EVENTS` entry.
3. In a browser with a new profile, Play opens Boot Hill and it can be won with clicks alone.
4. `npm test` passes.

### 2. The first hour

- Move `trail.js`, `progress.js` and `playtest.js` in. The camp replaces the title menu's Play, Wanted and Build Deck entries for the Showdown game.
- Join the save to the existing profile store. An existing profile must not lose what it earned: a Captured card already won in the lane game stays owned.
- Run `trail-sim.mjs`'s ramp check with the other tests.

**Done when**

1. `progress.test.js` passes with only import paths changed, including the ramp test.
2. A test loads a saved lane-era profile and shows its captured cards are still on record and shown in the Camp.
3. In a browser a new profile wins Trail duels 1 and 2 and is paid a card each time, and reloading the page keeps them.

### 3. The rest, and retiring the lanes

Rivals, bounties, packs, the deck builder with a side deck, best of three and two players are already in the reference screen; integrate them as one slice after the playtest result. In the same slice, each lane feature is replaced or dropped:

| Lane feature | In Showdown |
| --- | --- |
| Ride Out (move a troop one lane) | The Ride keyword: strike the Base past troops for 1 orb |
| Wraith Drift | Dropped. The Lantern Wraith is a Ghostly boss that opens on the board |
| Dragon Fire arc | The Sweep keyword |
| The Stargazer, the Imp, the Bonewright | Rivals 1, 2 and 3 |
| Frontier unlocks by counted wins | Trail rewards and the choice after each win |
| Guided first duel | Trail duel 1 and its one-line lesson |
| Practice decisions, lane previews, clash forecast | Dropped; the attack preview on each target replaces them |

**Done when** the lane engine and its tests are removed in one pull request that changes no Showdown file, and `npm test` still passes.

## The card pipeline

The eleven new cards and the new fields on the old ones live in an overlay in `cards.js` today, because the catalog has no place for them. The names are approved:

- Add `rarity`, `tag`, `keys` and `effect` to the card spec format and to all 29 cards.
- **Done when** `OVERLAY` and `FRESH` are gone from `cards.js`, the catalog is the only source, and `prototypes/showdown/cards.csv` regenerates byte for byte.

## Property tests worth writing

These are the properties the engine is built to satisfy. The example tests cover each on fixed positions; a generator over random legal play would cover them properly.

1. `applyAction` never changes the state it is given.
2. Every action in `legalActions` applies without throwing, and nothing outside it does.
3. No orb count, Base or hand size ever goes below zero or above its limit.
4. `viewFor(state, side)` never contains a card id from the other side's hand or traps, or from either deck.
5. Every event returned matches its `EVENTS` entry exactly.
6. The same seed and the same actions give the same game.
7. A bot's plan is legal to the last action, at every level.

## Answer on the Scout bot (Kiro's question of November 19)

Yes, take Kiro's fix (`7e8e6eb`: the level-2 plan stops at a Scout draw and plans again from the card it drew) before slice 2. The bot planning with cards it has not drawn is the shortcut marked at `src/game/showdown/rules.js:346`, and a bot that reads hidden cards is a defect, not a balance setting.

**Done when**

1. Kiro's fair-bot test is in and the shortcut comment is gone.
2. `prototypes/showdown/sim.mjs 1000` and `trail-sim.mjs` are run before and after, and both pairs of numbers are in the pull request.
3. The ramp test in `progress.test.js` still passes unchanged. If it fails, or a Trail win rate moves by more than three points, stop and send the numbers back to Fable; do not retune.

## Kiro's own tools, pointed at Showdown

The spec, the generated property tests and Night Watch were all built for the lane duel. The fight has changed, so they move with it. Each of these is Kiro's to do ([issue 37](https://github.com/alejandro-publius/cowboys-vs-wizards/issues/37)), and none changes a rule.

### A. A spec for slice 2

Build slice 2 from a Requirements-First spec in `.kiro/specs/`, the way the match presentation was built from `orb-duel`. The save is where a spec earns its keep: joining two profile formats without losing what a player earned.

**Done when**

1. The spec has requirements, design and tasks, and each "done when" line of slice 2 is a numbered requirement.
2. Each slice 2 test names the requirement it proves, and `docs/requirement-test-map.md` lists them.

### B. The seven properties, generated

Write the seven properties above over `src/game/showdown/`, reusing the generator and shrinker in `tests/helpers/boundary-properties/`.

**Done when**

1. Each of the seven runs over generated legal play from a recorded seed, and one failing case can be replayed alone.
2. One planted fault per property is caught. For property 4, the fault is a `viewFor` that leaks one card from the other hand.
3. `npm test` runs them.

### C. Night Watch on Showdown

Night Watch compares two commits with `scripts/simulate-matches.mjs`, which plays the lane duel. Give it a Showdown mode that plays each deal twice with the first seat swapped, as `prototypes/showdown/sim.mjs` does, and reports the first-player share and the Cowboy share. Both lean today (about 57% and 59%), and that lean is the number Fable tunes against.

**Done when**

1. One Night Watch report compares two Showdown commits over 1,000 deals. The commits before and after the Scout fix are the first pair.
2. The lane mode still passes its own tests.
3. The nightly job runs the Showdown mode.

## Before any 3D work

The rules will keep changing until the playtest passes. These make the 3D layer cheap to add afterwards and need no model:

- **Board.** Three slots a side map onto the three tiles a side the board already has. There are no lanes: an attack runs from any slot to any slot, which the existing attack cue already supports.
- **Cues.** The board has cues for arriving, attacking, a spell and leaving. Showdown needs ten more: take cover, a trap revealed, gear attached, the location changing, a troop raised, sweep, last stand, a card set face down, a burned draw and fatigue. Give each a placeholder first (a flash and the log line), so no rule waits on an animation.
- **Models.** The manifest from pull request 141 is keyed by card type and works unchanged. Six of the nineteen troops have a model or rig today. Make the rest in the order a new player meets them: Covered Wagon, Raven Familiar, Jack-o'-Lantern, Outrider, Bone Wall, Ranger, Imp, Dynamiter, Headless Horseman, Gatling Crew, then the two Wraiths and the Captured Dragon.
- **Look.** [`ART-DIRECTION.md`](../../prototypes/showdown/ART-DIRECTION.md) has a model-sheet block for each, and [`3D-DAY.md`](../../prototypes/showdown/3D-DAY.md) is the runbook from picture to a model on the board.

## Out of scope

- Any change to a rule, a number or a reward. Send those back to Fable with the position that shows the problem.
- New art, models or animation. Those are planned with Alex first.
- Play over a network.
