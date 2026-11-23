# Design: Mounted Billy (`cowboy-mounted-billy`)

Author: Kiro (native Kiro CLI). Describes the current data path and runtime behaviour; proposes no change.

## Data path

`.kiro/specs/duel-card-pipeline/cards/cowboy-mounted-billy.json` (`stars: 7, health: 5, attack: 3, copies: 1, rides: true, showdown: {rarity: "rare", tag: "Outlaw", keys: ["ride"]}`) becomes `TYPES["cowboy-mounted-billy"]`. The Showdown engine reads `keys`; `rides` and `copies` are lane-only.

## Runtime behaviour

- Cost: `tributes()` returns 2 (7 stars). Summons are `combinations(occupied, 2)`; it arrives `ready` and may strike at once.
- Ride: `targetsFor` adds `"base"` when the enemy has troops and no Guard. `attackOutcome` makes a ride-past 1 orb whatever the attack. A Guard troop removes the Base option (shown for the Outrider in the Guard test).
- Fights: 3 attack, 5 orbs, the largest orb count of any Cowboy troop. Spill past the target's last orb reaches the Base unless the target is in cover.
- Cover: a Mounted Billy in cover does not hit back; the `attack` event reports `hitBack: 0`.
- Sheriff's Office does not apply (Outlaw).

## Deck and progress contexts

| Context | Source | Copies |
| --- | --- | --- |
| Even match | `DECKS.cowboy` | 1 |
| Trail reward | `TRAIL[4]` The Hexed Mile: `["cowboy-mounted-billy", "cowboy-billy", 1]` | +1 for a Billy |
| Custom deck cap | `RARITY.rare` | 2 |
| Offers and packs | `pool()`, weight 1 | eligible while owned < 2 |
| Lane (retired) | `CARD_SPECS` `copies: 1`, `rides: true` | not used by Showdown |

## Art

Paintings `assets/cards/illustrated/cowboy-mounted-billy.webp` and `assets/cards/mounted-billy-card.webp`; it has a model (art-direction test). This spec changes no art.
