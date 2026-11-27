# Design: Showdown Wanted Bounty Draft & Agent Ownership Pipeline

## Architecture

1. **Preview Repair Ownership Verification (`PM3` / `SBP-1`):**
   - `scripts/maintain-showdown-preview.mjs` exports `REPAIR_AGENT_OWNERS` (`showdown-preview-maintainer` -> `src/ui/showdown-3d/gallery.js`, `showdown-camp-maintainer` -> `src/app.js`) and `verifyRepairAgentFence(candidateRoot, task)`.
   - Before running any baseline check or dispatching `kiro-cli`, `repairsFrom(candidateRoot)` reads `.kiro/agents/<agent>.json` inside the candidate checkout and verifies:
     - `REPAIR_AGENT_OWNERS[task.agent] === task.file`
     - `tools` includes `write` or `fs_write` and excludes `shell` / `execute_bash` / `*`
     - `permissions.rules` grants `fs_write` `allow` solely to `[task.file]`

2. **Showdown Bounty Draft Sandbox (`SBP-2..SBP-7`):**
   - Unlike the retired lane-duel `bounty-designer` (`tasks/bounties/**`), Showdown Wanted bosses follow `BOUNTIES` in `src/game/showdown/progress.js` (5 progressive hunts with a 16-card Wizard escort deck and `"board"` or `"lands"` boss arrival).
   - **Author (`showdown-bounty-drafter`):** `tools: ["read", "write"]`, `fs_write` fenced to `tasks/showdown-bounties/**`, guarded by `PreToolUse` (`node scripts/verify-showdown-bounty-draft.mjs guard`).
   - **Independent Verifier (`showdown-bounty-reviewer`):** read-only (`fs_write` denied on `**`), allowed only to run `node scripts/verify-showdown-bounty-draft.mjs prepare` and `node scripts/verify-showdown-bounty-draft.mjs verify`.
   - To select a new draft, the operator can put `{"id":"<bounty-id>","brief":"<design request>"}` in `tasks/showdown-bounties/active-brief.json`. Keep the request in place through verification. With no request the workflow checks the tracked Bone Marshal example. The author hook pins writes to the four draft files under the selected ID.
   - **Workflow (`.kiro/workflows/showdown-bounty-draft.workflow.json`):** orchestrates `prepare` -> `showdown-bounty-drafter` -> `verify` without touching live `src/game/` files or invoking asset generation before human gameplay approval.

3. **Tracked Reference Package (`tasks/showdown-bounties/bone-marshal/`):**
   - Provides a complete, verified Showdown Wanted boss draft (`The Bone Marshal`, boss `wizard-headless-horseman` arriving on turn `4`, reward `cowboy-mounted-billy`) that passes schema, rarity, progression, art-gate, and 5-hunt seeded Showdown simulation checks.
