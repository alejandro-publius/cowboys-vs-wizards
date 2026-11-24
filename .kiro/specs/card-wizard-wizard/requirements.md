# CARD-WIZARD-WIZARD requirements

The Wizard is a one-tribute Mage troop with Raise. These requirements describe the card as Showdown plays it today.

## Sources

- Card spec: `.kiro/specs/duel-card-pipeline/cards/wizard-wizard.json`
- Generator: `scripts/sync-card-specs.mjs` (`validateSpec`, `showdownRecord`); output `src/game/card-specs.generated.js`
- Tables: `src/game/showdown/cards.js` (`KEYWORDS.raise`, `tributes`, `DECKS`)
- Engine: `src/game/showdown/rules.js` (`legalActions`, `applyAction` summon branch, `arrive`, `defeat`, `canAttack`, `attackOutcome`)
- Opponent decks: `src/game/showdown/trail.js`, `src/game/showdown/progress.js`
- Rulebook: `prototypes/showdown/RULEBOOK.md` section 2 (Stars), 9 (Raise), 10 ("Raise and tributes")
- Log text: `src/game/showdown/presenter.js` (`tribute`, `summon`, `raise`)
- Replay beats: `src/ui/showdown-3d/event-positions.js` (`summon`/`raise` case)
- Existing tests: `prototypes/showdown/rules.test.js` ("Raise returns the last Undead troop ...", "a target that survives hits back, ...", "free troops rest on arrival, tribute troops strike at once, ...")

## Card data

- **CARD-WIZARD-WIZARD-01.** THE catalog SHALL define `wizard-wizard` as a Wizard troop named "Wizard" with 5 stars, 2 attack, 4 orbs, rarity `uncommon`, type tag `Mage` and the single keyword `raise`.
- **CARD-WIZARD-WIZARD-02.** THE sync script SHALL keep the spec's `copies: 3` in the lane catalog `CARD_SPECS` and omit it from the Showdown record, so Showdown deck counts come only from the deck tables.
- **CARD-WIZARD-WIZARD-03.** THE Wizard opponent decks SHALL hold the Wizard in these counts: even match 2, The Bone Fence 3, The Hexed Mile 3, Dragon's Roost 2, The Stargazer 3, The Bonewright 3, The Graveyard Coven 2, Graveyard Dragon escort 2, and no other Trail, rival or bounty deck.

## Summoning

- **CARD-WIZARD-WIZARD-04.** WHEN the Wizards summon a Wizard, THE engine SHALL require exactly 1 tribute, because 5 stars is in the one-tribute band of 5 and 6.
- **CARD-WIZARD-WIZARD-05.** WHILE the Wizards have no troop on the board, THE engine SHALL offer no summon action for a Wizard.
- **CARD-WIZARD-WIZARD-06.** WHILE the Wizards have 3 troops on the board, THE engine SHALL offer one Wizard summon action for each of the 3 slots as the tribute.
- **CARD-WIZARD-WIZARD-07.** WHEN a Wizard is summoned, THE engine SHALL move the tributed troop and its gear to the Wizard graveyard before the Wizard arrives.
- **CARD-WIZARD-WIZARD-08.** WHEN a Wizard arrives after its tribute, THE engine SHALL place it in the first empty Wizard slot with 4 orbs.
- **CARD-WIZARD-WIZARD-09.** WHEN a Wizard arrives on turn 2 or later, THE engine SHALL let it attack that turn, because it was paid for with a tribute.

## Raise

- **CARD-WIZARD-WIZARD-10.** WHEN a Wizard arrives, THE engine SHALL select the most recently added troop with type tag `Undead` in the Wizard graveyard.
- **CARD-WIZARD-WIZARD-11.** WHEN the selected Undead troop exists and a Wizard slot is free after the Wizard arrives, THE engine SHALL move it from the graveyard to the first empty Wizard slot with 1 orb and no gear.
- **CARD-WIZARD-WIZARD-12.** WHEN the tribute paid for the Wizard is an Undead troop, THE engine SHALL return that same troop, because the tribute reaches the graveyard first.
- **CARD-WIZARD-WIZARD-13.** WHEN a troop returns through Raise, THE engine SHALL leave it unable to attack on that turn, whatever it cost, because no Undead troop has Quickdraw.
- **CARD-WIZARD-WIZARD-14.** WHILE no Wizard slot is free after the Wizard arrives, THE engine SHALL leave the Wizard graveyard unchanged and emit no `raise` event.
- **CARD-WIZARD-WIZARD-15.** WHILE the Wizard graveyard holds no Undead troop, THE engine SHALL return nothing and emit no `raise` event.
- **CARD-WIZARD-WIZARD-16.** WHEN Raise searches the graveyard, THE engine SHALL skip every spell, trap, gear and location card and every troop whose tag is not `Undead`, including Imp, Jack-o'-Lantern, Raven Familiar, Dragon and Wizard.
- **CARD-WIZARD-WIZARD-17.** WHEN Raise returns a troop that died carrying gear, THE engine SHALL leave that gear in the Wizard graveyard.
- **CARD-WIZARD-WIZARD-18.** WHEN Raise searches, THE engine SHALL read only the Wizard side's own graveyard, so an Undead Cowboy troop such as the Captured Wraith never returns for the Wizards.

## Fighting

- **CARD-WIZARD-WIZARD-19.** WHEN a Cowboy Sheriff with 1 attack attacks a full Wizard out of cover, THE engine SHALL leave the Wizard on 3 orbs and hit the Sheriff back for 2.

## Visible results

- **CARD-WIZARD-WIZARD-20.** WHEN a Wizard summon resolves, THE engine SHALL emit events in the order `tribute`, `summon`, then `raise` when Raise returns a troop.
- **CARD-WIZARD-WIZARD-21.** WHEN Raise returns a troop, THE log SHALL read "Raise: The Wizards' <name> returned from the graveyard with 1 orb."
- **CARD-WIZARD-WIZARD-22.** WHEN the illustrated replay builds beats for a `raise` event, THE replay SHALL move the card from the Wizard graveyard to its board slot and show it with 1 orb.

## Not numbered

- The Wizard is not a Wanted boss and never lands through `arrivals`.
- The Singularity replay uses a Wizard troop as its caster. That is specified in `card-wizard-singularity`.
