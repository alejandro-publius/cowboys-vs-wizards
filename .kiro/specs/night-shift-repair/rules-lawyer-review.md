# Rules lawyer review: Night Shift repair protocol

Status: open

Findings as recorded below: R1, R2 and R3 are open; R4 is answered.
This line was added on 2026-11-22 (America/Los_Angeles) by the native Kiro
proof-scorecard pass so the scorecard can read the outcome. The findings below
are unchanged.

Reviewer: one native Kiro CLI agent (model `claude-opus-5.5`) working in the
`12-expert-reviews` worktree. The same agent wrote every review in this panel,
each through a different lens.

Method: compared [requirements.md](requirements.md) with
`scripts/field-trial-engine.mjs`, `scripts/field-trial-scout.mjs`,
`scripts/contest-balance.mjs`, `scripts/sync-card-specs.mjs` and the archived
run record. No command ran in this pass, because the session's shell calls
were refused before they could start.

Lens: does each requirement say exactly what the code and the receipts do?

## R1. "Adjacent value" has no single legal range (top blocker for the next repair)

- **Question:** Requirement 2 says `to` is "an adjacent value of that field".
  Which range decides adjacency?
- **Record:** Four different stat ranges exist in the checkout:
  - Card compiler, which decides legality:
    [`sync-card-specs.mjs`](../../../scripts/sync-card-specs.mjs) lines 75–77.
    Stars at least 1, health 1–5, and attack at least 1 for deck troops.
    Attack may be 0 only for `showdownOnly` troops, in `validateShowdownOnly`.
  - Balance brief: [`contest-balance.mjs`](../../../scripts/contest-balance.mjs)
    line 36 has attack 0–9, health 1–12 and stars 1–8. The same values are
    copied at
    [`field-trial-engine.mjs`](../../../scripts/field-trial-engine.mjs)
    line 25.
  - Card Forge: [`card-forge.mjs`](../../../scripts/card-forge.mjs) line 51 has
    attack 1–6, health 1–5 and stars 1–8. Its comment says "Health 1..5 is the
    card catalog's own limit".
  - Saloon browser validator:
    [`src/ui/night-shift-events.js`](../../../src/ui/night-shift-events.js)
    line 13, `STAT_MAX = 12` for every field.
- **Observed (archived):** Native workflow `wf_80aa97dac058694f` planned 82
  ±1 edits from the brief's ranges. The compiler refused 6 of them
  ([README](../../../docs/evidence/night-shift-repair/README.md)). The
  workflow is recorded as `failed`, and the scout step's exit is recorded as
  1 ([native-runs.json](../../../docs/evidence/night-shift-repair/native-runs.json)).
- **Status:** open. This is the panel's top blocker: the next repair attempt
  would plan the same six illegal edits.
- **Acceptance check:**
  - Requirement 2 names its source of legality, for example "legal under
    `scripts/sync-card-specs.mjs` for that card".
  - The brief's `bounds` are derived from that source, or no longer exist.
  - A test checks that for every brief card, every planned ±1 edit compiles.
  - On base `8ec0fe7`, the plan reports 0 rejections, and every edit it
    leaves out is listed with the compiler rule that excludes it.

## R2. The recorded scout exit does not match the current scout's exit codes

- **Question:** Was the failure of `wf_80aa97dac058694f` caused by the six
  refusals, as the README says, or by the no-nomination result?
- **Record:**
  - [`field-trial-scout.mjs`](../../../scripts/field-trial-scout.mjs) lines
    275–279 record a compile refusal as `engine-rejected` and continue.
  - Lines 363–366 return exit 3 ("No nomination") when no edit passes.
  - Line 374 exits 1 only for an uncaught non-input error.
  - `native-runs.json` records the scout's `"exit": 1`.
  - `scout.json` was written with `counts.rejected: 6` and
    `passingNsb1AndNsb2BothCohorts: 0`.
- **Observed:** In the code in this checkout, a run that produced that
  `scout.json` would exit 3, not 1. Either the scout code at `8ec0fe7` was
  different, or something failed after `scout.json` was written. This pass
  could not run `git show 8ec0fe7:scripts/field-trial-scout.mjs`, so it cannot
  tell which.
- **Status:** open. The receipt is unclear, and the record itself is not
  disputed.
- **Acceptance check:** Run
  `git show 8ec0fe7:scripts/field-trial-scout.mjs | grep -n "return 3\|process.exit"`
  and record the result next to the README's "ended failed" sentence. Also
  state which line produced exit 1. Requirement 7 should then say whether a
  compiler refusal of a planned edit fails the run or is only recorded.

## R3. The engine's interface and its `ref` handling are wider than the spec

- **Question:** The shared interface says `openTrialEngine` returns
  `{rules, inputs}` and that "`ref` is the frozen git commit". Requirement 5
  says the confirmation runs "at the same `ref`". Does the code match?
- **Record:** `field-trial-engine.mjs`:
  - `checkRef` accepts `"HEAD"`.
  - `resolveSource` falls back to the local `HEAD` when `ref` is missing,
    provided all four input object IDs equal `expectedInputs`.
  - `openTrialEngine` returns `{rules, inputs, commit}`.
- **Observed (by reading):** In a checkout without the frozen commit, the
  confirmation runs at `HEAD`, not at `ref`. Only the four game-input trees
  and blobs are extracted (`extract` archives `INPUT_PATHS` only), so equal
  object IDs mean the same engine files. In outcome terms the fallback looks
  equivalent, but the spec text does not allow it.
- **Status:** open (spec wording).
- **Acceptance check:** The Shared interface section documents the `HEAD`
  fallback and the extra `commit` field. Requirement 7's receipt list
  includes `commit` next to `ref`. Either the confirm receipt records both
  values, or the spec forbids the fallback for confirmation.

## R4. Passed reading: confirmation stays sealed when nothing is nominated

- **Question:** Do requirements 5 and 6 hold for the archived repair?
- **Record:** [`fresh.json`](../../../docs/evidence/night-shift-repair/fresh.json)
  and [`witness.json`](../../../docs/evidence/night-shift-repair/witness.json)
  are both `null`.
  [`src/ui/field-trial-data.js`](../../../src/ui/field-trial-data.js) imports
  them without substituting anything ("nothing here fills in a missing run").
  The scout prints "The held-out deals stayed sealed" when nothing passes.
- **Status:** answered for this repair.
- **Acceptance check:** As long as `scout.json` has
  `passingNsb1AndNsb2BothCohorts: 0`, both files stay `null`. A test (in `tests/match/field-trial-replay.test.js` if it is not
  already there) asserts
  that the saloon's repair replay stays hidden when `fresh` is `null`.
