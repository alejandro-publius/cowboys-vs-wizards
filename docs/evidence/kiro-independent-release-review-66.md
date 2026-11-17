# Independent release review recipe (#66 / #37)

Original recipe and first version of this note: Kiro CLI V3. Coordinator-authored additions are identified below. The original authoring notes are retained as historical context.

## Initial authoring status (historical, superseded by the execution below)

- `.kiro/workflows/independent-release-review.workflow.json` was **authored**. The first five `fs_write` attempts failed with "The permission request failed before it was answered." The sixth, after the file-specific approval, returned "Created the ... file." Authored means the file exists. It has not been validated or executed.
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

The earlier authoring-stage limitations above are historical; the following later, actual native Workflow execution supersedes the statement that no Workflow ran.

## Native Kiro Workflow execution — November 17, 2026 (coordinator-verified)

**Observed status: completed 3/3** in Kiro CLI 3.4.0 V3. The coordinator used the already-created isolated PR #76 worktree and approved individual requested commands/files, without a global or future-tool permission grant. The original Kiro CLI recipe executed the three independent stages `freeze-source` (reviewer), `run-checks` (coder) and `report` (reviewer). The terminal monitor displayed `independent-release-review - completed | 3/3`, with each stage checked, and the final reviewer verdict was **consistent with gaps**. This is a real native run, not merely a checked-in recipe.

- **Frozen source:** full `git rev-parse HEAD` value `75065999518656fc902b9f7fe5c98eefec5c8980` (PR #76's original head), correct `origin`, zero tracked modifications. The run was launched with the unambiguous short commit prefix `7506599` and Kiro recorded the corresponding full SHA. Temporary untracked `.kiro/agents/release-independent-review-66.json` and `node_modules` were deliberately excluded from the commit.
- **Tests:** `node scripts/verify-duel.mjs` exit 0, **222/222 Node tests**, **2/2 GLB structural checks**; source-based model structure does not establish believable animation.
- **Builds:** `npm run build` and `npm run build -- --web` both exit 0.
- **Real automated Chrome replays:** seed 0 **8/8** and seed 60 **4/4** observed steps, both exit 0, **zero console errors**, no flags, Chrome 157.0.8103.79; page digest `7ad145c9e245a1e22b73a13a690663108d0d45505a8ae343a07819685f71a547`, identical to the built static HTML. These are scripted replays, not human playtests.
- **Web artifact:** `dist/web/index.html` digest `5a44da9cba645b167c6c04d2cbee7438e852b15f9f7454602a16e168c04e1681`; embedded source SHA and `dist/web/build.json` were **not** present in the web build. Therefore web-build commit identity is **unverified**. The pre-build static HTML did not exist, so the frozen-before-build digest comparison is likewise pending.
- **Report:** `.artifacts/kiro/independent-release-review/report.md` exists in the isolated worktree and contains a command-by-command acceptance table, actual results and remaining gaps. The final stage's narrow `fs_write` permission for this exact local evidence path was approved **once** and the CLI then reported 3/3 completion. This is not an art-owner, human, phone or Safari approval.

**Local original receipts** (not included wholesale in Git because `.artifacts/` is intentionally ignored):
`.artifacts/kiro/independent-release-review/freeze.md`,
`.artifacts/kiro/independent-release-review/run-checks.txt`,
`.artifacts/kiro/independent-release-review/seed-0/browser-run.json`,
`.artifacts/kiro/independent-release-review/seed-60/browser-run.json`, and
`.artifacts/kiro/independent-release-review/report.md`.
Native stage session records in that worktree include `sess_fb52cf62-416f-4003-8007-06c55a2c9f19` (freeze),
`sess_2b155464-7e2d-42e1-b846-a1b6b8fd0ea7` (checks), and
`sess_04100790-42ca-4997-856f-108ae0107956` (report).
A distinct unique Workflow-run ID was **not captured**, so the 3/3 terminal monitor, individual native step sessions and written receipts are the execution evidence; no run ID is invented.

**Human gates remain:** final appearance/art approval, first-time human playtests, and real Safari/phone/device checks. No claim about fun, licensed-motion correctness, or submission readiness follows from this automated check. PR [#76](https://github.com/alejandro-publius/cowboys-vs-wizards/pull/76) and its verified run comment also record this checkpoint.
