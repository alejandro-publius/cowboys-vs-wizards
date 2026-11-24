# Card spec: Deadeye (`cowboy-deadeye`)

Author: Kiro (native Kiro CLI, agent `native-handoff-cowboy-specs`). Every clause describes the current Showdown engine as read from the files below. No clause adds or changes a rule.

## Sources

- Card JSON: `.kiro/specs/duel-card-pipeline/cards/cowboy-deadeye.json`
- Card table and effect text: `src/game/showdown/cards.js` (`TYPES`, `EFFECTS.shot`, `DECKS`)
- Rules: `src/game/showdown/rules.js` (`legalActions` spell branch, `applyAction` spell branch, `defeat`, the Last Stand loop in `attack`); text: `prototypes/showdown/RULEBOOK.md` sections 4 and 10 ("Ghostly", "Last Stand")
- Progress: `src/game/showdown/trail.js` (`STARTER`, `TRAIL`), `src/game/showdown/progress.js` (`newSave`, `settle`, `choose`, `deckProblems`)
- Log text: `src/game/showdown/presenter.js` (`PRESENTERS.spell`)

## Requirements

- CARD-COWBOY-DEADEYE-01: The Showdown card table SHALL define `TYPES["cowboy-deadeye"]` as a Cowboy spell named Deadeye with effect `shot`, rarity common, no keywords, `bounty: false` and no stars, attack or orbs.
- CARD-COWBOY-DEADEYE-02: WHEN a Deadeye is in the active side's hand, no other spell, gear or location has been played this turn and no troop has acted, `legalActions` SHALL list one Deadeye action per enemy troop that is not Ghostly, stunned troops included.
- CARD-COWBOY-DEADEYE-03: WHEN a Deadeye is cast at an enemy troop, the engine SHALL remove 1 orb from that troop and defeat it if it reaches 0.
- CARD-COWBOY-DEADEYE-04: WHEN a Deadeye defeats a Jack-o'-Lantern, the engine SHALL emit no `laststand` event, because Last Stand fires only in a fight.
- CARD-COWBOY-DEADEYE-05: WHEN a Deadeye has been cast this turn, `legalActions` SHALL list no gear action that turn.
- CARD-COWBOY-DEADEYE-06: WHEN a Deadeye leaves a Skeleton on 2 orbs, `presentEvent` for its `spell` event SHALL return "The Cowboys' Deadeye hit Skeleton: 2 orbs left."
- CARD-COWBOY-DEADEYE-07: The even-match Cowboy deck `DECKS.cowboy` SHALL hold 1 Deadeye.
- CARD-COWBOY-DEADEYE-08: The Trail starter `STARTER` SHALL hold 3 Deadeyes.
- CARD-COWBOY-DEADEYE-09: `newSave()` SHALL list 3 Deadeyes in its collection, because a common card counts toward the owned limit.
- CARD-COWBOY-DEADEYE-10: WHEN all six Trail duels are won, `deckAfter(6)` SHALL hold 1 Deadeye, because the Lasso and Bear Trap rewards each replace one.
- CARD-COWBOY-DEADEYE-11: WHEN the first Trail duel is won from a new save, `settle` SHALL offer exactly the Covered Wagon and the Deadeye.
- CARD-COWBOY-DEADEYE-12: WHEN the Deadeye is chosen from that offer, `choose` SHALL raise the owned Deadeye count from 3 to 4.
- CARD-COWBOY-DEADEYE-13: WHEN a deck and side deck together hold 5 Deadeyes and 4 are owned, `deckProblems` SHALL report "You own 4 Deadeye, not 5."

## Open items (not counted)

- Open: the JSON `relocates: false` and `copies: 2` are lane fields. Showdown never moves a troop.
- Open: no test title cites any CARD-COWBOY-DEADEYE ID, so the trace reports every clause as an orphan.
