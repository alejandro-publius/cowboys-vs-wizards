# Orb Duel Workflow run

Kiro CLI 3.3.0 completed both steps of `orb-duel-replay` against the playable match at `64e3614` on November 15, 2026. Codex authored the saved Workflow and the replay script’s separate output option. Kiro ran the checks in two step sessions.

- `presenter-tests` ran `node --test tests/match/presenter.test.js`. Six passed.
- `chrome-replay` built the game and replayed seed 0 in Chrome. It observed eight of eight scripted steps with zero console errors.
- The HTML SHA-256 matched the original Orb Duel closeout build (`41971491f1df4727b498d527da91265e61dd96c207dd166f3c6d5c96e94b79e5`).

The first replay captured both screenshots before Chrome’s profile removal returned `ENOTEMPTY`. Codex added bounded retries to the cleanup. Kiro retried the replay and wrote the receipt and both screenshots to its temporary output directory.


## Opening and showdown in one Workflow

On November 16, Kiro CLI ran the saved three-step Workflow through `run_workflow`. The first run passed both routes and exposed two missing fields in the report. Codex changed the report to read both step outputs directly. The rerun `wf_30bc03349c699917` recorded both exact commands and both exit statuses, with 112 Node tests, eight opening checks and four showdown checks. The two browser receipts identify the same standalone HTML. The Mac project folder has the workflow log and report.

The local Power returned `pass` for the real seed-0 and seed-60 receipts, `fail` for an incorrect showcase seed, and `stale` for a changed build. Clean and working checkouts of release `50163ee` produced identical standalone and web HTML. Both Chrome routes passed again, and the deployed web HTML matched the clean build. [Deployment](https://github.com/alejandro-publius/cowboys-vs-wizards/actions/runs/43954314805) · [Kiro workflow authoring](https://kiro.dev/docs/workflows/authoring/)
