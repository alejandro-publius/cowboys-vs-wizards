# CARD-WIZARD-HEX design

## Set

`legalActions`: `card.kind === "trap" && !state.setUsed && own.traps.length < TRAP_SLOTS` (2). The hand loop is skipped once `state.attacking` is true. `applyAction` set branch: remove from hand, `own.traps.push(cardId)`, `setUsed = true`, emit `{type: "set", side}` with no card id. `viewFor` replaces the other side's `traps` with `trapCount`.

## Spring

At the start of `attack`, after `attacker.attacked = true` and `next.attacking = true`:

```
if enemy.traps is not empty:
  trapId = enemy.traps.shift()        // oldest first
  enemy.discard.push(trapId)
  stopped = effect == "hex" or attacker.health == 0
  emit trap {side, cardId, target, left, stopped}
  if stopped: return                  // no attack event, no damage, no Sweep
```

Because `attacked` and `attacking` are set first, a cancelled attack still spends the troop's action and closes card plays (requirements 10, 11). The check runs for every target, the Base included (requirement 12). `cover` is a different action and never reaches `attack` (requirement 13).

## Interactions with other card types

| Other card | Result |
| --- | --- |
| Mounted Billy, Outrider (Ride) | A ride-past is cancelled. |
| Gatling Crew, Captured Dragon (Sweep) | No Sweep: the attack never lands. |
| Dynamiter (Last Stand) | No fight, so no Last Stand. |
| Cowboy Bear Trap | A Cowboy trap; unrelated to Hex, which springs only on Cowboy attacks. |
| Deadeye, Lasso | Spells do not spring traps. |
| Wizard spells, gear, locations | Separate plays; a Hex can be set in the same turn. |

## Visible results

- Set: "The Wizards set a card face down." and a `set` beat into the next trap slot.
- Spring: "Trap! The Wizards' Hex caught <name>: its attack was cancelled.", a `trap` beat on the attacker at unchanged orbs, then a `burial` beat for the Hex.

## Design notes for Fable (not requirements)

- The Hexed Mile lesson says "Send a cheap troop in first." Because Hex cancels the attack whatever the attacker, the counter is to spend the cheapest attacker on it. A player can also wait, since a Hex never expires. Both are readable choices.
