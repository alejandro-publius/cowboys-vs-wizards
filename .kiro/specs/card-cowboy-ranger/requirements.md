# Card spec: Ranger (`cowboy-ranger`)

Author: Kiro (native Kiro CLI, agent `native-handoff-cowboy-specs`). Every clause describes the current Showdown engine as read from the files below. No clause adds or changes a rule.

## Sources

- Card JSON: `.kiro/specs/duel-card-pipeline/cards/cowboy-ranger.json`
- Card table: `src/game/showdown/cards.js` (`TYPES`, `KEYWORDS.scout`, `tributes`, `DECKS`, `EFFECTS.office`)
- Rules: `src/game/showdown/rules.js` (`applyAction` summon branch, `draw`, `hideDraw`, `playTurn`); text: `prototypes/showdown/RULEBOOK.md` sections 9 and 10 ("Scout")
- Progress: `src/game/showdown/trail.js` (`TRAIL[2]`, The Bone Fence)

## Requirements

- CARD-COWBOY-RANGER-01: The Showdown card table SHALL define `TYPES["cowboy-ranger"]` as a Cowboy troop named Ranger with 5 stars, 2 attack, 4 orbs, tag Lawman, keywords `["scout"]`, rarity uncommon and `bounty: false`.
- CARD-COWBOY-RANGER-02: WHEN a Ranger is summoned with one tribute and the deck is not empty, the engine SHALL move the top deck card into the hand and emit the events `tribute`, `summon`, `draw` in that order.
- CARD-COWBOY-RANGER-03: WHEN a Ranger is summoned while its side's deck is empty, the engine SHALL draw nothing and leave that side's Base unchanged.
- CARD-COWBOY-RANGER-04: WHEN a Ranger is summoned after turn 1, `canAttack` SHALL return true for it on its arrival turn, because a tribute paid for it.
- CARD-COWBOY-RANGER-05: WHILE Sheriff's Office is the table's location, `attackOf` SHALL return 3 for a Ranger.
- CARD-COWBOY-RANGER-06: WHEN the level-2 bot's plan summons a Ranger that draws, `planTurn` SHALL end the plan after that summon, so `playTurn` plans again with the drawn card in hand.
- CARD-COWBOY-RANGER-07: The even-match Cowboy deck `DECKS.cowboy` SHALL hold 1 Ranger.
- CARD-COWBOY-RANGER-08: WHEN the third Trail duel (The Bone Fence) is won and the saved deck holds at least 1 Billy, `settle` SHALL add 1 Ranger to the collection and swap it into the deck for 1 Billy.

## Open items (not counted)

- Open: the JSON has `rides: true`, a lane field, while the Showdown keywords are `["scout"]` with no `ride`. In Showdown the Ranger cannot ride past troops. The two data sources disagree on what the card does; which is intended is a decision for Fable.
- Open: RULEBOOK section 10 says a Scout's card is discarded when the hand is full. A Ranger leaves the hand when it is summoned, and the hand never holds more than 6 cards, so at most 5 remain and the drawn card always fits. The full-hand branch of `draw` cannot be reached by a Ranger played from the hand. Nothing here is a requirement.
- Open: the JSON `limit: 2` is a lane field; Showdown's Uncommon cap is 3.
- Open: no test title cites any CARD-COWBOY-RANGER ID, so the trace reports every clause as an orphan.
