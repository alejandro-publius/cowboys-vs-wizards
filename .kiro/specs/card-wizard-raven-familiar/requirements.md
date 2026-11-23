# CARD-WIZARD-RAVEN-FAMILIAR requirements

The Raven Familiar is a free 1/1 Beast with Scout: when it arrives, the Wizards draw a card.

## Sources

- Card spec: `.kiro/specs/duel-card-pipeline/cards/wizard-raven-familiar.json`
- Generated catalog: `src/game/card-specs.generated.js`
- Tables: `src/game/showdown/cards.js` (`KEYWORDS.scout`, `DECKS`)
- Engine: `src/game/showdown/rules.js` (`applyAction` summon branch, `draw`, `HAND_CAP`, `hideDraw`, `planTurn`, `playTurn`)
- Opponent decks: `src/game/showdown/trail.js` (Raven Roost), `src/game/showdown/progress.js`
- Rulebook: `prototypes/showdown/RULEBOOK.md` sections 9 (Scout), 10 ("Scout")
- Log text: `src/game/showdown/presenter.js` (`draw`, `burn`)
- Existing tests: `prototypes/showdown/rules.test.js` ("Scout draws a card on arrival", using the Cowboy Ranger, which shares Scout)

## Card data

- **CARD-WIZARD-RAVEN-FAMILIAR-01.** THE catalog SHALL define `wizard-raven-familiar` as a Showdown-only Wizard troop named "Raven Familiar" with 2 stars, 1 attack, 1 orb, rarity `common`, type tag `Beast` and the single keyword `scout`.
- **CARD-WIZARD-RAVEN-FAMILIAR-02.** THE Wizard opponent decks SHALL hold Raven Familiars in these counts: even match 1, Raven Roost 4, Dragon's Roost 1, The Stargazer 2, The Graveyard Coven 1, Lantern Wraith escort 2, Graveyard Dragon escort 2, and none in any other deck.

## Scout

- **CARD-WIZARD-RAVEN-FAMILIAR-03.** WHEN the Wizards summon a Raven Familiar, THE engine SHALL require no tribute and leave it unable to attack that turn.
- **CARD-WIZARD-RAVEN-FAMILIAR-04.** WHEN a Raven Familiar arrives with cards left in the Wizard deck and fewer than 6 cards in the Wizard hand, THE engine SHALL move the top card of the Wizard deck into the Wizard hand and emit a `draw` event after the `summon` event.
- **CARD-WIZARD-RAVEN-FAMILIAR-05.** WHEN a Raven Familiar arrives with the Wizard deck empty, THE engine SHALL draw nothing and leave the Wizard Base unchanged.
- **CARD-WIZARD-RAVEN-FAMILIAR-06.** WHEN the Scout draw happens while the Wizard hand, after the Raven Familiar has left it, still holds 6 cards, THE engine SHALL put the drawn card in the Wizard graveyard and emit a `burn` event.
- **CARD-WIZARD-RAVEN-FAMILIAR-07.** WHEN the Scout draw happens, THE engine SHALL leave the turn's other-card and trap plays available, so the drawn card can be played the same turn if its kind's play is unused.
- **CARD-WIZARD-RAVEN-FAMILIAR-08.** WHEN the level-2 bot's plan summons a Raven Familiar that draws, THE bot SHALL end that plan at the summon and plan the rest of the turn again with the drawn card in hand.

## Visible results

- **CARD-WIZARD-RAVEN-FAMILIAR-09.** WHEN the Scout draw resolves, THE log SHALL read "The Wizards drew a card." without naming the card.
- **CARD-WIZARD-RAVEN-FAMILIAR-10.** WHEN the Card gallery lists previews for Raven Familiar, THE gallery SHALL offer one preview, "Watch attack", which applies a real Raven Familiar attack on a Cowboy Sheriff.

## Not numbered

- Requirement 06 is the code path the rulebook describes. From a normal deal it cannot be reached: the hand never exceeds 6 (`draw` burns at 6), and playing the Raven from the hand leaves at most 5 before the Scout draw. A test must build that state directly.
- Raise never returns a Raven Familiar: it is a Beast. Scout fires only on a summon from the hand.
