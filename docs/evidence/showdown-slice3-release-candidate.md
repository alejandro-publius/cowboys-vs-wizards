# Issue 143 slice 3 release candidate (`kiro/graywave-assemble`)

Kiro CLI coordinator job `graywave-assemble` (Claude Opus 5.5), November 19 to 20, 2026, America/Los_Angeles. Base: GitHub `main` `4d52642` (merge of #148). Rulings: Fable on [PR 148](https://github.com/alejandro-publius/cowboys-vs-wizards/pull/148#issuecomment-7031816529) and [issue 143](https://github.com/alejandro-publius/cowboys-vs-wizards/issues/143#issuecomment-7031863563).

## What was combined

| Source | Commits | Worker report |
| --- | --- | --- |
| `kiro/graywave-modes` (PR #159) | `e4d0f89`, `605e826` | `../graywave-modes.md` |
| `kiro/graywave-retire` | `4ebbb16` (the removal commit), `ec6d35a` (brief) | `../graywave-retire.md` |
| `kiro/graywave-topology` | `0ea47da` | `../graywave-topology.md` |
| `kiro/graywave-cleanup` (based on retire) | `738e041` | `../graywave-cleanup.md` |

Each branch was merged with `--no-ff`, so every worker commit, including the removal commit, stays separate in history. One conflict: `src/app.js` (modes added Camp modes under a lane branch; retire removed the lane branch). Resolution: retire's Showdown-only entry with modes' full Camp body. Coordinator commits on top: the hosted build drops its lane-chunk path and the staged-tree check asserts no lane chunk (#157 follow-up); docs and routing.

The removal commit `4ebbb16` changes 0 files under `src/game/showdown/`. No change to `prototypes/showdown/RULEBOOK.md`, Showdown rules or cards, Scout, models or art.

## Checks run on the combined tree (coordinator, this checkout)

Machine checks only. Bot and scripted mouse/keyboard runs support flow, storage and privacy claims, not clarity or fun.

- `npm test`: 578 tests, 578 pass, 0 fail, 0 todo; GLB structure preflight 2/2. `sh scripts/check-card-specs.sh`: exit 0.
- CI's other steps: `npm run build -- --web`, Kiro review server tests 4/4, Night Watch unit tests OK.
- Graybox build (`node scripts/build-graybox.mjs`), sha256 `6016652335e1f1421ab94153e988f5d1accd9d59905bc1cfdb5e738781fe7afd`, headless Chrome:
  - `browser-showdown-check` 22/22: Play opens the Camp, Boot Hill won with clicks, seat privacy, and every retired lane URL (`?mode=lanes`, `match`, `ride-out`, `practice-*`, `fire-arc`, guided and rideOut variants) opens the Showdown menu with no lane board.
  - `browser-showdown-modes-check` 13/13: gated new profile, packs, deck builder and side deck, rival, repeat bounty to capture, best of three with a side deck, two-player hotseat, save code and Start over.
  - `browser-showdown-trail-check` 16/16: Trail wins paid and kept after reload; the lane veteran's capture shows as a keepsake and is not carried.
  - `browser-showdown-keyboard-check` 6/6: keyboard-only win and mouse play.
  - `browser-showdown-cues-check`: all 5 ok.
- Staged Pages tree, as CI does it: `node scripts/stage-pages.mjs --commit <HEAD>` then `node scripts/check-pages-tree.mjs --commit <HEAD>` (4/4) and with `--browser` (8/8, no page error, failed request or HTTP error). The root `index.html` hashes to the same `6016652…` as the offline file, so the offline checks above apply to the hosted bytes. `/graybox/` is the same bytes, and neither path has a `chunks/` directory. `/3d/` is labelled, its 27 relative assets resolve, its 14 models are glTF binaries and all load in Chrome (SwiftShader).
- The `/3d/` page served under `/cowboys-vs-wizards/3d/`: `browser-menu-check ?seed=0` and `browser-board-accessibility-check ?seed=0` exit 0. `browser-match-check --seed 0 --swiftshader` observes 7 of 8 steps with 0 console errors. Step 2 is pending because the six newer cards have no art; the retire and topology workers recorded the same 7 of 8 on unchanged `main`.

## Lane files that remain, and the 3D import that keeps each

From the retire worker's metafile trace (`../graywave-retire.md`), shortest path from `src/main.js`:

- `game/state.js`, `game/cpu.js`, `game/deck-builder.js`, `game/deck-presets.js`, `game/opening-policy.js`: main.js imports each
- `game/clash.js`, `game/lanes.js`: main.js → game/cpu.js
- `game/actions.js`, `game/legal.js`, `game/view.js`: main.js → match/controller.js
- `game/cards.js`: main.js → render/match-board.js
- `game/card-specs.generated.js`: main.js → game/deck-builder.js
- `game/bounty-hunt.js`: main.js → profile/player-profile.js; `game/bounty-notices.js`, `game/wraith-notices.js`: … → game/bounty-hunt.js
- `match/controller.js`, `clash-log.js`, `guide.js`, `pace.js`, `scheduler.js`, `profile/player-profile.js`, `ui/cards.js`, `ui/card-model.js`, `ui/title-menu.js`: main.js imports each
- `match/presenter.js`, `match/selection.js`: main.js → match/controller.js
- `ui/card-art.js`, `ui/card-frames.js`: main.js → ui/cards.js
- `ui/deck-workbench.js`, `ui/wanted-board.js`: main.js → ui/title-menu.js
- `render/*`, `physics/gravity.cjs`: 3D-only, unchanged

The Showdown keepsake read also reaches lane code: `src/game/showdown/campaign-store.js` → `profile/player-profile.js` → `game/bounty-hunt.js` (reads `cvw-player-v1`, never writes it).

## Not verified, or pending

- Human playtests (three first-time players): pending.
- Fable's approval of first-draft wording: Camp and mode labels, the `/3d/` label.
- The Pages workflow on GitHub and the live `verify-live` job run only after a merge to `main`.
- Best of three reached 2-0 in the browser; the third-game path is covered by unit tests only.
- `browser-deck-workbench-check` fails its 13px assertion on the unchanged `/3d/` page (pre-existing, owner decision).
