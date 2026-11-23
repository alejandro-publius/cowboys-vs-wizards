# CARD-WIZARD-HEADLESS-HORSEMAN design

Ride is read in two places:

- `targetsFor`: the Base is a target when the enemy has no troops, or when there is no enemy Guard troop and the attacker has `ride`. With a Guard troop present, the targets are the Guard slots only.
- `attackOutcome`: a Base target with enemy troops standing yields `baseDamage: 1`, `targetLeft: null` and the attacker's health unchanged. With no enemy troops it yields the full attack.

`attack` springs a trap before either case, so a ride-past is still an attack (requirement 11). `attackKind` in `event-positions.js` returns `ride` when the target is a Base, enemy troops stand and the attacker has `ride`.

## Interactions with other card types

| Other card | Result |
| --- | --- |
| Covered Wagon (Cowboy Guard) | Blocks the ride-past. The Horseman must attack the Wagon. |
| Bear Trap | Springs on a ride-past too. 2 orbs off a full Horseman leaves 1 and the ride-past lands. |
| Cowboy troop in cover | Irrelevant to a ride-past, which touches no troop. |
| Wizard (Raise) | Can return it with 1 orb; it rests that turn. |
| Boneyard | +1 attack in fights; ride-past stays 1. |
| Bone Armor | 5 orbs from full. |
| Bone Wall (Wizard Guard) | No effect on the Horseman's targets: Guard restricts the enemy's attacks. |

## Visible results

- Log: Base branch of `attackText`, "struck the Cowboys' Base for 1."
- Replay: `ride` beat. `combat-effects.js` lists the Horseman in its `mounted` set alongside the Cowboy riders. This spec adds no animation.

## Design notes for Fable (not requirements)

- The Cowboys' only counter to a ride-past is a Guard troop (Covered Wagon) or removing the Horseman. Its 1-orb ride-past is fixed, so tuning its attack changes fights only. That makes attack a low-risk tuning lever if Fable wants the Horseman stronger in fights without more Base pressure.
