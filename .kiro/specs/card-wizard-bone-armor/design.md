# CARD-WIZARD-BONE-ARMOR design

| Requirement | Code path |
| --- | --- |
| 03, 04 | `legalActions`: `card.kind === "gear" && !castUsed` pushes `{type: "gear", cardId, slot}` for every occupied own slot. The hand loop is skipped once a troop has acted. |
| 05 | `applyAction` gear branch sets `castUsed`, the flag spells and locations also check. |
| 06, 08 | `troop.gear.push(cardId)`; `troop.health += EFFECTS.bonearmor.orbs` (2). There is no cap. |
| 07 | `attackOf` adds `EFFECTS.bonearmor.attack` (0). |
| 09 | The card lives in `troop.gear` only. |
| 10 | `defeat()` pushes `cardId` then `...gear` to the owner's discard. Tributes go through `defeat()`. |
| 11 | Raise splices only the troop id from the discard and calls `arrive`, which sets `gear: []`. |

## Interactions with other card types

| Other card | Result |
| --- | --- |
| Imp (3/1) | 3 orbs: survives one hit-back or a Bear Trap. |
| Bone Wall (0/4) | 6 orbs and still 0 attack. |
| Dragon, Graveyard Dragon | +2 orbs on either entrance. |
| Boneyard | Uses the same other-card play, so the Wizards cannot play both in one turn. |
| Hellfire, Singularity | Same: the turn's one other card. |
| Cowboy Deadeye and attacks | Remove orbs from the new total. |
| Wizard (Raise) | The returned troop does not get the armor back. |

## Visible results

Log line from `presenter.js` `gear`. The replay's `gear` beat moves the card from the hand to the troop and copies the troop's after-state orbs and gear.

## Design notes for Fable (not requirements)

- The Imp rival deck pairs Bone Armor with 3 Imps. On an Imp it removes the main counter (any hit-back). That is the strongest single target for it in the shipped decks.
