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
- Seed 0 and seed 60 browser runs: **not run**. They were not approved, and `dist/` is not built in this worktree (building is outside the owned paths). No measurements exist yet.

## Limitations
- This is a baseline instrument, not proof that scenery is a startup bottleneck. No before/after comparison exists, so no speedup is claimed.
- Headless Chrome on one machine says nothing about human or device startup experience.
- The snapshot is taken at the first `accepting_input` observation, so later paint entries are excluded.

Suggested command, once approved: `npm run build && node scripts/browser-match-check.mjs --seed 0 --startup-measure --out-dir <dir>` (and `--seed 60`).
