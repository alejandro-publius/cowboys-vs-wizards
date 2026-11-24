# Design: Sheriff's Office (`cowboy-sheriffs-office`)

Author: Kiro (native Kiro CLI). Describes the current data path and runtime behaviour; proposes no change.

## Data path

`.kiro/specs/duel-card-pipeline/cards/cowboy-sheriffs-office.json` (`order: 15, kind: "location", showdownOnly: true, showdown: {rarity: "rare", effect: "office"}`) appears only in `SHOWDOWN_SPECS`. `EFFECTS.office` is `{tag: "Lawman", text: "Location. Lawman troops have +1 attack."}`.

## Runtime behaviour

- Legal plays: gated by `castUsed`, and skipped when `cardOf(state.location.cardId).name` equals "Sheriff's Office".
- Resolution: the previous location, if any, goes to `next.sides[next.location.side].discard` (its owner's), then `next.location = {cardId, side}`. The Office itself is not discarded while it is in play.
- Effect: `attackOf` adds 1 when `EFFECTS[cardOf(location).effect].tag === card.tag`. Lawman Cowboy troops: Sheriff, Outrider, Ranger. The +1 reaches fights, direct Base strikes, hit backs and the bot's `evaluate`. A ride-past stays 1 orb.
- Bot: `evaluate` scores a location held by the side +2 and one held by the other side -2.

## Events and visible text

- `location` event `{side, cardId}`; `PRESENTERS.location`: "The Cowboys' Sheriff's Office is now the location."

## Deck and progress contexts

| Context | Source | Copies |
| --- | --- | --- |
| Even match | `DECKS.cowboy` | 0 |
| Rival reward | `RIVALS[1]` The Imp: `reward: ["cowboy-sheriffs-office"], packs: 1` | +1 on the first win |
| Offers and packs | `pool()` holds it back until The Imp is beaten | eligible while owned < 2 |
| Custom deck cap | `RARITY.rare` | 2 |

The Bonewright rival's lesson ("A location of your own replaces it") points at this card as the answer to the Boneyard.

## Art

Painting `assets/cards/illustrated/cowboy-sheriffs-office.webp`; brief `LOOK["cowboy-sheriffs-office"]`. This spec changes no art.
