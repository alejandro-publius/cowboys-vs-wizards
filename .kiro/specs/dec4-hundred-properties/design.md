# Design: Dec 4 Hundred-Property Fast-Check Verification Suite

## Architecture

1. **Preserving `scripts/showdown-dec4-properties.mjs` Contract (`20` properties):**
   - `tests/game/dec4-showdown-properties.test.js` pins `PROPERTIES.length` in `scripts/showdown-dec4-properties.mjs` to `12..20` (`20` properties). That module and its test remain untouched.

2. **Three Non-Overlapping `fast-check` Suites (`85` new properties -> `105` total):**
   - `tests/game/showdown-catalog-fast-check.test.js` (`PROP-001`..`PROP-035`, `35` properties): Showdown catalog, star tributes, opening lock, Quickdraw vs free arrival rest, Guard/Ride/Base targeting, Cover overflow soak, Sweep, Last Stand, Scout, Raise, Ghostly vs Hellfire, Even Fight spell cover, Lasso stun, Gear, symmetric Locations, Hex vs Bear Trap FIFO, turn phase locks, scheduled arrivals, `forecastAttack` / `presentAttackForecast` / `presentEvent`, `applyAction` purity, and bot levels `0`, `1`, `1.5`, `2` (`planTurn` hidden-info fairness).
   - `tests/game/showdown-campaign-fast-check.test.js` (`PROP-036`..`PROP-065`, `30` properties): Trail deck progression, `deckProblems` / `withDeck`, Grit cap, offer lock, `choose`, Rivals & held-back rewards, 5-hunt Wanted Bounties & Legendary exclusivity, Open Range pack cadence, `openPack`, `encodeSave` / `decodeSaveCode` round-trip + Unicode escaping + fuzz safety, `migrate` idempotence, `saveCampaign` / `loadCampaign` / `REFUSED_KEY`, and `inherited.js` keepsakes.
   - `tests/game/poker-kit-fast-check.test.js` (`PROP-066`..`PROP-085`, `20` properties): `mulberry32`, `normalizeSeed`, `shuffleDeck` bijection, `evaluateHand` card-order & suit-permutation invariance, `compareHands` total preorder axioms & 9-category hierarchy, `chooseDiscards`, 52-card deal/draw conservation, `toggleDiscard`, `viewState` privacy, `replayDeal` / `nextDeal`, `playPokerDuel`, `measurePairedCohort` completeness/symmetry/fail-closed errors, `wilson` bounds/shrinkage, and `evaluateBalanceRequirements`.

3. **Executed Property Receipt (`scripts/run-dec4-property-suite.mjs` -> `reports/properties/latest.json`):**
   - Runs all `20` properties from `scripts/showdown-dec4-properties.mjs` plus all `85` registered `fast-check` properties from the three suites (`105` distinct IDs), recording each property's real `id`, `file`, `status`, `numRuns`, and deterministic `seed` into `reports/properties/latest.json` (`schema: "cvw-property-receipt/1"`) with the checked-out source commit. The runner requires exactly one result for every registered ID before replacing the receipt.
