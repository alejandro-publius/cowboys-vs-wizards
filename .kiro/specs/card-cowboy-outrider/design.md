# Design: Outrider (`cowboy-outrider`)

Author: Kiro (native Kiro CLI). Describes the current data path and runtime behaviour; proposes no change.

## Data path

1. Source JSON `.kiro/specs/duel-card-pipeline/cards/cowboy-outrider.json`:
   `{order: 8, kind: "troop", stars: 3, health: 3, attack: 1, copies: 0, limit: 2, rides: true, showdown: {rarity: "common", tag: "Lawman", keys: ["ride"]}}`.
2. `scripts/sync-card-specs.mjs` writes the lane row (keeps `limit` and `rides`) and the Showdown row.
3. `src/game/showdown/cards.js` builds `TYPES["cowboy-outrider"]`. `has(cardId, "ride")` is the only Ride check in the Showdown engine; the lane `rides` flag is not read.

## Runtime behaviour (src/game/showdown/rules.js)

### Targets

```
const open = troops.length === 0 || (guards.length === 0 && has(state.sides[state.active].board[slot].cardId, "ride"));
return [...(guards.length ? guards : troops), ...(open ? ["base"] : [])];
```

| Enemy board | Outrider targets |
| --- | --- |
| empty | `["base"]` |
| troops, no Guard | every troop slot, then `"base"` |
| at least one Guard troop | Guard slots only |

### Ride-past damage

`attackOutcome` for `target === "base"`: `baseDamage` is 1 when any enemy troop stands, else the full `attackOf`. `targetLeft` is null and `attackerLeft` is the attacker's orbs, so nobody hits back. Sheriff's Office (+1 to Lawman) raises the Outrider to 2 attack but does not change the 1-orb ride-past.

### Traps and the end of the game

`attack()` springs the oldest enemy trap before the outcome is computed, for any target including the Base. A Hex returns early with `attacked` already set. After the attack `finish()` checks both Bases and sets `result` when one reaches 0.

### What does not apply

A ride-past is an attack but not a fight (RULEBOOK section 13). No troop loses orbs, so Last Stand, hit back and cover play no part. The Outrider has no Sweep. These are not listed as requirements.

## Events and visible text

- `attack` event for a ride-past: `{target: "base", covered: false, hitBack: 0, baseDamage: 1, targetLeft: null, attackerLeft}`.
- `attackText`: "The Cowboys' Outrider struck the Wizards' Base for 1."
- Keyword text: "Can ride past enemy troops to strike the Base for 1 orb, unless one of them has Guard."

## Deck and progress contexts

| Context | Source | Outrider copies |
| --- | --- | --- |
| Even match default | `DECKS.cowboy` | 2 |
| Trail reward | `TRAIL[1]` Raven Roost: `["cowboy-outrider", "cowboy-sheriff", 2]` | +2, replaces 2 Sheriffs |
| Custom deck cap | `RARITY.common` | 4 across deck and side deck |
| Offers and packs | `pool()`, weight 6 | eligible while owned < 4 |
| Lane catalog (retired) | `CARD_SPECS` `limit: 2`, `rides: true`; `FRONTIER_UNLOCKS` (4 wins) | not used by Showdown |

## Related work

`.kiro/specs/outrider-gate/requirements.md` (K-011) gates an experimental ride-or-fight decision control in the Camp. It reads the same engine and does not change the card. Its evidence is `docs/evidence/outrider-gate.md`.

## Art

Painting: `assets/cards/illustrated/cowboy-outrider.webp`. Brief: `LOOK["cowboy-outrider"]` in `prototypes/showdown/art.js` ("A lighter, faster shape than Mounted Billy"). This spec changes no art.
