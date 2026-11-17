# Contributor PR review: #40 clash log (issue #29)

Actual author and reviewer: Kiro CLI (task #45, parent #37). Date: 2026-11-16, America/Los_Angeles.
No GitHub review or comment was posted. This note is for the coordinator to publish.

## Native Workflow run

- Recipe: `.kiro/workflows/contributor-pr-review.workflow.json`, launched with Kiro's `run_workflow` tool.
- Workflow ID: `wf_0b2ce64faf14a4aa`, run label `contributor-pr-review-40`. Steps: `inspect-diff` (wf-code-reviewer), `run-checks` (wf-coder), `browser-replay` (wf-coder), `report` (wf-code-reviewer). All four completed.
- Candidate: `4fb0f88eeb5109d38db367f1fbcaf4c4fe8589ce`. Base: `c65f49e7bd70ef81244d83d906f9e6521bef3020`. Six files, +134 −3, nothing under `src/game/`.
- Raw outputs (ignored by git): `.artifacts/kiro/contributor-review-40/`. Step summaries below are taken from the workflow's `report.md`; I did not re-run the checks outside the Workflow.

## Checks run by the Workflow

| Command | Exit | Result |
| --- | --- | --- |
| `node --test tests/match/clash-log.test.js` | 0 | 4 of 4 pass |
| `node scripts/verify-duel.mjs` | 0 | 164 of 164 pass; animation check 2 of 2 files (structure only) |
| `npm run build` | 0 | built |
| `node scripts/browser-match-check.mjs --showcase --summary --out-dir .artifacts/kiro/contributor-review-40/default-file` (file://) | 0 | 4 of 4 steps, 0 console errors |
| Same showcase against local HTTP build (`python3 -m http.server`, 127.0.0.1) with `&log=1` | 0 | 4 of 4 steps, 0 console errors |
| Same, without `log` | 0 | 4 of 4 steps, 0 console errors |

Chrome 157.0.8103.52, seed 60. Build SHA-256 for all three browser runs: `a6b832113eb42d2b8533d65470520ea3082605ddf030bbe72636bbc20dd5efbc`.

Because the stock script does not read the log element, the browser step used an instrumented copy (`probe-check.mjs`, in the ignored artifacts folder) that only adds DOM reads. Probe runs also exited 0 with 4 of 4 steps and 0 errors.

| Observation | `?log=1` | omitted |
| --- | --- | --- |
| `.match-clash-log` elements | 1 (rounds 1 to 5, replaced not appended) | 0 |
| `[aria-live]` elements | 1 (`role=status`, `aria-live=polite`) | 0 |
| `#match` children | 8 | 7 |

Round 5 text on screen matches the engine events dumped by the Workflow (`round5-events.txt`):

1. Your Sheriff in lane 1 hit the Wizard Base: 3 → 2 orbs
2. Your Mounted Billy in lane 2 hit the Dragon: 5 → 2 orbs
3. Dragon in lane 2 hit your Mounted Billy: 3 → 0 orbs
4. Your Mounted Billy in lane 2 was defeated

## Acceptance (#29)

All seven items are met as far as the Workflow could observe: event-only sentences, no hidden Wizard card (by reading), both lines for a simultaneous clash, tests built from seed 60, polite live region showing the latest clash only, no new element without `?log=1`, and `verify-duel` passing. Screen-reader announcement was not tested.

## Findings

Confirmed bugs: none observed. Acceptance gaps: none observed.

Unverified risks for the author or coordinator to decide on (not reproduced):

1. **Error path.** `src/main.js` line ~64 publishes the pending log whenever status is not `playing`, but the pending log is set in `applyAction` before playback. After a presenter error or leaving mid-clash, the next render could show a clash that was never fully played. It exposes only Engine-state information. No step forced a presenter failure.
2. **Layout at intermediate widths.** The log is absolutely positioned (`match.css`). The author checked 1440×900 and 390×844 only. No screenshots at about 760 to 900 px wide were taken, so overlap with the hand tray or deck pile is unchecked.
3. **Design notes, disclosed by the author and observed as described:** spells appear with the following clash rather than when cast; an empty live region exists from the first render under `?log=1`.

Verdict from the Workflow: ready with gaps (the two unverified risks above).

## Not done

- Human playtest, real screen reader, real phone: not run.
- Forced presenter-error test and intermediate-width screenshots: not run.

## Artifact hashes (SHA-256)

| File | Hash |
| --- | --- |
| `report.md` | `626a0fa8471673e1fd4ae6772866c1ae72aaff0a6f46929ad9b9292b0fb996b8` |
| `inspect-diff.md` | `7d1a9b0a43c65bfdcf466f4d407f73b5636dd60910b3c653a8e27bd266cb3a2d` |
| `run-checks.txt` | `9a83cee9d5d3990229568852dea0b0f4b724f2c15bfbae0e56c5c13dd8547c12` |
| `browser-replay.md` | `0ef82ff644b430bae4ee72e17ad9454065ce9fc89ded7448d0b94e77c140f468` |
| `http-log-on/browser-run.json` | `779a027b75b17ec015f6a7815a228808b416daa1c38b45978eff13dd9ba2f7b6` |
| `http-log-off/browser-run.json` | `47305831d411d3463e36f24503d87338eb18c3491424a9b1cd8c51799f7ed68c` |
| `default-file/browser-run.json` | `15b1676028d27e9d7ef2d8efcb7d23f3253d5242c95d5a6710e9b4f049560658` |
| `probe-log-on/probe.json` | `7653e91b0784afa54dbf0f23645c48398fc48afa0a51704e9cefd16b7d4c4f74` |
| `probe-log-off/probe.json` | `454aee7d4cd4c34bdef57855a912d26da085e30af0e21d49be8701b9b27a6a67` |
| `round5-events.txt` | `cbb87ad5358f6066c33118fe07fb2304754161858b6f9f51438d90e86d1f2b6e` |
