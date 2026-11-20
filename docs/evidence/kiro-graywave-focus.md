# Showdown keyboard focus across redraws (graywave focus)

Date: 2026-11-19, America/Los_Angeles. Work by Kiro CLI 3.5.0 (Claude Opus 5.5) on Alex's Mac,
branch `kiro/graywave-focus` from main `a9aa828`. Graybox code only; no rules, wording, cue
timing or visuals changed.

## Problem (observed before the fix)

`render()` in `src/ui/showdown-screen.js` replaces `#sd-board` and `#sd-hand` with `innerHTML`, so
the button a keyboard player just pressed is destroyed and focus falls to `<body>`. The next Tab
starts again at the top of the page (`Main menu`). Reproduced in fresh headless Chrome 158 on the
real route (`?seed=0`, Tab to Play, Enter, Tab into the hand) with
`scripts/browser-showdown-keyboard-check.mjs` run against the unchanged build:

| Key press | Focus before | Focus after |
| --- | --- | --- |
| Enter: summon a free troop (turn 1) | hand card `cowboy-sheriff-3` | `body` |
| Enter: pick the ready troop (turn 2) | own slot 0 | `body` (not a target) |
| Escape: cancel that pick | `body` | `body` |
| Enter: Mounted Billy (tribute pick) | hand card `cowboy-billy-2` | `body` (not a tribute) |

Enter on End turn kept focus only because that button is not redrawn.

## Change

After a keyboard activation (a click with `detail === 0`, or Escape pressed on a duel button),
focus moves to, in order: a new pick's first legal choice on the board (then Take cover, then
Cancel); the card or troop that opened a pick just cancelled; the same button if it is still
usable (an unfinished tribute payment); else the first playable hand card, actable troop, End
turn, result button, or Main menu. Mouse clicks (`detail >= 1`) never call `focus()`. Legal
actions still come only from `session.legal()`; the targets are the buttons render already enabled.

## Verification

- `node scripts/browser-showdown-keyboard-check.mjs dist/cowboys-vs-wizards-board-duel.html`:
  6 checks passed. Boot Hill seed 0 won by keyboard only in 8 player turns: 58 Enter/Escape
  activations, 16 attack picks, 8 card picks, 1 cancel, 103 key presses; focus on a usable duel
  button after every one. Mouse pass: summon, attack pick, Cancel and Escape leave focus on
  `body` and do not scroll.
- `node scripts/browser-showdown-check.mjs` (mouse acceptance): 12 checks passed.
- `node scripts/browser-showdown-cues-check.mjs`: 5 checks, no failure.
- `npm test`: 530 pass, 0 fail.

## Compatibility with PR #148 (slice 2 integration, `cd764f1`)

Temporary detached worktree of #148 with this change applied (removed afterwards):

- Textual conflict in the click handler: #148 replaces the `sd-again`/`sd-menu` lines. Resolution:
  keep #148's lines and append this change's two lines after them.
- Name clash: #148 adds `let ... started` (duel start time). This change's helper is therefore
  named `pickStarted`; with it the integrated build compiles.
- #148's Play opens Camp; the keyboard check follows Camp's Trail duel button when present and
  clears storage before its mouse pass.
- Integrated results: keyboard check 6 passed; #148's `browser-showdown-check.mjs` 23 passed,
  `browser-showdown-trail-check.mjs` 16 passed, cue check 5 with no failure.

Not checked: human playtest of keyboard clarity; screen-reader output.
