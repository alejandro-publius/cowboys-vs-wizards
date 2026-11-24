# CARD-WIZARD-BONEYARD design

| Requirement | Code path |
| --- | --- |
| 03, 04 | `legalActions`: `card.kind === "location" && !castUsed && (!state.location || cardOf(state.location.cardId).name !== card.name)`. The comparison is by name, so a second Boneyard copy is refused. |
| 05, 06, 07 | `applyAction` location branch: remove from hand; if `next.location` exists push it to `next.sides[next.location.side].discard`; set `next.location = {cardId, side}`; set `castUsed`. |
| 08 | The same branch run by the Cowboys with `cowboy-sheriffs-office`. |
| 09, 10 | `attackOf`: `+1` when `EFFECTS[location effect].tag === card.tag`. |
| 11 | `canAttack` requires `attackOf > 0`. |
| 12 | `attackOutcome` uses `attackOf` for both the attack and the hit-back. |
| 13 | `attackOutcome` returns `baseDamage: 1` for a Base target with enemy troops standing, whatever the attack. |
| 15 | `viewFor` keeps `location` in the public state. |

## Interactions with other card types

| Other card | Result |
| --- | --- |
| Skeleton | 2 attack. |
| Bone Wall | 1 attack: it can attack and hit back. |
| Headless Horseman | 3 attack in fights and on an empty board; ride-past still 1. |
| Lantern Wraith | 3 attack, if both appeared together (no shipped deck does this). |
| Cowboy Captured Wraith | 3 attack: the Boneyard helps the Cowboys too. |
| Sheriff's Office | Replaces it; then Lawman troops get +1 instead. |
| Wizard (Raise) | A raised Undead troop has the +1 at once but still rests. |
| Singularity, Hellfire, Bone Armor | Share the other-card play; one per turn. |

## Visible results

Log line from `presenter.js` `location`. The replay's `location` beat moves the card from the hand to the shared location slot, and a `burial` beat sends any replaced location to its owner's graveyard.

## Design notes for Fable (not requirements)

- The Boneyard is symmetric. A Cowboy deck with the Captured Wraith benefits from the Wizards' own location. The Bonewright deck holds no Ghostly troop, and the Cowboy benefit only appears when the player brings the Captured Wraith.
