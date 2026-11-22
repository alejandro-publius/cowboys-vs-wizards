# Contest balance: fenced balancer and bounded repeat

Date: authored in one Kiro IDE session (Kiro, model claude-opus-5.5), America/Los_Angeles. Status: **authored, not run.** This session had no shell, so no test, workflow, hook trigger or simulation ran. The coordinator owns testing, staging and the commit. Every result below is pending until a real receipt exists.

## Goal
Up to 6 attempts. Each attempt drafts one numeric change to one troop card JSON under `.kiro/specs/duel-card-pipeline/cards/`. A separate reviewer command simulates it and the loop stops on the first PASS, which needs both a paired tune range and a disjoint holdout range. No candidate is applied to the real cards, the generated specs or a release.

## Files (owned paths only)
| Path | Role |
| --- | --- |
| `.kiro/agents/showdown-balancer.json` | Balancer profile: tools `read`, `write` only; no MCP servers; `fs_write` allow rule limited to scratch card files; deny rules for real specs, source, scripts, tests, docs, receipts and status; `shell` denied; one unscoped `PreToolUse` hook running the fence. |
| `scripts/contest-balance-fence.mjs` | PreToolUse fence. It reads the hook event on stdin (`hook_event_name`, `cwd`, `tool_name`, `tool_input`; camelCase accepted) and exits 0 to allow or 2 to block, failing closed on any error. Read tools are allowed. `write`/`fs_write` is allowed only for one existing `.artifacts/contest-balance/attempt-<1..6>/scratch/.kiro/specs/duel-card-pipeline/cards/<card>.json` whose card is in the scratch marker's troop whitelist, in an attempt without `receipt.json`, with no symlink on the path and no `..`, `.`, `//`, `\`, `~` or `%`. Shell, code, every MCP tool (`APPROVED_MCP` is empty) and unknown tools are blocked. |
| `scripts/contest-balance.mjs` | Reviewer-owned CLI: `reset`, `prepare`, `review`, `verify`. It reuses `scripts/night-review.mjs` (`changeField` single-field check, `summarize`, `paired`, `canonical`, `sealBundle`/`bundleSealIntact`, seat tolerance). |
| `.kiro/workflows/night-shift-review.workflow.json` | Replaced the single-finding 3-step recipe. The finding flow stays available as `node scripts/night-review.mjs run`. |
| `tests/game/showdown-balancer-fence.test.js`, `tests/game/showdown-balancer-loop.test.js` | New tests (see below). |

## How an attempt works
1. `prepare` writes `attempt-<n>/scratch/` from `git archive` of the base commit (HEAD at attempt 1; later attempts reuse attempt 1's base). It adds the marker `.contest-balance-scratch.json` with the troop whitelist (troops in the even-match `DECKS` that have a card JSON), plus `brief.json` with the bounds, the policy and every earlier verdict and share. It records the marker and card hashes in `prepare.json`.
2. The `showdown-balancer` agent edits one number in one scratch card. The fence blocks everything else.
3. `review` diffs the scratch tree against a fresh archive of the base. It requires exactly one changed card file, nothing added, removed or symlinked, an unchanged marker, one whitelisted field (`attack`, `health`, `stars`) inside its bounds, byte-identity with `changeField` applied to the base text, and no repeat of an earlier attempt. It then builds the candidate in a separate temporary snapshot (`sync-card-specs.mjs` and the receipt regeneration, as in night-review), runs `tests/game/showdown-properties.test.js` and `tests/game/showdown-fair-bot.test.js` on baseline and candidate, and plays tune `0:200` and holdout `100000:200` deals from both seats with the snapshot's level-2 bot. It writes the game records, a sealed `receipt.json` and `status.json`. `status.pass` is true only on PASS with the real card directory hashes unchanged.
4. `verify` checks the seal, the game record hashes, the summaries recomputed from the records, the recomputed decision, the scratch card hash and agreement with `status.json`.

## Workflow shape
- `reset-run` (wf-coder runs `reset`, which archives any earlier run rather than deleting it and writes `pass: false`).
- `balance-attempts`: `type: "repeat"`, `maxIterations: 6`, `onMaxIterations: "abort"`, `stopCondition.fileCheck` `{path: ".artifacts/contest-balance/status.json", jsonPath: "$.pass", value: true}` with a boolean value. The body is `prepare-attempt` (wf-coder), `draft-change` (showdown-balancer) and `review-attempt` (wf-code-reviewer).
- `verify-receipt` (wf-coder).

This copies the repeat syntax of `.kiro/workflows/card-summoning-lore-review.workflow.json`, which completed as native run `wf_ecb54a0b1a3d2a92` ([evidence](kiro-lore-review-loop.md)). A missing status file is not success: `reset` creates it as false before the loop. Whether the runtime treats an absent file as unmet is a runtime property. It is **unverified here**. With `abort`, six FAIL attempts end the run before `verify-receipt`; a coordinator can still run `verify --attempt <n>`.

## Decision policy (recorded in every receipt)
- PASS needs, on **both** tune and holdout, the candidate's Cowboy share and Wizard share each within 45–55% of all games (draws count for neither side). First-seat skew may not grow by more than 1 pp over baseline. Both property suites must pass, and the change must alter at least one game.
- These are reproducibly measured match win shares for these seeds, decks, rules and bot only. They are estimates under the tested conditions, not a claim that any individual card is balanced.

## Per-card measurement coverage (separate from the verdict)
The receipt's `perCard` section reports, per troop and per set, the cohort of games in which that card's side summoned at least one copy from hand. For each card it gives the side's win share with and without the card and a status: `unmeasured` (0 games), `sparse` (fewer than 50 games in either group) or `measured`. This is an observational association. Cards drawn more often in long games pick up game-length effects, so it is not causal and it is not used in the verdict. Spells, traps, gear and locations get no estimate. No mechanic changed to collect these numbers; the play loop only reads `summon` events.

## Hook and tool-name matching
- The tool names the fence accepts are `read`, `fs_read`, `glob`, `grep`, `write` and `fs_write`, with write commands `create` and `str_replace`. These are the names in this repo's agent profiles and the Kiro CLI built-ins. Any other name is blocked, so a renamed V3 write tool would fail closed (blocked) rather than open.
- The hook format matches the existing `.kiro/agents/showdown-presenter.json` (`trigger`, `action.type: command`). No real PreToolUse trigger has been observed for this profile yet. That is **pending**, and it is the check that proves the fence is wired.

## Checks to run (pending)
```
node --check scripts/contest-balance-fence.mjs scripts/contest-balance.mjs
node --test tests/game/showdown-balancer-fence.test.js tests/game/showdown-balancer-loop.test.js
```
Optional smoke (this writes only under ignored `.artifacts/contest-balance/`): `node scripts/contest-balance.mjs reset && node scripts/contest-balance.mjs prepare`, then edit one scratch card by hand and run `node scripts/contest-balance.mjs review` and `verify`. After it, `git status` should show no change under `.kiro/specs/duel-card-pipeline/cards/` or `src/game/card-specs.generated.js`.

Unverified assumptions: the property tests run inside a `git archive` snapshot without `node_modules` (night-review already relies on this), and 2×200-deal level-2 runs finish in reasonable time. Neither has been measured.

## Not done
No simulation, PASS, card change, workflow run, hook trigger, build-log entry (`docs/kiro-build-log.md` is not an owned path) or commit. No usage or credit figures are claimed.
