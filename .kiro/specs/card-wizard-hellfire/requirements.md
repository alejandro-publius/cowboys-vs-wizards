# CARD-WIZARD-HELLFIRE requirements

Hellfire is a Wizard spell that chooses no target and removes 1 orb from every Cowboy troop. Because it chooses no target, Ghostly does not stop it. It is a spell, not an attack, so it differs from the Graveyard Dragon's Sweep (`card-wizard-dragon`) and from the single-target Singularity (`card-wizard-singularity`).

## Sources

- Card spec: `.kiro/specs/duel-card-pipeline/cards/wizard-hellfire.json`
- Generated catalog: `src/game/card-specs.generated.js`
- Tables: `src/game/showdown/cards.js` (`EFFECTS.hellfire`, `DECKS`)
- Engine: `src/game/showdown/rules.js` (`legalActions` spell branch, `applyAction` spell branch, `defeat`)
- Opponent decks: `src/game/showdown/trail.js`, `src/game/showdown/progress.js`
- Rulebook: `prototypes/showdown/RULEBOOK.md` sections 4.3, 10 ("Ghostly", "Last Stand")
- Log text: `src/game/showdown/presenter.js` (`spell`)
- Replay beats: `src/ui/showdown-3d/event-positions.js` (`spell` case); gallery `src/ui/showdown-3d/attack-preview.js` (`hellfireExample`)
- Existing tests: `prototypes/showdown/rules.test.js` ("Ghostly troops cannot be targeted by spells, but Hellfire still burns them"); `tests/match/showdown-3d-presentation.test.js` ("the Hellfire gallery casts one real spell and strikes all three troops together"; "Hex stops an attack, Lasso shows a stun, and Hellfire groups public targets")

## Card data

- **CARD-WIZARD-HELLFIRE-01.** THE catalog SHALL define `wizard-hellfire` as a Showdown-only Wizard spell named "Hellfire" with rarity `uncommon` and effect `hellfire`, whose effect has no target.
- **CARD-WIZARD-HELLFIRE-02.** THE Wizard opponent decks SHALL hold Hellfire in these counts: even match 1, Imp Hollow 2, Dragon's Roost 1, The Stargazer 2, The Graveyard Coven 1, and none in any other Trail, rival or bounty deck.

## Casting

- **CARD-WIZARD-HELLFIRE-03.** WHILE the Wizards hold a Hellfire, have not used the turn's other-card play, no Wizard troop has acted this turn, and at least one Cowboy troop is on the board, THE engine SHALL offer exactly one Hellfire action, with no target.
- **CARD-WIZARD-HELLFIRE-04.** WHILE the Cowboy board is empty, THE engine SHALL offer no Hellfire action.
- **CARD-WIZARD-HELLFIRE-05.** WHEN a Hellfire resolves, THE engine SHALL mark the turn's other-card play as used, so no Singularity, other spell, gear or location can follow that turn.

## Resolution

- **CARD-WIZARD-HELLFIRE-06.** WHEN a Hellfire resolves, THE engine SHALL move the Hellfire from the Wizard hand to the Wizard graveyard before any orb is removed.
- **CARD-WIZARD-HELLFIRE-07.** WHEN a Hellfire resolves, THE engine SHALL remove exactly 1 orb from every troop on the Cowboy board, in slot order.
- **CARD-WIZARD-HELLFIRE-08.** WHEN a Hellfire resolves, THE engine SHALL include Ghostly Cowboy troops, because Hellfire chooses no target.
- **CARD-WIZARD-HELLFIRE-09.** WHEN a Hellfire resolves, THE engine SHALL include Cowboy troops that have Guard or are in cover.
- **CARD-WIZARD-HELLFIRE-10.** WHEN Hellfire takes a troop's last orb, THE engine SHALL move that troop and its gear to the Cowboy graveyard.
- **CARD-WIZARD-HELLFIRE-11.** WHEN a Hellfire resolves, THE engine SHALL change no Wizard troop and neither Base.
- **CARD-WIZARD-HELLFIRE-12.** WHEN a Hellfire resolves, THE engine SHALL spring no Cowboy trap.
- **CARD-WIZARD-HELLFIRE-13.** WHEN Hellfire defeats a troop with Last Stand, THE engine SHALL not fire that Last Stand.

## Visible results

- **CARD-WIZARD-HELLFIRE-14.** WHEN a Hellfire resolves, THE engine SHALL emit one `spell` event per Cowboy troop hit, each carrying that troop's id and its orbs left.
- **CARD-WIZARD-HELLFIRE-15.** WHEN the log presents each Hellfire `spell` event, THE log SHALL read "The Wizards' Hellfire hit <name>: <n> orb(s) left." with "orb" for 1 and "orbs" otherwise, or "The Wizards' Hellfire hit <name>: defeated." at 0.
- **CARD-WIZARD-HELLFIRE-16.** WHEN the illustrated replay builds a Hellfire cast, THE replay SHALL group all its `spell` events into one `hellfire` beat that targets every hit slot, after one `play` beat and before the `burial` beats.
- **CARD-WIZARD-HELLFIRE-17.** WHEN the Card gallery lists previews for Hellfire, THE gallery SHALL offer one preview, "Watch Hellfire".
- **CARD-WIZARD-HELLFIRE-18.** WHEN the "Watch Hellfire" preview runs, THE gallery SHALL apply a legal Hellfire action against a Sheriff, a Mounted Billy and a Gatling Crew and end with each of them 1 orb lower.

## Not numbered

- `src/ui/showdown-3d/hellfire-columns.js` draws the existing Hellfire effect used by `combat-effects.js`. This spec adds no effect.
- The gallery's area Singularity replays reuse a Hellfire action. That reuse is specified in `card-wizard-singularity` 19 to 22.
