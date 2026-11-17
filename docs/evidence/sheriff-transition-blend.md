# Sheriff runtime transition blend
November 16, 2026 (America/Los_Angeles). Codex integration after the user's approval to smooth and release PR #13.

The runtime snapshots the displayed pose when the approved sourced idle hands off to the existing draw, then blends bone rotations, hips and seating lift over 0.18 seconds. That finishes before the existing 0.29-second gun grab. Returning from a cue blends from its displayed endpoint into the unchanged sourced clip. No clip keys, existing draw keys, model geometry or impact timing were changed.

An independent read-only review caught a missed-render case: a whole attack can finish in one delayed scheduler tick without the render callback observing `acting`. Idle re-entry now resets its clock whenever playback was stopped, so a background-tab gap cannot skip the blend.

Checks:
- 19 focused Sheriff/idle/attack-clip tests pass, including zero-jump endpoints, unchanged shot aim/impact, independent playback, cleanup and the delayed-tick regression.
- A 300-frame actual-match capture shows idle, existing attack and recovery. Representative transition frames were reviewed; zero runtime exceptions were recorded.
- The web build before the delayed-tick guard passed all eight seeded browser steps with zero console errors. The guard has its own focused regression test; final release verification is recorded separately.

Authorship: Mixamo supplied the source motion; Codex retargeted the previously user-approved preview and implemented this runtime blending. Kiro integrated the original sourced idle and its lifecycle checks. The user's artistic approval remains the authority.

Final pre-merge code: 136/136 Node tests, both animated GLB structural checks, web build and diff checks passed. Final web HTML SHA-256: `201b62a71617a4b30ed83ad5c3c82ddab5ac991bf16cfd088be64992f0739494`.
