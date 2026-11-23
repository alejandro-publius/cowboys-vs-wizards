# Card spec: Gatling Crew (`cowboy-gatling-crew`)

Author: Kiro (native Kiro CLI, agent `native-handoff-cowboy-specs`). Every clause describes the current Showdown engine as read from the files below. No clause adds or changes a rule.

## Sources

- Card JSON: `.kiro/specs/duel-card-pipeline/cards/cowboy-gatling-crew.json`
- Card table: `src/game/showdown/cards.js` (`TYPES`, `KEYWORDS.sweep`, `tributes`, `DECKS`, `RARITY`)
- Rules: `src/game/showdown/rules.js` (`legalActions` summon combinations, `arrive`, `canAttack`, `targetsFor`, `attack` Sweep block, `attackOutcome`); text: `prototypes/showdown/RULEBOOK.md` sections 2, 5, 9 and 10 ("Sweep", "Ghostly")
- Progress: `src/game/showdown/trail.js` (`TRAIL[5]`, Dragon's Roost), `src/game/showdown/progress.js` (`deckProblems`, `migrate`)
- Log text: `src/game/showdown/presenter.js` (`PRESENTERS.sweep`)

## Requirements

- CARD-COWBOY-GATLING-CREW-01: The Showdown card table SHALL define `TYPES["cowboy-gatling-crew"]` as a Cowboy troop named Gatling Crew with 7 stars, 4 attack, 4 orbs, tag Rig, keywords `["sweep"]`, rarity rare and `bounty: false`.
- CARD-COWBOY-GATLING-CREW-02: WHEN a Gatling Crew is in the active side's hand and that side has not summoned this turn, `legalActions` SHALL list one summon action for each pair of occupied own slots, and none when fewer than 2 own troops stand.
- CARD-COWBOY-GATLING-CREW-03: WHEN a Gatling Crew is summoned, the engine SHALL send both tribute troops to the discard before it arrives, and place it in the lowest-numbered empty slot, which may be one the tributes freed.
- CARD-COWBOY-GATLING-CREW-04: WHEN a Gatling Crew is summoned after turn 1, `canAttack` SHALL return true for it on its arrival turn, because a tribute paid for it.
- CARD-COWBOY-GATLING-CREW-05: WHEN a Gatling Crew attacks an enemy troop, the engine SHALL remove 1 orb from every other enemy troop after the fight is settled and defeat any that reach 0.
- CARD-COWBOY-GATLING-CREW-06: WHEN a Gatling Crew's Sweep hits one or more troops, the engine SHALL emit one `sweep` event whose `count` is the number of other enemy troops hit.
- CARD-COWBOY-GATLING-CREW-07: WHEN a Gatling Crew at 3 orbs attacks a Dragon at 5 orbs beside another Wizard troop, the engine SHALL apply the Sweep to that troop even though the Dragon's hit back defeats the Gatling Crew.
- CARD-COWBOY-GATLING-CREW-08: WHEN a Gatling Crew attacks a Skeleton at 3 orbs while other Wizard troops stand, the Wizard Base SHALL lose only the fight's 1 orb of spill, whatever the Sweep defeats.
- CARD-COWBOY-GATLING-CREW-09: WHILE the Wizards have a Bone Wall and a Skeleton on the board, `legalActions` SHALL offer the Gatling Crew only the Bone Wall's slot as a target.
- CARD-COWBOY-GATLING-CREW-10: WHEN a Gatling Crew attacks a Bone Wall beside a Skeleton at 3 orbs, the engine SHALL leave the Skeleton on 2 orbs, because Guard does not shield other troops from Sweep.
- CARD-COWBOY-GATLING-CREW-11: WHEN a Gatling Crew's Sweep defeats a Jack-o'-Lantern, the engine SHALL emit no `laststand` event for it and take no orb from the Gatling Crew.
- CARD-COWBOY-GATLING-CREW-12: WHEN a Gatling Crew attacks a troop standing beside a Lantern Wraith, the engine SHALL remove 1 orb from the Lantern Wraith, because Sweep is not a spell.
- CARD-COWBOY-GATLING-CREW-13: WHEN a Gatling Crew's attack springs a Wizard Hex, the engine SHALL emit no `sweep` event and leave every Wizard troop's orbs unchanged.
- CARD-COWBOY-GATLING-CREW-14: WHEN a Wizard troop attacks a Gatling Crew, the engine SHALL apply no Sweep for the Gatling Crew.
- CARD-COWBOY-GATLING-CREW-15: `attackOutcome` SHALL report a Gatling Crew attack without its Sweep, so the orbs of the other enemy troops are not part of the preview.
- CARD-COWBOY-GATLING-CREW-16: WHEN a `sweep` event names a Cowboy Gatling Crew with `count: 2`, `presentEvent` SHALL return "Sweep: Gatling Crew also hit 2 other troops for 1."
- CARD-COWBOY-GATLING-CREW-17: The even-match Cowboy deck `DECKS.cowboy` SHALL hold no Gatling Crew.
- CARD-COWBOY-GATLING-CREW-18: WHEN the sixth Trail duel (Dragon's Roost) is won and the saved deck holds at least 1 Billy, `settle` SHALL add 1 Gatling Crew to the collection and swap it into the deck for 1 Billy.
- CARD-COWBOY-GATLING-CREW-19: WHEN a deck and its side deck together hold more than 2 Gatling Crews, `deckProblems` SHALL return at least one problem.
- CARD-COWBOY-GATLING-CREW-20: WHEN a save's deck holds 4 Gatling Crews or its collection holds 9, `migrate` SHALL return `newSave()`.

## Open items (not counted)

- Open: the JSON `limit: 1` feeds only the retired lane catalog. Showdown's cap is the Rare limit of 2, and a second copy can come from an offer or a pack (`pool()` weight 1) after the Trail pays the first. Which cap the card should carry is a decision for Fable.
- Open: Sweep never fires on a direct Base strike (RULEBOOK section 10). The Gatling Crew has no Ride, so it strikes the Base only when the enemy board is empty, where Sweep would have nothing to hit. This is not listed as a requirement because it cannot be observed for this card.
- Open: no test title cites any CARD-COWBOY-GATLING-CREW ID, so the trace reports every clause as an orphan.
