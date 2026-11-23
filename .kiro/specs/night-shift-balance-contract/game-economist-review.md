# Game economist review: Night Shift balance contract

Status: open

Findings as recorded below: E1 and E3 are open; E2 is answered.
This line was added on 2026-11-22 (America/Los_Angeles) by the native Kiro
proof-scorecard pass so the scorecard can read the outcome. The findings below
are unchanged.

Reviewer: one native Kiro CLI agent (model `claude-opus-5.5`) working in the
`12-expert-reviews` worktree. The same agent wrote every review in this panel,
each through a different lens. The lenses are not separate people.

Method: static reading of the spec, the code that applies it and the archived
receipts. No command ran in this pass because the session's shell calls were
refused before they could start. Every number below is quoted from a linked
file or worked out by hand from the code.

Lens: do NSB-1 and NSB-2 measure the trade-off they are meant to measure, and
which outcomes can pass them?

## E1. Draws shrink the measured first-seat skew

- **Question:** If a candidate produces more draws, can NSB-2 pass while the
  opening seat's edge grows?
- **Record:**
  [requirements.md](requirements.md) Measurement item 1 ("percents of all
  games ... Draws count for neither faction") and item 3
  (`abs(firstSharePct - 50)`).
  [`scripts/night-review.mjs`](../../../scripts/night-review.mjs) lines 96–97:
  `seatSkew: Math.abs(pp(t.first, t.games) - 50)`, where `t.games` includes
  draws.
- **Observed (derived from the code, not run):** Baseline: 0 draws, first seat
  wins 52%, so the skew is 2.0 pp. Candidate: 6% draws, first seat 50%, second
  seat 44%, so the skew is 0.0 pp and NSB-2 passes. In decided games the
  candidate's first seat wins 50/94 = 53.2%, which is a larger edge than the
  baseline's 52%. The reverse case also exists: an even candidate with 10%
  draws (45/45) measures a 5 pp skew and can fail.
- **Exposure today:** latent. The archived Showdown runs record 0 draws
  ([night-shift.md](../../../docs/evidence/night-shift.md), "draws 0"), and so
  does the Agent Arena series
  ([night-shift-repair README](../../../docs/evidence/night-shift-repair/README.md)).
- **Status:** open. The wording is a design choice, so it goes back to Fable.
- **Acceptance check:** Either (a) the spec states that seat skew is measured
  over all games and that draws dilute it, or (b) the skew is measured over
  decided games. In both cases a unit test in
  `tests/match/showdown-balance-contract.test.js` must cover the 52/48/0 vs
  50/44/6 pair above and assert the documented result.

## E2. NSB-2 caps growth only, so a large existing seat edge passes

- **Question:** Can a candidate pass the contract while leaving a
  first-player win share near 60%?
- **Record:** NSB-2 in [requirements.md](requirements.md) ("grow by at most 1
  percentage point versus the baseline").
  [`showdown-balance-contract.mjs`](../../../scripts/showdown-balance-contract.mjs)
  `evaluateBalanceRequirements`: `seatSkew <= baselineSeatSkew + tolerance`.
- **Observed (archived receipts):** The repair scout baseline had a 58.75%
  first-player share on both scout cohorts. Its NSB-2 limit was therefore
  "first-player skew ≤ 9.75 pp"
  ([night-shift-repair README](../../../docs/evidence/night-shift-repair/README.md)),
  so a candidate at 59.75% first-player share passes. The earlier 2,000-game
  run had the first player at 57.10%
  ([night-shift.md](../../../docs/evidence/night-shift.md)).
- **Interpretation:** This matches the spec as written. The spec bounds
  regression, not seat fairness, and Measurement item 5 says a PASS is no
  fairness claim. The player-facing cost is that the contract can never push a
  repair toward fixing the opening-seat edge.
- **Status:** answered (works as written). Whether to add an absolute seat
  band is a Fable decision.
- **Acceptance check:** If Fable keeps the rule as it is, a fixture with a
  baseline skew of 8.75 and a candidate skew of 9.75 must pass and one with
  9.76 must fail. If Fable adds an absolute band, the new line must be a third
  normative requirement, the grammar section must allow it, and the parser
  test must cover it.

## E3. Exact-equality pass cases depend on floating-point sums

- **Question:** Does "Growth equal to the tolerance passes" (Measurement item
  3) hold for shares computed as `100 * n / games`?
- **Record:** `seatSkew <= baselineSeatSkew + tolerance` in
  `evaluateBalanceRequirements`. Shares come from `(100 * n) / games` with no
  rounding (`night-review.mjs` line 89).
- **Observed:** Not run in this pass. Whole-percent cases such as 320-game
  cohorts with integer results are exact. Fractional shares such as
  177/320 = 55.3125 are exact binary fractions. Cohort sizes that are not
  powers-of-two multiples, combined with a non-integer tolerance, can make a
  sum that should be equal fail by one unit in the last place.
- **Status:** open (unverified risk).
- **Acceptance check:** Add a parser and evaluator test in which the
  candidate skew equals the baseline skew plus the tolerance, built from
  non-dyadic counts (for example 1,000 games, a baseline of 523 first-seat
  wins, a candidate of 533 and a tolerance of 1). It must pass. If it fails,
  compare in integer game counts or with a documented epsilon.
