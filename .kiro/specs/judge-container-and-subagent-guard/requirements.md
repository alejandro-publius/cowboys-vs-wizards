# Requirements: Judge Devcontainer, Subagent Receipt Guard, and Blog Compliance

## Normative requirements

- JCS-1: THE repository SHALL provide a valid `.devcontainer/devcontainer.json` configuring Node.js 22 and Python 3 with `npm ci` bootstrap and forwarded loopback ports (`4179`, `8080`), containing zero embedded credentials or secret tokens.
- JCS-2: THE `canonicalPhase` resolver in `scripts/saloon-activity.mjs` SHALL normalize Kiro CLI 3.6 `SubagentStop` (`subagentstop`) events onto `"Stop"` while keeping the 14 canonical `PHASES` list unchanged.
- JCS-3: WHEN `scripts/check-subagent-stop.mjs` runs on a `Stop` or `SubagentStop` hook event, THE script SHALL exit `0` immediately without output or re-entry if `stop_hook_active` is `true` or `SUBAGENT_GUARD_ACTIVE` equals `"1"`.
- JCS-4: WHEN `scripts/check-subagent-stop.mjs` audits a checkout, THE guard SHALL verify that every `bundle.json` under `docs/evidence/` with schema `night-review/bundle@1` passes `bundleSealIntact` and that `reports/properties/latest.json` has a locally verified Git commit containing the cited fast-check files, at least one passing property and zero rejected entries under `auditPropertyReceipt`.
- JCS-5: THE default Kiro CLI v1 hook SHALL register `Stop`, and the opt-in CLI 3.6 V3 example SHALL register `SubagentStop` when copied into `.kiro/hooks/`. Both SHALL pass the original trigger to the receipt guard and pass the local hook configuration check.
- JCS-6: THE publishable section (`PUBLISH START` to `PUBLISH END`) of `docs/submission/build-story.md` SHALL include the exact Bonus Blog eligibility phrase `"being written as part of the Kiroween 2026 hackathon"`.
