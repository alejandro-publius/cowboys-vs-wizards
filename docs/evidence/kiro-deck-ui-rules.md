# Deck workbench rule constants (issue #72)

Agent: Kiro CLI. Base: main 2400fbd.

Change: `src/ui/deck-workbench.js` now imports `DECK_SIZE` (deck-builder.js), `MAX_COWBOY_COPIES` and `tributeCost` (cards.js) in place of the literals 12, 6 and the star thresholds 5/7. Rendered text and controls are intended to be identical (same strings, same tribute tiers). No card, balance, art or dependency change.

Checks run:
- `node --test tests/game/deck-workbench-rules.test.js`: 1 pass, 0 fail. The new test is a source-level check: it asserts the constant values, the `tributeCost` tiers, the imports, and that the old literals are gone.
- `npm test`: 222 pass, 0 fail, plus the sourced-animation structure check passed.
- `npm run build`: built `dist/cowboys-vs-wizards-board-duel.html`.

Not run: `scripts/browser-deck-workbench-check.mjs` (browser check) and any visual comparison. Identical rendering is therefore not verified in a browser.
