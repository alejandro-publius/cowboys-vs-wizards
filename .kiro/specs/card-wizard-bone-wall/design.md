# CARD-WIZARD-BONE-WALL design

## Where the card lives

The spec file `wizard-bone-wall.json` is generated into `SHOWDOWN_SPECS`. `cards.js` `entry()` turns it into a `fresh` troop record with `keys: ["guard"]`. No code mentions Bone Wall by id except decks, art and the gallery summary. Its behaviour comes from two generic rules: Guard in `targetsFor`, and the zero-attack check in `canAttack`.

## How each rule is reached

| Requirement | Code path |
| --- | --- |
| 04, 05 | `tributes()` returns 0 for 3 stars. `legalActions` offers a summon with no tributes only while `occupied.length < BOARD_SIZE`. |
| 06 | `applyAction` summon branch calls `arrive(cardId, turn, {paid: false})`, so `ready` is false and `gear` is `[]`. |
| 07 | `legalActions` offers `cover` to any troop with `!attacked && !cover`. |
| 08 to 11 | `canAttack` requires `attackOf(state, troop) > 0`. `attackOf` adds gear attack (Bone Armor 0) and +1 when the location's tag is `Undead` (Boneyard). |
| 12, 13 | `targetsFor` returns the Guard slots when any exist and opens the Base for a rider only when `guards.length === 0`. |
| 14 | The spell branch of `legalActions` filters only Ghostly troops and, for Lasso, already stunned ones. It never reads Guard. |
| 15, 17, 18 | `attackOutcome`: hit-back is `attackOf(defender)` when the target survives out of cover. Overflow is `attack - health` unless the defender is in cover. |
| 16 | `presenter.js` `attackText`, the `!e.hitBack` branch. |
| 19 | `defeat()` pushes the troop id, then its gear ids, to the owner's discard. |
| 20 | `applyAction` summon branch: `findLastIndex` over the discard for an Undead troop, then `arrive(..., {health: 1})`. |
| 21, 22 | `attackPreviews` returns `[["guard", "Watch Guard"]]` when `card.attack === 0`. `attackExample` opens a Cowboy Sheriff and Billy against the Bone Wall, Cowboys to act, and plays the Sheriff's attack on slot 0. |

## Interactions with other card types

| Other card | Result |
| --- | --- |
| Cowboy troops | Must attack a Guard troop first. Out of cover, a surviving Bone Wall hits back for 0. |
| Cowboy Ride (Outrider, Mounted Billy) | Cannot ride past it to the Base. |
| Cowboy Sweep (Gatling Crew, Captured Dragon) | Must aim at a Guard troop. Sweep then takes 1 orb from each other Wizard troop. |
| Cowboy spells (Deadeye, Lasso) | May target any non-Ghostly Wizard troop. Guard does not redirect them. |
| Bear Trap | Cannot spring on a Bone Wall unless the Boneyard lets it attack, because a trap springs only on an enemy attack. |
| Bone Armor | +2 orbs and no attack. |
| Boneyard | +1 attack, so the Bone Wall can attack and hits back for 1. |
| Sheriff's Office | Replaces the Boneyard and so removes the Bone Wall's attack again. |
| Wizard (Raise) | Can bring a defeated Bone Wall back with 1 orb if it is the last Undead troop in the graveyard. |

## Visible results

- The log reports a survived hit with "it has no attack, so it did not hit back" (requirement 16).
- The gallery replays a real engine action for Guard (requirements 21 and 22). No Bone Wall attack animation is specified here, and none is added.

## Design notes for Fable (not requirements)

- `progress.js` records that a Bone Wall in front of the Graveyard Dragon made that hunt close to unwinnable, so the Dragon escort has no Guard troop. That shows Guard combined with a hard hitter behind it can dominate a matchup.
- The Bonewright pairs 3 Bone Walls with 2 Boneyards. In that deck the Bone Wall becomes a 1-attack Guard. A smaller alternative to compare would be a fixed attack of 1 with no location dependency. That would cut one rules interaction but remove the Boneyard's teaching moment. This is a hypothesis for Fable, untested.
