# CARD-WIZARD-IMP design

Quickdraw is read once, in `arrive`: `ready: paid || has(cardId, "quickdraw")`. `canAttack` then lets a `ready` troop attack on its arrival turn, still subject to `state.turn > 1`, not stunned and not already acted.

| Requirement | Code path |
| --- | --- |
| 04 | `tributes()` is 0 for 2 stars. |
| 05, 06 | `arrive` sets `ready: true`; `canAttack` requires `state.turn > 1`. |
| 07 | `attackOutcome`: `targetLeft = max(0, health − 3)`, overflow `3 − health` unless the target is in cover. |
| 08 | Hit-back `attackOf(defender)` against 1 orb. |
| 09 | `attack`: Bear Trap removes 2 orbs first; at 0 the attacker is defeated and the function returns. |
| 10 | Last Stand loop in `attack`: the fallen Dynamiter takes 1 orb from the standing Imp, which is then defeated. |

## Interactions with other card types

| Other card | Result |
| --- | --- |
| Cowboy Sheriff (1/3) | Defeated with no overflow; the Imp survives. |
| Cowboy Dynamiter (3/1, Last Stand) | Both fall: the Imp's hit defeats it and Last Stand removes the Imp's orb. |
| Covered Wagon (Guard, 1/4) | Must be attacked first; survives on 1 and hits back, defeating the Imp. |
| Bear Trap | Defeats the Imp before it strikes. |
| Troop in cover | No overflow and no hit-back, so the Imp survives a hit on a sturdier troop in cover. |
| Bone Armor | Lets an Imp survive one hit-back (3 orbs). |
| Boneyard | No effect: the Imp is a Fiend. |

## Visible results

The Imp's attack uses the default `blade` beat. This spec adds no animation.

## Design notes for Fable (not requirements)

- The Imp Hollow lesson ("Keep a troop in front of your Base") and The Imp rival's cover lesson both rely on Quickdraw. The test "the bot plans without seeing them" shows the bot walking an Imp into a Bear Trap, which is how the trap lesson lands.
