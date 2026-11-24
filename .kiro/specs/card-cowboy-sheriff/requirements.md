# Card spec: Sheriff (`cowboy-sheriff`)

Author: Kiro (native Kiro CLI, agent `native-handoff-cowboy-specs`), continuing a saved assignment from a Claude worktree that held no Cowboy card specs. Every clause describes behaviour of the current Showdown engine as read from the files below. No clause adds or changes a rule.

## Sources

- Card JSON: `.kiro/specs/duel-card-pipeline/cards/cowboy-sheriff.json`
- Generated table: `src/game/card-specs.generated.js` (`SHOWDOWN_SPECS`), read by `src/game/showdown/cards.js` (`TYPES`, `tributes`, `DECKS`)
- Rules: `src/game/showdown/rules.js`; text: `prototypes/showdown/RULEBOOK.md` sections 2, 4, 5 and 8
- Progress: `src/game/showdown/trail.js` (`STARTER`, `TRAIL`, `deckAfter`), `src/game/showdown/progress.js` (`owned`, `deckProblems`, `settle`, `migrate`)
- Log text: `src/game/showdown/presenter.js`

## Requirements

- CARD-COWBOY-SHERIFF-01: The Showdown card table SHALL define `TYPES["cowboy-sheriff"]` as a Cowboy troop named Sheriff with 2 stars, 1 attack, 3 orbs, tag Lawman, no keywords, rarity basic and `bounty: false`.
- CARD-COWBOY-SHERIFF-02: WHEN a Sheriff is in the active side's hand, that side has not summoned this turn and at least one of its 3 board slots is empty, `legalActions` SHALL list exactly one summon action for it, with `tributes: []`.
- CARD-COWBOY-SHERIFF-03: WHILE all 3 of the active side's board slots are occupied, `legalActions` SHALL list no summon action for a Sheriff in hand.
- CARD-COWBOY-SHERIFF-04: WHEN a Sheriff is summoned from the hand, `canAttack` SHALL return false for it until the turn after it arrived.
- CARD-COWBOY-SHERIFF-05: WHEN a Sheriff at 3 orbs attacks a Wizard at 4 orbs, the engine SHALL leave the Wizard on 3 orbs and the Sheriff on 1 orb, with both Bases unchanged.
- CARD-COWBOY-SHERIFF-06: WHILE Sheriff's Office is the table's location, `attackOf` SHALL return 2 for a Sheriff on either side.
- CARD-COWBOY-SHERIFF-07: WHEN a Sheriff carries a Six-Shooter, `attackOf` SHALL return 2 for it.
- CARD-COWBOY-SHERIFF-08: WHEN a Sheriff is paid as tribute for a 5-star or 6-star troop, the engine SHALL move the Sheriff to its owner's discard before the new troop arrives and emit a `tribute` event naming it.
- CARD-COWBOY-SHERIFF-09: WHEN a `tribute` event names a Cowboy Sheriff, `presentEvent` SHALL return "The Cowboys' Sheriff was paid as tribute."
- CARD-COWBOY-SHERIFF-10: The even-match Cowboy deck `DECKS.cowboy` SHALL hold 4 Sheriffs, dealt as `cowboy-sheriff-1` to `cowboy-sheriff-4`.
- CARD-COWBOY-SHERIFF-11: The Trail starter `STARTER` SHALL hold 8 Sheriffs.
- CARD-COWBOY-SHERIFF-12: WHEN all six Trail duels are won, `deckAfter(6)` SHALL hold 3 Sheriffs, because the Covered Wagon (2), Outrider (2) and Dynamiter (1) rewards each replace Sheriffs.
- CARD-COWBOY-SHERIFF-13: WHEN a Trail reward replaces Sheriffs and the saved deck holds fewer Sheriffs than the reward's copies, `settle` SHALL swap only the Sheriffs the deck holds.
- CARD-COWBOY-SHERIFF-14: The progress module SHALL treat the Sheriff as owned in any number, so `owned(save, "cowboy-sheriff")` is `Infinity` and `deckProblems` applies no copy cap to it.
- CARD-COWBOY-SHERIFF-15: The offer and pack pools SHALL never include the Sheriff, because `pool()` excludes basic cards.
- CARD-COWBOY-SHERIFF-16: WHEN a save's `collection` lists `cowboy-sheriff`, `migrate` SHALL return `newSave()`, because basic cards are not earnable entries.

## Open items (not counted)

- Open: the JSON fields `copies: 6` and `order: 1` feed only the retired lane catalog (`CARD_SPECS`, `src/game/cards.js`) and the 12-card lane total that `scripts/sync-card-specs.mjs` still validates. Showdown ignores them. Whether to keep these lane fields is a pipeline decision for Fable, not a Sheriff rule.
- Open: `src/ui/sheriffs-ledger.data.js` records a rejected Night Shift review of Sheriff health 3 to 4 (faction skew did not improve). No current tuning is proposed here.
- Open: no test title cites any CARD-COWBOY-SHERIFF ID, so `node scripts/trace.mjs` reports every clause above as an orphan. See tasks.md for the existing assertions that check the same behaviour without the ID.
