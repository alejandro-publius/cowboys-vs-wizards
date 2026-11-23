# Card spec: Mounted Billy (`cowboy-mounted-billy`)

Author: Kiro (native Kiro CLI, agent `native-handoff-cowboy-specs`). Every clause describes the current Showdown engine as read from the files below. No clause adds or changes a rule.

## Sources

- Card JSON: `.kiro/specs/duel-card-pipeline/cards/cowboy-mounted-billy.json`
- Card table: `src/game/showdown/cards.js` (`TYPES`, `KEYWORDS.ride`, `tributes`, `DECKS`, `RARITY`)
- Rules: `src/game/showdown/rules.js` (`targetsFor`, `attackOutcome`, `attack`); text: `prototypes/showdown/RULEBOOK.md` sections 5, 6, 9 and 10 ("Ride and Guard")
- Progress: `src/game/showdown/trail.js` (`TRAIL[4]`, The Hexed Mile), `src/game/showdown/progress.js` (`deckProblems`)

## Requirements

- CARD-COWBOY-MOUNTED-BILLY-01: The Showdown card table SHALL define `TYPES["cowboy-mounted-billy"]` as a Cowboy troop named Mounted Billy with 7 stars, 3 attack, 5 orbs, tag Outlaw, keywords `["ride"]`, rarity rare and `bounty: false`.
- CARD-COWBOY-MOUNTED-BILLY-02: WHEN a Mounted Billy is in the active side's hand and that side has not summoned this turn, `legalActions` SHALL list one summon per pair of occupied own slots, and none when fewer than 2 own troops stand.
- CARD-COWBOY-MOUNTED-BILLY-03: WHEN a Mounted Billy is summoned after turn 1, `canAttack` SHALL return true for it on its arrival turn.
- CARD-COWBOY-MOUNTED-BILLY-04: WHILE the Wizards have troops and none has Guard, `legalActions` SHALL offer a ready Mounted Billy every Wizard troop's slot and the target `"base"`.
- CARD-COWBOY-MOUNTED-BILLY-05: WHEN a Mounted Billy rides past a standing Skeleton, the engine SHALL remove exactly 1 orb from the Wizard Base, not its 3 attack.
- CARD-COWBOY-MOUNTED-BILLY-06: WHEN a Mounted Billy attacks a Skeleton at 1 orb, the engine SHALL defeat the Skeleton, remove 2 orbs from the Wizard Base and leave the Mounted Billy on 5 orbs.
- CARD-COWBOY-MOUNTED-BILLY-07: WHEN a Skeleton at 1 orb attacks a Mounted Billy outside cover, the engine SHALL report `hitBack: 3` in the `attack` event.
- CARD-COWBOY-MOUNTED-BILLY-08: WHEN a Skeleton attacks a Mounted Billy in cover, the engine SHALL report `hitBack: 0` in the `attack` event.
- CARD-COWBOY-MOUNTED-BILLY-09: The even-match Cowboy deck `DECKS.cowboy` SHALL hold 1 Mounted Billy.
- CARD-COWBOY-MOUNTED-BILLY-10: WHEN the fifth Trail duel (The Hexed Mile) is won and the saved deck holds at least 1 Billy, `settle` SHALL add 1 Mounted Billy to the collection and swap it into the deck for 1 Billy.
- CARD-COWBOY-MOUNTED-BILLY-11: WHEN a deck and its side deck together hold 3 Mounted Billys and 3 are owned, `deckProblems` SHALL report "Mounted Billy is Rare: at most 2 in a deck and its side deck."

## Open items (not counted)

- Open: the JSON `copies: 1` and `rides: true` are lane fields. Showdown reads the `ride` keyword. The lane field and the Showdown keyword agree for this card.
- Open: `AGENTS.md` notes the Mounted Billy GLB contains exported attack clips. Presentation is outside these rules clauses.
- Open: no test title cites any CARD-COWBOY-MOUNTED-BILLY ID, so the trace reports every clause as an orphan.
