# Showdown board zones: verification design

Author: Kiro CLI 3.5.0 worker board-system, 2026-11-20, America/Los_Angeles. Base: main `ea183ee`.
Requirements: `requirements.md` (BZ-01 to BZ-12, RV-01 to RV-05). This file maps each ID to an
existing repo check and fixes the run preconditions. It adds no runtime, test runner or data source.
The game's own view and the existing check scripts stay the only source of truth.

## Pattern

The recipe follows two existing native workflow recipes: `independent-release-review` (a 40-hex
`expected_sha`, a detached clean checkout, refusal before any test) and `showdown-ride-search`
(a `parallel` step with `joinPolicy: all` and a read-only join). It adds negative controls, so a
review shows that each check can fail.

Outside references, as given in the board-system brief and not re-read by this worker (no Web):
- X-047, InteractionKit README, "Leverage Kiro's Superpowers" (Hooks, Steering, MCP, Spec). Its idea
  used here is a UI contract with verification that can be run again.
- X-049, SpookBnB Devpost, "The Kiro-Powered Development Process": a living spec checked for feature
  consistency. Video 55 at 5:05 and 5:18: checks join before a gate decides.
- `docs/evidence/kiro-competitive-research.md` and `docs/submission/kiroween-competitive-benchmark.md`
  hold the repo's own notes on both entries.

## Run preconditions

1. The candidate is one commit that already contains the board UI, CSS and
   `scripts/browser-showdown-board-zones.mjs`. The recipe is launched only after that combined commit exists.
2. `git checkout --detach <sha>` in a clean worktree. `node_modules` is the shared symlink. Do not
   install. Chrome is at `CHROME_PATH` or the default macOS path.
3. The QA script documents its usage in its header comment, takes the built HTML path and an output
   folder, and exits non-zero on any failed assertion. If its header shows another interface, the
   recipe follows the header and records the exact command. If the script is missing, BZ-01 to BZ-08,
   BZ-10 and BZ-11 are `pending` and the verdict is `fail`.
4. `npm run build` prints `build <first 12 hex of sha>`. That label must appear in the HTML.

## Tracks (same HEAD, same HTML)

The gate step builds once and copies the page to `<out>/candidate.html`. It also writes two witness
copies, each made by inserting one `<script>` before the single `</body>`:

- `witness-zone-break.html`: a MutationObserver removes every `data-zone` and `data-zone-side` attribute.
- `witness-curtain-leak.html`: a MutationObserver copies every card id ever shown in `#sd-hand` into a
  hidden `<i data-bz-leak>` inside `#showdown`, so earlier hands stay in the DOM after a pass.

The snippets are `witness/zone-break.snippet` and `witness/curtain-leak.snippet` in this spec folder.
The gate step inserts each with one `python3 -c` line that asserts a single `</body>`.

| Step | Command (relative to the checkout) | Expected | IDs |
| --- | --- | --- | --- |
| gate | `git diff --name-only <base> <sha> -- src/game/` | empty | BZ-12 |
| rules-flow | `npm test` | exit 0 | BZ-07, BZ-12 |
| rules-flow | `node scripts/browser-showdown-check.mjs <out>/candidate.html <out>/rules-flow/camp` | exit 0 | BZ-09, BZ-12 |
| rules-flow | `node scripts/browser-showdown-board-zones.mjs <out>/candidate.html <out>/rules-flow/zones` | exit 0 | BZ-01 to BZ-08, BZ-10, BZ-11, as the script reports |
| rules-flow | the same on `witness-zone-break.html` | exit non-zero | RV-03, BZ-01 |
| privacy | `MODES=hotseat node scripts/browser-showdown-modes-check.mjs <out>/candidate.html <out>/privacy/hotseat` | exit 0 | BZ-09, BZ-12 |
| privacy | the same on `witness-curtain-leak.html` | exit non-zero, "card ids behind the curtain" | RV-03, BZ-09 |
| privacy | board-zones script on `witness-curtain-leak.html` | exit non-zero | RV-03, BZ-09 |
| join | reads the step reports only | | RV-01 to RV-05 |

Not covered by any listed check: BZ-02 on a real phone, the "public gate" (its path set is
Fable's or the coordinator's to name), clarity and fun (human playtest), appearance (rendered review).

## Measured on main `ea183ee` (before the board commit)

The curtain-leak witness was tested against the existing hotseat check. See
`docs/evidence/devpost-lift-board-system.md`. The zone-break witness cannot be tested until
`data-zone` markup and the QA script exist.
