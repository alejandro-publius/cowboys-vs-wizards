# Kiro evidence: paired trap lab report comparator (issue #124)

Date: 2026-11-17 (America/Los_Angeles). Worker: Kiro CLI 3.4.0 V3, model `claude-opus-5.5` (requested explicitly; the session context reported this model). Credits and usage: none were emitted to the worker, so none are recorded. Base: main `ad2b68e840a9d5f760c139a57d2f24cd6c9bd881` (includes #119 report export, #121 seed kit, #123 seed picker). Branch `kiro/trap-compare-124` in worktree `.worktrees/kiro-trap-compare-124`, one local commit, not pushed or merged.

## Problem

The lab exports a redacted JSON report per match, and the #120 kit and #122 picker give deterministic T1 seeds with a BASE pair. Nothing compared a T1 and a BASE report of the same seed without hand reading JSON. This task adds an offline comparator for that pair. It does not collect or produce human feedback, and no person has played a match for it.

## Change

New files only, under [experiments/trap-playtest-compare/](../../experiments/trap-playtest-compare/README.md):

- [compare.js](../../experiments/trap-playtest-compare/compare.js): pure, import-free `compareReports(first, second, { includeNotes })`, `formatMarkdown` and `countRows`. Exact-key validation of the exporter schema (v1, `synthetic-developer-lab`), one T1 and one BASE, same seed and Wizard CPU, either order. Only allowlisted values are copied: match status, round, result outcome, reason and round, the report's metric counts by side, and the metric limits. Raw events are never read beyond the list length. Accessors, symbols, `__proto__` keys and unknown keys are refused without echoing the value or key name.
- [run.mjs](../../experiments/trap-playtest-compare/run.mjs): `node experiments/trap-playtest-compare/run.mjs <T1.json> <BASE.json> [--notes]`. Reads two files of at most 1 MiB, prints Markdown, writes nothing. Paths stay out of stdout and stderr.
- [index.html](../../experiments/trap-playtest-compare/index.html) and [app.js](../../experiments/trap-playtest-compare/app.js): optional loopback page with two native file inputs, a notes checkbox (off) and a Compare button. File API only, `textContent` rendering, CSP `default-src 'none'; script-src 'self'; connect-src 'none'`.
- [compare.test.js](../../experiments/trap-playtest-compare/compare.test.js): 13 focused tests.
- [README.md](../../experiments/trap-playtest-compare/README.md).

No change to `src/`, `CARDS`, `DECKS`, the lab, existing tests, scripts, packages, CI, public UI, assets or other docs.

## Completeness rule

A pair is complete only when both reports have `match.status === "terminal"` (the controller's status after a result, `src/match/controller.js`) and a valid `match.result` (outcome win, loss or draw consistent with winner and loser, reason code, round 1 to 9). Otherwise the comparator reports `incomplete`, interpretation `blocked`, and computes no outcome, ending-round or count difference, while keeping each report's counts. Truncated (500-event cap) or dropped events add warnings that a zero or low count does not show absence.

## Example output (synthetic match, not a playtest)

Seed 0, Wizard CPU normal, Cowboy played by `chooseAction` through the controller, reports built by the real exporter. One match per scenario:

| Scenario | Status | Outcome (Cowboy view) | Reason | Ending round | Public events | Cowboy trap set | Wizard trap set | Wizard trap trigger |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | terminal | loss | base-destroyed | 5 | 71 | 1 | 1 | 1 |
| BASE | terminal | win | round-limit | 9 | 130 | 0 | 0 | 0 |

This shows the tool's output format on one deterministic bot match. It says nothing about clarity, fun, balance or how a person would play.

## Verification (this run)

| Check | Result |
| --- | --- |
| `node --test experiments/trap-playtest-compare/compare.test.js` (new) | 13 of 13 pass, 0 skipped, about 7 s; includes the Chrome smoke (Chrome/157.0.8103.79, 3 requests, all loopback). One earlier run failed 1 test: a partial T1 match stopped with status `playing`, not the assumed `accepting_input`. The test now accepts any non-terminal in-play status and checks the warning text for the actual one. |
| `node --test tests/experiments/trap-placeholder-report.test.js` (existing) | 7 of 7 pass, 0 skipped, about 19 s including its Chrome smoke |
| `node --test experiments/trap-playtest-kit/seeds.test.js` (existing) | 11 of 11 pass |
| `npm test` | node:test 313 of 313 pass, 0 skipped; asset structural checks 2 of 2 (structure only) |
| `node scripts/check-links.mjs` | 183 Markdown files, 681 relative links and images, 0 broken (new files staged intent-to-add) |
| `git diff --check` | clean |

What the tests check: real T1 and BASE lab pairs for seeds 0, 9 and 55 at easy, normal and hard reach `terminal`; comparison counts equal each report's metrics; deltas, same-outcome and ending-round difference are arithmetic on those; output is byte-identical in either order and on replay; no Wizard or deck trap ID, `humanNotes`, raw event or exporter disclaimer in the output. Partial (round 2 or 3), idle-shaped, error and terminal-without-result reports give `incomplete` with no comparison and no "Same outcome" or delta column in the Markdown. A null-seed idle export is refused with a "press Start" fix. Exporter-built 525-event and dropped-event reports produce the limit warnings. Wrong schema, version, source, scenario (T2, FIXTURE), CPU, seed range or type, same-scenario pairs, seed or CPU mismatch, inconsistent result, bad reason, list-length mismatches, cap overflow, BASE trap counts, non-integer, negative, NaN, infinite, string or unsafe counts, and unknown metric keys are refused with field-named errors in both argument positions. Sentinel extras, `__proto__` keys at three levels, symbols and a hidden ID in `result` are refused without echo, with no prototype pollution; a getter is refused before it runs. Deep-frozen inputs compare unchanged and share no references with the output. Notes are absent unless `includeNotes === true`; with it they are bounded, cleaned and Markdown/HTML-escaped. `compare.js` has no imports, clock, random source, storage, DOM or network; `run.mjs` imports only `node:fs/promises` and `./compare.js`. The CLI runs under `node --permission` with read-only grants, prints exactly `formatMarkdown`, never prints temp paths or file names, creates no file, leaves inputs unchanged, exits 2 on bad arguments and 1 with path-free messages on missing, directory, invalid JSON or same-scenario files. The Chrome smoke chooses real report files with `DOM.setFileInputFiles`, checks nothing renders before a real mouse click, reads the rendered tables, shows a hostile `<img onerror>` note string as text with no `img` element, blocks interpretation for a partial file, shows an alert for a same-scenario pair, and records no request outside loopback, no cookie or storage use and no console error or dialog.

## Limits

- No human feedback exists for this tool. Every note in the tests is a fixed test string.
- One synthetic match per scenario per seed. The comparator computes no win rate and makes no balance or clarity claim.
- Counts are exporter tallies of public Cowboy-view events. A truncated or dropped list can undercount.
- The page needs loopback HTTP (ES modules); `file://` is not supported.

## Remaining work

`docs/kiro-build-log.md` was not updated because the coordinator owns it. A person plays a #120 or #122 seed in T1 and BASE, exports both reports and compares them. The coordinator reviews, tests and gates on GitHub CI.

## Independent coordinator verification (November 17, 2026)

The coordinator independently reviewed the Kiro worker's seven
NEW-file-only commit 88f8218 and verified exact main base
ad2b68e840a9d5f760c139a57d2f24cd6c9bd881, then
ran:

- node --test experiments/trap-playtest-compare/compare.test.js:
  **13/13 pass, zero skipped**. This includes Chrome 157
  loopback File API smoke selecting synthetic source-grounded
  T1 and BASE reports. Exactly three browser requests, all
  local loopback; no runtime errors. Tests cover terminal
  result gating, incomplete/aborted pairs, matched seed and CPU,
  missing/truncated event caveats, count allowlist, hostile
  hidden-data sentinels, optional bounded/escaped notes,
  CLI error handling and input immutability.
- node --test tests/experiments/trap-placeholder-report.test.js:
  **7/7 pass**, including the real Chrome local JSON exporter.
- node --test experiments/trap-playtest-kit/seeds.test.js:
  **11/11 pass**, deterministic real 12-card seed kit.
- npm test: **313/313 Node tests** plus 2/2 existing
  GLB structural checks (not visual animation quality).
- node scripts/check-links.mjs:
  **183 Markdown files, 681 relative links/images,
  zero broken**.
- git diff HEAD^ HEAD --check: **pass**.
- Kiro CLI 3.4.0 and the explicitly advertised model were
  checked at launch. The completed V3 session selected
  **claude-opus-5.5** and reported **23.70397039933665**
  session credits (usage metadata only, not an account invoice).
  This appended coordinator receipt supplements the worker's
  earlier 'usage unavailable' note.

These independent checks do NOT constitute a real human
playtest or balance verdict. Real-person notes have not been
collected. No shipped cards/decks, published game, gameplay
engine, sound, art, 3D, animation, asset, package, CI, deployment
or user files changed.
