# Card spec: Outrider (`cowboy-outrider`)

Author: Kiro (native Kiro CLI, agent `native-handoff-cowboy-specs`). Every clause describes the current Showdown engine as read from the files below. No clause adds or changes a rule.

## Sources

- Card JSON: `.kiro/specs/duel-card-pipeline/cards/cowboy-outrider.json`
- Card table and keyword text: `src/game/showdown/cards.js` (`TYPES`, `KEYWORDS.ride`, `DECKS`, `RARITY`, `EFFECTS.office`)
- Rules: `src/game/showdown/rules.js` (`targetsFor`, `attackOutcome`, `attack`, `finish`, `attackOf`); text: `prototypes/showdown/RULEBOOK.md` sections 5, 9 and 10 ("Ride and Guard", "Ride and traps")
- Progress: `src/game/showdown/trail.js` (`TRAIL[1]`, Raven Roost), `src/game/showdown/progress.js` (`deckProblems`)
- Log text: `src/game/showdown/presenter.js` (`attackText`)

## Requirements

- CARD-COWBOY-OUTRIDER-01: The Showdown card table SHALL define `TYPES["cowboy-outrider"]` as a Cowboy troop named Outrider with 3 stars, 1 attack, 3 orbs, tag Lawman, keywords `["ride"]`, rarity common and `bounty: false`.
- CARD-COWBOY-OUTRIDER-02: WHEN an Outrider is in the active side's hand and a board slot is free, `legalActions` SHALL list its summon with `tributes: []`.
- CARD-COWBOY-OUTRIDER-03: WHEN an Outrider is summoned from the hand, `canAttack` SHALL return false for it on its arrival turn, so it cannot ride out that turn.
- CARD-COWBOY-OUTRIDER-04: WHILE the enemy has troops and none has Guard, `legalActions` SHALL offer a ready Outrider every enemy troop's slot and the target `"base"`.
- CARD-COWBOY-OUTRIDER-05: WHILE any enemy troop has Guard, `legalActions` SHALL offer a ready Outrider only the Guard troops' slots and not `"base"`.
- CARD-COWBOY-OUTRIDER-06: WHEN an Outrider rides past standing enemy troops to the Base, the engine SHALL remove exactly 1 orb from the enemy Base, whatever the Outrider's attack.
- CARD-COWBOY-OUTRIDER-07: WHEN an Outrider rides past standing enemy troops, the engine SHALL leave the orbs of every troop on both boards unchanged.
- CARD-COWBOY-OUTRIDER-08: WHILE the enemy board is empty, the engine SHALL let a ready Outrider strike the Base for its full attack.
- CARD-COWBOY-OUTRIDER-09: WHILE Sheriff's Office is the table's location, `attackOf` SHALL return 2 for an Outrider.
- CARD-COWBOY-OUTRIDER-10: WHEN an Outrider rides past while Sheriff's Office is in play and enemy troops stand, the engine SHALL still remove exactly 1 orb from the enemy Base.
- CARD-COWBOY-OUTRIDER-11: WHEN an Outrider's ride-past springs a Wizard Hex, the engine SHALL cancel it, leave the Wizard Base unchanged and count it as the Outrider's action.
- CARD-COWBOY-OUTRIDER-12: WHEN an Outrider's ride-past takes the Wizard Base from 1 orb to 0, the engine SHALL set `result` to `{winner: "cowboy", reason: "base"}`.
- CARD-COWBOY-OUTRIDER-13: WHEN an Outrider rides past, the engine SHALL emit an `attack` event with `target: "base"`, `baseDamage: 1`, `targetLeft: null`, `hitBack: 0` and `attackerLeft` equal to the Outrider's orbs.
- CARD-COWBOY-OUTRIDER-14: WHEN that `attack` event names a Cowboy Outrider, `presentEvent` SHALL return "The Cowboys' Outrider struck the Wizards' Base for 1."
- CARD-COWBOY-OUTRIDER-15: The even-match Cowboy deck `DECKS.cowboy` SHALL hold 2 Outriders.
- CARD-COWBOY-OUTRIDER-16: WHEN the second Trail duel (Raven Roost) is won and the saved deck holds at least 2 Sheriffs, `settle` SHALL add 2 Outriders to the collection and swap them into the deck for 2 Sheriffs.
- CARD-COWBOY-OUTRIDER-17: WHEN a deck and its side deck together hold more than 4 Outriders, `deckProblems` SHALL return at least one problem.

## Open items (not counted)

- Open: the JSON `rides: true` and `limit: 2` are lane fields (`src/game/cards.js` `canRide`, `cowboyCopyLimit`). Showdown reads the `ride` keyword and caps the Common card at 4. Whether to drop or align these lane fields is a pipeline decision for Fable.
- Open: `.kiro/specs/outrider-gate/` is a separate experiment (ride or fight decision cases in the Camp). It changes no Outrider rule and its G-clauses are not restated here.
- Open: `tests/game/card-specs.test.js` cites `CARD-COWBOY-OUTRIDER-04` through `-10` and `-12` through `-14`; `-01` to `-03`, `-11` and `-15` to `-17` are not yet cited in a test title and remain orphans in the trace.
