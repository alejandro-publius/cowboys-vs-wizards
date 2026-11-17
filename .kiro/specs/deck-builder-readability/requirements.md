# Requirements: deck-builder readability

Scope: the existing **Build Deck** page (`deck()` in `src/ui/title-menu.js`, styles in `src/ui/title-menu.css`). Direction approved by the user: a readable, playful open-book catalog beside the chosen deck, with the structure inspired by a Wizard101-style screenshot. The author had only a text brief, not the image. The page must not reproduce proprietary art or copy the screenshot. Keep the earth/gold/lilac menu style and the approved card and title art (`assets/menu/title-screen.webp`, existing `--*-card` art). No new art, game rules, animation or custom game logic.

## Glossary
- Catalog: the four Cowboy cards in `COWBOY_CATALOG` (Sheriff, Billy, Mounted Billy, Deadeye).
- Chosen deck: the current unsaved counts per card type.
- Card tile: one catalog entry (art, name, stats, rules text, add/remove controls).
- Desktop: viewport width 1280px. Phone: viewport width 390px.

## Requirements
Each criterion is pass/fail from a real measurement (computed style or `getBoundingClientRect`) in Chrome. "Pass" is not recorded until measured.

### R1 Card size
1. WHEN the Build Deck page is shown at 1280px, THE card art in every card tile SHALL be at least 180px wide.
2. WHEN it is shown at 390px, THE card art in every card tile SHALL be at least 150px wide.

### R2 Readable text
1. THE card name, attack, life, tribute cost and rules text of each tile SHALL be typed text in the page, computed `font-size` at least 16px, at both viewports.
2. THE page SHALL NOT make any card detail available only through hover, title attributes or zooming the painted card art.
3. WHEN a tile is a spell, THE rules text SHALL state the existing effect ("removes 1 enemy orb") in typed text.

### R3 Add/remove controls
1. THE add and remove controls SHALL each have a rendered box of at least 44x44px.
2. THE controls SHALL be native buttons, operable with Enter and Space, with a visible focus indicator (non-zero outline or equivalent, contrast against its background).
3. THE controls SHALL keep the current limits: remove disabled at 0, add disabled at 6 copies or when the total is 12. No new input rules.
4. THE controls SHALL keep accessible names naming the card ("Add Sheriff", "Remove Sheriff").

### R4 Chosen deck summary
1. THE page SHALL show the chosen deck as a list with one row per catalog type giving name and selected count, updated on every count change.
2. THE page SHALL show the total as "N / 12" in typed text of at least 16px.
3. WHEN the counts satisfy `validateDeck`, THE page SHALL show a ready state and enable Save.
4. WHEN they do not, THE page SHALL show the `validateDeck` error text, keep Save disabled, and not rely on colour alone.
5. THE validation rules SHALL remain exactly: each type 0 to 6 whole copies, at least 1 Sheriff, 12 cards total. Validation SHALL continue to come from `validateDeck`, not be re-implemented in the UI.
6. WHEN Save succeeds, THE page SHALL show the existing saved message (persistent or session-only variant).

### R5 Desktop layout
WHEN at 1280px, THE catalog and the chosen deck SHALL both be visible without scrolling horizontally, side by side, and the Save and Restore buttons SHALL be reachable without horizontal scrolling.

### R6 Mobile layout
1. WHEN at 390px, THE page SHALL present the catalog and the chosen deck as either two tabs (catalog, deck) or a vertical stack, with `document.documentElement.scrollWidth <= 390`.
2. IF tabs are used, THEN the tab controls SHALL be native buttons at least 44px tall, expose the selected state, and the total and Save state SHALL stay visible or one tap away in both tabs.
3. IF stacked, THEN every catalog control, deck row, total, Save and Restore SHALL be reachable by scrolling vertically only.
4. THE tile minimum widths in R1.2 SHALL hold in either mode.

### R7 Preserved behavior
1. THE page SHALL keep: stored deck used when valid else `DEFAULT_COUNTS`; `profile.saveDeck(counts)` only on Save; Restore starter deck changing counts only, with the existing "Choose Save deck to keep it" message; Back (`#menu-back`) and Escape returning to the title; Play and resume unchanged.
2. WHEN a saved deck is reloaded, THE page SHALL show the saved counts.
3. THE title scene, hotspots and other menu pages SHALL be unchanged.
4. THE change SHALL add no dependency, art asset, game rule or animation.
