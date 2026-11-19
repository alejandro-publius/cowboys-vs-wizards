# Issue 143 slice 1: Showdown engine move and presenter coverage

Kiro CLI worker (Opus 5.5), isolated worktree, 2026-11-19 15:10 PST (America/Los_Angeles).
Brief: [showdown-integration-kiro-brief.md](../design/showdown-integration-kiro-brief.md), slice 1, done-when items 1, 2 and 4.

## Change

- `cards.js`, `rules.js` and `contract.js` moved (git mv) from `prototypes/showdown/` to `src/game/showdown/`.
  The only edit is `cards.js` importing `../card-specs.generated.js` from its new place.
- The three prototype paths are now one-line `export *` re-exports, so `main.js`, `progress.js`,
  `trail.js`, the sims and the exporters keep working unchanged.
- `prototypes/showdown/rules.test.js` and `contract.test.js` now import the engine from
  `src/game/showdown/`; no other line changed. They stay in place because they read
  `cards.csv`, `RULEBOOK.md` and `ART-DIRECTION.md` next to them and import prototype-only
  modules (`progress.js`, `trail-sim.mjs`, `art.js`). `scripts/verify-duel.mjs` already
  discovers `prototypes/showdown/*.test.js`, so `npm test` runs them.
- New `src/game/showdown/presenter.js`: `presentEvent(event)` returns one log line per event,
  with a handler for each of the 16 `EVENTS` entries (`PRESENTERS`), and throws for a type outside
  `EVENTS` or without a handler. No DOM. Wording follows the prototype screen's `say()`, in
  neutral side names; the trap line reads the event's `stopped` field rather than the card effect.
- New `tests/game/showdown-presenter.test.js`: handler keys equal `EVENTS` keys; removing any one
  handler makes `presentEvent` throw; unknown types throw; every event from 40 seeded bot games
  (seeds 0 to 39, bot levels 0 to 2) presents as non-empty text without `undefined`/`NaN`; a
  hand-built sample of each type carries exactly the `EVENTS` fields.

## Verification (observed)

- `node --test tests/game/showdown-presenter.test.js prototypes/showdown/*.test.js`: 48 of 48 passed.
- `npm test`: 502 of 502 Node tests passed, then the GLB preflight passed.
- `npx esbuild prototypes/showdown/main.js --bundle` to /dev/null: bundled without errors.
- `src/game/showdown/` has no DOM, renderer or `node:` imports (grep).

## Pending

Browser items of slice 1 (graybox duel drawn from `viewFor`/`EVENTS`, Boot Hill winnable by clicks,
`?mode=lanes`) belong to the screen worker. No UI, build or `package.json` file was changed.
