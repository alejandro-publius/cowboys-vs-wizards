# CARD-WIZARD-IMP requirements

The Imp is a free Fiend with Quickdraw: 3 attack, 1 orb, and it may attack the turn it arrives.

## Sources

- Card spec: `.kiro/specs/duel-card-pipeline/cards/wizard-imp.json`
- Generator: `scripts/sync-card-specs.mjs` (the zero-copy, limit-1 Wizard troop branch); output `src/game/card-specs.generated.js`
- Tables: `src/game/showdown/cards.js` (`KEYWORDS.quickdraw`, `DECKS`)
- Engine: `src/game/showdown/rules.js` (`arrive`, `canAttack`, `attack`)
- Opponent decks: `src/game/showdown/trail.js` (Imp Hollow), `src/game/showdown/progress.js` (The Imp)
- Rulebook: `prototypes/showdown/RULEBOOK.md` sections 4 ("Nobody attacks on turn 1"), 9 (Quickdraw)
- Existing tests: `prototypes/showdown/rules.test.js` ("Quickdraw: a free troop with it attacks on the turn it arrives"; "a set trap springs ...: Hex cancels it, Bear Trap bites first"; "setting a trap: ... the bot plans without seeing them")

## Card data

- **CARD-WIZARD-IMP-01.** THE catalog SHALL define `wizard-imp` as a Wizard troop named "Imp" with 2 stars, 3 attack, 1 orb, rarity `uncommon`, type tag `Fiend` and the single keyword `quickdraw`.
- **CARD-WIZARD-IMP-02.** THE sync script SHALL accept the Imp's lane fields `copies: 0` and `limit: 1` as a registered Wizard troop that is in no lane deck, and omit both from the Showdown record.
- **CARD-WIZARD-IMP-03.** THE Wizard opponent decks SHALL hold Imps in these counts: even match 1, Imp Hollow 3, Dragon's Roost 1, The Imp 3, The Graveyard Coven 1, and none in any other Trail, rival or bounty deck.

## Quickdraw

- **CARD-WIZARD-IMP-04.** WHEN the Wizards summon an Imp, THE engine SHALL require no tribute.
- **CARD-WIZARD-IMP-05.** WHEN an Imp arrives from the hand on turn 2 or later, THE engine SHALL let it attack that turn.
- **CARD-WIZARD-IMP-06.** WHILE the turn is 1, THE engine SHALL offer the Imp no attack, because nobody attacks on turn 1.

## Fighting

- **CARD-WIZARD-IMP-07.** WHEN an Imp attacks a Cowboy troop with 3 or fewer orbs out of cover, THE engine SHALL defeat that troop and send any damage beyond its orbs to the Cowboy Base.
- **CARD-WIZARD-IMP-08.** WHEN an Imp on 1 orb attacks a troop that survives out of cover with at least 1 attack, THE engine SHALL defeat the Imp with the hit-back.
- **CARD-WIZARD-IMP-09.** WHEN an Imp on 1 or 2 orbs attacks while the Cowboys have a Bear Trap set, THE engine SHALL defeat the Imp before it strikes and leave the target untouched.
- **CARD-WIZARD-IMP-10.** WHEN an Imp on 1 orb defeats a Cowboy troop with Last Stand in a fight, THE engine SHALL take the Imp's orb and defeat it.

## Card gallery

- **CARD-WIZARD-IMP-11.** WHEN the Card gallery lists previews for Imp, THE gallery SHALL offer one preview, "Watch attack", which applies a real Imp attack on a Cowboy Sheriff.

## Not numbered

- Imp is `uncommon` (a Cowboy deck limit of 3) while its lane spec has `limit: 1`. Wizard opponent decks are not checked against either; Imp Hollow and The Imp hold 3. The lane limit has no Showdown effect.
- Raise never returns an Imp: it is a Fiend (`card-wizard-wizard` 16).
