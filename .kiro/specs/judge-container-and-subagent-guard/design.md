# Design: Judge Devcontainer, Subagent Receipt Guard, and Blog Compliance

## Architecture

1. **One-Click Judge Reproduction Container (`JCS-1`):**
   - `.devcontainer/devcontainer.json` uses `mcr.microsoft.com/devcontainers/javascript-node:1-22-bookworm` with the official `ghcr.io/devcontainers/features/python:1` (`3.12`) feature so Kiro IDE `1.5.11` (*Reopen in Container*) and GitHub Codespaces can run `npm run scorecard`, `node scripts/billy-balance-gate.mjs --arm candidate`, and `proof/referee/referee.py` with zero local setup.

2. **Kiro CLI `3.5` / `3.6` `SubagentStop` & `Stop` Receipt Integrity Guard (`JCS-2..JCS-5`):**
   - Adding `subagentstop: "Stop"` to `LEGACY` in `scripts/saloon-activity.mjs` preserves the 14-phase `PHASES` contract in `tests/match/night-shift-presence.test.js` while mapping Kiro CLI `3.6.0` `SubagentStop` events onto `"Stop"`.
   - `scripts/check-subagent-stop.mjs` verifies checked-in `night-review/bundle@1` cryptographic seals (`bundleSealIntact`) and `reports/properties/latest.json` receipt entries (`auditPropertyReceipt`), failing closed on any tampered bundle or rejected property entry while preventing stop-hook loops.

3. **Bonus Blog Rule Phrase (`JCS-6`):**
   - Updates paragraph 2 of the `PUBLISH START`..`PUBLISH END` block in `docs/submission/build-story.md` to carry the exact required hackathon phrase from `docs/submission/rules-check.md` line 84.
