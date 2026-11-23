# Card spec: Bear Trap (`cowboy-bear-trap`)

Author: Kiro (native Kiro CLI, agent `native-handoff-cowboy-specs`). Every clause describes the current Showdown engine as read from the files below. No clause adds or changes a rule.

## Sources

- Card JSON: `.kiro/specs/duel-card-pipeline/cards/cowboy-bear-trap.json` (Showdown-only)
- Card table and effect text: `src/game/showdown/cards.js` (`TYPES`, `EFFECTS.snare`, `DECKS`)
- Rules: `src/game/showdown/rules.js` (`TRAP_SLOTS`, `legalActions` set branch, `applyAction` set branch, `attack` trap block, `defeat`); text: `prototypes/showdown/RULEBOOK.md` sections 7 and 10 ("Ride and traps", "Last Stand", "Bear Trap and gear")
- Hidden information: `src/game/showdown/contract.js` (`viewFor`, `EVENTS.set`, `EVENTS.trap`)
- Progress: `src/game/showdown/trail.js` (`TRAIL[3]`, Imp Hollow), `src/game/showdown/progress.js` (`deckProblems`)
- Log text: `src/game/showdown/presenter.js` (`PRESENTERS.trap`)

## Requirements

- CARD-COWBOY-BEAR-TRAP-01: The Showdown card table SHALL define `TYPES["cowboy-bear-trap"]` as a Cowboy trap named Bear Trap with effect `snare`, rarity uncommon and `fresh: true`.
- CARD-COWBOY-BEAR-TRAP-02: WHEN a Bear Trap is in the active side's hand, no trap has been set this turn, fewer than 2 traps are face down and no troop has acted, `legalActions` SHALL list one set action for it.
- CARD-COWBOY-BEAR-TRAP-03: WHILE 2 Cowboy traps are face down, `legalActions` SHALL list no set action.
- CARD-COWBOY-BEAR-TRAP-04: WHEN a Bear Trap has been set this turn, `legalActions` SHALL list no further set action that turn.
- CARD-COWBOY-BEAR-TRAP-05: WHEN a Bear Trap is set, the engine SHALL emit a `set` event that carries only the side, not the card.
- CARD-COWBOY-BEAR-TRAP-06: WHILE a Bear Trap is face down, `viewFor(state, "wizard")` SHALL give the Cowboy side a `trapCount` and no `traps` list.
- CARD-COWBOY-BEAR-TRAP-07: WHEN a Wizard troop attacks while a Bear Trap is the oldest Cowboy trap, the engine SHALL remove 2 orbs from the attacker before the attack resolves and move the Bear Trap to the Cowboy discard.
- CARD-COWBOY-BEAR-TRAP-08: WHEN the Bear Trap defeats the attacker, the engine SHALL stop the attack, so its target keeps all its orbs.
- CARD-COWBOY-BEAR-TRAP-09: WHEN the attacker survives the Bear Trap, the engine SHALL resolve its attack with the attacker's reduced orbs.
- CARD-COWBOY-BEAR-TRAP-10: WHILE two Cowboy traps are face down, the engine SHALL spring only the older one on the next Wizard attack.
- CARD-COWBOY-BEAR-TRAP-11: WHEN the Bear Trap defeats an attacker that carries gear, the engine SHALL move the gear to the Wizard discard with the troop.
- CARD-COWBOY-BEAR-TRAP-12: WHEN the Bear Trap defeats an attacking Jack-o'-Lantern, the engine SHALL emit no `laststand` event.
- CARD-COWBOY-BEAR-TRAP-13: WHEN a Headless Horseman at 3 orbs rides past Cowboy troops into a Bear Trap, the engine SHALL leave the Horseman on 1 orb and still remove 1 orb from the Cowboy Base.
- CARD-COWBOY-BEAR-TRAP-14: WHEN the Bear Trap defeats an Imp, `presentEvent` for the `trap` event SHALL return "Trap! The Cowboys' Bear Trap caught Imp: defeated before it struck."
- CARD-COWBOY-BEAR-TRAP-15: The even-match Cowboy deck `DECKS.cowboy` SHALL hold 1 Bear Trap.
- CARD-COWBOY-BEAR-TRAP-16: WHEN the fourth Trail duel (Imp Hollow) is won and the saved deck holds at least 1 Deadeye, `settle` SHALL add 1 Bear Trap to the collection and swap it into the deck for 1 Deadeye.
- CARD-COWBOY-BEAR-TRAP-17: WHEN a deck and its side deck together hold more than 3 Bear Traps, `deckProblems` SHALL return at least one problem.

## Open items (not counted)

- Open: the JSON has no lane fields (`showdownOnly: true`), so `scripts/sync-card-specs.mjs` keeps it out of `CARD_SPECS` and lists it after the lane cards in `SHOWDOWN_SPECS`.
- Open: no test title cites any CARD-COWBOY-BEAR-TRAP ID, so the trace reports every clause as an orphan.
