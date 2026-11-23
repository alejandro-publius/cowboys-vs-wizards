# CARD-WIZARD-BONE-ARMOR requirements

Bone Armor is Wizard gear. A Wizard troop that carries it gains 2 orbs.

## Sources

- Card spec: `.kiro/specs/duel-card-pipeline/cards/wizard-bone-armor.json`
- Generated catalog: `src/game/card-specs.generated.js`
- Tables: `src/game/showdown/cards.js` (`EFFECTS.bonearmor`, `DECKS` comment "Gear and locations are earned, so they are not in these")
- Engine: `src/game/showdown/rules.js` (`legalActions` gear branch, `applyAction` gear branch, `attackOf`, `defeat`, Raise in the summon branch)
- Opponent decks: `src/game/showdown/progress.js` (The Imp, The Bonewright)
- Rulebook: `prototypes/showdown/RULEBOOK.md` sections 2 (Gear), 8 (Gear)
- Log text: `src/game/showdown/presenter.js` (`gear`)
- Existing tests: `prototypes/showdown/rules.test.js` ("gear: a Six-Shooter adds 1 attack, Bone Armor adds 2 orbs, and gear goes to the graveyard with its troop")

## Card data

- **CARD-WIZARD-BONE-ARMOR-01.** THE catalog SHALL define `wizard-bone-armor` as a Showdown-only Wizard gear card named "Bone Armor" with rarity `uncommon` and effect `bonearmor`, which adds 0 attack and 2 orbs.
- **CARD-WIZARD-BONE-ARMOR-02.** THE Wizard opponent decks SHALL hold 1 Bone Armor in The Imp and 1 in The Bonewright, and none in the even match or any other deck.

## Playing

- **CARD-WIZARD-BONE-ARMOR-03.** WHILE the Wizards hold a Bone Armor, have not used the turn's other-card play, and no Wizard troop has acted this turn, THE engine SHALL offer one gear action for each occupied Wizard slot.
- **CARD-WIZARD-BONE-ARMOR-04.** WHILE the Wizard board is empty, THE engine SHALL offer no Bone Armor action.
- **CARD-WIZARD-BONE-ARMOR-05.** WHEN Bone Armor is played, THE engine SHALL mark the turn's other-card play as used, so no spell or location can follow that turn.

## Effect

- **CARD-WIZARD-BONE-ARMOR-06.** WHEN Bone Armor is fixed to a Wizard troop, THE engine SHALL add 2 to that troop's current orbs, even above its printed orbs.
- **CARD-WIZARD-BONE-ARMOR-07.** WHEN Bone Armor is fixed to a Wizard troop, THE engine SHALL leave that troop's attack unchanged.
- **CARD-WIZARD-BONE-ARMOR-08.** WHEN a troop already carries gear, THE engine SHALL still allow Bone Armor on it, and the orbs stack.
- **CARD-WIZARD-BONE-ARMOR-09.** WHILE Bone Armor is on a troop, THE engine SHALL keep it out of the hand, the deck and the graveyard.
- **CARD-WIZARD-BONE-ARMOR-10.** WHEN the carrier is defeated or paid as a tribute, THE engine SHALL move the Bone Armor to the Wizard graveyard right after the carrier.
- **CARD-WIZARD-BONE-ARMOR-11.** WHEN Raise returns a troop that died carrying Bone Armor, THE engine SHALL leave the Bone Armor in the graveyard.

## Visible results

- **CARD-WIZARD-BONE-ARMOR-12.** WHEN Bone Armor is fixed, THE log SHALL read "The Wizards' <troop> now carries Bone Armor."

## Not numbered

- Gear adds its orbs once, when played. Later damage removes orbs normally; nothing restores them.
- Bone Armor has no Card gallery preview.
