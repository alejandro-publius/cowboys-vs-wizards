# CARD-WIZARD-DRAGON requirements

`wizard-dragon` is one card with two entrances. In a Wizard deck it is the Dragon, a two-tribute Beast with Sweep. On the Wanted board the same card is the boss of the Graveyard Dragon bounty: it lands by itself, rests, and carries the hunt's orbs. Graveyard Dragon damage is Sweep damage from attacks. It is not a spell, so it differs from Hellfire (`card-wizard-hellfire`) and Singularity (`card-wizard-singularity`).

## Sources

- Card spec: `.kiro/specs/duel-card-pipeline/cards/wizard-dragon.json`
- Generator: `scripts/sync-card-specs.mjs`; output `src/game/card-specs.generated.js`
- Tables: `src/game/showdown/cards.js` (`KEYWORDS.sweep`, `tributes`, `DECKS`)
- Engine: `src/game/showdown/rules.js` (`legalActions`, `attack` lines 189–230, `attackOutcome`, `createShowdown` `arrivals`, `applyAction` end-of-turn branch)
- Bounty: `src/game/showdown/progress.js` (`BOUNTIES[1]`, `duelFor`, `settle`)
- Rulebook: `prototypes/showdown/RULEBOOK.md` sections 9 (Sweep), 10 ("Sweep", "Last Stand"), 12 (Bounties)
- Log text: `src/game/showdown/presenter.js` (`attack`, `sweep`, `summon`)
- Replay beats: `src/ui/showdown-3d/event-positions.js` (`attackKind`, `sweep` case)
- Existing tests: `prototypes/showdown/rules.test.js` ("Sweep: every other enemy troop loses an orb ..."; "cover: ..."); `prototypes/showdown/progress.test.js` (the Dragon landing block and "the boss is not also in its escort deck"); `tests/match/showdown-3d-presentation.test.js` ("Ranger, Dragon counter, and a cancelled Dragon attack ..."; "covered Last Stand, Ride, and lethal Sweep ...")

## Card data

- **CARD-WIZARD-DRAGON-01.** THE catalog SHALL define `wizard-dragon` as a Wizard troop named "Dragon" with 8 stars, 3 attack, 5 orbs, rarity `legendary`, type tag `Beast` and the single keyword `sweep`.
- **CARD-WIZARD-DRAGON-02.** THE sync script SHALL keep the spec's `copies: 1` in the lane catalog and omit it from the Showdown record.
- **CARD-WIZARD-DRAGON-03.** THE Wizard opponent decks SHALL hold 1 Dragon in the even match, Dragon's Roost and The Graveyard Coven, and no Dragon in any other Trail, rival or bounty deck.

## Summoning from the hand

- **CARD-WIZARD-DRAGON-04.** WHEN the Wizards summon a Dragon from the hand, THE engine SHALL require exactly 2 tributes, because 8 stars is in the band of 7 and up.
- **CARD-WIZARD-DRAGON-05.** WHILE the Wizards have fewer than 2 troops on the board, THE engine SHALL offer no summon action for a Dragon.
- **CARD-WIZARD-DRAGON-06.** WHILE the Wizards have 3 troops on the board, THE engine SHALL offer one Dragon summon action for each of the 3 pairs of tribute slots.
- **CARD-WIZARD-DRAGON-07.** WHEN a Dragon arrives from the hand on turn 2 or later, THE engine SHALL let it attack that turn, because it was paid for with tributes.

## Sweep

- **CARD-WIZARD-DRAGON-08.** WHEN a Dragon's attack on an enemy troop lands, THE engine SHALL remove 1 orb from every other enemy troop after the fight's damage, hit-back, Last Stand and the target's defeat are settled.
- **CARD-WIZARD-DRAGON-09.** WHEN Sweep takes a troop's last orb, THE engine SHALL move that troop and its gear to its owner's graveyard.
- **CARD-WIZARD-DRAGON-10.** WHEN Sweep removes orbs, THE engine SHALL send no damage to either Base.
- **CARD-WIZARD-DRAGON-11.** WHEN a Dragon attacks a Base, THE engine SHALL apply no Sweep.
- **CARD-WIZARD-DRAGON-12.** WHEN a Dragon's attack lands, THE engine SHALL take the Sweep orb from other enemy troops that are in cover or Ghostly as well.
- **CARD-WIZARD-DRAGON-13.** WHEN Sweep defeats a troop with Last Stand, THE engine SHALL not fire that Last Stand.
- **CARD-WIZARD-DRAGON-14.** WHEN the target's hit-back defeats the Dragon, THE engine SHALL still apply Sweep before the Dragon goes to the graveyard.
- **CARD-WIZARD-DRAGON-15.** WHEN a Cowboy Bear Trap defeats the Dragon before it strikes, THE engine SHALL apply no damage to the target and no Sweep.
- **CARD-WIZARD-DRAGON-16.** WHEN a Bear Trap leaves the Dragon with at least 1 orb, THE engine SHALL let the attack land with its Sweep.
- **CARD-WIZARD-DRAGON-17.** WHEN Sweep removes an orb from at least one troop, THE engine SHALL emit one `sweep` event carrying the number of troops hit.
- **CARD-WIZARD-DRAGON-18.** WHEN the log presents a Dragon `sweep` event, THE log SHALL read "Sweep: Dragon also hit 1 other troop for 1." for one troop, or "Sweep: Dragon also hit <n> other troops for 1." for more.
- **CARD-WIZARD-DRAGON-19.** WHEN the screen or the bot reads `attackOutcome` for a Dragon attack, THE engine SHALL report the fight only, without Sweep.

## Replay beats

- **CARD-WIZARD-DRAGON-20.** WHEN the illustrated replay builds a Dragon attack or a Dragon hit-back, THE replay SHALL use the `breath` beat kind.
- **CARD-WIZARD-DRAGON-21.** WHEN the replay builds a `sweep` event, THE replay SHALL target every other occupied enemy slot in one `sweep` beat and show each at the engine's after-state orbs.

## The Graveyard Dragon bounty

- **CARD-WIZARD-DRAGON-22.** THE `graveyard-dragon` bounty SHALL use `wizard-dragon` as its boss, with entrance `lands`, landing turn 4, Cowboys first and a Wizard Base of 4 orbs.
- **CARD-WIZARD-DRAGON-23.** THE bounty SHALL give the boss 2, 3, 3, 4 and 4 orbs on hunts 1 to 5, with Wizard levels 1, 1, 1.5, 1.5 and 2.
- **CARD-WIZARD-DRAGON-24.** THE bounty's escort deck SHALL be 9 Skeleton, 2 Raven Familiar, 2 Jack-o'-Lantern, 2 Wizard and 1 Singularity, with no Dragon and no Guard troop.
- **CARD-WIZARD-DRAGON-25.** WHILE the turn is before 4, THE engine SHALL keep the boss off the board.
- **CARD-WIZARD-DRAGON-26.** WHEN a Wizard turn numbered 4 or later begins with the boss pending and a Wizard slot free, THE engine SHALL place `wizard-dragon-0` in the first empty slot with the hunt's orbs and emit a `summon` event before the Wizards' draw.
- **CARD-WIZARD-DRAGON-27.** WHEN the boss lands, THE engine SHALL leave it unable to attack that turn.
- **CARD-WIZARD-DRAGON-28.** WHEN the boss lands, THE engine SHALL leave the Wizards' summon, other-card and trap plays for that turn unused and take no card from their hand or deck.
- **CARD-WIZARD-DRAGON-29.** WHILE every Wizard slot is occupied at the start of a Wizard turn, THE engine SHALL keep the boss pending and try again at the start of each later Wizard turn.
- **CARD-WIZARD-DRAGON-30.** WHILE the landed boss is on the board, THE engine SHALL treat it as an ordinary Wizard troop with Sweep for attacks, cover and tributes.
- **CARD-WIZARD-DRAGON-31.** WHEN the log names the landed boss, THE log SHALL use its card name "Dragon" ("The Graveyard Dragon" is the bounty's name in the Camp duel list and the duel title "The Graveyard Dragon, hunt <n> of 5").
- **CARD-WIZARD-DRAGON-32.** WHEN the Cowboys win a Graveyard Dragon hunt, THE progress module SHALL add 1 to that bounty's cleared count.
- **CARD-WIZARD-DRAGON-33.** WHEN that win is the fifth, THE progress module SHALL add one `cowboy-captured-dragon` to the collection.
- **CARD-WIZARD-DRAGON-34.** WHEN `duelFor` builds a Graveyard Dragon hunt, THE duel description SHALL carry the lesson "Wanted: the Graveyard Dragon. It lands on the Wizards' second turn. Get troops out before it does: its fire sweeps your whole line."

## Not numbered

- A hunt is won by emptying the Wizard Base. Defeating the boss is not a win condition.
- Captured Dragon (`cowboy-captured-dragon`, 5 stars, 4 attack, 2 orbs, Sweep) is the Cowboy reward. It is a separate card and outside this Wizard spec.
- Lane-era "Dragon Fire" overflow rules in `docs/cards.csv` and `docs/design/depth-arc-kiro-brief.md` belong to the retired lane duel and are not Showdown rules.
- The Singularity gallery's "Against Skeleton and Dragon" replay calls the Dragon "the Graveyard Dragon" in its summary. That replay is covered in `card-wizard-singularity`.
