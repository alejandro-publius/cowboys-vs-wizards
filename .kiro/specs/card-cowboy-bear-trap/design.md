# Design: Bear Trap (`cowboy-bear-trap`)

Author: Kiro (native Kiro CLI). Describes the current data path and runtime behaviour; proposes no change.

## Data path

`.kiro/specs/duel-card-pipeline/cards/cowboy-bear-trap.json` (`order: 13, kind: "trap", showdownOnly: true, showdown: {rarity: "uncommon", effect: "snare"}`) is validated by `validateShowdownOnly` and appears only in `SHOWDOWN_SPECS`. `entry()` in `src/game/showdown/cards.js` marks it `fresh: true`.

## Runtime behaviour

- Setting: the hand loop lists `{type: "set", cardId}` when `!state.setUsed` and `own.traps.length < TRAP_SLOTS` (2). The card moves to `own.traps` in order; the `set` event carries `side` only.
- Hidden: `viewFor` replaces the opponent's `traps` with `trapCount`. The level-2 bot plans with the enemy traps removed (`knowable`), and `playTurn` replans after a `trap` event.
- Springing, in `attack()` before the outcome:
  ```
  const trapId = enemy.traps.shift();       // oldest first, one per attack
  enemy.discard.push(trapId);
  if (effect === "snare") attacker.health = Math.max(0, attacker.health - 2);
  const stopped = effect === "hex" || attacker.health === 0;
  if (attacker.health === 0) defeat(own, action.slot);   // troop and its gear
  if (stopped) return;
  ```
- It springs on any attack, including a direct Base strike and a ride-past.
- A trap defeat is not a fight, so Last Stand does not fire.

## Events and visible text

- `trap` event `{side: "cowboy", cardId, target, left, stopped}`.
- `PRESENTERS.trap`: "Trap! The Cowboys' Bear Trap caught <troop>: defeated before it struck" or "it dropped to <n> and attacked anyway".

## Deck and progress contexts

| Context | Source | Copies |
| --- | --- | --- |
| Even match | `DECKS.cowboy` | 1 |
| Trail reward | `TRAIL[3]` Imp Hollow: `["cowboy-bear-trap", "cowboy-deadeye", 1]` | +1 for a Deadeye |
| Custom deck cap | `RARITY.uncommon` | 3 |

The Hexed Mile lesson ("A face-down card is a trap") teaches the Wizard Hex, the mirror of this card.

## Art

Painting `assets/cards/illustrated/cowboy-bear-trap.webp`; brief `LOOK["cowboy-bear-trap"]`. This spec changes no art.
