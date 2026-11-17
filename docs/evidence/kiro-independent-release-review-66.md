# Independent release review recipe (#66 / #37)

Author: Kiro (this file). Not committed; the coordinator reviews and commits.

## Status

- `.kiro/workflows/independent-release-review.workflow.json` is **authored**. The first five `fs_write` attempts failed with "The permission request failed before it was answered." The sixth, after the file-specific approval, returned "Created the ... file." Authored means the file exists. It has not been validated or executed.
- The two files written are this note and that workflow file.
- No shell command, browser check, build or Workflow was run by me. Every shell and search call I attempted in the earlier sessions failed on the same permission message.

## Authored workflow

Same schema as `orb-duel-replay.workflow.json` and `contributor-pr-review.workflow.json` (`name`, `description`, `steps[]` with `type`, `id`, `agent`, `prompt`).

1. `freeze-source`: confirm HEAD matches the user-provided `expected_sha` Workflow input with no tracked changes. Record the origin URL and the SHA-256 of the built HTML and `build.json`, with a missing file reported as pending.
2. `run-checks`: record `node --version`, run `node scripts/verify-duel.mjs` and `npm run build`, rehash the build, then run the seed 0 and seed 60 (`--showcase`) browser replays. Record exit status, observed steps, console errors and receipt paths.
3. `report`: write `.artifacts/kiro/independent-release-review/report.md` with provenance, expected versus observed results, claims checked, pending items and limits. Human approval and device/art approval are separate lines, each pending unless a named person recorded it.

All stages are read-only. They do not deploy or post, and they write only under `.artifacts/kiro/independent-release-review/`.

## Checks

| Check | Result |
| --- | --- |
| `git rev-parse HEAD`, `git status --short` | Not run (permission failure). |
| `node scripts/verify-duel.mjs` | Not run (permission failure). No exit status or counts. |
| Search for `build.json` and flags in `scripts/browser-match-check.mjs` | Not run (permission failure). |
| Workflow execution | Not run. No native receipt. |

## What was read

`.kiro/workflows/orb-duel-replay.workflow.json`, `.kiro/workflows/contributor-pr-review.workflow.json`, and the first 80 lines of `scripts/browser-match-check.mjs`. That header lists `--seed`, `--showcase` (always seed 60), `--summary`, `--out-dir` and `--url`, and the page path `dist/cowboys-vs-wizards-board-duel.html`. The `--seed 0` form and the `build.json` location were not confirmed by running anything.

## Limits any resulting review must state

Scripted browser replays support flow and position claims only. Art approval needs rendered review. Clarity and fun need a human playtest. Real-device behavior is not covered by headless Chrome on one machine.

## Coordinator review and checks — November 17, 2026

Kiro authored the initial recipe and this note after a file-specific **Allow once** approval, with no broad tool grant. The coordinator then made the frozen commit a required Workflow launch input so the recipe remains usable after this PR changes main, and added an explicit `--web` build stage. This targeted correction is coordinator-authored, not Kiro-authored.

Coordinator ran `node scripts/verify-duel.mjs` on worktree HEAD `667c1264a95d9602e20b1b5d3235a492bf450de5`: **222/222 Node tests** and **2/2 GLB structural checks** passed. Coordinator ran `npm run build -- --web`: passed, building `dist/web/index.html`. These are coordinator-run checks, **not** a native Workflow execution or a browser replay. No human, real-device, animation-quality or art approval is implied.

Native Workflow execution and its own three-step receipt: **pending**. Its correctness remains unverified until a separate actual Kiro Workflow run reports IDs, source commit, commands, pass/fail results and browser receipts.
