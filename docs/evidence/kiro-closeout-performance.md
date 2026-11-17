# Closeout performance measurement

Observed November16,2026 (America/Los_Angeles), frozen runtime `e9aeb06`. **Executed by Codex**, using the current Chrome replay harness startup measurement. No runtime or asset edits. This is not a new Kiro benchmark claim.

Three local HTTP loads used fresh isolated Chrome profiles, cache disabled, seed0 starter deck,1440×900 viewport, native WebGL and no network throttling. Each run stopped after the match accepted input; the full match was not replayed. The harness polls readiness every60ms, then observes the next animation frame. This includes polling/instrumentation delay and is not an exact first-paint timestamp.

| Sample | Navigation to observed accepting input | Next observed ready frame |
| --- | --- | --- |
| 1 | 750ms | 799.7ms |
| 2 | 626ms | 679.8ms |
| 3 | 689ms | 736.5ms |

Median input readiness: **689ms**. Median next observed ready frame: **736.5ms**. All three startup checks passed; zero console errors. The two-second animation-frame observations were 60.7, 60.9, 60.6Hz; this is an idle frame-callback observation, not combat rendering performance.

HTML SHA-256: `863ab8bd525cb2e78b0e73b529406b73c6a2381f982f2854e71340df79718e02`.
Detailed conditions and sanitized measurements: [JSON receipt](kiro-closeout-performance.json).

## Comparison limits

The historical overnight note reports three interleaved cache-disabled navigations ending at the first rendered accepting-input frame, with a1109→686ms improvement for an older runtime and art. Its original benchmark script was not tracked or found in the scoped artifact locations. These current runs reuse today's startup harness, have changed runtime/assets, and ran on an active development Mac. **No current speedup/regression percentage is claimed.**

This does not test real-device/mobile performance, Safari, network-limited loading, long combat sessions, or human perception. It is a bounded current-build startup measurement.
