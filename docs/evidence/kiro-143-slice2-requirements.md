# Issue 143 slice 2: Requirements-First spec, backfilled (graywave-requirements)

Kiro CLI worker (Claude Opus 5.5), 2026-11-19, America/Los_Angeles. Brief: PR 147, `docs/design/showdown-integration-kiro-brief.md`, tool A.
Branch `kiro/graywave-requirements`, base `kiro/graywave-integrate` `cd764f1` (PR 148).

## What changed

- New spec `.kiro/specs/showdown-first-hour/` (requirements, design, tasks). It is **backfilled**: the slice 2 code and tests already existed. Every slice 2 brief line and "done when" line is a numbered `FH-R` requirement.
- `docs/requirement-test-map.md`: new section mapping each `FH-R` criterion to unit, controller, browser and regression tests, with gaps.
- Comments naming the `FH-R` IDs above each slice 2 Node test and browser check. No title, assertion or behaviour changed (`git diff -U0` adds only `// FH-R…` lines). `prototypes/showdown/progress.test.js` is left untouched.

## Checks run on this branch

- Focused: `node --test` on `prototypes/showdown/progress.test.js` and the five slice 2 test files: 40 of 40 pass, before and after the comments.
- `npm test`: 556 of 556, plus both GLB structure checks.
- `node --check` on both browser scripts: ok. The Chrome checks were **not** re-run: only comments changed. Their receipts are from `6ade89e` (see [integration note](kiro-143-slice2-integrate/README.md)).

## Gaps recorded, not fixed

- FH-R1.2 purity of `src/game/showdown/`: no automated check.
- FH-R7.1 inherited cards are per-device and not in save codes: true by construction, no test asserts it.
- FH-R7.2 balance policy for inherited cards: Fable F1/F2 open; compat A1 fails on 7 cases.
- FH-R7.3 Fable F3–F5 open.
- Human playtests: none run.
