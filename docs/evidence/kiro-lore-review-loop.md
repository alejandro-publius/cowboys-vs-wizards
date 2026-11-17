# K21: bounded Kiro lore-review loop

Date: 2026-11-16 (America/Los_Angeles, run about 18:03-18:05). Agent: Kiro (orchestrator session) launched a native Kiro workflow. Base: `e9aeb063abb947c7fc9447595d9143bd04d71ac0`.

## What was configured
- New recipe `.kiro/workflows/card-summoning-lore-review.workflow.json` with one native `repeat` node: `maxIterations` 3, `onMaxIterations` abort, `stopCondition.fileCheck` on `.artifacts/kiro-lore-review-loop/verdict.json` `$.approved == true`.
- Body: `author-catalog-summary` then `lore-reviewer`, both bundled `wf-coder`. The lore reviewer is a workflow step role with a strict prompt, not an installed custom agent.
- Native tools available: `run_workflow` (validates the definition at launch), `inspect_workflow`, `update_workflow`. No separate validate or wait command was exposed, so validation happened at launch and completion arrived as a notification.
- The legacy `card-summoning-circle.workflow.json` was not touched (hash in receipt).

## What was observed
- Run `wf_ecb54a0b1a3d2a92`, final status `completed`.
- Configured cap 3. Executed rounds 1 (`lore-review-loop#0`). Revision rounds 0. The reviewer approved on the first pass with no findings, so the stop condition ended the loop.
- Receipt: [receipt.json](kiro-lore-review-loop/receipt.json). Author output: [summary.md](kiro-lore-review-loop/summary.md). Verdict: [verdict.json](kiro-lore-review-loop/verdict.json).
- The eight card files and the legacy recipe have identical SHA256 before and after (listed in the receipt). `git status` showed only the new recipe as a change before these evidence files.

## Limitations
- Cards have names, faction and fields, no prose backstory. The review covers name/faction/theme consistency only.
- The reviewer's own verdict says it compared the summary to the eight card files only and did not consult `requirements.md` or `src/game/cards.js`, so rule descriptions were not checked against runtime rules.
- No art, balance, playtest, build or test claim. No game rules were improved. One approval is not evidence that rounds 2 or 3 would approve.
- Original run log (`run-stream.jsonl`, ignored under `.artifacts/`) is not committed; its SHA256 is in the receipt. The artifact directory also held coordinator-created files (task, launcher, baseline hashes) that were left as found.
