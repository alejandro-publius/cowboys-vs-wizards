# Kiro match UI evidence

Performed by Kiro (Kiro spec task execution, orb-duel spec). Later tasks append their checkpoints here.

## Task 5 checkpoint: pure match modules

- Date: 2026-11-15, 12:14 PST.
- Commit: `b3c77bd` (`git rev-parse --short HEAD`) on `codex/repo-layout`. Kiro's work is uncommitted: `src/match/` and `tests/match/` are untracked files on top of that commit, so the commit alone does not contain the code tested here.
- Runtime: Node v26.0.0.
- Scope: `src/match/selection.js`, `scheduler.js`, `presenter.js` and the new `controller.js`, with their tests in `tests/match/`. Fable's Engine (`src/game/`) and the asset auditor were not edited.

| Command | Tests | Pass | Fail |
| --- | --- | --- | --- |
| `node --test "tests/match/*.test.js"` | 31 | 31 | 0 |
| `node --test "tests/game/*.test.js"` | 38 | 38 | 0 |
| `node --test "tests/assets/*.test.mjs"` | 15 | 15 | 0 |

Each command ran once and passed on its first run. No fixes were needed.

The 31 match tests are 21 that existed before task 4 (selection, scheduler, Presenter) and 10 new controller tests in `tests/match/controller.test.js`:

- Property 5 (cancellation), seeds 0 to 99. Diagnostic from the run: 12 cuts with a CPU request queued, 61 cuts during clash playback, 54 of them restarts from inside an impact callback.
- Property 6 (CPU information limit), seeds 0 to 99.
- Eight examples, one of which plays seeds 0 to 99 to a result. In that run the Cowboy (driven by `chooseAction`) had 50 wins, 35 losses and 15 draws. These counts describe the test walk only, not game balance.

Not covered here: browser behaviour, rendering, layout and the card overlay (tasks 6 to 10).

## Tasks 6 and 7: card overlay, card back, orbs and match board

- Date: 2026-11-15, 12:49 PST.
- Commit: `b3c77bd` on `codex/repo-layout`. The work is still uncommitted, so the commit alone does not contain it.
- Runtime: Node v26.0.0, three 0.180.0. No dependency or package file changed.
- New files: `src/ui/card-model.js`, `src/ui/cards.js`, `src/render/orbs.js`, `src/render/match-board.js`, `tests/match/card-model.test.js`, `tests/match/orbs.test.js` and `assets/cards/card-back.png`.
- Edited files:
  - `src/render/scene.js`: `export` added to `fit`, `surface`, `setBoard`, `attachPistol`, `attachStaff`, `lighting`, `makeEffects`, `drawKeys`, `staffKeys` and `motion`, plus a new `createBoardScene`. `createDuel` is unchanged and the diff removes no other line.
  - `scripts/build.mjs`: one `@@CARDBACK@@` replacement before `@@SCRIPT@@`.
  - `src/ui/layout.html`: `#match` styles and an empty hidden `<section id="match">`. No demo line was removed.

### A1 card back import

| | File | Pixels | Bytes | SHA-256 |
| --- | --- | --- | --- | --- |
| Source | `~/Downloads/Amethyst Horseshoe Arcana.png` | 1060x1484 | 3,467,714 | `3f73ed46bd9c4822ccc921752db0b442e088461237833b1fc30871bdca7e66aa` |
| Imported | `assets/cards/card-back.png` | 530x742 | 815,988 | `7f29fdd6751755b8bf32f0618c973fedacf54fe0f91970cae92aa669e63d2a2f` |

- Command: `sips -Z 742 "$HOME/Downloads/Amethyst Horseshoe Arcana.png" --out assets/cards/card-back.png`. The image was scaled only, with no pixel edits.
- The outer margin is transparent (alpha 0), not white. CSS shows the image with `background-size: contain` and a `drop-shadow` filter, so nothing is clipped.
- The bytes embedded in the built HTML (`--card-back:url("data:image/png;base64,...")`) have the SHA-256 of the imported file. The build leaves no `@@...@@` placeholder.
- The visual check of the deck pile and the Wizard hand is deferred to task 10. Task 8 mounts the overlay.

### Checks

| Command | Result |
| --- | --- |
| `node --test "tests/match/card-model.test.js" "tests/match/orbs.test.js"` | 10 tests, 10 pass, 0 fail |
| `node --test "tests/match/*.test.js"` | 41 tests, 41 pass, 0 fail (31 before plus 10 new) |
| `npm run check` | Passed: `{"tiles":6,"maxLift":1.4978164082128924,"aboveBoardBeforeRelease":1.1951721682030432,"backwardTravel":0.6350000000000002,"staffSocketDrift":0,"minimumGripContactSamples":162,"wizardDrift":0,"orbitCount":36}` |
| `npm run build` | Built `dist/cowboys-vs-wizards-board-duel.html` (25,538,213 bytes) with the card back embedded |

Each command ran once and passed on its first run. No fixes were needed.

The 10 new tests:

- `card-model.test.js` has 2 tests. The first walks CPU-vs-CPU matches over seeds 0 to 99 and builds the model from `publicState(state, "cowboy")` at every step. In that walk the Cowboy had 50 wins, 35 losses and 15 draws. These counts describe the test walk only, not game balance. The second test covers a null state, the result labels and the message.
- `orbs.test.js` has 8 tests, run in Node with the real GLBs and no WebGL. They cover orb counts 0 to 5, the slot-to-tile mapping (the stage and camera equal `createDuel`'s), rigged pieces against labelled tokens, reset and `clear()`, `pick`, cue end states, and `scheduler.advance()` freezing all motion. The last test is not in the task list: it plays seeds 0 to 4 through the real controller and Presenter on the real board.

Not covered:

- No browser was run. Rendering, layout, label sprites, the look of the orbs and tokens, and the DOM overlay are unverified. `src/ui/cards.js` has no Node test. It was only bundled with esbuild for the browser target, with 0 warnings.
- The card fronts are temporary text cards until the approved front (OQ-A) is named.

## Task 9 checkpoint: integration (no rerun)

Recorded at closeout, 2026-11-15, 8:30 PM PST. These results stand for the integrated code:

| Check | Result | Run |
| --- | --- | --- |
| `node --test "tests/match/*.test.js"` | 41 of 41 pass | 12:49 PM PST |
| `node --test "tests/game/*.test.js"` | 38 of 38 pass | 12:14 PM PST |
| `node --test "tests/assets/*.test.mjs"` | 15 of 15 pass | 12:14 PM PST |
| `npm run check` | passed | 12:49 PM PST |
| `npm run build` | built the page the browser run loaded (25,591,171 bytes, SHA-256 `41971491…79e5`) | 7:43 PM PST |

None was rerun, because none is stale:

- After 12:49 PM PST only `src/main.js`, `src/render/cues.js` and `src/ui/layout.html` changed. No Node test and no file used by `npm run check` imports or reads them.
- `src/game/`, `tests/game/`, `tests/assets/` and the asset auditor are unchanged from `b3c77bd`.
- No build input is newer than the 7:43 PM PST build.

`src/main.js`, `src/render/cues.js` and `src/ui/cards.js` have no Node tests, so [the browser run](kiro-match-browser.md) is their only check.
