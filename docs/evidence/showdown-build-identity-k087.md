# K-087 / K-094: the Camp playtest report names each duel's build (Kiro CLI worker, export worktree)

Date: 2026-11-19 (America/Los_Angeles). Branch `kiro/showdown-sprint-export`, change commit `1f09d5cbfc8ff277d88016c09dce485125d17d47`.

Problem: Alex's pasted Camp export (Boot Hill 13 turns / 53 s, Raven Roost 11 / 34 s, 87 s, no rulebook opens) did not say which game build produced it.

Change:
- `scripts/graybox-build-label.mjs` + `scripts/build-graybox.mjs`: every graybox build (standalone and Pages) carries a public label, the 12-character commit prefix, with `+local` when `src/`, the build scripts or the package files were uncommitted. It is null without git. On Pages it is the prefix of the commit in `build.json`.
- `src/match/showdown-playtest.js`: each new log line stores that label. Lines from older builds keep no label, and a caller cannot set it. Only `^[0-9a-f]{12}(\+local)?$` is kept, so no user, device or path value can be stored.
- `src/game/showdown/playtest.js`: given `{build}`, the report adds three lines before "Duel by duel:": the page's build, "Duels by build: 1 build not recorded; 2 on <label>", and a note that Reached and the deck cover the whole saved career. Every earlier line is unchanged. The prototype's `report(log, save)` output is byte-identical.

Verification (scripted, not human):
- `node scripts/verify-duel.mjs`: 617 tests, 617 pass (before commit, same tree).
- `tests/match/showdown-playtest.test.js` (legacy log from the pasted wins, mixed builds, junk labels, prototype text) and `tests/assets/graybox-build-label.test.mjs` (git label, no-git null, bundled define).
- `node scripts/browser-showdown-build-check.mjs older.html current.html`: headless Chrome, fresh profile, file:// pages. The older page was built from `4069bf9`, and the current page from `1f09d5c` (label `1f09d5cbfc8f`). Boot Hill was won on the older build and Raven Roost on the current one. The report read `Duels by build: 1 build not recorded; 2 on 1f09d5cbfc8f.`, and Copy report answered. The older build still read both duels. 5 checks passed, with no page errors.
- `scripts/browser-showdown-check.mjs` 22 checks and `scripts/browser-showdown-modes-check.mjs` 13 checks pass on the current build.
- `node scripts/stage-pages.mjs --commit 1f09d5c…` + `node scripts/check-pages-tree.mjs --commit …`: 4 checks pass. The `dist/web/index.html` label is `1f09d5cbfc8f`.

Known limit: when an older build adds a duel, it rewrites the log through its own field filter, which drops newer lines' labels. Those duels then read "build not recorded". They are never credited to the wrong build. Human playtest and native Kiro IDE/Web checks: pending.
