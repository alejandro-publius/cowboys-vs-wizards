# Card spec: Lasso (`cowboy-lasso`)

Author: Kiro (native Kiro CLI, agent `native-handoff-cowboy-specs`). Every clause describes the current Showdown engine as read from the files below. No clause adds or changes a rule.

## Sources

- Card JSON: `.kiro/specs/duel-card-pipeline/cards/cowboy-lasso.json`
- Card table and effect text: `src/game/showdown/cards.js` (`TYPES`, `EFFECTS.tie`, `DECKS`, `RARITY`)
- Rules: `src/game/showdown/rules.js` (`legalActions` spell branch, `applyAction` spell and end branches, `canAttack`, `attackOutcome`, `targetsFor`); text: `prototypes/showdown/RULEBOOK.md` sections 4 (step 5), 9 ("Stunned") and 10 ("Stun", "Ghostly")
- Progress: `src/game/showdown/trail.js` (`TRAIL[2]`, The Bone Fence), `src/game/showdown/progress.js` (`deckProblems`)
- Log text: `src/game/showdown/presenter.js` (`PRESENTERS.spell`)

## Requirements

- CARD-COWBOY-LASSO-01: The Showdown card table SHALL define `TYPES["cowboy-lasso"]` as a Cowboy spell named Lasso with effect `tie`, rarity uncommon, no keywords, `bounty: false` and no stars, attack or orbs.
- CARD-COWBOY-LASSO-02: WHEN a Lasso is in the active side's hand, no other spell, gear or location has been played this turn and no troop has acted, `legalActions` SHALL list one Lasso action per enemy troop that is neither Ghostly nor stunned.
- CARD-COWBOY-LASSO-03: WHILE the enemy board is empty, `legalActions` SHALL list no Lasso action.
- CARD-COWBOY-LASSO-04: WHEN a Lasso is cast at an enemy troop, the engine SHALL set that troop's `stunned` flag and leave its orbs unchanged.
- CARD-COWBOY-LASSO-05: WHEN a Lasso is cast, the engine SHALL move it from the caster's hand to the caster's discard.
- CARD-COWBOY-LASSO-06: WHEN the turn of a Lassoed troop's owner begins, `canAttack` SHALL return false for that troop for the whole of that turn.
- CARD-COWBOY-LASSO-07: WHEN the owner of a Lassoed troop ends its turn, the engine SHALL clear the stun, so the troop may attack on its owner's following turn.
- CARD-COWBOY-LASSO-08: WHILE a troop is stunned and has not acted, `legalActions` SHALL still list a cover action for it.
- CARD-COWBOY-LASSO-09: WHEN a stunned troop survives an attack outside cover, the engine SHALL apply its hit back as usual.
- CARD-COWBOY-LASSO-10: WHILE a stunned Bone Wall stands with other Wizard troops, `legalActions` SHALL still offer the Cowboy attackers only the Bone Wall's slot.
- CARD-COWBOY-LASSO-11: WHEN a Lasso has been cast this turn, `legalActions` SHALL list no further spell, gear or location action that turn.
- CARD-COWBOY-LASSO-12: WHEN a Lasso is cast before the side has summoned, `legalActions` SHALL still list that side's troop summons.
- CARD-COWBOY-LASSO-13: WHEN a Lasso is cast, the engine SHALL emit one `spell` event with `stunned: true` and `left` equal to the target's unchanged orbs.
- CARD-COWBOY-LASSO-14: WHEN that `spell` event names a Cowboy Lasso and a Wizard target, `presentEvent` SHALL return "The Cowboys' Lasso hit Wizard: stunned for its next turn."
- CARD-COWBOY-LASSO-15: The even-match Cowboy deck `DECKS.cowboy` SHALL hold 1 Lasso.
- CARD-COWBOY-LASSO-16: WHEN the third Trail duel (The Bone Fence) is won and the saved deck holds at least 1 Deadeye, `settle` SHALL add 1 Lasso to the collection and swap it into the deck for 1 Deadeye.
- CARD-COWBOY-LASSO-17: WHEN a deck and its side deck together hold more than 3 Lassos, `deckProblems` SHALL return at least one problem.

## Open items (not counted)

- Open: the JSON `relocates: true` and `limit: 2` belong to the retired lane duel, where a relocating spell could move the surviving troop (`src/game/legal.js`, `src/game/actions.js`). Showdown's Lasso never moves a troop and its cap is the Uncommon limit of 3. Whether to drop or align these lane fields is a pipeline decision for Fable.
- Open: the Wizards have no stun card, so a stunned Cowboy troop cannot occur in current play. The stun rules above are stated for Wizard targets only.
- Open: no test title cites any CARD-COWBOY-LASSO ID, so the trace reports every clause as an orphan.
