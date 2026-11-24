# Design: Six-Shooter (`cowboy-six-shooter`)

Author: Kiro (native Kiro CLI). Describes the current data path and runtime behaviour; proposes no change.

## Data path

`.kiro/specs/duel-card-pipeline/cards/cowboy-six-shooter.json` (`order: 14, kind: "gear", showdownOnly: true, showdown: {rarity: "uncommon", effect: "sixshooter"}`) appears only in `SHOWDOWN_SPECS`. `EFFECTS.sixshooter` is `{attack: 1, orbs: 0, text: "Gear. The troop that carries it has +1 attack."}`.

## Runtime behaviour

- Legal plays: `for (const slot of slots) if (own.board[slot]) actions.push({type: "gear", cardId, slot})`, gated by `castUsed`, so gear shares the one "other card" with spells and locations.
- Resolution: the id is pushed onto `troop.gear`; `troop.health += EFFECTS.sixshooter.orbs` adds 0.
- Attack: `attackOf` sums `EFFECTS[...].attack` over every carried gear id, so copies stack across turns. Attack feeds fights, Base strikes on an empty board and hit backs (`attackOutcome` uses `attackOf` for the defender). A ride-past stays 1 orb.
- Removal: `defeat()` pushes the troop id, then its gear ids, to the owner's discard. The summon branch calls `defeat()` for tributes, so gear leaves with a tribute too.

## Events and visible text

- `gear` event `{side, cardId, target}`; `PRESENTERS.gear`: "The Cowboys' <troop> now carries Six-Shooter."

## Deck and progress contexts

| Context | Source | Copies |
| --- | --- | --- |
| Even match | `DECKS.cowboy` (comment: "Gear and locations are earned") | 0 |
| Rival reward | `RIVALS[0]` The Stargazer: `reward: ["cowboy-six-shooter"], packs: 1` | +1 on the first win |
| Offers and packs | `pool()` holds back an unbeaten rival's reward | eligible after the Stargazer, while owned < 3 |
| Custom deck cap | `RARITY.uncommon` | 3 |

## Art

Painting `assets/cards/illustrated/cowboy-six-shooter.webp`; brief `LOOK["cowboy-six-shooter"]`. This spec changes no art.
