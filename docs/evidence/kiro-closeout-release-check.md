# Kiro closeout release check

Date: 2026-11-16 (America/Los_Angeles), run began about 17:51 PST.
Frozen base: `e9aeb063abb947c7fc9447595d9143bd04d71ac0`, branch `kiro/closeout-release-check`, checked out in worktree `.worktrees/kiro-final-release-check`. No app, test, build or workflow source was edited by this task.

## 1. Saved Kiro Workflow run (Kiro CLI, `run_workflow`)

- Workflow: saved recipe `orb-duel-replay` (`.kiro/workflows/orb-duel-replay.workflow.json`), launched once with `run_workflow` `workflowPath`, run label `orb-duel-replay-closeout-release-check`. No model override.
- **Workflow ID: `wf_5bd13532f5142477`**, final status `completed` (per `inspect_workflow`). Steps ran in agent `wf-coder`, model `auto`.
- Step sessions (from `sessions.json`):
  - `verify-duel`: `sess_0714cf00-fde5-43ef-aff4-5f95d002b778`
  - `verify-showdown`: `sess_bf842489-5412-4115-aaed-6e36cd13b671`
  - `report`: `sess_9f417649-1df7-4046-9de1-75ae00136526`
- Orchestrator session: `sess_1dbf591d-46a2-467e-86b3-19cd80af632d`.
- Run state was copied after the tool returned from its session store, `~/.kiro/sessions/6fd9dcfb7f622440/workflows/wf_5bd13532f5142477/`. Raw session logs were left in place outside the worktree.

| Step | Command (run by the step agent) | Exit | Result (step-reported) |
|---|---|---|---|
| verify-duel | `node scripts/verify-duel.mjs --browser` | 0 | 157 tests, 157 pass, 0 fail/cancelled/skipped/todo (4845.95 ms). Asset structure checks 2 of 2 (`dragon.glb`, `mounted-billy.glb`; structure only, not motion quality). Chrome/157.0.8103.52, seed 0, revision `e9aeb06`, 8 of 8 steps observed, pending IDs none, console errors 0. |
| verify-showdown | `node scripts/browser-match-check.mjs --showcase --summary --out-dir .artifacts/kiro/showcase` | 0 | Seed 60, revision `e9aeb06`, 4 of 4 steps observed, pending IDs none, console errors 0. |
| report | writes `.artifacts/kiro/replay/report.md` | n/a | Report written from the two step results; it ran no checks. |

Standalone duel HTML (`dist/cowboys-vs-wizards-board-duel.html`, 64,355,866 bytes) SHA-256 printed by both replays: `a5d0c756077e89afa4f8a107c64e863a7d09cba48456f8229a8b42b4fa208bd2`. This is the replay-printed value; neither the steps nor I hashed that file separately. Seed 0 and seed 60 printed the same hash, so they used the same standalone build.

Both receipts record `"uncommittedChanges": true`. At the end of the run `git status --short` showed only untracked `node_modules`. I did not investigate further which path set the flag.

Usage: this run emitted no usage figures. None are recorded.

## 2. Web build (me, direct command, after the workflow)

- `node scripts/build.mjs --web`: exit 0, output `Built dist/web/index.html` ([log](kiro-closeout-release-check/web-build.log)).
- `shasum -a 256 dist/web/index.html`: `863ab8bd525cb2e78b0e73b529406b73c6a2381f982f2854e71340df79718e02`. This equals the coordinator's expected frozen HTML hash.

## 3. Menu and readability checks (Codex, not re-run here)

Source: `.worktrees/kiro-closeout-integration/.artifacts/kiro-closeout/` in the root repo (listed by filename only; PNGs not copied).

- Menu: `menu-review/menu-run.json` reports 11 checks, `menu-review.log` reports `"checks": 11`, `"errors": []`. Seen in the JSON: five menu hit targets, keyboard/Escape focus, locked achievements, deck counts, illustration decode. Original `menu-run.json` SHA-256 `753647e63045aede9af36f3c31935d7ac2dab95c422a6351f7aec65123ebfc85`.
- Readability: `deck-review.log` (SHA-256 `1faacce1399067798c1c485d2809693c6dd9e3e037ab3bba4fc233f2f6d3d6c7`) covers `desktop-1280x800` and `phone-390x844`, with no small targets, overflow 0. Tracked measurements are in `docs/evidence/deck-workbench/measurements.json`.
- **Hash binding: not present.** None of these files contains the HTML SHA-256, and `build-web.log` there holds only `Built dist/web/index.html`. The receipts are unbound by hash. They are timestamp-adjacent to a web build in the integration worktree (build log 17:43, reviews 17:45 to 17:46), and the coordinator states they ran on the same frozen UI. I cite them as Codex checks, not as verification of hash `863ab8bd…`. I did not re-run them.

## 4. Not run

- Crew/NightWatch gameplay review: not run by this task. The earlier NightWatch 403 is that app's execution policy and is not evidence of a global Crew limitation.
- No new human playtest, rendered-appearance review, or performance measurement. The replays observe scripted states only.
- No PR, push, merge, deploy or publish. Nothing here claims a published release.

## 5. Files and redactions

- [workflow-report.md](kiro-closeout-release-check/workflow-report.md): the `report` step's output, copied unchanged.
- [workflow-state/](kiro-closeout-release-check/workflow-state): `workflow-state.json`, `workflow-definition.json`, `sessions.json`, `checkpoint-cleanup.json` copied unchanged, plus `step-output-*.md` extracted from `capturedOutputs`.
- [receipts/](kiro-closeout-release-check/receipts): `seed-0-browser-run.json` (SHA-256 `bc032cc7…8bb0`, from `.artifacts/kiro/replay/browser-run.json`) and `seed-60-browser-run.json` (SHA-256 `42c82e5c…8241`, from `.artifacts/kiro/showcase/browser-run.json`), unchanged.
- No path redaction was applied. Copies contain the local home path (`/Users/alexvintera/...`) and the machine model in receipt metadata. No credentials were seen.
- Screenshots stay under ignored `.artifacts/kiro/{replay,showcase}/`. `dist/` is also ignored.

## Coordinator verification

Codex independently hashed the standalone HTML after the Kiro run: `a5d0c756077e89afa4f8a107c64e863a7d09cba48456f8229a8b42b4fa208bd2`, matching both receipts. Seven copied original files (four Workflow-state files, two browser receipts and the report) match their source bytes exactly. Six evidence JSON files parse; linked files exist. The small `web-build.log` was explicitly included after the generic log ignore rule omitted it from the worker commit.

The browser receipt flag uses `Boolean(git status --porcelain)`, which includes untracked files. The worktree has an untracked `node_modules` symlink; the source/art/test/workflow paths have no diff from frozen `e9aeb06`. This explains why the flag is broader than a runtime-source modification check; the original flag remains unchanged. These inspections are Codex review, not additional Kiro browser runs.
