# Tasks: Judge Devcontainer, Subagent Receipt Guard, and Blog Compliance

- [x] 1. Add `.devcontainer/devcontainer.json` with Node 22, Python 3, `npm ci`, and forwarded preview ports (`JCS-1`).
- [x] 2. Map `subagentstop` -> `"Stop"` in `scripts/saloon-activity.mjs` and implement `scripts/check-subagent-stop.mjs` with a default `Stop` registration and an opt-in `SubagentStop` example (`JCS-2..JCS-5`).
- [x] 3. Add exact Bonus Blog eligibility wording to the publishable block of `docs/submission/build-story.md` (`JCS-6`).
- [x] 4. Verify with `tests/game/devcontainer-and-subagent-hook.test.js`, `tests/match/night-shift-presence.test.js`, `tests/game/dec4-scorecard.test.js`, `tests/game/dec4-trace.test.js`, and `tests/assets/links.test.mjs`.
- [ ] 5. Record a successful dispatched-worker event in a native Kiro CLI 3.6+ V3 session before enabling `SubagentStop` by default.
