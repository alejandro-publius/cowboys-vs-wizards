# Protected Kiro Agents & Showdown Wanted Bounty Draft Pipeline

- **Author / Tooling:** Antigravity (feature branch `antigravity/scorecard-protected-agents`). No native Kiro CLI session is claimed in this note.
- **Spec:** [`.kiro/specs/showdown-bounty-pipeline/requirements.md`](../../.kiro/specs/showdown-bounty-pipeline/requirements.md) (`SBP-1..SBP-8`, `PM3`).
- **Scope:** Zero edits to `src/game/` or shipped card balances.

## What changed

1. **Preview Repair Ownership Fence (`PM3`, `SBP-1`):**
   - [`scripts/maintain-showdown-preview.mjs`](../../scripts/maintain-showdown-preview.mjs) now pins `REPAIR_AGENT_OWNERS` (`showdown-preview-maintainer` -> `src/ui/showdown-3d/gallery.js`, `showdown-camp-maintainer` -> `src/app.js`) and verifies `.kiro/agents/<agent>.json` single-file `fs_write` rules and shell exclusion before running or dispatching a repair.
2. **Showdown Wanted Bounty Sandbox (`SBP-2..SBP-7`):**
   - Added [`.kiro/agents/showdown-bounty-drafter.json`](../../.kiro/agents/showdown-bounty-drafter.json) (fenced to `tasks/showdown-bounties/**`, no shell, `PreToolUse` guard) and read-only verifier [`.kiro/agents/showdown-bounty-reviewer.json`](../../.kiro/agents/showdown-bounty-reviewer.json), orchestrated by [`.kiro/workflows/showdown-bounty-draft.workflow.json`](../../.kiro/workflows/showdown-bounty-draft.workflow.json).
   - Added [`scripts/verify-showdown-bounty-draft.mjs`](../../scripts/verify-showdown-bounty-draft.mjs) and tracked reference draft [`tasks/showdown-bounties/bone-marshal/bounty.json`](../../tasks/showdown-bounties/bone-marshal/bounty.json), checking 16-card Wizard escort legality, rarity caps, non-decreasing 5-hunt progression, human art-approval gates, and seeded Showdown simulation winnability across all 5 hunts.
3. **Dec 4 Scorecard `agents` Target (`SBP-8`):**
   - `node scripts/scorecard.mjs --offline` now measures **`8` active protected writer agents** (`target >= 8` -> **`PASS`**) with `0` unprotected writers and `0` shared write paths.

## Codex integration review

Codex ran the local verifier on the Bone Marshal example. With the post-Trail deck and seeds 0–23, the Cowboy won 23, 23, 23, 23 and 22 games across the five hunts. The scorecard and agent checks inspect configuration. The author and reviewer hook tests used local events. These checks establish deterministic winnability for this cohort. Human opponents have yet to play the draft.

The sample stays outside Camp. Mounted Billy is a Rare card a player can already own twice. Before release, the reward needs to handle players at the collection cap so their saves still load. See the [reward brief](../../tasks/showdown-bounties/bone-marshal/reward.md).

## Reproduce

```sh
node scripts/verify-showdown-bounty-draft.mjs verify tasks/showdown-bounties/bone-marshal
node --test tests/game/showdown-bounty-draft.test.js tests/game/dec4-scorecard.test.js tests/game/dec4-trace.test.js tests/assets/links.test.mjs
node scripts/contest-submission-check.mjs
node scripts/scorecard.mjs --offline
```
