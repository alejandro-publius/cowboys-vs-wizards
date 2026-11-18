# Graybox browser replay and input QA

Date: November 17–18, 2026 Pacific (`America/Los_Angeles`). Authored and verified by Antigravity (Gemini 4 Carbon High) in `work/kiro-card-rd/ag-replay` on branch `antigravity/graybox-replay` from base `55a395e`.

## Scope

Added one repeatable headless Chrome QA script, [browser-graybox-check.mjs](../../scripts/browser-graybox-check.mjs), covering the standalone `npm run build` graybox output against [codex-graybox.md](codex-graybox.md) and [codex-card-rd.md](codex-card-rd.md). All five steps passed against the existing `55a395e` graybox build without reproducing a product defect, so no graybox source, rules, art, Pages workflow or model files were modified.

## Commands run

```sh
npm run build
node --test tests/match/summon-forecast.test.js tests/match/selection.test.js tests/match/card-model.test.js tests/match/guide.test.js
node scripts/browser-graybox-check.mjs --summary
node scripts/check-links.mjs
```

- **Build**: `dist/cowboys-vs-wizards-board-duel.html` (`75,924` bytes, SHA-256 `9748d8a49787f971fc1a9cc6669766d2cd90731678da37cc8d8b28b6480523b8`), `0` external markup URLs, `0` external network requests during play.
- **Browser**: Headless Google Chrome `Chrome/158.0.8127.37` (Chromium revision `@b8c2be851f62f6a394ec57955d7f31335d7cb6d4`, V8 `15.8.62.31`; an earlier pass before Chrome auto-updated ran on `Chrome/157.0.8103.79`) driven via Chrome DevTools Protocol over Node `v26.0.0` built-in `WebSocket` on Apple M1 (`MacBookPro17,1`, 16 GB, macOS `15.1.1`).
- **Errors**: `0` console errors, `0` uncaught exceptions, `0` log warnings.

## Observed results

1. **Fresh profile and 12-card workbench (`1440 × 900`)**: Loaded `dist/cowboys-vs-wizards-board-duel.html` over `file://` in a fresh temporary `--user-data-dir` (`localStorage.getItem("cvw-player-v1") === null`). Opened `Build Deck` by real click, observed the four starter rows totaling `12` cards (`6` Sheriff, `3` Billy, `1` Mounted Billy, `2` Deadeye), and returned via `Main menu` with storage still empty.
2. **Guided seed 0 and summon cancellation**: Started `How to Play` → `Start guided duel` (`Seed 0 (pinned)`). Observed the visible idle guide hint, `4` starter cards (`Mounted Billy`, `Deadeye`, `Sheriff`, `Billy`), `6` empty lanes, `0` idle forecasts, and one five-marker `.plain-orbs` row on each Base (`Base 5/5`). Selecting `Sheriff` showed `"Enemy base 5 → 4"` on all three Cowboy lanes; choosing center `Lane 2` narrowed the preview to `Lane 2`. Cancelling via the `Cancel` button and again via `Escape` (`defaultPrevented: true`; pressing `Escape` while the Duel menu `<dialog>` was open closed only the dialog and kept the active selection) removed all `.plain-forecast` previews (`0` in DOM) and left the `4`-card hand and empty center lane unchanged. Summoning `Sheriff` into `Lane 2` placed `Sheriff` at `3/3` orbs, reduced the hand to `3` cards, and cleared previews; `End turn` returned control at `Round 2 · Cowboy phase (you) · Seed 0` matching engine state (`Sheriff 1/3` vs `Skeleton 2/3` after Wizard `Singularity`, with `Round 1 clash` logged).
3. **Seed 60 showcase route and mid-selection cancellations**: Opened the Duel menu (`☰`), typed `60` into `Seed to replay`, and clicked `Replay`.
   - Cancelled a Round 1 `Sheriff` selection in `Lane 1` (`"Skeleton 3 → 2 · Sheriff 3 → 2"` preview) and confirmed `0` previews remained with hand and lanes unchanged before continuing the same match.
   - **Normal summon (Round 1)**: `Sheriff` entered `Lane 1` at `3/3` orbs (`0` previews after confirm).
   - **Deadeye (Round 2)**: Summoned `Sheriff` in `Lane 2`; selected `Deadeye` (`0` forecasts during spell steps) and reduced Wizard `Skeleton` in `Lane 1` from `2/3` to `1/3` orbs before Round 2 clash defeated it.
   - **One tribute (Round 3)**: Selected `Billy` (`0` forecasts before tribute choice, `2` forecasts once `Lane 1` was chosen), sacrificed `Lane 1` (`Empty`), and placed `Billy` in `Lane 3` at `4/4` orbs.
   - **Two tributes and cancel check (Round 4)**: Selected `Mounted Billy` plus tributes in `Lane 2` and `Lane 3`, observed `3` lane previews, cancelled via `Cancel` (`0` previews, `0` pressed tributes, `Sheriff` and `Billy` unchanged), then re-selected and summoned `Mounted Billy` into `Lane 3` at `5/5` orbs with `Lane 1` and `Lane 2` empty.
   - **Singularity (Round 4 → Round 5)**: Ending Round 4 logged `"Singularity hit your Mounted Billy in lane 3: 5 → 4 orbs, then moved it to lane 2"` in `Round 4 clash` and positioned `Mounted Billy` (`3/5`) opposite `Dragon` (`5/5`) in center `Lane 2`.
   - **Round-5 showdown → Round 6**: Summoned `Sheriff` in `Lane 1` and ended Round 5. Observed both hits in `Round 5 clash` (`"Your Mounted Billy in lane 2 hit the Dragon: 5 → 2 orbs"`, `"Dragon in lane 2 hit your Mounted Billy: 3 → 0 orbs"`, `"Your Mounted Billy in lane 2 was defeated"`), Wizard center `Lane 2` showing `Dragon` at `2/5` (`orbRows: 1`, `2` filled of `5`), Cowboy center `Lane 2` `Empty` (`orbRows: 0`), and **one set of five markers per Base** (`Base 2/5`, `orbRows: 1`, `orbsTotal: 5`, `orbsFilled: 2` on both Bases).
4. **Replay repeatability**: Restarted `Seed 60` via the Duel menu `Restart` button and replayed Rounds 1–5 without cancellations; Round 6 lanes, Base marker counts, hand IDs, and `Round 5 clash` lines matched the cancelled-first replay identically.
5. **Narrow viewport (`390 × 844`, mobile emulation)**: Checked at Round 6 (`3`-card hand), after `Restart` (`4`-card opening hand), and with `Sheriff` selected (`3` active forecasts + `4`-card hand). Observed `scrollWidth === 390` (no horizontal overflow), all `6` lanes inside `[0, 390] × [0, 844]` with no overlap (`115.5 × 88` px minimum), and the complete hand inside `[0, 390] × [0, 844]` with no overlap or horizontal clipping (`176.6 × 84` px minimum).

## Environmental blockers and notes

- **Worktree sandbox boundary**: In Antigravity's default command sandbox, worktree symlinks outside `ag-replay` (`node_modules` and `.git` in the parent checkout) and loopback CDP WebSocket connections (`ws://127.0.0.1:<port>`) are blocked by sandbox isolation. Running `npm run build`, `node scripts/browser-graybox-check.mjs`, `node scripts/check-links.mjs`, and `git` with approved unsandboxed execution completed without blockers.
- **Session flag observation**: Starting `Start guided duel` sets `guided = true` in `src/graybox.js`, and replaying another seed via the Duel menu `Replay` form retains that flag until a match terminates (matching `src/main.js`). It did not block any Seed 60 or cancellation contract.

## Local receipts (gitignored)

- JSON report: `.artifacts/card-rd/graybox-replay/browser-run.json`
- Screenshots: `.artifacts/card-rd/graybox-replay/01-guided-seed-0-previews.png` through `.artifacts/card-rd/graybox-replay/06-narrow-viewport-390x844.png`
