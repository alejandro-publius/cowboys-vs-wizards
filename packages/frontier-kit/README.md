# Frontier kit

Showdown and Boot Hill Poker share two dependency-free modules. Each game owns its rules. The optional Node CLI and GitHub Action below review paired outcomes from any deterministic two-sided game.

## Run the balance gate in another game

Commit a seed plan before tuning. Have your simulator emit one JSON file for the chosen baseline and candidate on every run. The gate needs two inputs.

- **Plan** — `{"sides":["red","blue"],"tune":{"firstSeed":1,"deals":500},"holdout":{"firstSeed":501,"deals":500}}`. Choose distinct lowercase side names and disjoint seed ranges.
- **Evidence** — an object with `tune` and `holdout` arrays. For each seed in ascending order, record both openers in the plan's side order. One row looks like `{"seed":1,"first":"red","baseline":{"winner":"blue","endTurn":4},"candidate":{"winner":"red","endTurn":5}}`. Use a side name or an explicit draw (`"draw"` or `null`) and a positive whole ending turn. The kit's `onPair` callback emits this shape. Each input file can be up to 64 MiB. [Poker producer](../../experiments/boot-hill-poker/balance-evidence.mjs)

From the caller's working directory, run Node 22.18+ against a checkout containing the gate. No package install is required.

```sh
node /path/to/cowboys-vs-wizards/packages/frontier-kit/balance-gate.mjs ci/plan.json pairs.json
```

For GitHub Actions, run the same check after your simulation. This example assumes your simulator writes the paired evidence to stdout. Replace the producer path and pin the Action to the full SHA of a published revision containing it. The Action reads the two files and needs no secret or write permission. [Runnable Boot Hill workflow](../../.github/workflows/balance-gate-demo.yml)

```yaml
on: pull_request
permissions:
  contents: read
jobs:
  balance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with:
          persist-credentials: false
      - uses: actions/setup-node@v6
        with:
          node-version: 22
      - run: node ci/record-pairs.mjs > "$RUNNER_TEMP/pairs.json"
      - uses: alejandro-publius/cowboys-vs-wizards/packages/frontier-kit@27583b16aab4ab38805fab93b720d383eb4fb7d8
        with:
          plan: ci/plan.json
          evidence: ${{ runner.temp }}/pairs.json
```

Exit **0** means both candidate side win shares are within 45–55% and opening-seat skew grew by at most 1 percentage point versus baseline, separately on tune and holdout. All games count in the denominator. Exit **2** reports a measured rejection. Both print JSON with counts and shares per arm, changed winners and each cohort's checks. Exit **1** reports invalid inputs on stderr, including missing, duplicated or out-of-order pairs. The Action reads the thresholds from its pinned [Night Shift contract](../../.kiro/specs/night-shift-balance-contract/requirements.md). The caller supplies the simulator and the evidence of which versions it ran.

### Import the Kiro Power

On November 27, Kiro CLI 3.5.0 installed the Power in a fresh profile. From a checkout containing the Power, run `kiro-cli powers install "$PWD/.kiro/powers/balance-gate"`.

In Kiro IDE, open **Powers → Add Custom Power → Import power from a folder**, select `.kiro/powers/balance-gate` in the checkout, then click **Install**. Once this directory is public, use **Import power from a repository URL** (called **Import power from GitHub** in earlier versions) and paste its GitHub directory URL. With a game workspace open, ask “Run the paired balance gate on ci/plan.json and pairs.json. Which cohort and rule explain the verdict?” The Power contains the input contract and CLI instructions. [Power directory](../../.kiro/powers/balance-gate/) · [Kiro installation guide](https://kiro.dev/docs/powers/installation/)

### Reproduce the Poker controls

From the root of this checkout, replay both Cowboy discard policies against the Wizard's standard policy. The baseline Cowboy always stands pat. This exercises the same gate as the Action.

```sh
poker=experiments/boot-hill-poker
pairs=$(mktemp)
node "$poker/balance-evidence.mjs" standard > "$pairs"
node packages/frontier-kit/balance-gate.mjs "$poker/balance-plan.json" "$pairs"  # exit 0
node "$poker/balance-evidence.mjs" pat > "$pairs"
node packages/frontier-kit/balance-gate.mjs "$poker/balance-plan.json" "$pairs"  # exit 2
node --test tests/game/frontier-balance-gate.test.js  # includes invalid evidence at exit 1
```

Codex CLI measured these controls on November 27, 2026. Each cohort contains 1,000 games per arm. The unchanged stand-pat candidate failed NSB-1 in both cohorts.

| Seeds | Baseline Cowboy wins | Standard Cowboy wins | Opening seat win share, baseline → candidate | Changed winners |
| --- | ---: | ---: | ---: | ---: |
| Tune 1–500 | 295 | 500 | 49.5% → 48.8% | 291 |
| Holdout 501–1,000 | 308 | 500 | 47.1% → 48.6% | 274 |

The Action's shell command was exercised locally from a separate caller directory. Hosted Actions execution and native Kiro import or activation remain unverified. The isolated Kiro CLI 3.5.0 import returned `Operation not permitted`.

## What is shared

Two modules.

`paired-cohort.js` is the deterministic paired-duel cohort audit
(`measurePairedCohort`, `PairedCohortError`, `DRAW`, `MAX_DEALS`). It was
moved here unchanged from `src/review/paired-duel-kit.js`, which is now a
re-export so existing callers keep working. `index.js` exports this module
and nothing else.

| Game | Consumer | Import path |
| --- | --- | --- |
| Showdown | `scripts/field-trial-confirm.mjs`, `tests/game/field-trial-repair.test.js` | `src/review/paired-duel-kit.js` (re-export) |
| Boot Hill Poker | `scripts/verify-poker-kit.mjs` | `packages/frontier-kit/index.js` |

## Seeded deals in both games

Showdown and Boot Hill Poker call the same `mulberry32` implementation. The package exposes it from `packages/frontier-kit/seeded-rng.js`. The dependency-free source lives in `src/game/frontier-kit/seeded-rng.js` so archived `src/game` snapshots include every input needed to reproduce a Showdown deal.

| Consumer | Call site | Seed handling |
| --- | --- | --- |
| Showdown, including the illustrated and reference builds | `random(seed)` in `src/game/showdown/rules.js` | Coerce to uint32 using `seed >>> 0`. |
| Boot Hill Poker, in the browser and terminal | `createRng(seed)` in `experiments/boot-hill-poker/engine.js` | Use Poker’s existing numeric and decimal seed parsing, or FNV-1a for other text. |

Each call creates an independent stream of numbers in [0, 1). The package entry for the paired audit stays at `index.js`. Each game owns its rules, shuffling order, rendering and input.

## Browser packaging

The Showdown pages bundle the generator. Poker’s import map resolves the public package import to `./frontier-kit/seeded-rng.js` within its own URL. Staging copies the implementation into that location as a regular file. On a source checkout the same relative path is a symbolic link, so the existing single-folder HTTP server still works. For a checkout with symbolic links disabled, serve the output of `node scripts/stage-pages.mjs` from `dist/web`.

## Checks

- `node --test tests/game/frontier-kit-seeded-rng.test.js tests/game/dec4-frontier-kit.test.js` checks the real entry points, an independent BigInt oracle across 4,096 seeds, old deals, 120 Showdown duel outcomes, and 1,000 mirrored Poker outcomes. The recorded inputs predate the move to the shared generator.
- `node scripts/check-pages-tree.mjs --browser` checks the staged module graph, follows the saloon link, and compares Poker’s shuffled deck and dealt state against Node for numeric and text seeds. Stage with a commit identity before running it.
- To compare Showdown before and after a build change, record complete public duels with `scripts/referee/browser-transcripts.mjs --source public` on the original commit, then run `scripts/referee/browser.mjs --cohort --transcripts <file>` on the staged page.
