# Design: Lasso (`cowboy-lasso`)

Author: Kiro (native Kiro CLI). Describes the current data path and runtime behaviour; proposes no change.

## Data path

1. Source JSON `.kiro/specs/duel-card-pipeline/cards/cowboy-lasso.json`:
   `{order: 12, kind: "spell", relocates: true, copies: 0, limit: 2, showdown: {rarity: "uncommon", effect: "tie"}}`.
2. `scripts/sync-card-specs.mjs` validates the spell fields (`relocates` must be a boolean) and the Showdown block (`rarity`, `effect`). It writes the lane row and the Showdown row `{type, side, name, kind: "spell", rarity: "uncommon", effect: "tie"}`.
3. `src/game/showdown/cards.js` `entry()` checks that `EFFECTS.tie` exists. `EFFECTS.tie` is `{target: true, text: "Stun an enemy troop: it cannot attack on its next turn."}`.

Showdown reads `kind`, `rarity` and `effect`. `relocates`, `limit`, `copies` and `order` are lane-only.

## Runtime behaviour (src/game/showdown/rules.js)

### Legal casts

The hand loop in `legalActions` is skipped once `state.attacking` is set (any troop attacked or took cover). For a spell it needs `!state.castUsed`; Lasso has `target: true`, so it walks the enemy board:

```
if (!troop || has(troop.cardId, "ghostly") || (card.effect === "tie" && troop.stunned)) return;
actions.push({type: "spell", cardId, target});
```

Copies are listed once per card name, so two Lassos in hand give the same action list as one.

### Resolution

`applyAction` spell branch: remove from hand, push to own discard, set `castUsed`, then for the one target set `troop.stunned = true` (no orb change) and push a `spell` event with `stunned: true`. The `health === 0` defeat check cannot trigger because orbs are untouched.

### Duration

| Moment | Code | Stunned troop |
| --- | --- | --- |
| Rest of the Cowboy turn | no change | stunned |
| Wizard turn starts (`end` from Cowboy) | only `attacked` and `cover` are reset for the Wizards | still stunned; `canAttack` false |
| Wizard turn ends (`end` from Wizard) | `for (const troop of own.board) troop.stunned = false` | cleared |
| Next Wizard turn | normal | may attack |

`canAttack` reads `stunned`; nothing else does. So a stunned troop still keeps Guard (`targetsFor`), may take cover (`legalActions` cover check), and hits back (`attackOutcome` reads `attackOf(defender)` with no stun check).

### Interactions

| Card or rule | Interaction |
| --- | --- |
| Ghostly (Lantern Wraith boss) | not a legal target |
| Already stunned | not a legal target (RULEBOOK section 10, "Stun") |
| Deadeye, gear, locations | share the turn's one "other card" slot (`castUsed`) |
| Troop summon, trap set | separate allowances; still legal after a Lasso |
| Bot evaluation | `evaluate()` multiplies a stunned troop's worth by 0.5 |
| Zero-attack troops (Bone Wall) | legal target, but the stun has no attack to stop unless the Boneyard is in play |

## Events and visible text

- `spell` event `{side, cardId, target, left, stunned: true}`.
- `PRESENTERS.spell`: "The Cowboys' Lasso hit <target>: stunned for its next turn."
- Card text (cards.csv): "Stun an enemy troop: it cannot attack on its next turn."

## Deck and progress contexts

| Context | Source | Lasso copies |
| --- | --- | --- |
| Even match default | `DECKS.cowboy` | 1 |
| Trail reward | `TRAIL[2]` The Bone Fence: `["cowboy-lasso", "cowboy-deadeye", 1]` (with Ranger for Billy) | +1, replaces a Deadeye |
| Custom deck cap | `RARITY.uncommon` | 3 across deck and side deck |
| Offers and packs | `pool()`, weight 3 | eligible while owned < 3 |
| Lane catalog (retired) | `CARD_SPECS` `relocates: true`, `limit: 2`; `FRONTIER_UNLOCKS` (2 wins) | not used by Showdown |

## Art

Painting: `assets/cards/illustrated/cowboy-lasso.webp`. Brief: `LOOK["cowboy-lasso"]` in `prototypes/showdown/art.js` ("Nothing is hurt; it is held"). This spec changes no art.
