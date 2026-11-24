# CARD-WIZARD-SKELETON design

The Skeleton has no card-specific code. Its behaviour comes from its stats and its `Undead` tag:

| Requirement | Code path |
| --- | --- |
| 04 | `tributes()` is 0 for 1 star. |
| 05 | `arrive` with `paid: false`; `canAttack` rejects `arrived === turn && !ready`. |
| 06 | `attackOutcome` hit-back is `attackOf(defender)` = 1. |
| 07 | `attackOf` adds 1 when the location's effect tag is `Undead`. |
| 08, 09 | Raise in the `applyAction` summon branch, after tributes reach the graveyard. |
| 10 | `attackPreviews` default `[["attack", "Watch attack"]]`; `attackExample` opens the Skeleton against a Cowboy Sheriff, Wizards to act. |

## Interactions with other card types

| Other card | Result |
| --- | --- |
| Wizard (Raise) | Paying a Skeleton returns it at 1 orb, so the tribute costs 2 orbs, not a troop. |
| Boneyard | 2 attack. |
| Bone Armor | 5 orbs from full. |
| Cowboy Sheriff (1/3) | Even trade: each leaves the other on 2. |
| Cowboy Mounted Billy (3 attack) | Defeats a full Skeleton with no overflow; a 1-orb Skeleton lets 2 through to the Base. |
| Hellfire, Singularity, Hex | No interaction: they act on Cowboy troops. |

## Visible results

The Skeleton's attack uses the `blade` beat with its own timing entry `[1140, 598]` in `event-positions.js`. This spec adds no animation.

## Design notes for Fable (not requirements)

- Boot Hill is 16 Skeletons at level 0, the game's first lesson. Any Skeleton stat change moves that lesson's difficulty first.
