# Board keyboard focus — actual Fable task, Codex-reviewed

Date: 2026-11-17. Baseline: origin/main b5cecc6272f53be450d51af62d9edfcd6319411b. Branch: fable/board-accessibility.

## Observed defect and repair

A real keyboard route in Chrome reached and selected a playable Sheriff, then a legal Cowboy lane. On the baseline, choosing that lane dropped document.activeElement to BODY because the selected lane became disabled. Keyboard Cancel also hid the focused control and left focus on BODY. After confirming a summon and waiting for input to return, focus was still on BODY.

Fable changed only src/ui/cards.js at runtime. It records focus lost from a lane, hand card, or selection panel. It moves focus to Confirm when the selection is complete; Cancel returns it to the selected card; after summon playback a remaining hand control receives focus. If the user has moved focus to another usable control, it leaves that focus alone. It changes no art, layout, animation, game rules, or deck behaviour.

## Real-browser result

The new scripts/browser-board-accessibility-check.mjs uses an isolated headless Chrome profile and CDP Input.dispatchKeyEvent. Initial focus on the title screen Play button is explicitly scripted, followed by real Enter. Board actions use Tab, Shift+Tab, Enter and Escape; no synthetic clicks, direct board focus calls, or engine-state changes.

| Check | Before | After |
| --- | --- | --- |
| Tab reaches a playable card with a nonempty DOM label | Pass | Pass |
| Card selection keeps focus after rerender | Pass | Pass |
| Shift+Tab reaches a legal lane with a DOM label | Pass | Pass |
| Choosing a lane leaves focus on a usable board control | Fail: BODY | Pass: Summon |
| Cancel leaves focus on a usable board control | Fail: BODY | Pass: selected Sheriff |
| Input returning after Confirm has usable board focus | Fail: BODY | Pass: remaining Mounted Billy card |
| Duel menu opens by Enter and focuses inside | Pass | Pass |
| Escape closes the duel menu and restores its opener | Pass | Pass |
| No page errors | Pass | Pass |

Before: 6/9 checks passed. After: 9/9 passed, zero page errors. During summon playback, controls are intentionally disabled and focus may temporarily be on BODY; the repaired assertion is after input returns. The first remaining card can be inspected even when it cannot currently be played.

Commands run by Fable used the local build at http://127.0.0.1:51746/?seed=0:
- /opt/homebrew/bin/node scripts/browser-board-accessibility-check.mjs <url> <output-directory>
- /opt/homebrew/bin/node scripts/build.mjs --web

Screenshots and JSON are preserved outside the worktree under .artifacts/fable-board-accessibility-launch/browser/{before,after}/ in the main project folder. Each run saves lane-chosen.png, after-cancel.png, after-confirm.png, and board-accessibility-run.json. These local artifacts are not public submission screenshots.

## Execution and attribution

The coordinator invoked the actual /opt/homebrew/bin/claude 2.1.326 CLI with requested model claude-fable-5-2. Fable wrote the runtime fix and browser harness, reproduced the baseline failure, rebuilt, and completed the successful replay. No substitute model was requested, and no permission bypass was used. Shell permissions were restricted to the named build and browser harness commands.

The task started at 2026-11-17T04:28:18.693241+00:00 and was stopped by its requested five-minute bound at 2026-11-17T04:33:19.038582+00:00 (exit143). The successful replay was already on disk. Fable did not finish its final JSON response or evidence prose before that bound; there is therefore no final modelUsage receipt for this second task. Do not describe it as an uninterrupted successful CLI completion. The earlier submission-story task has its separate successful Fable receipt.

Codex reviewed the resulting diff and before/after reports, wrote this evidence note, checked JavaScript syntax and git diff whitespace, and committed the owned files. Codex did not author the runtime patch. No further Fable retry or quota probe was made.

Local launch receipt, exact prompt and raw stdout/stderr are preserved under .artifacts/fable-board-accessibility-launch/. No account information is included here.

## Limits

This is an automated agent keyboard check in Chrome at 1440x810, seed0, one summon/cancel route and one dialog. DOM label presence is not a screen-reader speech test. It does not certify all accessibility, Safari, mobile, all cards/spells, or human usability. No human playtest was performed. Parent integration should rerun this focused harness against the final combined candidate.

## Report receipts

[
  {
    "phase": "before",
    "passed": 6,
    "total": 9,
    "errors": [],
    "error": null,
    "sha256": "e3319866b9964d074fde45b114768d3861cf8abdff548688a4fedc69cc32c4db"
  },
  {
    "phase": "after",
    "passed": 9,
    "total": 9,
    "errors": [],
    "error": null,
    "sha256": "5d2c2dbf3134db4e2c5c9552c9e28bae7931e6fe2b0014dad66039fe91f85d73"
  }
]
