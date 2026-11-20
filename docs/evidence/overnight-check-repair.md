# Overnight check repair: turn-check Back step and ledger Tab walk

- Branch `kiro/graywave-overnight-check-repair`, base `3d970ca`. Kiro CLI session (Claude Opus 5.5) on Alex's Mac, 2026-11-20 America/Los_Angeles. Emulated runs only: scripted headless Chrome over CDP. No human played.
- Scope: the two test scripts and their evidence notes. No app, rules, wording, tuning or Scout change. The built graybox (`npm run build`) has sha256 `6e849fe1…3e9a77`, and staged `dist/web/index.html` (`node scripts/stage-pages.mjs --commit 3d970ca2…`) has the same bytes.

## 1. Turn check, browser Back (overnight-verify Finding 1)

The old step required the title screen after Back. Over HTTP, Chrome's back/forward cache restores the earlier root document as it was left, which here is the Camp, so the old step timed out after 11 of 18 checks. Over `file://` the cache is not used and the root loads afresh at the title.

`scripts/browser-showdown-turn-check.mjs` now accepts a built file path or an `http(s)` URL. The Back step requires that:
- the URL is the earlier root path with no `?turn`;
- the duel is closed;
- exactly one of title and Camp is shown, and its normal entry (Play, or an enabled Boot Hill tile) is usable;
- a freshly loaded root shows the title, while only a document restored by the cache may show the Camp (a window marker set before `?turn` tells which happened);
- the saved career is byte-identical.

It records which case it saw in `report.json` as `browserBack`. The two choices, both retries and every other assertion are unchanged.

| Run | Command | Observed |
| --- | --- | --- |
| File | `node scripts/browser-showdown-turn-check.mjs dist/cowboys-vs-wizards-board-duel.html <out>` | 18/18. Back: fresh load, title with Play, `restored: false` |
| HTTP, bfcache on (Chrome default) | temporary Node static server on an OS-assigned port serving `dist/web` at `/cowboys-vs-wizards/`; `node scripts/browser-showdown-turn-check.mjs http://127.0.0.1:59450/cowboys-vs-wizards/ <out>` | 18/18. Back: `/cowboys-vs-wizards/`, no query, `restored: true`, Camp shown with Boot Hill usable, duel closed |

Whether Back should restore the Camp or show the menu is still an open presentation decision for Fable and the coordinator. The check records the browser's behaviour and prescribes neither outcome.

## 2. Ledger check, Tab order (`overnight-both-ledger.log`)

**Cause, confirmed.** The combined release failed with `focus order BUTTON,BUTTON,camp-build,SUMMARY,SUMMARY,summary`. The fresh Camp now focuses Boot Hill on entry (`toCamp` in `src/app.js`). The old check blurred that control before walking, and Chrome keeps a blurred control as the Tab starting point, so the walk began after Boot Hill and never listed it. With the repaired walk, both widths record `trail,BUTTON,BUTTON,camp-build,SUMMARY,SUMMARY,summary`. That is the failed order with the entry focus in front.

**Change.** `scripts/browser-ledger-check.mjs` now enters the Camp from the keyboard: it focuses Play and presses Enter. The control that has focus on entry becomes the first stop. The check then presses Tab up to the ledger summary. It requires Boot Hill before the summary, with no stop outside the page. Shift+Tab from the summary must then retrace the same stops in reverse back to Boot Hill, so Boot Hill must also be reachable by Tab and not only by programmatic focus.

| Run | Observed |
| --- | --- |
| `node scripts/browser-ledger-check.mjs dist/cowboys-vs-wizards-board-duel.html <out>` | 12/12 at 390×844 and 1440×900; entry focus `trail` at both widths |
| same on staged `dist/web/index.html` | 12/12 |
| Negative: temporary copy with `tabindex=-1` on Boot Hill (unreachable by Tab) | exit 1: Shift+Tab never retraces to Boot Hill |
| Negative: temporary copy with `tabindex=1` on `#camp-ledger` (ledger ahead of Boot Hill in Tab order) | exit 1: `focus order trail,BUTTON,BUTTON,camp-build,SUMMARY,SUMMARY,camp-turn-dragon,BODY,DETAILS,summary` |

The negative copies were temporary files outside the repo and were deleted afterwards.

## Regressions

- `node scripts/browser-showdown-keyboard-check.mjs dist/cowboys-vs-wizards-board-duel.html <out>`: 7/7.
