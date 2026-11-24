# Design: Sheriff (`cowboy-sheriff`)

Author: Kiro (native Kiro CLI). Describes the current data path and runtime behaviour; proposes no change.

## Data path

1. Source JSON `.kiro/specs/duel-card-pipeline/cards/cowboy-sheriff.json`:
   `{type, side: "cowboy", order: 1, name: "Sheriff", kind: "troop", stars: 2, health: 3, attack: 1, copies: 6, showdown: {rarity: "basic", tag: "Lawman", keys: []}}`.
2. `scripts/sync-card-specs.mjs` validates it (`validateSpec` troop fields, `validateShowdown`) and writes two rows to `src/game/card-specs.generated.js`:
   - `CARD_SPECS` (retired lane catalog): `order`, `copies: 6`. The Cowboy lane `copies` must still total 12, so this field is load-bearing for the generator check even though no current build plays the lane.
   - `SHOWDOWN_SPECS`: `{type, side, name, kind, stars, attack, health, rarity, tag, keys}`.
3. `src/game/showdown/cards.js` `entry()` turns the Showdown row into `TYPES["cowboy-sheriff"]` with `bounty: false` and `keys: []`. Copies in play are ids `cowboy-sheriff-<n>` from `deckIds`.

## Runtime behaviour (src/game/showdown/rules.js)

| Concern | Code | Sheriff result |
| --- | --- | --- |
| Cost | `tributes()` in cards.js: stars < 5 is 0 | free; `combinations(occupied, 0)` gives one `tributes: []` option |
| Board space | `legalActions`: `occupied.length - paid.length < BOARD_SIZE` | no summon onto a full board (3 slots) |
| Resting | `arrive(..., {paid: false})` sets `ready: false`; `canAttack` rejects `arrived === turn && !ready` | cannot attack on arrival turn; may take cover |
| Attack value | `attackOf`: card attack + gear `EFFECTS[...].attack` + 1 if location tag matches | 1; 2 with Sheriff's Office (tag Lawman, either side); 2 with a Six-Shooter |
| Fight | `attackOutcome` / `attack` | 1 damage; takes the survivor's attack as hit back |
| Tribute | `applyAction` summon branch: `defeat(own, slot)` before `arrive` | goes to discard with any gear, `tribute` event |

The Sheriff has no keyword, so Guard, Ride, Sweep, Last Stand, Scout, Raise, Quickdraw and Ghostly do not apply to it. Those are not listed as requirements because they would be vacuous.

## Events and visible text

- `summon` event: "The Cowboys' Sheriff arrived."
- `tribute` event: "The Cowboys' Sheriff was paid as tribute." (`PRESENTERS.tribute`)
- `attack` event text follows `attackText` in presenter.js with the Sheriff's name.

## Deck and progress contexts

| Context | Source | Sheriff copies |
| --- | --- | --- |
| Even match / two players default | `DECKS.cowboy` in cards.js | 4 |
| New player's starter | `STARTER` in trail.js | 8 |
| After Trail duel 1 (Boot Hill, Covered Wagon x2) | `TRAIL[0].reward` | 6 |
| After Trail duel 2 (Raven Roost, Outrider x2) | `TRAIL[1].reward` | 4 |
| After Trail duel 4 (Imp Hollow, Dynamiter x1) | `TRAIL[3].reward` | 3 |
| Custom deck | `deckProblems` | any count; basic means `owned` is `Infinity` and the cap is `Infinity` |
| Offers and packs | `pool()` | never offered |
| Lane catalog (retired) | `CARD_SPECS` | `copies: 6`, `order: 1` |

## Art

Existing paintings: `assets/cards/illustrated/cowboy-sheriff.webp`, `assets/cards/sheriff-card.webp`, `assets/cards/sheriff-storybook.webp`, `assets/cards/sheriff.webp`. The brief is `LOOK["cowboy-sheriff"]` in `prototypes/showdown/art.js`. The art-direction test lists the Sheriff among the six troops that already have a model. This spec changes no art.

## Design notes

- The Sheriff is the reference troop: the cards.csv row reads "No keyword." Its value comes from being free, being a cheap tribute and gaining from Sheriff's Office.
- A Night Shift review of health 3 to 4 was rejected (`src/ui/sheriffs-ledger.data.js`, bundle `docs/evidence/night-shift/guard-sheriff-health-3-to-4/bundle.json`). Any further tuning goes to Fable.
