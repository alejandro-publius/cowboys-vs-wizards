# Combined web build: menus, instructions and keyboard focus

Observed November 16, 2026 (America/Los_Angeles), by Codex on clean candidate 02b1bf8785f154dcee8e2a21293d6a455a3bf82e. No new art, motion, rules or dependencies.

## Changes checked

- How to Play explains optional summon/spell actions, casting without a friendly troop, Singularity, simultaneous damage including defeated attackers, and the nine-round Base-orb comparison.
- Fable's focus handoff selects Summon after a lane, restores the selected card after Cancel, and returns to a hand control after summon playback.
- Existing approved menu, deck workbench, settings and achievements remain functional.

## Actual verification

The web build passed. Two independent isolated Chrome profiles checked the same local HTTP build with seed=0:

| Check | Result |
| --- | --- |
| Existing menu, save/reload, achievement, pause/resume and portrait-control route | 11/11, no page errors, exit 0 |
| Fable keyboard route on the combined candidate | 9/9, no page errors, exit 0 |
| How to Play visual inspection | Desktop and 390px Chrome screenshots inspected; 16px content text, no horizontal overflow; phone page scrolls vertically |

Original reports are [menu-run.json](final-polish-web/menu-run.json) and [board-accessibility-run.json](final-polish-web/board-accessibility-run.json). [Build identity](final-polish-web/build.json) records the HTML and report SHA-256 values. Screenshots remain in the local ignored final-polish artifact directory.

Commands: node scripts/build.mjs --web; node scripts/browser-board-accessibility-check.mjs <local-HTTP-URL-with-seed=0> <output-dir>. Menu verification used scripts/browser-menu-check.mjs copied into the ignored artifact directory, with imports resolved to this checkout and two added How to Play screenshots plus viewport measurements; the original eleven assertions were unchanged.

An earlier invocation omitted seed=0, so its fixed-seed hand assertion failed after seven checks. Supplying the required seed passed all eleven. That was a coordinator invocation error, not a game defect; no rules or test assertion was changed to obtain a pass. A prior file-URL run was inconclusive and is not counted.

## Limits and attribution

Fable authored the focus repair and keyboard harness; Codex reviewed, integrated and ran this combined-candidate verification. Codex corrected instructions for existing rules, without changing gameplay. Kiro's separate final Workflow evidence covers its own executed commands.

These are agent-run Chrome checks. They do not establish human usability, screen-reader speech, Safari, physical-device performance or a judging score. No final narrated video or public YouTube upload is claimed.
