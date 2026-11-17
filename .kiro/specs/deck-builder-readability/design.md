# Design: deck-builder readability

Status: design only. No implementation was written or run by this spec. Fable implements the UI on a separate branch.

## Existing elements (read at base `599450a`)
- `deck(opener)` in `src/ui/title-menu.js`: builds a `.deck-grid` of `article.deck-choice` tiles (`.deck-art` with `data-card-type`, `h3`, details `p`, `.deck-quantity` with `−`, `output`, `+`), a `p.deck-total[role=status]`, and `.menu-actions` with `#save-deck` and "Restore starter deck". `refresh()` calls `validateDeck`, sets Save `disabled`, and disables minus/plus.
- `src/game/deck-builder.js`: `COWBOY_CATALOG`, `DEFAULT_COUNTS`, `validateDeck` (0..6 each, 1+ Sheriff, 12 total). Not to be changed.
- `profile.saveDeck`, `profile.get().deck`, `profile.isPersistent()`.
- CSS today: `.deck-grid` four columns (two at aspect ratio <=1/1); `.deck-choice p` 12px; `.deck-quantity button` min 44px; card art from `--sheriff-card` etc.; title art `assets/menu/title-screen.webp` via `@@MENUART@@` (referenced in `scripts/build.mjs` and `src/ui/layout.html`).

## Proposed structure (guidance; implementer may differ if criteria hold)
- Open-book layout: left page "Catalog" with the tile list, right page "Your deck" with the summary rows, total, status line and actions. Page styling reuses the current earth/gold/lilac colours.
- Tiles: art at `min-width` 180px (desktop) and 150px (phone); name, stats and rules in a 16px+ typed block beside or under the art. Tiles may use a single column on phone.
- Deck summary: one row per `COWBOY_CATALOG` entry with name and count, plus the total line. Rendered from the same `counts` object in `refresh()`.
- Mobile: tabs "Catalog" and "Your deck" (`role=tablist`, `aria-selected`) or a vertical stack. If tabs, keep a compact total plus Save state in both.
- Feedback: the total line keeps `role=status`; invalid text comes from `validateDeck(...).error`; add a text prefix or icon label so state is not colour-only.

## Not changed
Rules, validation, persistence, title scene, hotspots, other pages, assets, animation.

## Requirement to QA mapping
| Req | Check (Chrome, measured) | Method |
| --- | --- | --- |
| R1 | Art width per tile at 1280 and 390 | `getBoundingClientRect().width` on `.deck-art` |
| R2 | Text sizes; no hover-only detail | `getComputedStyle().fontSize` on name/stats/rules; hover off and read DOM text |
| R3 | Control size, keyboard, focus, limits | Rect of each button; Tab to focus, Enter/Space; outline computed |
| R4 | Rows, total, valid/invalid text, Save disabled | Change counts; read DOM and `#save-deck.disabled` |
| R5 | Side-by-side, no h-scroll | Rect overlap/position; `scrollWidth` |
| R6 | Tabs or stack, no overflow | `scrollWidth <= 390`; tab rect height; reach Save |
| R7 | Save, reload, Restore, Back/Escape | Save, reload page, read counts; Back/Escape focus return |
