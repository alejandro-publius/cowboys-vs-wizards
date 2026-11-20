# Bugfix: keyboard focus after "Back to camp" with a card offer open

Author: Kiro agent session (Claude Opus 5.5), job graywave-overnight-qa, 2026-11-19, America/Los_Angeles.
Base: `kiro/graywave-overnight-qa` at `db80cd0`.

**How this spec was made:** written by hand in the Kiro bugfix layout (defect, expected behavior,
behavior to keep). It was not produced by the native Kiro IDE bugfix-spec flow, and no native spec
run took place. Fable 5.2 owns rules, wording and rewards; this spec changes none of them.

## Defect (observed)

Fresh Chrome profile, graybox `?seed=0`, played only by keyboard (`scripts/browser-showdown-keyboard-check.mjs`):
Play, then Boot Hill, won. The result screen offers two cards. Without choosing one, the player
presses Enter on "Back to camp".

- Actual: focus lands on the Camp's **Main menu** button (`#camp-home`). The next Enter leaves the
  Camp for the title screen. The same thing happens after a rival win that leaves an offer open.
- Cause: `toCamp()` in `src/app.js` returns focus to the Camp tile that started the duel. While a
  card is on offer, every solo tile is disabled, so it falls back to
  `querySelector("[data-duel], [data-choose], button")`. A selector list matches in document order,
  so it finds the header's Main menu first. It also never skips disabled buttons.

## Expected behavior

1. When the player returns to the Camp by keyboard and the control that started the duel is no
   longer usable, focus goes to the Camp's claim area first (the first offered card, or the pack
   button), then to the first open duel, then to the first enabled button. This is the order the Camp
   already uses after a card is chosen or a pack is opened (`src/ui/showdown-camp.js`).
2. With a card offer open, focus is on the first offered card (`#camp-claim [data-choose]`).

## Behavior to keep

- If the starting control is still enabled, focus returns to it (Trail tile, rival, hunt, even
  match, best of three, two players, Build deck).
- Mouse play, the duel's own focus rules, rules, rewards, wording, storage and Scout are unchanged.

## Verification

- Regression: step 4b of `scripts/browser-showdown-keyboard-check.mjs`. Before the fix it failed with
  "Back to camp with an offer open focuses the first offered card, not #camp-home". After the fix it passes.
- Kept behavior: the keyboard, trail, modes and main graybox browser checks, plus `npm test`.
  Results are in `docs/evidence/kiro-overnight-qa-camp-focus.md`.
