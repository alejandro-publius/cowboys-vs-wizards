# CARD-WIZARD-BONEYARD requirements

The Boneyard is a Wizard location. While it is the table's one location, every Undead troop on both sides has +1 attack.

## Sources

- Card spec: `.kiro/specs/duel-card-pipeline/cards/wizard-boneyard.json`
- Generated catalog: `src/game/card-specs.generated.js`
- Tables: `src/game/showdown/cards.js` (`EFFECTS.boneyard`, `EFFECTS.office`)
- Engine: `src/game/showdown/rules.js` (`legalActions` location branch, `applyAction` location branch, `attackOf`, `canAttack`, `attackOutcome`, `evaluate`)
- Public view: `src/game/showdown/contract.js` (location is public)
- Opponent decks: `src/game/showdown/progress.js` (The Bonewright, The Graveyard Coven)
- Rulebook: `prototypes/showdown/RULEBOOK.md` sections 2 (Location), 8 (Locations), 10 ("Zero attack")
- Log text: `src/game/showdown/presenter.js` (`location`)
- Existing tests: `prototypes/showdown/rules.test.js` ("locations: one for the whole table, it adds attack by type tag, and a new one replaces it")

## Card data

- **CARD-WIZARD-BONEYARD-01.** THE catalog SHALL define `wizard-boneyard` as a Showdown-only Wizard location named "Boneyard" with rarity `rare` and effect `boneyard`, whose tag is `Undead`.
- **CARD-WIZARD-BONEYARD-02.** THE Wizard opponent decks SHALL hold 2 Boneyards in The Bonewright and 1 in The Graveyard Coven, and none in the even match or any other deck.

## Playing

- **CARD-WIZARD-BONEYARD-03.** WHILE the Wizards hold a Boneyard, have not used the turn's other-card play, no Wizard troop has acted this turn, and the location in play is not a Boneyard, THE engine SHALL offer a location action for it.
- **CARD-WIZARD-BONEYARD-04.** WHILE a Boneyard is the location in play, THE engine SHALL offer no action to play another Boneyard.
- **CARD-WIZARD-BONEYARD-05.** WHEN the Wizards play a Boneyard, THE engine SHALL mark the turn's other-card play as used.
- **CARD-WIZARD-BONEYARD-06.** WHEN the Wizards play a Boneyard while another location is in play, THE engine SHALL send that location to its owner's graveyard.
- **CARD-WIZARD-BONEYARD-07.** WHEN the Wizards play a Boneyard, THE engine SHALL record it as the table's location with the Wizards as its side, outside every hand, deck and graveyard.
- **CARD-WIZARD-BONEYARD-08.** WHEN the Cowboys play the Sheriff's Office while the Boneyard is in play, THE engine SHALL send the Boneyard to the Wizard graveyard.

## Effect

- **CARD-WIZARD-BONEYARD-09.** WHILE the Boneyard is the location, THE engine SHALL add 1 to the attack of every troop whose tag is `Undead`, on both sides.
- **CARD-WIZARD-BONEYARD-10.** WHILE the Boneyard is the location, THE engine SHALL leave the attack of troops with any other tag unchanged.
- **CARD-WIZARD-BONEYARD-11.** WHILE the Boneyard is the location, THE engine SHALL let a Bone Wall attack, because its attack becomes 1.
- **CARD-WIZARD-BONEYARD-12.** WHILE the Boneyard is the location, THE engine SHALL apply the +1 to hit-back and overflow damage as well as to the attack itself.
- **CARD-WIZARD-BONEYARD-13.** WHILE the Boneyard is the location, THE engine SHALL keep a Headless Horseman's ride-past at 1 orb.

## Visible results

- **CARD-WIZARD-BONEYARD-14.** WHEN the Wizards play a Boneyard, THE log SHALL read "The Wizards' Boneyard is now the location."
- **CARD-WIZARD-BONEYARD-15.** WHILE the Boneyard is the location, THE public view for both seats SHALL show it.

## Not numbered

- Undead troops in the shipped game: Wizard Skeleton, Bone Wall, Headless Horseman, Lantern Wraith; Cowboy Captured Wraith. The Cowboy Captured Wraith therefore gains +1 from a Wizard Boneyard.
- The bot scores a location on its own side at +2 and on the other side at −2 (`evaluate`). That is a bot heuristic, not a rule.
- The Bonewright's lesson ("His Boneyard makes every Undead hit harder. A location of your own replaces it.") teaches requirement 08.
