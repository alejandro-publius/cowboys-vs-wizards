# CARD-WIZARD-RAVEN-FAMILIAR design

Scout is read once, in the `applyAction` summon branch: after the troop is placed and `summon` is emitted, `if (has(cardId, "scout")) draw(next, side, events)`. It calls `draw` without `fatigue`, so an empty deck returns silently (requirement 05). `draw` burns the card when the hand is at `HAND_CAP` (requirement 06).

The bot cannot know the drawn card in advance. `planTurn` uses `hideDraw` to remove the card from its imagined hand and cut the plan after the summon. `playTurn` replans when it sees its own `draw` or `burn` event (requirement 08).

## Interactions with other card types

| Other card | Result |
| --- | --- |
| Any Cowboy troop | The Raven's 1 orb falls to any hit-back; its 1 attack rarely defeats anything. |
| Bear Trap | Defeats it before it strikes. |
| Wizard (Raise) | Never returns it (Beast). |
| Boneyard | No effect (Beast). |
| Bone Armor | 3 orbs. |
| Hellfire, Singularity, Hex | A drawn copy can be played the same turn if the matching play is unused. |

## Visible results

The opponent sees "The Wizards drew a card." The illustrated replay's `draw` beat hides the card id from the other seat (`showdown-3d-presentation.test.js`, "the visible draw comes from the deck without revealing the opposing hand"). The Raven's attack has its own timing entry `[860, 470]`.

## Design notes for Fable (not requirements)

- Raven Roost teaches keywords with 4 Ravens. Scout gives no board effect the Cowboy player can see beyond a card count, so its lesson depends on the keyword list under the board.
