# Design: Captured Dragon (`cowboy-captured-dragon`)

Author: Kiro (native Kiro CLI). Describes the current data path and runtime behaviour; proposes no change.

## Data path

`.kiro/specs/duel-card-pipeline/cards/cowboy-captured-dragon.json` (`order: 5, stars: 5, health: 2, attack: 4, copies: 0, bounty: true, showdown: {rarity: "legendary", tag: "Beast", keys: ["sweep"]}`) becomes `TYPES["cowboy-captured-dragon"]` with `bounty: true`.

## Runtime behaviour

- Cost: 1 tribute (5 stars); arrives `ready`.
- Sweep: the same block as the Gatling Crew and the Wizard Dragon (see `.kiro/specs/card-cowboy-gatling-crew/design.md`). It runs before the attacker's own `defeat()`, so a Captured Dragon that falls to a hit back still sweeps.
- Profile: 4 attack on 2 orbs. Any surviving defender with 2 or more attack defeats it on the hit back.
- No location names Beast.

## How it is earned

`BOUNTIES[1]` (`graveyard-dragon`): five hunts against a Dragon that lands on game turn 4 (the Wizards' second turn) with 2, 3, 3, 4, 4 orbs. `settle` counts cleared hunts; the fifth sets `earned.captured` and adds the card to the collection. `migrate` accepts a Legendary in the collection only when its bounty shows `HUNTS` (5) cleared.

| Context | Copies |
| --- | --- |
| Even match, starter, Trail | 0 |
| Bounty capture | 1 |
| Custom deck cap (`RARITY.legendary`) | 1 |
| Offers and packs | never |

## Art

Painting `assets/cards/illustrated/cowboy-captured-dragon.webp`; brief `LOOK["cowboy-captured-dragon"]`. This spec changes no art.
