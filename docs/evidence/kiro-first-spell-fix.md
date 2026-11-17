# First Spell fix (issue #59, first item)

Worker: Kiro CLI. Date: 2026-11-14 (America/Los_Angeles).

- Problem: `src/main.js` recorded a spell only when `action.type==="cast"`, but the engine's spell action type is `"spell"`, so First Spell never unlocked.
- Change: `src/main.js` now checks `action.type==="spell"`.
- Test: `tests/game/player-profile.test.js`, "an accepted Cowboy spell action records progress and unlocks First Spell". It applies a real Cowboy spell through `applyAction`, checks the main.js hook condition matches the engine's `spell` type, then records it in the profile store and checks `stats.spells === 1` and the `first-spell` achievement.
- Limit: the hook is inline in `main.js`, so the test checks it by source pattern, not by running it.
- Verified: with the old `"cast"` condition the new test fails (12 pass, 1 fail); with the fix `node --test tests/game/player-profile.test.js` passes 13/13. `npm test` passes 201/201.
- Browser: `scripts/browser-menu-check.mjs` not run and not extended. It needs a built page and a seeded UI path to a Cowboy spell, which was too costly here. Pending.
- Not addressed: other findings in issue #59.
