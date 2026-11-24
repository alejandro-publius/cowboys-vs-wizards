# Card spec: Six-Shooter (`cowboy-six-shooter`)

Author: Kiro (native Kiro CLI, agent `native-handoff-cowboy-specs`). Every clause describes the current Showdown engine as read from the files below. No clause adds or changes a rule.

## Sources

- Card JSON: `.kiro/specs/duel-card-pipeline/cards/cowboy-six-shooter.json` (Showdown-only)
- Card table and effect text: `src/game/showdown/cards.js` (`TYPES`, `EFFECTS.sixshooter`, `DECKS`)
- Rules: `src/game/showdown/rules.js` (`legalActions` gear branch, `applyAction` gear and summon branches, `attackOf`, `attackOutcome`, `defeat`); text: `prototypes/showdown/RULEBOOK.md` section 8
- Progress: `src/game/showdown/progress.js` (`RIVALS[0]` The Stargazer, `pool`, `settle`, `deckProblems`)
- Log text: `src/game/showdown/presenter.js` (`PRESENTERS.gear`)

## Requirements

- CARD-COWBOY-SIX-SHOOTER-01: The Showdown card table SHALL define `TYPES["cowboy-six-shooter"]` as a Cowboy gear card named Six-Shooter with effect `sixshooter`, rarity uncommon and `fresh: true`.
- CARD-COWBOY-SIX-SHOOTER-02: WHEN a Six-Shooter is in the active side's hand, no spell, gear or location has been played this turn and no troop has acted, `legalActions` SHALL list one gear action per occupied own slot and none when the side's board is empty.
- CARD-COWBOY-SIX-SHOOTER-03: WHEN a Six-Shooter is fixed to a troop, `attackOf` SHALL return that troop's attack plus 1, with its orbs unchanged.
- CARD-COWBOY-SIX-SHOOTER-04: WHEN a Six-Shooter has been played this turn, `legalActions` SHALL list no spell or location action that turn.
- CARD-COWBOY-SIX-SHOOTER-05: WHEN a troop carries two Six-Shooters from two turns, `attackOf` SHALL return its card attack plus 2.
- CARD-COWBOY-SIX-SHOOTER-06: WHEN a troop carrying a Six-Shooter is defeated, the engine SHALL move the troop and then the Six-Shooter to its owner's discard.
- CARD-COWBOY-SIX-SHOOTER-07: WHEN a troop carrying a Six-Shooter is paid as tribute, the engine SHALL move the Six-Shooter to the discard with it.
- CARD-COWBOY-SIX-SHOOTER-08: WHEN a Skeleton attacks a Sheriff that carries a Six-Shooter, the engine SHALL leave the Skeleton on 1 orb, because the hit back uses the gear's attack.
- CARD-COWBOY-SIX-SHOOTER-09: WHEN a Mounted Billy carrying a Six-Shooter rides past standing troops, the engine SHALL remove exactly 1 orb from the Wizard Base.
- CARD-COWBOY-SIX-SHOOTER-10: WHEN a Six-Shooter is fixed to a Sheriff, `presentEvent` for the `gear` event SHALL return "The Cowboys' Sheriff now carries Six-Shooter."
- CARD-COWBOY-SIX-SHOOTER-11: WHEN The Stargazer is beaten for the first time, `settle` SHALL pay `[["cowboy-six-shooter", 1]]` and 1 pack.
- CARD-COWBOY-SIX-SHOOTER-12: WHILE The Stargazer is unbeaten, the offer and pack pools SHALL exclude the Six-Shooter.
- CARD-COWBOY-SIX-SHOOTER-13: The even-match Cowboy deck `DECKS.cowboy` SHALL hold no Six-Shooter.
- CARD-COWBOY-SIX-SHOOTER-14: WHEN a deck and its side deck together hold more than 3 Six-Shooters, `deckProblems` SHALL return at least one problem.

## Open items (not counted)

- Open: no Cowboy troop has 0 attack, so the "Zero attack" ruling (gear can let a 0-attack troop attack) has no Cowboy case. Not listed as a requirement.
- Open: no test title cites any CARD-COWBOY-SIX-SHOOTER ID, so the trace reports every clause as an orphan.
