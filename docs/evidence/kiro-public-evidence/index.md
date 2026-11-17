# Kiro public evidence pack

Four structured extracts that back the first gap in [`docs/kiro-brag-sheet.md`](../../kiro-brag-sheet.md). Written against released commit `65ce1f1`. Each is a JSON summary of named source files, not the original log or a transcript. Each lists its sources with a SHA-256 computed from the bytes read, and states what was redacted. Where a source is untracked, the hash lets the holder of the original file confirm the extract.

This pack makes no Crew bonus claim and no separate-repository claim. The runs below are ordinary Kiro CLI delegation. It says nothing about the live release or any current replay.

| Claim | Actual app | Commit / run | Evidence |
| --- | --- | --- | --- |
| Build plus seed-0 Chrome replay: 8 of 8 steps, 0 console errors | Kiro CLI (non-interactive chat) | base `e7cddfd`, 2026-11-16 | [01](01-sheriff-runtime-smoke.json) |
| `PostFileSave` hook regenerated the card catalog; 3 of 3 registration tests, exit 0 | Kiro CLI 3.3.0, isolated worktree | `36ecede` | [02](02-card-save-hook.json) |
| `SessionStart` hook ran 19 of 19 presenter, controller and card-model tests | Kiro `duel-presenter` agent | stamped 2026-11-16T06:30:14Z | [03](03-session-start-hook.json) |
| Saved Workflow rerun: 112 tests, 8 opening and 4 showdown checks | Kiro CLI 3.3.0 `run_workflow` | `wf_30bc03349c699917`, release `50163ee`; [deploy run](https://github.com/alejandro-publius/cowboys-vs-wizards/actions/runs/43954314805) | [04](04-workflow-wf_30bc03349c699917.json) |

## Who did what

Kiro executed each run above. Codex authored the saved `orb-duel-replay` Workflow, changed its report after the first run, and ran the 134-test combined check mentioned beside extract 01. Fable wrote the rules engine and CPU that the replays exercise. Attribution comes from the project evidence documents and receipt contents, not from git authorship.

## How the extracts were made

A local script read the named files, kept an allowlist of fields and wrote JSON. Extracts 01 and 02 read the original receipt files. Extract 03 reads the tracked hook output. Extract 04 reads two tracked project documents only, because its run log was not available.

## Limits and missing receipts

- **Missing:** the `wf_30bc03349c699917` workflow log and report. The project docs say they are on the Mac but name no path, so none was read.
- **Missing:** the compaction log (`.artifacts/kiro/duel-compaction.jsonl`, receipt `861af78-1794855476196`). It was not at that path in this worktree or in the submission-preflight worktree's `.artifacts/kiro/`, so there is no compaction extract.
- **Not read:** the seed-60 browser receipt for the Workflow rerun and the Crew preview reports.
- Extract 02 takes the app and version from `docs/evidence/kiro-card-pipeline.md`. The receipt files record neither, and no date.
- Extract 01's launch receipt was written at start, so its exit code comes from `exit-code.txt`. The receipt reports `uncommittedChanges: true`, and the smoke covers one seed-0 route only.
- Original receipt and log files, screenshots, machine details and local paths are omitted.
