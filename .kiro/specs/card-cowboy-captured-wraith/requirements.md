# Card spec: Captured Wraith (`cowboy-captured-wraith`)

Author: Kiro (native Kiro CLI, agent `native-handoff-cowboy-specs`). Every clause describes the current Showdown engine as read from the files below. No clause adds or changes a rule.

## Sources

- Card JSON: `.kiro/specs/duel-card-pipeline/cards/cowboy-captured-wraith.json`
- Card table: `src/game/showdown/cards.js` (`TYPES`, `KEYWORDS.ghostly`, `EFFECTS.boneyard`, `RARITY`, `DECKS`)
- Rules: `src/game/showdown/rules.js` (`legalActions` spell branch, `applyAction` spell branch, `attack` trap block, `attackOf`); text: `prototypes/showdown/RULEBOOK.md` sections 8, 9, 10 ("Ghostly") and 12 ("Bounties")
- Progress: `src/game/showdown/progress.js` (`BOUNTIES[0]` lantern-wraith, `settle`, `pool`, `deckProblems`)

## Requirements

- CARD-COWBOY-CAPTURED-WRAITH-01: The Showdown card table SHALL define `TYPES["cowboy-captured-wraith"]` as a Cowboy troop named Captured Wraith with 3 stars, 2 attack, 2 orbs, tag Undead, keywords `["ghostly"]`, rarity legendary and `bounty: true`.
- CARD-COWBOY-CAPTURED-WRAITH-02: WHEN a Captured Wraith is in the active side's hand and a board slot is free, `legalActions` SHALL list its summon with `tributes: []`.
- CARD-COWBOY-CAPTURED-WRAITH-03: WHEN a Captured Wraith is summoned from the hand, `canAttack` SHALL return false for it on its arrival turn.
- CARD-COWBOY-CAPTURED-WRAITH-04: WHILE a Captured Wraith stands on the Cowboy board, `legalActions` SHALL list no Wizard Singularity action that targets its slot.
- CARD-COWBOY-CAPTURED-WRAITH-05: WHEN the Wizards cast Hellfire, the engine SHALL remove 1 orb from a Captured Wraith, because Hellfire chooses no target.
- CARD-COWBOY-CAPTURED-WRAITH-06: WHILE the Boneyard is the table's location, `attackOf` SHALL return 3 for a Captured Wraith, because its tag is Undead.
- CARD-COWBOY-CAPTURED-WRAITH-07: WHEN a Captured Wraith's attack springs a Wizard Hex, the engine SHALL cancel the attack, because traps are not spells.
- CARD-COWBOY-CAPTURED-WRAITH-08: WHEN the fifth hunt of the Lantern Wraith bounty is won, `settle` SHALL report `captured: "cowboy-captured-wraith"` and add 1 copy to the collection.
- CARD-COWBOY-CAPTURED-WRAITH-09: WHEN a deck and its side deck together hold 2 Captured Wraiths, `deckProblems` SHALL return at least one problem.
- CARD-COWBOY-CAPTURED-WRAITH-10: The offer and pack pools SHALL never include the Captured Wraith, because `pool()` excludes legendary cards.
- CARD-COWBOY-CAPTURED-WRAITH-11: The even-match Cowboy deck `DECKS.cowboy` SHALL hold no Captured Wraith.

## Open items (not counted)

- Open: the Wizards' Raise reads only the Wizard discard, so a defeated Captured Wraith (Undead) in the Cowboy discard is never raised. No Cowboy card raises. Not listed as a requirement because it cannot be observed as a Captured Wraith effect.
- Open: no test title cites any CARD-COWBOY-CAPTURED-WRAITH ID, so the trace reports every clause as an orphan.
