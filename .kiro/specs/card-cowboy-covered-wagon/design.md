# Design: Covered Wagon (`cowboy-covered-wagon`)

Author: Kiro (native Kiro CLI). Describes the current data path and runtime behaviour; proposes no change.

## Data path

`.kiro/specs/duel-card-pipeline/cards/cowboy-covered-wagon.json` (`stars: 4, health: 4, attack: 1, copies: 0, limit: 2, showdown: {rarity: "common", tag: "Rig", keys: ["guard"]}`) becomes `TYPES["cowboy-covered-wagon"]`. `limit` and `copies` are lane-only.

## Runtime behaviour

- Guard: `targetsFor` collects `guards`; when any exist, only their slots are returned and the Base is closed, including for riders. Two Wagons make both legal targets.
- Guard and Sweep: the Sweep block lists every other occupied slot, so Guard does not protect neighbours from a Dragon or Captured Dragon.
- Cover: `cover` sets `attacked` and `cover`; `attackOutcome` then gives no Base spill and no hit back. The Wizards' `end` resets `attacked` and `cover` on the Cowboy board when the Cowboy turn begins.
- Cost: 4 stars, free; it rests on arrival but may take cover at once.

## Deck and progress contexts

| Context | Source | Copies |
| --- | --- | --- |
| Even match | `DECKS.cowboy` | 2 |
| Trail reward | `TRAIL[0]` Boot Hill: `["cowboy-covered-wagon", "cowboy-sheriff", 2]` | +2 for 2 Sheriffs |
| Custom deck cap | `RARITY.common` | 4 |
| Lane (retired) | `CARD_SPECS` `limit: 2`; `FRONTIER_UNLOCKS` (3 wins) | not used by Showdown |

## Art

Painting `assets/cards/illustrated/cowboy-covered-wagon.webp`; brief `LOOK["cowboy-covered-wagon"]` ("it fills the picture from edge to edge like a wall"). This spec changes no art.
