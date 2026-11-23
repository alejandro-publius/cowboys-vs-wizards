# CARD-WIZARD-HEADLESS-HORSEMAN requirements

The Headless Horseman is a one-tribute Undead rider: 2 attack, 3 orbs, and Ride, which lets it strike the Cowboy Base for 1 past standing Cowboy troops unless one of them has Guard.

## Sources

- Card spec: `.kiro/specs/duel-card-pipeline/cards/wizard-headless-horseman.json`
- Generated catalog: `src/game/card-specs.generated.js`
- Tables: `src/game/showdown/cards.js` (`KEYWORDS.ride`, `tributes`, `DECKS`)
- Engine: `src/game/showdown/rules.js` (`targetsFor`, `attackOutcome`, `attack`)
- Opponent decks: `src/game/showdown/trail.js` (The Hexed Mile), `src/game/showdown/progress.js`
- Rulebook: `prototypes/showdown/RULEBOOK.md` sections 9 (Ride), 10 ("Ride and Guard", "Ride and traps", "Raise and tributes")
- Log text: `src/game/showdown/presenter.js` (`attackText`, Base branch)
- Replay beats: `src/ui/showdown-3d/event-positions.js` (`attackKind` `ride`); gallery `src/ui/showdown-3d/attack-preview.js`
- Existing tests: `prototypes/showdown/rules.test.js` ("Ride: a rider may pass standing troops ...", "Guard: ... a rider cannot pass it", both with Cowboy riders; "Raise returns ..." with a raised Headless Horseman); `tests/match/showdown-3d-presentation.test.js` (Ride preview and "covered Last Stand, Ride, ...")

## Card data

- **CARD-WIZARD-HEADLESS-HORSEMAN-01.** THE catalog SHALL define `wizard-headless-horseman` as a Showdown-only Wizard troop named "Headless Horseman" with 5 stars, 2 attack, 3 orbs, rarity `rare`, type tag `Undead` and the single keyword `ride`.
- **CARD-WIZARD-HEADLESS-HORSEMAN-02.** THE Wizard opponent decks SHALL hold Headless Horsemen in these counts: even match 1, The Hexed Mile 2, Dragon's Roost 1, The Imp 2, The Bonewright 2, The Graveyard Coven 1, and none in any other deck.

## Summoning

- **CARD-WIZARD-HEADLESS-HORSEMAN-03.** WHEN the Wizards summon a Headless Horseman, THE engine SHALL require exactly 1 tribute.
- **CARD-WIZARD-HEADLESS-HORSEMAN-04.** WHEN a Headless Horseman arrives from the hand on turn 2 or later, THE engine SHALL let it attack that turn.
- **CARD-WIZARD-HEADLESS-HORSEMAN-05.** WHEN a Headless Horseman returns through Raise, THE engine SHALL leave it unable to attack that turn, with 1 orb.

## Ride

- **CARD-WIZARD-HEADLESS-HORSEMAN-06.** WHILE the Cowboys have at least one troop and none of them has Guard, THE engine SHALL offer the Headless Horseman the Cowboy Base as a target in addition to every Cowboy troop.
- **CARD-WIZARD-HEADLESS-HORSEMAN-07.** WHILE a Cowboy troop with Guard (Covered Wagon) is on the board, THE engine SHALL offer the Headless Horseman only the Guard troops as targets.
- **CARD-WIZARD-HEADLESS-HORSEMAN-08.** WHEN the Headless Horseman rides past standing Cowboy troops to the Base, THE engine SHALL remove exactly 1 orb from the Cowboy Base, whatever its attack.
- **CARD-WIZARD-HEADLESS-HORSEMAN-09.** WHEN the Headless Horseman rides past, THE engine SHALL change no Cowboy troop and take no hit-back.
- **CARD-WIZARD-HEADLESS-HORSEMAN-10.** WHILE the Cowboy board is empty, THE engine SHALL let the Headless Horseman strike the Base for its full current attack.
- **CARD-WIZARD-HEADLESS-HORSEMAN-11.** WHEN the Headless Horseman rides past while the Cowboys have a trap set, THE engine SHALL spring the oldest Cowboy trap first.

## Visible results

- **CARD-WIZARD-HEADLESS-HORSEMAN-12.** WHEN the Headless Horseman rides past, THE log SHALL read "The Wizards' Headless Horseman struck the Cowboys' Base for 1."
- **CARD-WIZARD-HEADLESS-HORSEMAN-13.** WHEN the illustrated replay builds a Base attack by the Headless Horseman while Cowboy troops stand, THE replay SHALL use the `ride` beat kind.
- **CARD-WIZARD-HEADLESS-HORSEMAN-14.** WHEN the Card gallery lists previews for Headless Horseman, THE gallery SHALL offer "Watch attack" and "Watch Ride".

## Not numbered

- With the Boneyard in play the Horseman has 3 attack. A ride-past still removes 1 orb (requirement 08); the extra attack matters only in fights and on an empty board.
