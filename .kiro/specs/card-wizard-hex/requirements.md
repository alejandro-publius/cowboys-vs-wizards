# CARD-WIZARD-HEX requirements

Hex is the Wizards' trap. Set face down, it springs on the next Cowboy attack and cancels it.

## Sources

- Card spec: `.kiro/specs/duel-card-pipeline/cards/wizard-hex.json`
- Generated catalog: `src/game/card-specs.generated.js`
- Tables: `src/game/showdown/cards.js` (`EFFECTS.hex`, `DECKS`)
- Engine: `src/game/showdown/rules.js` (`TRAP_SLOTS`, `legalActions` trap branch, `applyAction` set branch, `attack` lines 196–205, `knowable`)
- Public view: `src/game/showdown/contract.js` (`viewFor`, `EVENTS.set`, `EVENTS.trap`)
- Opponent decks: `src/game/showdown/trail.js` (The Hexed Mile), `src/game/showdown/progress.js`
- Rulebook: `prototypes/showdown/RULEBOOK.md` section 7 (Traps), 10 ("Ride and traps")
- Log text: `src/game/showdown/presenter.js` (`set`, `trap`)
- Replay beats: `src/ui/showdown-3d/event-positions.js` (`set`, `trap` cases)
- Existing tests: `prototypes/showdown/rules.test.js` ("a set trap springs on the next enemy attack: Hex cancels it, Bear Trap bites first"; "setting a trap: one a turn, two face down at most, ..."); `tests/match/showdown-3d-presentation.test.js` ("Hex stops an attack, ..."; the Dragon test's hidden `traps` check)

## Card data

- **CARD-WIZARD-HEX-01.** THE catalog SHALL define `wizard-hex` as a Showdown-only Wizard trap named "Hex" with rarity `uncommon` and effect `hex`.
- **CARD-WIZARD-HEX-02.** THE Wizard opponent decks SHALL hold Hex in these counts: even match 1, The Hexed Mile 2, Dragon's Roost 1, The Stargazer 2, The Imp 1, The Graveyard Coven 1, Lantern Wraith escort 1, and none in any other deck.

## Setting

- **CARD-WIZARD-HEX-03.** WHILE the Wizards hold a Hex, have not set a trap this turn, hold fewer than 2 face-down traps, and no Wizard troop has acted this turn, THE engine SHALL offer a `set` action for it.
- **CARD-WIZARD-HEX-04.** WHEN the Wizards set a Hex, THE engine SHALL leave the turn's troop summon and other-card play available.
- **CARD-WIZARD-HEX-05.** WHEN the Wizards set a Hex, THE engine SHALL append it to the Wizard trap list, behind any trap already set.
- **CARD-WIZARD-HEX-06.** WHILE a Hex is face down, THE public view for the Cowboy seat SHALL show only the Wizard trap count, not the card.
- **CARD-WIZARD-HEX-07.** WHEN the Wizards set a Hex, THE log SHALL read "The Wizards set a card face down." without naming it.

## Springing

- **CARD-WIZARD-HEX-08.** WHEN a Cowboy troop attacks while a Hex is the oldest Wizard trap, THE engine SHALL remove that Hex from the trap list, put it in the Wizard graveyard, and cancel the attack.
- **CARD-WIZARD-HEX-09.** WHEN a Hex cancels an attack, THE engine SHALL change no troop's orbs and neither Base, and apply no hit-back, Last Stand or Sweep.
- **CARD-WIZARD-HEX-10.** WHEN a Hex cancels an attack, THE engine SHALL count the attack as that Cowboy troop's action for the turn.
- **CARD-WIZARD-HEX-11.** WHEN a Hex cancels an attack, THE engine SHALL end the Cowboys' card plays for that turn, because a troop has acted.
- **CARD-WIZARD-HEX-12.** WHEN a Cowboy troop attacks the Wizard Base, including a ride-past, THE engine SHALL spring the oldest Wizard trap, so a Hex cancels that attack too.
- **CARD-WIZARD-HEX-13.** WHEN a Cowboy troop takes cover, THE engine SHALL spring no trap.
- **CARD-WIZARD-HEX-14.** WHEN the Wizards hold 2 traps, THE engine SHALL spring only the oldest one per Cowboy attack.

## Visible results

- **CARD-WIZARD-HEX-15.** WHEN a Hex springs, THE engine SHALL emit one `trap` event with `stopped: true` and no `attack` event.
- **CARD-WIZARD-HEX-16.** WHEN the log presents that event, THE log SHALL read "Trap! The Wizards' Hex caught <name>: its attack was cancelled."
- **CARD-WIZARD-HEX-17.** WHEN the illustrated replay builds a Hex spring, THE replay SHALL produce a `trap` beat that leaves the attacker's orbs unchanged, then a `burial` beat for the Hex.

## Not numbered

- The level-2 bot plans without seeing the other side's traps (`knowable`). A Cowboy bot in two-player or test play would therefore not see a Hex.
- Hex has no Card gallery preview.
