# Even-fight package through the Night Shift (measurement)

Kiro CLI worker `even-proof`, November 20, 2026 (America/Los_Angeles), branch `kiro/showdown-sprint-even-proof`.
Native local CLI runs only: no browser, no human play, no Kiro Web or Crew. Brief: Fable's
[even-fight brief](../design/showdown-even-fight-kiro-brief.md) at `f079fdc` ("Done when" 1, 2 and 5).

## Tool

`scripts/night-review.mjs package` (commit `8dd5f9b`) compares two pinned commits read with `git archive`:
the even match at both commits on the tune and holdout deals from both seats with the level-2 bot
(`createShowdown(seed, {first})`, as the one-card reviews and Fable's table do), Fable's own `trail-sim.mjs` (its
`LADDER` and `winRate`) at both, and the candidate's property, rules and progress tests. It also checks that
the measured setup equals the Camp's Open range (`duelFor(save, "open")`), which matters because change 2 is an
even-match-only rule. The bundle is `night-review/package@1`, sealed, and lists every commit between base and
candidate with its author. The gate is Fable's: both shares 45–55% on both sets, and no Trail, rival or hunt win rate at
any bot level moving more than 3 points. The Open range row is reported but gated by the band, since it is the even
match the package is meant to change. That reading is mine and is recorded in the bundle's policy. The staged
one-card Sheriff review (`night-shift/guard-sheriff-health-3-to-4`) stays a separate `night-review/bundle@1` entry. The
Ledger lists it under "one-card candidates" and lists package reviews under "Rules package review" with their own verdict.

## Results

| Run | Commits | Tune 0–999 first / Cowboys | Holdout 1000–1999 first / Cowboys | Trail largest move | Verdict |
| --- | --- | --- | --- | --- | --- |
| Control (engine files identical) | `755df56` → `6a464e0` | 57.10% / 59.40% | 58.25% / 61.05% | 0.0 | failed (band), as expected for today's rules |
| Combined candidate | `755df56` → `d5a799d` | **49.50% / 51.80%** | **51.40% / 54.10%** | **6.7 points** | **failed (Trail)** |

2,000 games per set and no draws. The control's "today" numbers equal Fable's table (57.1 / 59.4; 58.3 / 61.0), and the
candidate's equal her package rows (49.5 / 51.8; 51.4 / 54.1). Both shares are inside 45–55% on both sets.

The Trail gate fails on three level-1 ("simple" player) rows: Rival 1 The Stargazer 33.3% → 40.0%, Lantern Wraith hunt 1
91.3% → 95.3%, and hunt 2 86.3% → 92.3%. Rival 1 at level 2 moved exactly +3.0, which is not more than 3. The Open range
at level 2 moved from 65.3% to 58.7%. The full table is in [trail.txt](night-shift/even-fight-d5a799d6/trail.txt).
Per the brief, this worker stopped here. No retune was made, and the package is not marked release eligible. The numbers
go to Fable.

## Files

- Sealed bundle: [night-shift/even-fight-d5a799d6/bundle.json](night-shift/even-fight-d5a799d6/bundle.json)
  (seal `bd01f65586725b37…`), with gzipped per-game records and [trail.txt](night-shift/even-fight-d5a799d6/trail.txt).
- Console output: [package run](even-fight-proof/package-run.txt), [verify --rerun](even-fight-proof/package-verify-rerun.txt)
  (games and Trail replayed identically), [control](even-fight-proof/control-755df56-vs-6a464e06.txt).
- Fable's `trail-sim.mjs` CLI run unchanged on each snapshot (rounded):
  [before, 755df56](even-fight-proof/trail-baseline-755df56.txt) and [after, d5a799d](even-fight-proof/trail-candidate-d5a799d6.txt).
  All 21 rows match the tool's exact counts once rounded.

## Reproduce

```sh
CAND=d5a799d61a93db8ed9a90499bc8ae7d68c7a845c
node scripts/night-review.mjs package --base 755df56b9903a6c7ee27273c45efa62346cd8a2d --candidate "$CAND" \
  --tune 0:1000 --holdout 1000:1000 --trail 300 \
  --brief f079fdcafb066ba5142dc2be2f1c1fc74b2bce12:docs/design/showdown-even-fight-kiro-brief.md \
  --out "docs/evidence/night-shift/even-fight-${CAND:0:8}"     # exit 1: gate failed
node scripts/night-review.mjs verify --bundle docs/evidence/night-shift/even-fight-d5a799d6 --rerun   # exit 0
```

Each `package` run takes about 2.5 minutes on Alex's Mac, and `--rerun` takes about the same. `createdAt` and the seal
change on every run. The counts do not.
