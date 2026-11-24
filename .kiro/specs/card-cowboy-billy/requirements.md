# Card spec: Billy (`cowboy-billy`)

Author: Kiro (native Kiro CLI, agent `native-handoff-cowboy-specs`). Every clause describes the current Showdown engine as read from the files below. No clause adds or changes a rule.

## Sources

- Card JSON: `.kiro/specs/duel-card-pipeline/cards/cowboy-billy.json`
- Card table: `src/game/showdown/cards.js` (`TYPES`, `tributes`, `DECKS`)
- Rules: `src/game/showdown/rules.js` (`legalActions`, `arrive`, `canAttack`, `targetsFor`, `attack`); text: `prototypes/showdown/RULEBOOK.md` sections 2 and 5
- Progress: `src/game/showdown/trail.js` (`STARTER`, `TRAIL`, `deckAfter`), `src/game/showdown/progress.js` (`owned`, `pool`)

## Requirements

- CARD-COWBOY-BILLY-01: The Showdown card table SHALL define `TYPES["cowboy-billy"]` as a Cowboy troop named Billy with 5 stars, 2 attack, 4 orbs, tag Outlaw, no keywords, rarity basic and `bounty: false`.
- CARD-COWBOY-BILLY-02: WHEN a Billy is in the active side's hand and that side has not summoned this turn, `legalActions` SHALL list one Billy summon per occupied own slot, each paying that one troop, and none when the side's board is empty.
- CARD-COWBOY-BILLY-03: WHEN a Billy is summoned after turn 1, `canAttack` SHALL return true for it on its arrival turn, because a tribute paid for it.
- CARD-COWBOY-BILLY-04: WHEN a Billy strikes an undefended Wizard Base at 5 orbs, the engine SHALL leave that Base on 3 orbs.
- CARD-COWBOY-BILLY-05: WHEN a Billy at 4 orbs attacks a Skeleton at 3 orbs, the engine SHALL leave the Skeleton on 1 orb and the Billy on 3 orbs.
- CARD-COWBOY-BILLY-06: WHEN a Billy at 4 orbs attacks a Jack-o'-Lantern, the engine SHALL defeat the Jack-o'-Lantern and leave the Billy on 3 orbs through Last Stand.
- CARD-COWBOY-BILLY-07: WHILE Sheriff's Office is the table's location, `attackOf` SHALL return 2 for a Billy, because its tag is Outlaw.
- CARD-COWBOY-BILLY-08: WHEN a Billy's attack springs a Wizard Hex, the engine SHALL cancel the attack, move the Hex to the Wizard discard and leave the target's orbs unchanged.
- CARD-COWBOY-BILLY-09: The even-match Cowboy deck `DECKS.cowboy` SHALL hold 2 Billys.
- CARD-COWBOY-BILLY-10: The Trail starter `STARTER` SHALL hold 5 Billys.
- CARD-COWBOY-BILLY-11: WHEN all six Trail duels are won, `deckAfter(6)` SHALL hold 2 Billys, because the Ranger, Mounted Billy and Gatling Crew rewards each replace one.
- CARD-COWBOY-BILLY-12: The progress module SHALL treat Billy as owned in any number and never put it in an offer or pack, because it is basic.

## Open items (not counted)

- Open: the JSON `copies: 3` and `order: 2` feed only the retired lane catalog and its 12-card total check in `scripts/sync-card-specs.mjs`.
- Open: no test title cites any CARD-COWBOY-BILLY ID, so the trace reports every clause as an orphan.
