# Fast pace preview (issue #64)

Author: Kiro CLI 3.4.0 V3. Date: 2026-11-17 (America/Los_Angeles). Source: https://github.com/alejandro-publius/cowboys-vs-wizards/issues/64, pacing section of `.kiro/specs/trap-zone/design.md`.

## Change
- `src/match/pace.js`: `paceOptions(value)` returns `{}` unless the value is exactly `fast`.
- `src/main.js`: spreads `paceOptions(params.get("pace"))` into `createController`. Without `?pace=fast` the call is unchanged.
- `tests/match/pace.test.js`: five focused tests.

Applied with `?pace=fast`: `cpuDelay` 600 to 250, `round-start` 500 to 250, `phase-start` 350 to 150, `phase-end` 150 to 80.

## Not applied (blocker)
`draw` 250 to 120 and visible draw 450 to 300. In `src/match/presenter.js`, `pauses.draw` replaces both the hidden and visible draw wait, so one override would cut the Cowboy card flight to 120 ms. Applying them needs a presenter change, outside the owned paths. The values are named in `FAST_PACE` for that follow-up. `clash`, `result`, damage and defeat pauses and all cue lengths are untouched.

## Checks run (all observed)
- `node --test tests/match/pace.test.js`: 5 of 5 pass. The order test plays seeds 0 and 60 CPU-vs-CPU through the real presenter with a fixed-cue renderer. The renderer call sequence is identical at default and fast pace, and fast finishes earlier on the fake clock.
- `npm test`: 221 of 221 pass, plus the Dragon and Mounted Billy GLB structure check.
- `npm run build -- --web`: built `dist/web/index.html`.
- Headless Chrome 157 via `scripts/browser-match-check.mjs`, served from `dist/web` over local HTTP, receipts in `/tmp` (not committed). Build SHA-256 c10f9e02ea888b1cb2fbc4e822b3ee90f386448445f076d03f800aa7aef3f2dd.
  - Seed 0, default URL: 8 of 8 steps observed, 0 console errors.
  - Seed 0, `&pace=fast`: 8 of 8 steps observed, 0 console errors.
  - Seed 60 `--showcase`, default URL: 4 of 4 steps observed, 0 console errors.
  - Seed 60 `--showcase`, `&pace=fast`: 4 of 4 steps observed, 0 console errors.

## Not measured
No wall-clock time saving was measured in the browser, and no side-by-side visual comparison of attack, clash, damage and defeat order was made. Order parity is established by the Node test only.
