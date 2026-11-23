# CARD-WIZARD-JACK-O-LANTERN design

Last Stand is evaluated only inside `attack`, after target damage and hit-back are applied and before either troop is removed:

```
for [fallen, standing] of [[defender, attacker], [attacker, defender]]:
  if fallen.health == 0 and standing.health > 0 and fallen has laststand:
    standing.health -= 1; emit laststand
then defeat the defender at 0, Sweep, defeat the attacker at 0
```

Consequences used by the requirements:

- Cover does not matter. Cover changes hit-back and overflow, but a covered Jack-o'-Lantern still reaches 0 (requirement 06).
- `standing.health > 0` blocks the effect when both fall (requirement 07).
- The standing troop is removed by the normal defeat checks that follow (requirement 05).
- Tribute, spells, traps and Sweep remove orbs outside this loop (requirement 08). A trap that defeats an attacker returns before the loop.
- A Base attack skips the troop branch (requirement 09).

## Interactions with other card types

| Other card | Result |
| --- | --- |
| Cowboy Sheriff (1/3) | Defeats the Jack-o'-Lantern and drops to 2. |
| Cowboy Billy (2/4) | Defeats it and drops to 3 (existing test). |
| Cowboy Dynamiter (3/1, Last Stand) | Whichever attacks, the target is defeated, its Last Stand defeats the attacker, and the attacker's own Last Stand does not fire (requirement 07). |
| Gatling Crew / Captured Dragon Sweep | A Jack-o'-Lantern swept to 0 fires nothing. |
| Deadeye, Lasso | Deadeye defeats it with no Last Stand. Lasso stuns it. |
| Bear Trap | Defeats an attacking Jack-o'-Lantern before the fight; no Last Stand. |
| Bone Armor | 3 orbs; see the note in requirements. |

## Visible results

- Log: `laststand` line, with ", defeating it" when the standing troop reaches 0.
- Replay: a `laststand` beat from the Jack-o'-Lantern's slot to the other troop, then `burial` beats.

## Design notes for Fable (not requirements)

- Raven Roost introduces keywords with this card. The Last Stand lesson only lands if a Cowboy troop fights it, so the Cowboy player sees it as soon as they attack.
