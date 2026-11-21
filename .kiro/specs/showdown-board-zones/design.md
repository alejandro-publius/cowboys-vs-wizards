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

1. The candidate is one commit that contains the board UI, the CSS and
   `scripts/browser-showdown-board-zones.mjs` as committed in board-replay `490f005`. The coordinator
   launches the recipe only on that combined commit.
2. Detached, clean checkout of the candidate. The shared checkout must resolve `playwright-core`
   (`node -e "require.resolve('playwright-core')"`); the recipe calls the script with plain `node`, never
   `npx` or an install. If it does not resolve, the gate refuses with `missing dependency: playwright-core`.
   Chrome is at `CHROME_PATH` or the default macOS path.
3. `node scripts/build-graybox.mjs --hosted` writes `dist/web/index.html` and prints the candidate's
   12-hex build label.
4. QA script exit codes (its usage text): 0 every route passed, 1 a route failed or `--require-zones`
   found no zones markup, 2 bad arguments. Its last line reports the layout, witness, revision (12 hex)
   and the page SHA-256 (16 hex).

## Tracks (same HEAD, same page)

`Q` = `node scripts/browser-showdown-board-zones.mjs --page dist/web/index.html --require-zones`.
The witnesses are the script's own `--witness` faults; this spec does not reimplement them.

| Step | Command | Expected exit | IDs |
| --- | --- | --- | --- |
| gate | SHA, detached, clean, base exists, script present, playwright-core resolves | else refuse | RV-01 |
| gate | `git diff --name-only <base> <sha> -- src/game/` | empty | BZ-12 |
| gate | build `--hosted`, `shasum -a 256 dist/web/index.html` | label = sha | RV-02 |
| rules-flow P | `Q --only raise,raise-narrow` | 0 | BZ-01, BZ-02 (360px), BZ-04, BZ-06, BZ-07, BZ-08 |
| rules-flow W | `Q --only raise,raise-narrow --witness break-pile` | 1 | RV-03 |
| rules-flow N | `npm test` | 0 | BZ-07, BZ-12 |
| privacy P | `Q --only trap` | 0 | BZ-01, BZ-03, BZ-08, BZ-09, BZ-10, BZ-12 (saves) |
| privacy W | `Q --only trap --witness leak-name` | 1 | RV-03, BZ-09 |
| join | reads the three step reports | | RV-01 to RV-05 |

`break-move` is an equivalent rules-flow witness if `break-pile` is retired.
Not covered: BZ-05 and BZ-11 (no command asserts them), BZ-02 at 390px on a real phone, the "public
gate" path set, appearance, clarity and fun.

## Measured

See `docs/evidence/devpost-lift-board-system.md`. The positive and witness runs against zones markup
are pending until the combined candidate exists.
