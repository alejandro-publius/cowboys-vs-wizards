# Card spec: Captured Dragon (`cowboy-captured-dragon`)

Author: Kiro (native Kiro CLI, agent `native-handoff-cowboy-specs`). Every clause describes the current Showdown engine as read from the files below. No clause adds or changes a rule.

## Sources

- Card JSON: `.kiro/specs/duel-card-pipeline/cards/cowboy-captured-dragon.json`
- Card table: `src/game/showdown/cards.js` (`TYPES`, `KEYWORDS.sweep`, `tributes`, `RARITY`, `DECKS`)
- Rules: `src/game/showdown/rules.js` (`legalActions`, `arrive`, `attack` Sweep block); text: `prototypes/showdown/RULEBOOK.md` sections 9, 10 ("Sweep") and 12 ("Bounties")
- Progress: `src/game/showdown/progress.js` (`BOUNTIES[1]` graveyard-dragon, `HUNTS`, `settle`, `pool`, `deckProblems`, `migrate`)

## Requirements

- CARD-COWBOY-CAPTURED-DRAGON-01: The Showdown card table SHALL define `TYPES["cowboy-captured-dragon"]` as a Cowboy troop named Captured Dragon with 5 stars, 4 attack, 2 orbs, tag Beast, keywords `["sweep"]`, rarity legendary and `bounty: true`.
- CARD-COWBOY-CAPTURED-DRAGON-02: WHEN a Captured Dragon is in the active side's hand and that side has not summoned this turn, `legalActions` SHALL list one summon per occupied own slot, each paying that one troop.
- CARD-COWBOY-CAPTURED-DRAGON-03: WHEN a Captured Dragon is summoned after turn 1, `canAttack` SHALL return true for it on its arrival turn.
- CARD-COWBOY-CAPTURED-DRAGON-04: WHEN a Captured Dragon attacks a Wizard at 4 orbs beside a Skeleton at 3 orbs, the engine SHALL defeat the Wizard, leave the Skeleton on 2 orbs and leave the Wizard Base unchanged.
- CARD-COWBOY-CAPTURED-DRAGON-05: WHEN a Captured Dragon at 2 orbs attacks a Wizard Dragon at 5 orbs beside a Skeleton, the engine SHALL apply its Sweep to the Skeleton even though the Dragon's hit back defeats the Captured Dragon.
- CARD-COWBOY-CAPTURED-DRAGON-06: WHEN the fifth hunt of the Graveyard Dragon bounty is won, `settle` SHALL report `captured: "cowboy-captured-dragon"` and add 1 copy to the collection.
- CARD-COWBOY-CAPTURED-DRAGON-07: WHEN a deck and its side deck together hold 2 Captured Dragons, `deckProblems` SHALL return at least one problem.
- CARD-COWBOY-CAPTURED-DRAGON-08: The offer and pack pools SHALL never include the Captured Dragon, because `pool()` excludes legendary cards.
- CARD-COWBOY-CAPTURED-DRAGON-09: WHEN a save's collection lists a Captured Dragon while the Graveyard Dragon bounty has fewer than 5 cleared hunts, `migrate` SHALL return `newSave()`.
- CARD-COWBOY-CAPTURED-DRAGON-10: The even-match Cowboy deck `DECKS.cowboy` SHALL hold no Captured Dragon.

## Open items (not counted)

- Open: the bounty fields (`bounty: true`, `copies: 0`, no `limit`) are validated by `scripts/sync-card-specs.mjs` ("a bounty card must be a troop with zero starter copies"). The retired lane gave a bounty card a fixed limit of 1, which matches the Legendary cap.
- Open: no test title cites any CARD-COWBOY-CAPTURED-DRAGON ID, so the trace reports every clause as an orphan.
