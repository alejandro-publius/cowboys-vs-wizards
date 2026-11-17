# Final polish: actual Kiro Workflow verification

Date: 2026-11-16 (America/Los_Angeles). Frozen candidate:
`02b1bf8785f154dcee8e2a21293d6a455a3bf82e`.
Branch: `kiro/final-polish-verification`. This run tested the integrated keyboard
focus repair; it made no runtime, asset, test, or workflow source edits.

## Native run and observed results

Kiro CLI V3 invoked `run_workflow` once with the saved
`.kiro/workflows/orb-duel-replay.workflow.json` as `workflowPath`.
The persisted definition's steps exactly match that recipe.

- Workflow: **`wf_0572a745f5194cf1`**.
- Label: `orb-duel-replay-final-polish`; status: **completed**.
- Parent session: `sess_c81e729c-3dee-4712-90aa-20bdb71ef58a`.
- Step agent: `wf-coder`; parent model: `auto`, no model override.
- Launcher: 04:35:41–04:38:40 UTC on 2026-11-17, **179 seconds**, exit **0**.
  Its five-minute watchdog did not fire.
- The sequence and all three persisted step nodes show `completed`.

| Step | Command | Observed result |
| --- | --- | --- |
| verify-duel | `node scripts/verify-duel.mjs --browser` | Exit 0; **157/157 tests passed**, 0 failed/cancelled/skipped/todo; 2/2 asset structure preflights passed; seed **0**, **8/8** browser steps, no pending IDs, **0 console errors** |
| verify-showdown | `node scripts/browser-match-check.mjs --showcase --summary --out-dir .artifacts/kiro/showcase` | Exit 0; seed **60**, **4/4** browser steps, no pending IDs, **0 console errors** |
| report | Writes `.artifacts/kiro/replay/report.md` | Native step completed and report exists; this is a file-write step, not a shell command with an exit code |

Both browser receipts identify revision `02b1bf8`, Chrome/157.0.8103.52,
and `uncommittedChanges: false`. The isolated worktree used an ignored real
`node_modules/` directory with symlink children, and was clean before and after
Kiro's run.

Both receipts identify the same 64,356,507-byte standalone HTML:

`873a8962396263a4feb2dc382bdb3f464cdb203d0eb19f1cc153caa82a3e6eca`

Codex independently hashed `dist/cowboys-vs-wizards-board-duel.html` after
completion and confirmed that exact SHA-256. It also inspected both original
receipt JSON files and the completed workflow nodes.

The step agents appended `; echo "EXIT_STATUS=$?"` and
`; echo "EXIT=$?"` respectively to expose each Node command's exit status.
Both original command outputs contain the corresponding zero sentinel; the
result is not inferred solely from the wrapper shell's exit code.

## Evidence and interpretation

- [Workflow state](kiro-final-polish-verification/workflow-state.json),
  [definition](kiro-final-polish-verification/workflow-definition.json),
  [sessions](kiro-final-polish-verification/workflow-sessions.json), and
  [cleanup record](kiro-final-polish-verification/checkpoint-cleanup.json) came
  from this exact run's session store.
- [Seed 0](kiro-final-polish-verification/seed-0-browser-run.json) and
  [seed 60](kiro-final-polish-verification/seed-60-browser-run.json) are the actual
  browser receipts.
- [Kiro's report](kiro-final-polish-verification/workflow-report.md) is preserved.
  It unnecessarily labels a seed-60 Node test count “pending”: the showcase
  command does not run Node tests. The 157-test result belongs to verify-duel;
  this wording does not represent an unrun required test.
- [Launcher receipt](kiro-final-polish-verification/launcher-receipt.json) records
  the invocation and exit. [Source manifest](kiro-final-polish-verification/source-manifest.json)
  records original and saved SHA-256 values for every copy.

Only absolute worktree, project-root, and home path prefixes were replaced with
`<WORKTREE>`, `<PROJECT_ROOT>`, and `<HOME>`. No result fields were removed or
rewritten. Raw CLI logs, browser screenshots, and build output remain outside
tracked evidence. Per-run workflow usage, when present in the original state,
is not an account balance or a separate billing query.

These are scripted gameplay and structure checks, not human visual approval,
animation-quality scoring, a general accessibility audit, or a published-release
claim. The coordinator owns the separate web/menu/keyboard review and release.
Crew app trust, its live UI report, and production scheduling are not tested by
this workflow.
