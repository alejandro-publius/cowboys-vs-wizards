# Issue 143 slice 2: saves (worker evidence)

Kiro CLI (claude-opus-5.5 worker), November 19, 2026 (America/Los_Angeles), branch `kiro/graywave-saves`, base `24dd11c`.
Build-log entry is left to the coordinator.

## Change

- `trail.js`, `progress.js`, `playtest.js` moved with `git mv` to `src/game/showdown/`, unchanged. The `prototypes/showdown/` paths re-export them, so the prototype screen, `trail-sim.mjs`, `savecode.js`, `src/match/showdown-session.js` and every prototype test run unchanged.
- `src/game/showdown/campaign-store.js`: `loadCampaign(storage)` returns the `progress.js` v2 object (v2 key, else v1 Trail key, through `migrate()`, as `prototypes/showdown/main.js` reads it) and writes nothing. `saveCampaign(storage, progress)` writes only `cvw-showdown-save-v2`, refuses a progress object the next load would reset, and keeps a stored value the load refused (damaged or newer version) once under `cvw-showdown-save-v2-refused` before replacing it. `laneCapturedCards(storage)` reads lane captures through `createProfileStore` and `earnedRewards`; it never writes `cvw-player-v1`.
- No rule, number, reward, screen, camp entry or package script changed.

## Checks run

| Command | Result |
| --- | --- |
| `node --test tests/game/showdown-campaign-store.test.js tests/game/showdown-trail-ramp.test.js` | 13 tests, 13 pass |
| `npm test` | 529 tests, 529 pass; GLB preflight passed |
| esbuild bundle (no write) of `prototypes/showdown/main.js` and `src/match/showdown-session.js` | both resolve |
| `../cli-progression/experiments/showdown-profile-compat/run.mjs` with `loadCampaign` as loader | 7 of 14 pass. A2 to A5 pass on every case; A1 fails on the 7 capture cases (Showdown `owned()` is 0), pending Fable F1/F2 |

Browser done-when 3 (win Trail 1 and 2 in a browser, reload) is pending: it needs the camp screen, which this job does not own. The Node equivalent passes in `showdown-campaign-store.test.js`.

## Pending Fable

A Captured card won in the lanes stays owned in the lane profile, which is byte-identical after Showdown loads and saves. It is not owned in the Showdown progress: `migrate()` accepts a Legendary only when the Trail is done and that bounty's `hunts` is 5, so adding it would either reset the save or advance the Trail and bounty. Decisions F1, F2 and F5 in the compat HANDOFF.md are needed; a test pins today's behaviour so the change is deliberate.
