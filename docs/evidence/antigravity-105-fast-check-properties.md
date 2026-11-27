# 105 Executed Fast-Check Properties (`PROP-001`..`PROP-085` + `rb*`/`contract*`/`stable*`)

- **Author / Tooling:** Antigravity (feature branch `antigravity/scorecard-100-properties`). No native Kiro CLI session is claimed in this note.
- **Spec:** [`.kiro/specs/dec4-hundred-properties/requirements.md`](../../.kiro/specs/dec4-hundred-properties/requirements.md) (`PROP-001..PROP-085`).
- **Scope:** Zero edits to `src/game/` or `scripts/showdown-dec4-properties.mjs` (`PROPERTIES.length === 20` preserved).

## What was executed

`node scripts/run-dec4-property-suite.mjs` runs all `20` Showdown rulebook/contract properties in [`scripts/showdown-dec4-properties.mjs`](../../scripts/showdown-dec4-properties.mjs) alongside `85` new requirement-traced `fast-check` properties executed through `node --test`:

1. [`tests/game/showdown-catalog-fast-check.test.js`](../../tests/game/showdown-catalog-fast-check.test.js) (`PROP-001`..`PROP-035`, `35` properties): catalog specs, star tributes, opening lock, Quickdraw vs free arrival rest, Guard/Ride/Base targeting, Cover overflow soak, Sweep, Last Stand, Scout, Raise, Ghostly vs Hellfire, Even Fight spell cover, Lasso stun lifecycle, Gear, symmetric Locations, Hex vs Bear Trap FIFO, turn phase locks, scheduled arrivals, `forecastAttack` / `presentAttackForecast` / `presentEvent` parity, `applyAction` purity, and bot levels `0`, `1`, `1.5`, `2` (`planTurn` hidden-deck/trap fairness).
2. [`tests/game/showdown-campaign-fast-check.test.js`](../../tests/game/showdown-campaign-fast-check.test.js) (`PROP-036`..`PROP-065`, `30` properties): Trail 16-card progression, `deckProblems` / `withDeck`, Grit cap, offer lock, `choose`, Rivals & held-back rewards, 5-hunt Wanted Bounties & Legendary exclusivity, Open Range pack cadence, `openPack`, `encodeSave` / `decodeSaveCode` round-trip + Unicode escaping + fuzz safety, `migrate` idempotence, `saveCampaign` / `loadCampaign` / `REFUSED_KEY`, and `inherited.js` keepsakes.
3. [`tests/game/poker-kit-fast-check.test.js`](../../tests/game/poker-kit-fast-check.test.js) (`PROP-066`..`PROP-085`, `20` properties): `mulberry32`, `normalizeSeed`, `shuffleDeck` 52-card bijection, `evaluateHand` card-order & suit-permutation invariance, `compareHands` total preorder axioms & 9-category hierarchy, `chooseDiscards`, 52-card deal/draw conservation, `toggleDiscard` involution, `viewState` privacy, `replayDeal` / `nextDeal`, `playPokerDuel`, `measurePairedCohort` completeness/symmetry/fail-closed errors, `wilson` bounds/shrinkage, and `evaluateBalanceRequirements`.

## Verified results

- `reports/properties/latest.json`: **`105` distinct passing `fast-check` properties** (`3,050` executed random cases at quick default seeds, `0` rejected, engine commit `93db9f3e2f3970ec8b391650199027eac1d252db`).
- `node scripts/trace.mjs --require PROP-`: **`required PROP-: all proven`** (`85/85` registered as `(property)`).
- `node scripts/scorecard.mjs --offline`: **`PASS properties value 105 target >= 100`**, plus `shall` increased from `663` to `748`.

## Reproduce

```sh
node scripts/run-dec4-property-suite.mjs --commit 93db9f3e2f3970ec8b391650199027eac1d252db
node --test tests/game/dec4-showdown-properties.test.js tests/game/showdown-catalog-fast-check.test.js tests/game/showdown-campaign-fast-check.test.js tests/game/poker-kit-fast-check.test.js tests/game/dec4-scorecard.test.js tests/game/dec4-trace.test.js tests/assets/links.test.mjs
node scripts/trace.mjs --require PROP-
node scripts/scorecard.mjs --offline
```
