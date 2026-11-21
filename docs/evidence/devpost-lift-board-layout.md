# Devpost lift: board-layout worker (Kiro CLI)

Date: 2026-11-20 (America/Los_Angeles). Agent: Kiro CLI worker `board-layout`, branch
`kiro/devpost-lift-board-layout`, base `ea183ee`. Scope: `src/ui/showdown.css` only, for the Boot Hill
board pass (Fable 5.2's board-design.md, the board contract prompt). No JS, art, model, engine or Camp changes.

## Change

- Zone rail `.sd-zone-rail` (cells `[data-zone=deck|hand-count|traps|graveyard]`): one full-width row of
  equal cells with a 44 px floor. It works whether the JS puts the rail inside its `.sd-side` or beside it in
  `#sd-board`. The empty pile (`[data-zone=graveyard]` that is not a button) is dashed muted text. A
  long newest-card name is cut with an ellipsis inside its cell.
- `#sd-location`, when moved into `#sd-board`, becomes one shared strip using the existing location border.
- `#sd-zone-move` ticker keeps one line of height when empty, so the hand does not jump.
- `#sd-graveyard-sheet`: a native dialog docked to the bottom, at most 75vh, and long piles scroll inside it.
  `[data-graveyard-card]` rows and `[data-graveyard-close]` are at least 44 px.
- Phones (≤40rem): the Base is a full-width row, the three slots sit side by side under it in the same template
  for both seats, and board buttons size to their content with a 44 px floor. The hand is two columns.
- Desktop: Base and slot minimum height goes from 9rem to 6.5rem. End turn and the other duel action buttons
  get a 44 px floor. `.sd-type` and `.sd-key` go from .78rem (11.7 px) to .8rem (12 px).
- The CSS uses no `order` property, so the visual order is the DOM and Tab order.

## Measurement

The setup is headless Google Chrome with playwright-core 1.64.1 from the local npx cache (no install),
`reducedMotion: reduce`, a fixed mulberry32 `Math.random`, and the page built by
`node scripts/build-graybox.mjs --hosted`. The route is `/?seed=0` → Play → the first Camp trail duel (Boot Hill),
turn 1. Viewports: 390x844 and 320x640 (isMobile, touch emulation, not a physical device) and 1280x800.
The before build is `ea183ee`'s CSS. The after build is this commit. The probe script was temporary and is not committed.

The **turn1** state is the real current markup. The **rail** state is the real turn 1 with contract-shaped fake
markup injected: the rival rail is the first child of the rival `.sd-side` (four cells, five hand backs, two trap
backs, a 12-card pile button). The own rail is the last child of the own `.sd-side` (empty pile, named trap, deck).
`#sd-location` moves between the sides, `#sd-zone-move` goes above the hand, the hand is cloned up to five
cards, and the Base counts and backs are removed. A 14-row `#sd-graveyard-sheet` was opened with `showModal()`.

| viewport, state | horizontal overflow | board height | empty slot | End turn top–bottom | first enabled card top–bottom | buttons < 44 px |
|---|---|---|---|---|---|---|
| 390 turn1, before | none | 573 | 135–146 | 838–878 | 878–1088 | home, End turn, Restart (40) |
| 390 turn1, after | none | 327 | 44 | 592–636 | 636–812 (whole card on screen) | none |
| 390 rail, before | none | 859 | 135 | 1120–1160 | 1182–1392 | 3 |
| 390 rail, after | none | 404 | 44 | 665–709 | 730–906 (partly on screen) | none |
| 320 turn1, after | none | 327 | 44 | 592–636 | 636–847 | none |
| 320 rail, after | none | 426 | 44 | 687–731 | 752–963 | none |
| 1280 turn1, before / after | none | 306 / 294 | 135–164 / 123–164 | 522–562 / 511–555 | 562–773 / 555–766 | 3 / none |
| 1280 rail, before / after | none | 578 / 375 | 135–192 / 98 | 791–831 / 589–633 | 853–1063 / 654–865 | 3 / none |

Rail cells after the change: at 390, 4×89x63 (rival) and 3×120x44 (own). At 320, 4×72x85 (the five hand backs
wrap) and 3×97x44. At 1280, 4×211x66 and 3×283x44. Before the change, the injected rail stacked into one
135–176 px column with 22 px cells. The sheet after the change sits at 0–390 x 304–844 at 390, 0–320 x 160–640 at
320 and 340–940 x 260–800 at 1280. It scrolls internally (scrollHeight 758) with no page overflow. Before the change, it was
a centred default dialog. In every state, focusable controls never jump up a row in DOM order, no text is below
12 px after the change, and there are no page errors.

## Checks

- `node scripts/build-graybox.mjs` then `node scripts/browser-showdown-cues-check.mjs dist/cowboys-vs-wizards-board-duel.html <dir>`:
  **fails with the same assertion at unmodified `ea183ee`**. In step 2's harness, `trap defeated` expects
  /attack was cancelled/ but gets "Trap! The Cowboys' Bear Trap caught Skeleton: defeated before it struck."
  This is log-text drift that the CSS does not cause. Steps 3–4 of that script did not run in either build.

## Limitations and gaps for the board JS / Fable

- The rail, sheet, ticker and moved location are fake markup. Re-measure once the JS worker's real markup lands.
- The CSS has no owner tint for the location strip and no Raise dot on the pile cell, because the contract names no
  attribute or class for them. `[data-raise-target]` gets a Wizard border in the sheet.
- At 390 with the full rail, End turn is on screen but the first card is only partly visible. A shorter rival
  rail or Base would be needed for the whole card, and that is a design choice for Fable.
- Physical phones, human playtests and rendered appearance review were not done.
