# Parallel integration review — November 16, 2026 (Pacific)

Coordinator: Codex. Kiro work ran in isolated CLI 3.4.0 V3 sessions; both Claude terminals kept their existing ownership. This record covers the integration branch `codex/parallel-closeout-2200`; the merge/Pages run determines the published revision.

## Included work and attribution

| Work | Source | Review outcome |
| --- | --- | --- |
| Opt-in CPU difficulty | Rachel/Fable PR #47, merged separately | Normal unchanged; easy/hard use only public information. Simulation evidence is not a human balance verdict. |
| Opt-in clash log | Rachel/Fable PR #40 | Integrated alongside CPU selection. Only successful playback completion publishes the pending log; errors/leaving do not. Default remains off. |
| Documentation index/checker | Rachel/Fable PR #42 | Added balanced destinations, correct code delimiters, escaped punctuation and indented-code regressions during Codex review. |
| WebKit card faces | Kiro #43, `961218e` | Fixed CSS face stacking; baseline 0/6 and fixed 6/6 in Kiro's [comparison](kiro-webkit-card-fix.md). Coordinator repeated 6/6 in each browser on the combined web build. |
| Contracts and seeded properties | Kiro #44, `d57b797` | Three specs; six checks across 800 legal matches. Codex fixed single-seed replay's corpus-only coverage assertion. [Worker evidence](kiro-preview-contracts.md). |
| Contributor review Workflow | Kiro #45, `145c80a` | Actual native `wf_0b2ce64faf14a4aa`, four steps on frozen PR #40: 164 tests, two model structure checks, Chrome default/log routes. [Receipt](kiro-contributor-review-40.md). |
| Scoped steering and docs hook | Kiro #46, `740a856`, `b7490a7`, `8174bed` | Three file-scoped documents configured; activation not independently observed. Actual save hook failed and recovered. Codex corrected event parsing and Mac path aliases; Kiro repeated actual saves after the correction. [Hook proof](kiro-doc-link-hook.md). |
| Eight-topic submission write-up | Rachel/Fable PR #48 | Merged separately; current integration reconciles new evidence without claiming Kiro Web use. |

The clash-log spec documents an existing implementation; it is not evidence that all work began spec-first. Earlier Dragon/Mounted attack curves were Kiro-authored before the sourcing rule; current steering states that provenance explicitly.

## Commands and actual results

- On `099847adcaa03a228a7a3eb421889501a355e4bd`, `node scripts/verify-duel.mjs`: **179 tests passed**, zero failures; **2/2 GLB structure checks**. Structure checks do not approve animation.
- On that candidate, `npm run build` and `git diff --check` passed.
- Single-seed replay: `CLASH_LOG_SEED=0 node --test tests/match/clash-log-properties.test.js` failed before the review fix. After the fix: **5 passed, 1 corpus-coverage check skipped**, zero failures.
- Chrome 157 on that candidate: seed 0 **8/8**, zero console errors; seed 60 at **850×900** with `log=1`: **4/4**, zero errors. The four log lines matched engine events. Codex inspected the final screenshot: wrapped log at left, cards clear.
- Both Chrome replay receipts identify standalone HTML SHA-256 `0194a1d4653afcdd50a9307c1279ae90ccaf66fe15972400a2c661d48b5331fa`. They predate the WebKit CSS fix and are **not** receipts for the final HTML.
- The first 850px harness attempt used a `file://` URL and failed receipt creation because Node fetch does not support it. The local HTTP rerun above passed. The failed attempt is not counted as a passing receipt.
- After adding the CSS fix, `npm run build` and `npm run build -- --web` passed. `scripts/browser-card-face-check.mjs` on the combined web build: **WebKit 27.2 6/6**, **Chromium 156.0.8078.4 6/6**, zero console errors. States: opening, hover, selection, post-summon hand, viewer front and flipped back.
- At `a59aad6`, `node --test tests/assets/doc-link-hook.test.mjs tests/assets/links.test.mjs`: **10/10 passed** on the Mac. An earlier Mac run caught the `/var` versus `/private/var` alias failure; the passing result includes the correction.
- Revised hook actual saves in Kiro session `sess_88cb21c9-4565-49b1-a423-4535069dba51`: failed on the deliberate broken link at 06:21:54Z, passed after removal at 06:21:59Z, November 17 UTC (November 16 Pacific).

## Receipts and limits

[Published receipts](parallel-closeout-2200/manifest.json) copy the actual JSON/text outputs, replacing only the worktree prefix with `<PROJECT_ROOT>`. Original and published hashes are recorded. Full temporary logs/screenshots remain under the coordinator's ignored `.artifacts/integration-2200/`. Browser receipts flagged `uncommittedChanges: true` because the dependency symlink was untracked; it was never committed.

Actual Safari/iPhone, a first-time human playtest, full animation approval and final narrated public video remain open. The separate Billy sourced-idle pilot is preview-only; it does not change production motion. Future AoE/trap/lasso mechanics remain deferred. The native Workflow reviewed PR #40, not the final combined release. No account-wide credit use or internal model-routing claim is made.
