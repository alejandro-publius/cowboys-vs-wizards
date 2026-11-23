# Card spec: Dynamiter (`cowboy-dynamiter`)

Author: Kiro (native Kiro CLI, agent `native-handoff-cowboy-specs`). Every clause describes the current Showdown engine as read from the files below. No clause adds or changes a rule.

## Sources

- Card JSON: `.kiro/specs/duel-card-pipeline/cards/cowboy-dynamiter.json`
- Card table and keyword text: `src/game/showdown/cards.js` (`TYPES`, `KEYWORDS.laststand`, `DECKS`, `RARITY`)
- Rules: `src/game/showdown/rules.js` (`attack`, the Last Stand loop, `defeat`); text: `prototypes/showdown/RULEBOOK.md` sections 9 and 10 ("Last Stand", "Cover and Last Stand")
- Progress: `src/game/showdown/trail.js` (`TRAIL[3]`, Imp Hollow), `src/game/showdown/progress.js` (`deckProblems`)
- Log text: `src/game/showdown/presenter.js` (`PRESENTERS.laststand`)

## Requirements

- CARD-COWBOY-DYNAMITER-01: The Showdown card table SHALL define `TYPES["cowboy-dynamiter"]` as a Cowboy troop named Dynamiter with 3 stars, 3 attack, 1 orb, tag Outlaw, keywords `["laststand"]`, rarity uncommon and `bounty: false`.
- CARD-COWBOY-DYNAMITER-02: WHEN a Dynamiter is in the active side's hand and a board slot is free, `legalActions` SHALL list its summon with `tributes: []`.
- CARD-COWBOY-DYNAMITER-03: WHEN a Dynamiter is summoned from the hand, `canAttack` SHALL return false for it on its arrival turn.
- CARD-COWBOY-DYNAMITER-04: WHEN a Dynamiter at 1 orb attacks a Wizard at 4 orbs, the engine SHALL defeat both troops: the attack leaves the Wizard on 1, the hit back defeats the Dynamiter, and Last Stand removes the Wizard's last orb.
- CARD-COWBOY-DYNAMITER-05: WHEN a Dynamiter attacks a Skeleton at 3 orbs, the engine SHALL defeat the Skeleton and leave the Dynamiter on 1 orb with no hit back.
- CARD-COWBOY-DYNAMITER-06: WHEN a Skeleton at 3 orbs attacks a Dynamiter, the engine SHALL defeat the Dynamiter and leave the Skeleton on 2 orbs.
- CARD-COWBOY-DYNAMITER-07: WHEN an Imp attacks a Dynamiter that is not in cover, the engine SHALL defeat both troops and remove 2 orbs from the Cowboy Base.
- CARD-COWBOY-DYNAMITER-08: WHEN a Wizard attacks a Dynamiter in cover, the engine SHALL defeat the Dynamiter, leave the Wizard on 3 orbs and leave the Cowboy Base unchanged.
- CARD-COWBOY-DYNAMITER-09: WHEN a Dynamiter's attack defeats a Jack-o'-Lantern, the engine SHALL defeat both troops and emit exactly one `laststand` event, whose `cardId` is the Jack-o'-Lantern.
- CARD-COWBOY-DYNAMITER-10: WHEN a Singularity or Hellfire removes the Dynamiter's orb, the engine SHALL emit no `laststand` event.
- CARD-COWBOY-DYNAMITER-11: WHEN a Dragon's Sweep removes the Dynamiter's orb, the engine SHALL emit no `laststand` event for the Dynamiter and take no orb from the Dragon for it.
- CARD-COWBOY-DYNAMITER-12: WHEN a Dynamiter is paid as tribute, the engine SHALL emit no `laststand` event.
- CARD-COWBOY-DYNAMITER-13: WHEN a Dynamiter's attack springs a Wizard Hex, the engine SHALL cancel the attack, leaving the Dynamiter on 1 orb and its target unchanged.
- CARD-COWBOY-DYNAMITER-14: WHEN a `laststand` event names a Cowboy Dynamiter and a defeated Wizard, `presentEvent` SHALL return "Last Stand: Dynamiter took an orb off Wizard, defeating it."
- CARD-COWBOY-DYNAMITER-15: The even-match Cowboy deck `DECKS.cowboy` SHALL hold 1 Dynamiter.
- CARD-COWBOY-DYNAMITER-16: WHEN the fourth Trail duel (Imp Hollow) is won and the saved deck holds at least 1 Sheriff, `settle` SHALL add 1 Dynamiter to the collection and swap it into the deck for 1 Sheriff.
- CARD-COWBOY-DYNAMITER-17: WHEN a deck and its side deck together hold more than 3 Dynamiters, `deckProblems` SHALL return at least one problem.

## Open items (not counted)

- Open: the JSON `limit: 2` and `copies: 0` feed only the retired lane catalog (`src/game/cards.js` `cowboyCopyLimit`) and `tests/game/frontier-pack.test.js`. Showdown's copy cap comes from the rarity (Uncommon, 3). The two numbers disagree; which one the card should carry is a decision for Fable.
- Open: when the Dynamiter fights another Last Stand troop, the first Last Stand can defeat the second troop, whose own Last Stand then has no standing troop to hit (clause 09). The rulebook says "If both troops fall, it does nothing" but does not spell out this chain. A rulebook sentence for it would be a Fable decision.
- Open: no test title cites any CARD-COWBOY-DYNAMITER ID, so the trace reports every clause as an orphan.
