# Card spec: Sheriff's Office (`cowboy-sheriffs-office`)

Author: Kiro (native Kiro CLI, agent `native-handoff-cowboy-specs`). Every clause describes the current Showdown engine as read from the files below. No clause adds or changes a rule.

## Sources

- Card JSON: `.kiro/specs/duel-card-pipeline/cards/cowboy-sheriffs-office.json` (Showdown-only)
- Card table and effect text: `src/game/showdown/cards.js` (`TYPES`, `EFFECTS.office`, `DECKS`)
- Rules: `src/game/showdown/rules.js` (`legalActions` location branch, `applyAction` location branch, `attackOf`); text: `prototypes/showdown/RULEBOOK.md` section 8
- Progress: `src/game/showdown/progress.js` (`RIVALS[1]` The Imp, `pool`, `settle`, `deckProblems`)
- Log text: `src/game/showdown/presenter.js` (`PRESENTERS.location`)

## Requirements

- CARD-COWBOY-SHERIFFS-OFFICE-01: The Showdown card table SHALL define `TYPES["cowboy-sheriffs-office"]` as a Cowboy location named Sheriff's Office with effect `office`, rarity rare and `fresh: true`.
- CARD-COWBOY-SHERIFFS-OFFICE-02: WHEN a Sheriff's Office is in the active side's hand, no spell, gear or location has been played this turn, no troop has acted and the location in play is not a Sheriff's Office, `legalActions` SHALL list one location action for it.
- CARD-COWBOY-SHERIFFS-OFFICE-03: WHILE a Sheriff's Office is the table's location, `legalActions` SHALL list no location action for another Sheriff's Office.
- CARD-COWBOY-SHERIFFS-OFFICE-04: WHEN a Sheriff's Office is played, the engine SHALL set `state.location` to `{cardId, side: "cowboy"}` and keep the card out of the discard.
- CARD-COWBOY-SHERIFFS-OFFICE-05: WHILE a Sheriff's Office is the table's location, `attackOf` SHALL add 1 to every Lawman troop (Sheriff, Outrider, Ranger).
- CARD-COWBOY-SHERIFFS-OFFICE-06: WHILE a Sheriff's Office is the table's location, `attackOf` SHALL add nothing to a troop whose tag is not Lawman.
- CARD-COWBOY-SHERIFFS-OFFICE-07: WHEN a Sheriff's Office is played while the Boneyard is in play, the engine SHALL move the Boneyard to the Wizard discard.
- CARD-COWBOY-SHERIFFS-OFFICE-08: WHEN the Wizards play the Boneyard while a Sheriff's Office is in play, the engine SHALL move the Sheriff's Office to the Cowboy discard.
- CARD-COWBOY-SHERIFFS-OFFICE-09: WHEN a Sheriff's Office has been played this turn, `legalActions` SHALL list no spell or gear action that turn.
- CARD-COWBOY-SHERIFFS-OFFICE-10: WHEN a Sheriff's Office is played, `presentEvent` for the `location` event SHALL return "The Cowboys' Sheriff's Office is now the location."
- CARD-COWBOY-SHERIFFS-OFFICE-11: WHEN The Imp rival is beaten for the first time, `settle` SHALL pay `[["cowboy-sheriffs-office", 1]]` and 1 pack.
- CARD-COWBOY-SHERIFFS-OFFICE-12: WHILE The Imp rival is unbeaten, the offer and pack pools SHALL exclude the Sheriff's Office.
- CARD-COWBOY-SHERIFFS-OFFICE-13: The even-match Cowboy deck `DECKS.cowboy` SHALL hold no Sheriff's Office.
- CARD-COWBOY-SHERIFFS-OFFICE-14: WHEN a deck and its side deck together hold more than 2 Sheriff's Offices, `deckProblems` SHALL return at least one problem.

## Open items (not counted)

- Open: a location affects both sides, but no Wizard troop has the Lawman tag, so the Office never changes a Wizard troop in current play. Not listed as a requirement.
- Open: no test title cites any CARD-COWBOY-SHERIFFS-OFFICE ID, so the trace reports every clause as an orphan.
