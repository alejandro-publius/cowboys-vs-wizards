# Tasks: Showdown Wanted Bounty Draft & Agent Ownership Pipeline

- [x] 1. Enforce `REPAIR_AGENT_OWNERS` and `.kiro/agents/<name>.json` single-file ownership checks in `scripts/maintain-showdown-preview.mjs` (`SBP-1`, `PM3`).
- [x] 2. Author `.kiro/agents/showdown-bounty-drafter.json`, `.kiro/agents/showdown-bounty-reviewer.json`, and `.kiro/workflows/showdown-bounty-draft.workflow.json` (`SBP-2`, `SBP-3`, `SBP-8`).
- [x] 3. Implement `scripts/verify-showdown-bounty-draft.mjs` (`prepare`, `verify`, and `guard` modes) and tracked sample package `tasks/showdown-bounties/bone-marshal/` (`SBP-4`, `SBP-5`, `SBP-6`, `SBP-7`).
- [x] 4. Verify with `tests/game/showdown-bounty-draft.test.js`, `tests/game/dec4-scorecard.test.js`, `tests/game/dec4-trace.test.js`, and `tests/assets/links.test.mjs` (`SBP-1..SBP-8`).
