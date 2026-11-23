# Game economist review: Night Shift repair protocol

Status: open

Findings as recorded below: E1 and E2 are open.
This line was added on 2026-11-22 (America/Los_Angeles) by the native Kiro
proof-scorecard pass so the scorecard can read the outcome. The findings below
are unchanged.

Reviewer: one native Kiro CLI agent (model `claude-opus-5.5`) working in the
`12-expert-reviews` worktree. The same agent wrote every review in this panel,
each through a different lens.

Method: read [requirements.md](requirements.md),
[protocol.json](protocol.json) and the archived scout receipts in
[`docs/evidence/night-shift-repair/`](../../../docs/evidence/night-shift-repair/).
No games were played and no command ran in this pass, because the session's
shell calls were refused before they could start. Sampling figures are
binomial approximations worked out by hand. They are estimates, not
measurements.

Lens: can the scout cohorts tell a good one-number edit from a bad one?

## E1. Scout cohorts are small next to the NSB-1 band

- **Question:** With 160 deals × 2 seats = 320 games per scout cohort, how
  much of the 45–55% band is sampling noise?
- **Record:** `protocol.json` scout `{"first":630100000,"deals":160}` and
  `{"first":630200000,"deals":160}`. Requirement 3 requires NSB-1 and NSB-2 on
  every scout range.
- **Observed (archived):**
  - The baseline Cowboy share was 65.00% on scout-1 and 60.00% on scout-2.
    Those are the same rules on two seed ranges, 5 pp apart.
  - The strongest edit, Sheriff health 3 → 2, measured 51.875% and 55.3125%.
    It failed scout-2 by one game: 177 Cowboy wins against a cap of 176 out of
    320 ([README](../../../docs/evidence/night-shift-repair/README.md),
    "Strongest candidate").
  - Billy attack 2 → 1 measured 59.792% → 51.920% on 100,000 duels at another
    commit, but 56.25% on scout-1 here.
- **Estimate (not measured):**
  - At n = 320 the standard error of a share near 50% is about 2.8 pp, so the
    ±5 pp band is about ±1.8 SE.
  - Even an edit whose true share is exactly 50% stays inside the band on one
    cohort about 93% of the time, and on both cohorts about 86% of the time,
    before NSB-2 is applied.
  - An edit with a true share of 53% passes NSB-1 on both cohorts only about
    58% of the time.
  - The pairing of both seats per deal may change these figures. This review
    did not measure that effect.
- **Effect on decisions:** The scout can reject good edits and rank edits by
  noise. The protocol's guard against false positives works: nomination is
  followed by a fresh 2 × 2,000-deal confirmation (requirement 5). The
  scout's false negatives get no such guard. A good edit can be missed for a
  whole repair.
- **Status:** open. The cohort size is a protocol decision for Fable.
- **Acceptance check:** Before the next repair, record in this spec the false
  rejection rate that the scout size was chosen for. One way is a bootstrap
  over the 320 recorded baseline games in `scout.json`, giving the
  probability that a true 50% or 52% edit passes both cohorts. Alternatively,
  enlarge the scout cohorts in a new `protocol.json` written before the
  attempt starts.

## E2. The brief's stat ranges exceed the card compiler, which spends candidate slots

- **Question:** Do the adjacent edits that the scout plans all exist as legal
  cards?
- **Record:**
  - [`scripts/contest-balance.mjs`](../../../scripts/contest-balance.mjs)
    line 36: `BOUNDS = {attack: [0, 9], health: [1, 12], stars: [1, 8]}`.
  - [`scripts/sync-card-specs.mjs`](../../../scripts/sync-card-specs.mjs)
    line 15 (`MAX_HEALTH = 5`) and lines 76–77 (health 1–5; attack at least 1
    for deck troops).
  - [`brief.json`](../../../docs/evidence/night-shift-repair/brief.json)
    `bounds`.
- **Observed (archived):** 82 candidates were planned. Six were refused by
  the compiler: attack 1 → 0 on Sheriff, Outrider, Covered Wagon and Skeleton,
  and health 5 → 6 on Mounted Billy and Dragon. That left 76 measured edits
  ([README](../../../docs/evidence/night-shift-repair/README.md)).
- **Effect:** The refusals do not bias the measured edits. They do, however,
  make the agent's choice space under requirement 2 differ from what the brief
  advertises. Because the scout result has rejections, it is not cached
  (`field-trial-scout.mjs`: the cache is written only when
  `counts.rejected === 0`), so every rerun replays all 49,280 games.
- **Status:** open. The same root cause is raised under the rules-lawyer
  lens in [rules-lawyer-review.md](rules-lawyer-review.md) R1.
- **Acceptance check:** For the archived brief's card set at base `8ec0fe7`,
  the planned candidate list contains no edit the compiler refuses, so
  `counts.rejected` is 0. Then a rerun reports `cache hit`.
