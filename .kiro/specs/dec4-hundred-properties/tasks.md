# Tasks: Dec 4 Hundred-Property Fast-Check Verification Suite

- [x] 1. Author `PROP-001`..`PROP-085` in `.kiro/specs/dec4-hundred-properties/requirements.md`.
- [x] 2. Implement `tests/game/showdown-catalog-fast-check.test.js` (`PROP-001`..`PROP-035`).
- [x] 3. Implement `tests/game/showdown-campaign-fast-check.test.js` (`PROP-036`..`PROP-065`).
- [x] 4. Implement `tests/game/poker-kit-fast-check.test.js` (`PROP-066`..`PROP-085`).
- [x] 5. Implement `scripts/run-dec4-property-suite.mjs` and generate `reports/properties/latest.json` (`105` distinct passing `fast-check` properties).
- [x] 6. Verify `node --test`, `node scripts/trace.mjs --require PROP-`, and `node scripts/scorecard.mjs --offline` (`PASS properties value 105 target >= 100`).
