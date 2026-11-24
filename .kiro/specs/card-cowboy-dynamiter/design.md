# Design: Dynamiter (`cowboy-dynamiter`)

Author: Kiro (native Kiro CLI). Describes the current data path and runtime behaviour; proposes no change.

## Data path

1. Source JSON `.kiro/specs/duel-card-pipeline/cards/cowboy-dynamiter.json`:
   `{order: 9, kind: "troop", stars: 3, health: 1, attack: 3, copies: 0, limit: 2, showdown: {rarity: "uncommon", tag: "Outlaw", keys: ["laststand"]}}`.
2. `scripts/sync-card-specs.mjs` accepts `copies: 0` because it is a Cowboy card with a `limit` (a collectible). It writes a `CARD_SPECS` row (lane, retired) with `limit: 2` and a `SHOWDOWN_SPECS` row.
3. `src/game/showdown/cards.js` `entry()` checks `laststand` against `KEYWORDS` and builds `TYPES["cowboy-dynamiter"]`.

Showdown reads `stars`, `attack`, `health`, `tag`, `keys` and `rarity`. It does not read `limit`, `copies` or `order`.

## Runtime behaviour (src/game/showdown/rules.js)

The Dynamiter is a free troop (`tributes()` is 0 for 3 stars) that rests on arrival. Its one rule is Last Stand, applied inside `attack()` after the fight's orbs are set:

```
for (const [fallen, standing] of [[defender, attacker], [attacker, defender]]) {
  if (fallen.health === 0 && standing.health > 0 && has(fallen.cardId, "laststand")) {
    standing.health -= 1;
    events.push({type: "laststand", ...});
  }
}
```

Consequences used by the requirements:

| Situation | Code path | Result |
| --- | --- | --- |
| Dynamiter attacks and survives the fight | `targetLeft === 0`, no hit back | stays on 1 orb; no Last Stand |
| Dynamiter attacks and falls to the hit back | `attackerLeft === 0` | target loses 1 more orb |
| Dynamiter is attacked and falls | `targetLeft === 0` | attacker loses 1 orb; spill to the Base is `attack - 1` unless in cover |
| Dynamiter in cover falls | `cover` affects only `baseDamage` and hit back | Last Stand still fires; no spill |
| Fight with a Jack-o'-Lantern | first pass fires the Jack's Last Stand, second pass finds no standing troop | both fall, one `laststand` event |
| Spell, Hellfire, Sweep, tribute | `applyAction` spell branch, Sweep loop, summon tribute loop | these call `defeat()` directly and never reach the Last Stand loop |
| Hex | `attack()` returns after `stopped` | no fight, so nothing fires |
| Bear Trap | Cowboy trap; the Wizards hold only Hex | not applicable to a Cowboy attacker |

`attackOutcome` excludes Last Stand (its comment says so), so a screen preview of a Dynamiter fight shows the fight only, not the extra orb.

## Events and visible text

- `laststand` event `{side, cardId, target, left}`: `side` is the Dynamiter's owner whether it attacked or defended.
- `PRESENTERS.laststand`: "Last Stand: Dynamiter took an orb off <target><, defeating it>."
- Keyword text (cards.csv and RULEBOOK section 9): "When it is defeated in a fight, the troop that fought it loses 1 orb."

## Deck and progress contexts

| Context | Source | Dynamiter copies |
| --- | --- | --- |
| Even match default | `DECKS.cowboy` | 1 |
| Starter | `STARTER` | 0 |
| Trail reward | `TRAIL[3]` Imp Hollow: `["cowboy-dynamiter", "cowboy-sheriff", 1]` | +1, replaces a Sheriff |
| Custom deck cap | `RARITY.uncommon` | 3 across deck and side deck |
| Offers and packs | `pool()`, weight 3 | eligible while owned < 3 and (on the Trail) already met |
| Lane catalog (retired) | `CARD_SPECS` `limit: 2`; `FRONTIER_UNLOCKS` in `src/game/deck-presets.js` (5 wins) | not used by Showdown |

The Imp Hollow lesson teaches that an Imp strikes on arrival. Against an Imp (3 attack, 1 orb) a Dynamiter in the open trades one for one and lets 2 orbs through (requirement 07). Cover keeps those orbs off the Base.

## Art

Painting: `assets/cards/illustrated/cowboy-dynamiter.webp`. Brief: `LOOK["cowboy-dynamiter"]` in `prototypes/showdown/art.js` ("the burning fuse is the whole story"). The Jack-o'-Lantern brief calls itself the Dynamiter's mirror. No 3D model is listed for it. This spec changes no art.
