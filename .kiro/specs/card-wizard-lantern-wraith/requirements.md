# CARD-WIZARD-LANTERN-WRAITH requirements

The Lantern Wraith is a Ghostly Undead troop that appears only as the boss of the Lantern Wraith bounty. It stands on the Wizard board from the start of each hunt.

## Sources

- Card spec: `.kiro/specs/duel-card-pipeline/cards/wizard-lantern-wraith.json`
- Generator: `scripts/sync-card-specs.mjs` (bounty branch); output `src/game/card-specs.generated.js`
- Tables: `src/game/showdown/cards.js` (`KEYWORDS.ghostly`, `DECKS`)
- Engine: `src/game/showdown/rules.js` (`createShowdown` `opening`, `arrive`, `legalActions` spell branch, `canAttack`)
- Bounty: `src/game/showdown/progress.js` (`BOUNTIES[0]`, `duelFor`, `settle`)
- Rulebook: `prototypes/showdown/RULEBOOK.md` sections 9 (Ghostly), 10 ("Ghostly"), 12 (Bounties)
- Existing tests: `prototypes/showdown/rules.test.js` ("Ghostly troops cannot be targeted by spells, ...", "a bounty's boss opens on the board with the orbs the hunt gives it"); `prototypes/showdown/progress.test.js` (Lantern Wraith hunts: orbs 4–8, capture, "the boss is not also in its escort deck"); `tests/game/card-specs.test.js` (the Lantern Wraith record)

## Card data

- **CARD-WIZARD-LANTERN-WRAITH-01.** THE catalog SHALL define `wizard-lantern-wraith` as a Wizard troop named "Lantern Wraith" with 6 stars, 2 attack, 4 orbs, rarity `legendary`, type tag `Undead`, the single keyword `ghostly` and `bounty: true`.
- **CARD-WIZARD-LANTERN-WRAITH-02.** THE sync script SHALL require the Lantern Wraith, as a bounty card, to be a troop with `copies: 0` and no `limit`.
- **CARD-WIZARD-LANTERN-WRAITH-03.** THE Wizard opponent decks SHALL hold no Lantern Wraith, including its own escort deck.

## The bounty

- **CARD-WIZARD-LANTERN-WRAITH-04.** THE `lantern-wraith` bounty SHALL use `wizard-lantern-wraith` as its boss with entrance `board`, Cowboys first and a Wizard Base of 4 orbs.
- **CARD-WIZARD-LANTERN-WRAITH-05.** THE bounty SHALL give the boss 4, 5, 6, 7 and 8 orbs on hunts 1 to 5, with Wizard levels 1, 1, 1.5, 1.5 and 2.
- **CARD-WIZARD-LANTERN-WRAITH-06.** THE bounty's escort deck SHALL be 6 Skeleton, 3 Jack-o'-Lantern, 2 Raven Familiar, 2 Bone Wall, 2 Singularity and 1 Hex.
- **CARD-WIZARD-LANTERN-WRAITH-07.** WHEN a Lantern Wraith hunt starts, THE engine SHALL place `wizard-lantern-wraith-0` in Wizard slot 0 with the hunt's orbs before turn 1, even when that is more than its printed 4.
- **CARD-WIZARD-LANTERN-WRAITH-08.** WHEN the Wizards' first turn begins, THE engine SHALL let the boss attack, because it was on the board before turn 1.
- **CARD-WIZARD-LANTERN-WRAITH-09.** WHEN the Cowboys win a Lantern Wraith hunt, THE progress module SHALL add 1 to that bounty's cleared count.
- **CARD-WIZARD-LANTERN-WRAITH-10.** WHEN that win is the fifth, THE progress module SHALL add one `cowboy-captured-wraith` to the collection and close the bounty.
- **CARD-WIZARD-LANTERN-WRAITH-11.** WHEN `duelFor` builds a Lantern Wraith hunt, THE duel description SHALL carry the lesson "Wanted: the Lantern Wraith. It stands on the board from the start, and spells cannot touch it."

## Ghostly

- **CARD-WIZARD-LANTERN-WRAITH-12.** WHILE the Lantern Wraith is on the board, THE engine SHALL not offer it as a target of a Cowboy spell that chooses a target (Deadeye, Lasso).
- **CARD-WIZARD-LANTERN-WRAITH-13.** WHILE the Lantern Wraith is on the board, THE engine SHALL offer it as an attack target to Cowboy troops, because attacks are not spells.
- **CARD-WIZARD-LANTERN-WRAITH-14.** WHEN a Cowboy troop with Sweep attacks another Wizard troop, THE engine SHALL remove 1 orb from the Lantern Wraith as well.
- **CARD-WIZARD-LANTERN-WRAITH-15.** WHEN the Lantern Wraith attacks while the Cowboys have a Bear Trap set, THE engine SHALL spring the trap on it.

## Card gallery

- **CARD-WIZARD-LANTERN-WRAITH-16.** WHEN the Card gallery lists previews for Lantern Wraith, THE gallery SHALL offer one preview, "Watch attack", which applies a real Lantern Wraith attack on a Cowboy Sheriff.

## Not numbered

- A Wizard with Raise could return a defeated Lantern Wraith, which is Undead. The escort deck holds no Wizard, so this does not happen in a shipped hunt.
- The Wraith has 1-tribute stars (6) but is never summoned from a hand in Showdown.
- The Boneyard would give it +1 attack; the escort deck has no Boneyard.
- The `bounty` flag is checked by the sync script and copied into `TYPES`. No code in `src/game/showdown/` reads it.
- Lane-era "drift into the marked lane" text in `docs/cards.csv` belongs to the retired lane duel.
