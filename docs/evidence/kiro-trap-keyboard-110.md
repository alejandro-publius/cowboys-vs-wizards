# Trap placeholder lab: keyboard focus (issue #110)

Date: 2026-11-17 (America/Los_Angeles). Worker: Kiro (single worker, Kiro IDE session reporting model `claude-opus-5.5`). The coordinator verified CLI 3.4.0 and the model at launch. The completed Kiro CLI V3 stream selected claude-opus-5.5 and reported 17.09867163150912 session credits (metadata, not an account invoice). Base: main `a723a22` (PR #109 merged). One local commit. Not pushed.

## Problem

[README.md](../../experiments/trap-placeholder/README.md) for the #108 lab listed a known limit: every control is disabled while a move plays, so keyboard focus can drop. Issue #110 asks to reproduce it in a real browser with real key events and, if it reproduces, fix it in the lab only.

## Reproduction (before the fix)

Installed Google Chrome 157.0.8103.79, `--headless=new`, temporary profile, driven over the DevTools protocol by [tests/experiments/trap-placeholder-keyboard.test.js](../../tests/experiments/trap-placeholder-keyboard.test.js) with `Input.dispatchKeyEvent`. The test serves the repo root itself on 127.0.0.1 (Node `http`, GET only). Run against unchanged `app.js` from `a723a22`:

| Step | Status | `document.activeElement` |
|---|---|---|
| Tab x5 from the seed field | accepting_input | fixture trap hand button |
| Enter | accepting_input | same hand button, `aria-pressed="true"` (existing `fillButtons` keyed focus) |
| Tab x1, Enter on Confirm | playing | Confirm, disabled |
| next `accepting_input` | accepting_input | `<body>` |

Result: `seed 0: focus returns to an enabled control after keyed Confirm`, failed with `after: {tag: "BODY"}`. The bug reproduces.

## Change

Only [app.js](../../experiments/trap-placeholder/app.js). Each action handler (hand, lane, Confirm, Skip, Cancel, End phase, command list) is wrapped by `act`. If the click came from the keyboard (`event.detail === 0`) and the controller left `accepting_input` (the action was accepted), `act` stores that control's `id` or `data-key`. At the next render with status `accepting_input`, if focus is on `<body>` or a disabled node, the lab focuses the first usable one of: the stored control, the first enabled hand button, End phase. "Usable" means a connected, enabled, rendered button. The stored control is cleared by any `pointerdown`, by a mouse click, at `terminal` or `idle`, and once it is used. If the user moved focus to another enabled control during playback, nothing moves. Nothing is clicked or submitted by the restore. Restart, Leave and the seed form are unchanged and stay enabled, so they keep focus natively.

No change to `lab.js`, `src/`, CSS, HTML, cards, decks, packages or scripts. The page still uses the real Engine, Controller, Presenter and `publicEvents(…, "cowboy")` with the two anonymous fixture traps.

## Browser run (after the fix)

Same test, seeds 0 and 60 in one page, keyboard only except one `Input.dispatchMouseEvent` click. 32 of 32 checks pass, 0 runtime exceptions, 0 console errors. Focus history (seed 0; seed 60 matches except that it starts and restarts in `cpu_turn`):

| Step | Status | Focus after |
|---|---|---|
| Tab x1, type seed, Enter (Start) | accepting_input | seed field |
| Tab to fixture trap, Enter | accepting_input | trap button, pressed |
| Tab x2, Space on Cancel | accepting_input | Cancel, disabled (selection cleared) |
| Shift+Tab x1, Enter, Tab x1, Enter on Confirm | playing | Confirm, disabled |
| next `accepting_input` | accepting_input | End phase (Confirm disabled, no playable hand card) |
| Enter on End phase, CPU plays | playing | End phase, disabled |
| next `accepting_input` | accepting_input | End phase |
| mouse click End phase, next `accepting_input` | accepting_input | `<body>` (no restore after a mouse action) |
| Shift+Tab to Restart, Enter | accepting_input | Restart, round 1, shorter log |
| keyed End phase, then Tab while playing | playing | Show log checkbox |
| next `accepting_input` | accepting_input | Show log checkbox (user's choice kept) |
| Tab to Leave, Enter | idle | Leave; status, log and Wizard info unchanged for 2 s |

Other checks in the run: the Wizard fixture ID `lab-fixture-trap-w` was absent from `document.documentElement.outerHTML` at start and at the check before it sprang. The enemy trap zone read only `Enemy trap: set (face-down)` or `Enemy trap: none`.

Not exercised: the hand-card fallback (no hand card was playable at a restore point in these runs) and the command-list path by keyboard.

## Other checks

- `node --test tests/experiments/trap-placeholder.test.js`: 7 of 7 pass (seed 0 and 60 replay receipts unchanged: wizard, base-destroyed, round 5 / 72 events and round 7 / 106 events).
- `npm test`: 306 of 306 pass; asset structure 2/2.
- `node scripts/check-links.mjs`: 172 Markdown files, 617 relative links and images, 0 broken.
- `git diff --cached --check`: clean.

## Limits

Chrome automation only. This is not a screen reader test, a human keyboard test or a visual review. Remaining caveats are in the README: Cancel leaves focus on itself while disabled, and no restore happens after the match ends. Fixture traps stay synthetic; card identities, copy counts, art, models, animation and sound stay owner-blocked. `docs/kiro-build-log.md` is coordinator-owned and was not edited in this task.


## Independent coordinator verification

After the Kiro-authored commit a4de771 and runFinished, the
coordinator independently inspected all four scoped files and reran:

- Chrome keyboard test: 1/1 passed, using actual Chrome key events
  across seeds 0 and 60 and 32 test assertions. Duration ~46 seconds.
- Previous local placeholder tests: 7/7 passed.
- Full npm test: 306/306 Node tests passed, plus 2/2 existing GLB
  structural checks, not a visual-animation-quality result.
- Documentation: 172 Markdown files, 617 links, 0 broken.
- git diff HEAD^ HEAD --check: passed.
- Base SHA checked: a723a224ef84698533abfa96ce2663f0f045e82e.
- CLI version 3.4.0 verified at launch, model availability confirmed.
  V3 JSONL selected claude-opus-5.5 and reported
  17.09867163150912 session credits (not an invoice).

The coordinator authored this follow-up separately from Kiro's code
and tests. Chrome automation is not a human keyboard or screen-reader
evaluation. Production UI/cards/decks/models/animation/art/audio and
deployment/public flag remain unchanged.
