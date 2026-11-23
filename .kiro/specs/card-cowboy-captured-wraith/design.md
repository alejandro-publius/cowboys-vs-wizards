# Design: Captured Wraith (`cowboy-captured-wraith`)

Author: Kiro (native Kiro CLI). Describes the current data path and runtime behaviour; proposes no change.

## Data path

`.kiro/specs/duel-card-pipeline/cards/cowboy-captured-wraith.json` (`order: 6, stars: 3, health: 2, attack: 2, copies: 0, bounty: true, showdown: {rarity: "legendary", tag: "Undead", keys: ["ghostly"]}`) becomes `TYPES["cowboy-captured-wraith"]` with `bounty: true`.

## Runtime behaviour

- Cost: free (3 stars); rests on arrival.
- Ghostly: the spell branch of `legalActions` skips a Ghostly troop for every spell whose effect has `target: true` (Singularity, and on the other side Deadeye and Lasso). Hellfire has `target: false` and its branch hits every enemy troop, Ghostly included.
- Traps and attacks: the trap block in `attack()` and fights do not read `ghostly`.
- Undead tag: the Wizards' Boneyard (`EFFECTS.boneyard`, tag Undead) adds 1 attack to every Undead troop on both sides, so it also raises the Captured Wraith. Sheriff's Office does not apply.

## How it is earned

`BOUNTIES[0]` (`lantern-wraith`): the Lantern Wraith opens on the Wizard board with 4, 5, 6, 7, 8 orbs over the five hunts. The fifth win sets `earned.captured` to `cowboy-captured-wraith`.

| Context | Copies |
| --- | --- |
| Even match, starter, Trail | 0 |
| Bounty capture | 1 |
| Custom deck cap (`RARITY.legendary`) | 1 |
| Offers and packs | never |

## Art

Painting `assets/cards/illustrated/cowboy-captured-wraith.webp`; brief `LOOK["cowboy-captured-wraith"]`. This spec changes no art.
