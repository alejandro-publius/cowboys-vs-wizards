# Startup measurement flag for audit #59.5

Agent: Kiro CLI V3 (low effort). Base SHA: 6a07ccde5d74625bb1f9984c10d97378e251cf4d.

## Change
`scripts/browser-match-check.mjs` accepts an opt-in `--startup-measure` flag. Without it, behavior is unchanged. With it, the report JSON gets a `startup` object right after the existing `loadMs` is taken:

- `loadMs`: copy of the existing value (Date.now() from `Page.navigate` to the first observed `accepting_input`; semantics unchanged).
- `navigation`: browser Navigation Timing entry (startTime, domInteractive, domContentLoadedEventEnd, loadEventStart, loadEventEnd, responseEnd, duration, transfer/encoded/decoded sizes), or null.
- `paint`: paint entries present at that moment (may be empty).
- `resourceCount`, `resourceTransferBytes`: from Resource Timing; bytes are null when there are no entries. A file:// load may report 0 sizes.
- `canvasObserved`, `acceptingInputObserved`: read from the page at that moment.

Gameplay, selectors, step counts and seed handling are untouched.

## Verification
- `node --check scripts/browser-match-check.mjs`: passed.
- Seed 0 and seed 60 browser runs: **not run by Kiro in its CLI session** because those commands were not approved. The independent coordinator verification below was performed later.

## Limitations
- This is a baseline instrument, not proof that scenery is a startup bottleneck. No before/after comparison exists, so no speedup is claimed.
- Headless Chrome on one machine says nothing about human or device startup experience.
- The snapshot is taken at the first `accepting_input` observation, so later paint entries are excluded.

Suggested command, once approved: `npm run build && node scripts/browser-match-check.mjs --seed 0 --startup-measure --out-dir <dir>` (and `--seed 60`).


## Coordinator verification (2026-11-17, after Kiro's one-file commit)

This section is **coordinator-run**, not a Kiro Workflow, Crew action, hook execution or Kiro tool test receipt. It measures the existing default game; it does not implement or validate lazy scenery loading.

- Frozen source: `6a07ccde5d74625bb1f9984c10d97378e251cf4d`; Kiro code commit `9a2c31bc462dfd4829016973d0725f25251f50f3`.
- `node --check scripts/browser-match-check.mjs`: passed.
- `npm run build`: exited 0, produced `dist/cowboys-vs-wizards-board-duel.html` (built page SHA-256 `7ad145c9e245a1e22b73a13a690663108d0d45505a8ae343a07819685f71a547`).
- `node scripts/verify-duel.mjs`: exited 0; **222/222** Node tests and **2/2** exported GLB structural checks passed; structure does not establish animation quality.
- Headless Chrome **157.0.8103.52** (single Mac, local `file://` page). Each row is one observation, **not** a distribution, speedup estimate, real phone measurement or human judgment.

| Run | Replay observed | JS console errors | Navigate → accepting input (`loadMs`) | Browser navigation duration | First contentful paint | Canvas / accepting input |
| --- | --- | --- | --- | --- | --- | --- |
| `--seed 0 --startup-measure --summary` | 8/8, no pending | 0 | 965 ms | 487 ms | 220 ms | both observed |
| `--showcase --startup-measure --summary` (seed 60) | 4/4, no pending | 0 | 2,964 ms | 399.3 ms | 176 ms | both observed |

Both receipts report `resourceCount: 0` (the HTML embeds assets), and navigation `transferSize: 64,363,535` bytes. Browser navigation/FCP happen before the game necessarily becomes playable; therefore these figures do **not** isolate scenery loading or prove a causal bottleneck. Later work on #59.5 requires a controlled before/after change with appearance and replay preservation.

Uncommitted/generated browser receipts (intentionally not published): `.artifacts/kiro/startup59/seed-0/browser-run.json` and `.artifacts/kiro/startup59/seed-60/browser-run.json`. The generated files remain available in the authorized worktree but not on GitHub.
