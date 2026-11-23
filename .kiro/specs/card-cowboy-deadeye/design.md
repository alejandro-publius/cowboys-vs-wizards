# Design: Deadeye (`cowboy-deadeye`)

Author: Kiro (native Kiro CLI). Describes the current data path and runtime behaviour; proposes no change.

## Data path

`.kiro/specs/duel-card-pipeline/cards/cowboy-deadeye.json` (`kind: "spell", relocates: false, copies: 2, showdown: {rarity: "common", effect: "shot"}`) becomes `TYPES["cowboy-deadeye"]`. `EFFECTS.shot` is `{target: true, text: "Remove 1 orb from an enemy troop."}`. The Wizard Singularity has the same effect.

## Runtime behaviour

- Legal casts: the spell branch of `legalActions` skips empty slots and Ghostly troops. The stun check applies only to `tie`, so a stunned troop is a legal Deadeye target.
- Resolution: `troop.health -= 1`, a `spell` event with `left`, and `defeat()` at 0 (troop and gear to the owner's discard). The Deadeye goes to the caster's discard.
- Allowance: it sets `castUsed`, shared with gear and locations.
- Last Stand: spells call `defeat()` directly, outside the fight loop, so no Last Stand fires.

## Deck and progress contexts

| Context | Source | Copies |
| --- | --- | --- |
| Even match | `DECKS.cowboy` | 1 |
| Starter and new collection | `STARTER`, `newSave()` | 3 each |
| Trail 3 (Lasso) and 4 (Bear Trap) | `TRAIL[2]`, `TRAIL[3]` | 2, then 1 |
| First offer | `settle` with `pool(save, {met: true})` | Covered Wagon or Deadeye |
| Custom deck cap | `RARITY.common` | 4 |

## Art

Paintings `assets/cards/illustrated/cowboy-deadeye.webp`, `assets/cards/deadeye-card.webp`, `assets/cards/deadeye-storybook.webp`. This spec changes no art.
