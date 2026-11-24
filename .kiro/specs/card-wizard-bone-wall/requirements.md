# CARD-WIZARD-BONE-WALL requirements

Bone Wall is a free Wizard troop with Guard and no attack of its own. These requirements describe the card as Showdown plays it today. They add no rule.

## Sources

- Card spec: `.kiro/specs/duel-card-pipeline/cards/wizard-bone-wall.json`
- Generated catalog: `src/game/card-specs.generated.js` (`SHOWDOWN_SPECS`)
- Keyword, rarity, tribute and deck tables: `src/game/showdown/cards.js` (`KEYWORDS.guard`, `RARITY`, `tributes`, `DECKS`)
- Engine: `src/game/showdown/rules.js` (`arrive`, `attackOf`, `canAttack`, `targetsFor`, `legalActions`, `attackOutcome`, `attack`, `defeat`, `applyAction`)
- Opponent decks: `src/game/showdown/trail.js` (`TRAIL`), `src/game/showdown/progress.js` (`RIVALS`, `BOUNTIES`)
- Rulebook: `prototypes/showdown/RULEBOOK.md` sections 2, 5, 6, 8, 9 and 10 ("Zero attack")
- Log text: `src/game/showdown/presenter.js` (`attackText`)
- Card gallery: `src/ui/showdown-3d/attack-preview.js` (`attackPreviews`, `attackExample`)
- Existing tests: `prototypes/showdown/rules.test.js` ("Guard: enemies must attack it first, and a rider cannot pass it"; "locations: one for the whole table, ..."), `tests/game/card-specs.test.js` (Bone Wall record), `tests/match/showdown-3d-presentation.test.js` ("every troop opens a real rules-engine preview, ...")

## Card data

- **CARD-WIZARD-BONE-WALL-01.** THE catalog SHALL define `wizard-bone-wall` as a Showdown-only Wizard troop named "Bone Wall" with 3 stars, 0 attack, 4 orbs, rarity `common`, type tag `Undead` and the single keyword `guard`.
- **CARD-WIZARD-BONE-WALL-02.** THE sync script SHALL accept the Bone Wall's attack of 0, because a Showdown-only troop's attack only has to be a non-negative integer.
- **CARD-WIZARD-BONE-WALL-03.** THE Wizard opponent decks SHALL hold Bone Wall in these counts: even match (`DECKS.wizard`) 2, The Bone Fence 3, The Hexed Mile 2, The Bonewright 3, Lantern Wraith escort 2, Dragon's Roost 2 (it uses `DECKS.wizard`), The Graveyard Coven 2 (it spreads `DECKS.wizard`), and no other Trail, rival or bounty deck.

## Summoning

- **CARD-WIZARD-BONE-WALL-04.** WHEN the Wizards summon a Bone Wall, THE engine SHALL require no tribute, because 3 stars is in the free band of 1 to 4.
- **CARD-WIZARD-BONE-WALL-05.** WHILE all 3 Wizard troop slots are occupied, THE engine SHALL offer no summon action for a Bone Wall.
- **CARD-WIZARD-BONE-WALL-06.** WHEN a Bone Wall arrives from the hand, THE engine SHALL place it in the first empty Wizard slot with 4 orbs, no gear and `ready` false.
- **CARD-WIZARD-BONE-WALL-07.** WHILE a Bone Wall has not acted this turn and is not in cover, THE engine SHALL offer it a cover action, including on the turn it arrives.

## Attack

- **CARD-WIZARD-BONE-WALL-08.** WHILE a Bone Wall's current attack from `attackOf` is 0, THE engine SHALL offer it no attack action.
- **CARD-WIZARD-BONE-WALL-09.** WHILE the Boneyard is the table's location, THE engine SHALL compute a Bone Wall's attack as 1.
- **CARD-WIZARD-BONE-WALL-10.** WHILE the Boneyard is the location and the Bone Wall is otherwise able to attack, THE engine SHALL offer the Bone Wall attack actions.
- **CARD-WIZARD-BONE-WALL-11.** WHEN a Bone Wall carries Bone Armor, THE engine SHALL leave its attack unchanged, because Bone Armor adds 0 attack.

## Guard

- **CARD-WIZARD-BONE-WALL-12.** WHILE at least one Bone Wall is on the Wizard board, THE engine SHALL limit every Cowboy troop's attack targets to Wizard troops that have Guard.
- **CARD-WIZARD-BONE-WALL-13.** WHILE at least one Bone Wall is on the Wizard board, THE engine SHALL not offer a Cowboy troop with Ride the Wizard Base as a target.
- **CARD-WIZARD-BONE-WALL-14.** WHILE a Bone Wall is on the Wizard board, THE engine SHALL still offer a Cowboy spell that chooses a target (Deadeye, Lasso) every non-Ghostly Wizard troop that spell may otherwise target, because Guard restricts attacks only.

## Being attacked

- **CARD-WIZARD-BONE-WALL-15.** WHEN a Cowboy troop attacks a Bone Wall that survives and is not in cover, THE engine SHALL hit the attacker back for the Bone Wall's current attack, which is 0 without the Boneyard.
- **CARD-WIZARD-BONE-WALL-16.** WHEN a Bone Wall survives an attack out of cover with 0 attack, THE log SHALL read "<attacker> attacked Bone Wall and left it on <n>; it has no attack, so it did not hit back."
- **CARD-WIZARD-BONE-WALL-17.** WHEN a Cowboy attack deals more damage than an uncovered Bone Wall's remaining orbs, THE engine SHALL send the excess to the Wizard Base.
- **CARD-WIZARD-BONE-WALL-18.** WHEN a Cowboy attack deals more damage than a covered Bone Wall's remaining orbs, THE engine SHALL send nothing to the Wizard Base.
- **CARD-WIZARD-BONE-WALL-19.** WHEN a Bone Wall's orbs reach 0, THE engine SHALL move the Bone Wall and any gear it carries to the Wizard graveyard.

## Raise

- **CARD-WIZARD-BONE-WALL-20.** WHEN a Wizard troop with Raise arrives while a Bone Wall is the last Undead troop in the Wizard graveyard and a Wizard slot is free, THE engine SHALL return that Bone Wall to the board with 1 orb and no gear.

## Card gallery

- **CARD-WIZARD-BONE-WALL-21.** WHEN the Card gallery lists previews for Bone Wall, THE gallery SHALL offer only the "Watch Guard" preview, because the card's printed attack is 0.
- **CARD-WIZARD-BONE-WALL-22.** WHEN the Bone Wall "Watch Guard" preview runs, THE gallery SHALL begin its summary with "Guard makes enemies attack Bone Wall first." and follow it with the engine's log lines for a Cowboy Sheriff attacking the Bone Wall.

## Not numbered

- Rarity `common` caps a Cowboy deck at 4 copies (`progress.js` `deckProblems`). Wizard opponent decks are fixed in source and are not checked against rarity, so no rarity requirement applies to Wizard decks.
- The lane catalog fields `copies` and `limit` do not exist on this Showdown-only spec.
