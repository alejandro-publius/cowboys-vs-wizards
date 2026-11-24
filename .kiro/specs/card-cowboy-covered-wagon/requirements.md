# Card spec: Covered Wagon (`cowboy-covered-wagon`)

Author: Kiro (native Kiro CLI, agent `native-handoff-cowboy-specs`). Every clause describes the current Showdown engine as read from the files below. No clause adds or changes a rule.

## Sources

- Card JSON: `.kiro/specs/duel-card-pipeline/cards/cowboy-covered-wagon.json`
- Card table: `src/game/showdown/cards.js` (`TYPES`, `KEYWORDS.guard`, `DECKS`)
- Rules: `src/game/showdown/rules.js` (`targetsFor`, `attackOutcome`, `attack` Sweep block, `applyAction` cover and end branches); text: `prototypes/showdown/RULEBOOK.md` sections 5, 6, 9 and 10 ("Ride and Guard")
- Progress: `src/game/showdown/trail.js` (`TRAIL[0]`, Boot Hill), `src/game/showdown/progress.js` (`settle`, `deckProblems`)

## Requirements

- CARD-COWBOY-COVERED-WAGON-01: The Showdown card table SHALL define `TYPES["cowboy-covered-wagon"]` as a Cowboy troop named Covered Wagon with 4 stars, 1 attack, 4 orbs, tag Rig, keywords `["guard"]`, rarity common and `bounty: false`.
- CARD-COWBOY-COVERED-WAGON-02: WHEN a Covered Wagon is in the active side's hand and a board slot is free, `legalActions` SHALL list its summon with `tributes: []`.
- CARD-COWBOY-COVERED-WAGON-03: WHILE a Covered Wagon stands on the Cowboy board, `legalActions` SHALL offer every ready Wizard attacker only Guard troops' slots as targets.
- CARD-COWBOY-COVERED-WAGON-04: WHILE a Covered Wagon stands, `legalActions` SHALL offer a ready Headless Horseman no `"base"` target.
- CARD-COWBOY-COVERED-WAGON-05: WHEN a Dragon attacks a Covered Wagon beside other Cowboy troops, the engine SHALL still remove 1 orb from each of those troops through Sweep.
- CARD-COWBOY-COVERED-WAGON-06: WHEN a Skeleton attacks a Covered Wagon in cover, the engine SHALL leave the Skeleton's orbs unchanged, because a troop in cover does not hit back.
- CARD-COWBOY-COVERED-WAGON-07: WHEN the Cowboys' turn begins, the engine SHALL clear the Covered Wagon's cover.
- CARD-COWBOY-COVERED-WAGON-08: The even-match Cowboy deck `DECKS.cowboy` SHALL hold 2 Covered Wagons.
- CARD-COWBOY-COVERED-WAGON-09: WHEN the first Trail duel (Boot Hill) is won from a new save, `settle` SHALL report `[["cowboy-covered-wagon", 2]]` as earned and add 2 Covered Wagons to the collection.
- CARD-COWBOY-COVERED-WAGON-10: WHEN a deck holds 3 Covered Wagons and 2 are owned, `deckProblems` SHALL report "You own 2 Covered Wagon, not 3."

## Open items (not counted)

- Open: the JSON `limit: 2` is a lane field. Showdown's Common cap is 4, reachable through offers and packs after the 2 Boot Hill copies.
- Open: no test title cites any CARD-COWBOY-COVERED-WAGON ID, so the trace reports every clause as an orphan.
