# Design: Gatling Crew (`cowboy-gatling-crew`)

Author: Kiro (native Kiro CLI). Describes the current data path and runtime behaviour; proposes no change.

## Data path

1. Source JSON `.kiro/specs/duel-card-pipeline/cards/cowboy-gatling-crew.json`:
   `{order: 11, kind: "troop", stars: 7, health: 4, attack: 4, copies: 0, limit: 1, showdown: {rarity: "rare", tag: "Rig", keys: ["sweep"]}}`.
2. `scripts/sync-card-specs.mjs` writes the lane row (`limit: 1`, retired) and the Showdown row.
3. `src/game/showdown/cards.js` builds `TYPES["cowboy-gatling-crew"]`. `tributes()` returns 2 for 7 stars or more.

Showdown reads stars, attack, health, tag, keys and rarity. It ignores `limit`, `copies` and `order`.

## Runtime behaviour (src/game/showdown/rules.js)

### Summoning

- `legalActions` enumerates `combinations(occupied, 2)`: one action per unordered pair of occupied slots, each kept because `occupied - 2 < BOARD_SIZE`. 0 or 1 own troops give no Gatling summon; 2 give one; 3 give three.
- `applyAction` summon branch: each tribute gets a `tribute` event and `defeat()` (troop plus gear to discard), then `arrive(..., {paid: true})` at `board.indexOf(null)`.
- `ready: true` lets `canAttack` pass on the arrival turn (after turn 1, before the troop has acted).

### Sweep

Inside `attack()`, after the fight's orbs and Last Stand are applied and a defeated defender is removed:

```
if (has(attacker.cardId, "sweep")) {
  const swept = enemy.board.flatMap((troop, slot) => (troop && slot !== action.target ? [slot] : []));
  for (const slot of swept) if ((enemy.board[slot].health -= 1) === 0) defeat(enemy, slot);
  if (swept.length) events.push({type: "sweep", side, cardId: attacker.cardId, count: swept.length});
}
if (attacker.health === 0) defeat(own, action.slot);
```

| Property | Why it holds |
| --- | --- |
| Fires even if the Gatling Crew falls in the fight | the Sweep block runs before the attacker's `defeat()` |
| No Base damage from Sweep | `enemy.base` is reduced only by `outcome.baseDamage` from the fight |
| Guard does not block it | `swept` lists every other occupied slot |
| Hits Ghostly troops and covered troops | no keyword or cover check in the block |
| No Last Stand from swept troops | swept troops go straight to `defeat()` |
| Hex stops it | `attack()` returns before the fight when the trap's `stopped` is true |
| Only on its own attack | the check reads `attacker`, never the defender |
| Not in the preview | `attackOutcome` covers the fight only ("without traps, Last Stand or Sweep") |

The Captured Dragon and the Wizard Dragon share this keyword; the requirements here use the Gatling Crew only.

## Events and visible text

- `sweep` event `{side, cardId, count}` after the `attack` event; there is no per-troop sweep event, so the log shows one line.
- `PRESENTERS.sweep`: "Sweep: Gatling Crew also hit <n> other troop(s) for 1."
- Keyword text: "When it attacks a troop, every other enemy troop loses 1 orb."

## Deck and progress contexts

| Context | Source | Gatling Crew copies |
| --- | --- | --- |
| Even match default | `DECKS.cowboy` | 0 (cards.csv "Copies in the even-match deck": 0) |
| Trail reward | `TRAIL[5]` Dragon's Roost: `["cowboy-gatling-crew", "cowboy-billy", 1]` | +1, replaces a Billy |
| Custom deck cap | `RARITY.rare` | 2 across deck and side deck |
| Offers and packs | `pool()`, weight 1 (the rarest weight) | eligible while owned < 2 |
| Saved game check | `migrate` | over-cap deck or collection resets the save |
| Lane catalog (retired) | `CARD_SPECS` `limit: 1`; `FRONTIER_UNLOCKS` (7 wins); `tests/game/frontier-pack.test.js` | not used by Showdown |

## Art

Paintings: `assets/cards/illustrated/cowboy-gatling-crew.webp` and `assets/cards/gatling-storybook.webp`. Brief: `LOOK["cowboy-gatling-crew"]` in `prototypes/showdown/art.js` ("a fan of gold tracer lines spreads ... across the whole width"). This spec changes no art.

## Design notes

- The Gatling Crew is the Cowboys' only Sweep troop outside the Legendary Captured Dragon. Its 2-tribute cost means it never adds to the troop count: from 2 own troops the board goes to 1, from 3 it goes to 2.
- Tuning ideas (for example a 1-tribute cost) are design hypotheses for Fable; none is proposed as a requirement.
