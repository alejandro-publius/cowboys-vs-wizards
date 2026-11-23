# Design: Billy (`cowboy-billy`)

Author: Kiro (native Kiro CLI). Describes the current data path and runtime behaviour; proposes no change.

## Data path

`.kiro/specs/duel-card-pipeline/cards/cowboy-billy.json` (`stars: 5, health: 4, attack: 2, copies: 3, showdown: {rarity: "basic", tag: "Outlaw", keys: []}`) goes through `scripts/sync-card-specs.mjs` to `SHOWDOWN_SPECS`, then `TYPES["cowboy-billy"]` in `src/game/showdown/cards.js`. `copies` and `order` are lane-only.

## Runtime behaviour

| Concern | Code | Billy result |
| --- | --- | --- |
| Cost | `tributes()`: 5 or 6 stars cost 1 | `combinations(occupied, 1)`: one summon per own troop |
| Arrival | `arrive(..., {paid: true})` sets `ready` | strikes on arrival after turn 1 |
| Fight | `attackOutcome` | 2 damage; hit back from a survivor |
| Direct strike | `attackOutcome` with `target === "base"` and an empty enemy board | full 2 attack |
| Location | `attackOf` adds 1 only for a matching tag | Outlaw: no location in the game names it |
| Traps | `attack()` springs the oldest enemy trap first | a Hex cancels the attack |

Billy has no keyword; keyword clauses would be vacuous and are not listed.

## Deck and progress contexts

| Context | Source | Billy copies |
| --- | --- | --- |
| Even match | `DECKS.cowboy` | 2 |
| Starter | `STARTER` | 5 |
| Trail 3 (The Bone Fence, Ranger) / 5 (The Hexed Mile, Mounted Billy) / 6 (Dragon's Roost, Gatling Crew) | `TRAIL[2]`, `TRAIL[4]`, `TRAIL[5]` | 4, 3, 2 |
| Custom deck | basic: `owned` is `Infinity` | any count |
| Lane catalog (retired) | `CARD_SPECS` `copies: 3` | not used by Showdown |

## Art

Paintings `assets/cards/illustrated/cowboy-billy.webp`, `assets/cards/billy-card.webp`, `assets/cards/billy-storybook.webp`, `assets/cards/billy.webp`. Billy is one of the six troops with a model (art-direction test in `prototypes/showdown/rules.test.js`). This spec changes no art.
