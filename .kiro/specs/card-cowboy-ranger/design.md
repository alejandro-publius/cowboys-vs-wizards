# Design: Ranger (`cowboy-ranger`)

Author: Kiro (native Kiro CLI). Describes the current data path and runtime behaviour; proposes no change.

## Data path

`.kiro/specs/duel-card-pipeline/cards/cowboy-ranger.json` (`stars: 5, health: 4, attack: 2, copies: 0, limit: 2, rides: true, showdown: {rarity: "uncommon", tag: "Lawman", keys: ["scout"]}`) becomes `TYPES["cowboy-ranger"]`. Showdown reads `keys`, so the Ranger has Scout and no Ride. The lane `rides` flag is read only by the retired `src/game/cards.js` `canRide`.

## Runtime behaviour

- Cost: 1 tribute; arrives `ready`.
- Scout: in the `applyAction` summon branch, `if (has(action.cardId, "scout")) draw(next, side, events)`. `draw` without `fatigue` returns silently on an empty deck, and burns the card when the hand already holds `HAND_CAP` (6).
- Office: Lawman, so +1 attack under Sheriff's Office.
- Bot: `hideDraw` removes the drawn card from the planning view and `planTurn` cuts the plan after the summon; `playTurn` replans when it sees its own `draw` event.

## Deck and progress contexts

| Context | Source | Copies |
| --- | --- | --- |
| Even match | `DECKS.cowboy` | 1 |
| Trail reward | `TRAIL[2]` The Bone Fence: `["cowboy-ranger", "cowboy-billy", 1]` | +1 for a Billy |
| Custom deck cap | `RARITY.uncommon` | 3 |
| Lane (retired) | `CARD_SPECS` `limit: 2`, `rides: true`; `FRONTIER_UNLOCKS` (6 wins) | not used by Showdown |

## Art

Painting `assets/cards/illustrated/cowboy-ranger.webp`; brief `LOOK["cowboy-ranger"]` ("the Cowboy who sees what is coming and draws a card for it"). This spec changes no art.
