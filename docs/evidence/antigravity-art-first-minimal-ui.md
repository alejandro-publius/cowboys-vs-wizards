# Art-First Minimal UI Evidence (`FH-R2`)

## Scope

This branch trims redundant visible prose on the illustrated 3D Showdown table (`src/ui/showdown-3d/`) and the Night Shift Saloon (`src/ui/saloon-billy-table.js`, `src/ui/showdown-3d/night-shift-saloon.js`) while keeping all painted artwork (`c92f7c1`), engine contracts, and screen-reader / accessibility tree descriptions intact.

## Changes Verified

1. **3D Aiming & Tribute HUD (`src/ui/showdown-3d/table-ui.js`, `src/ui/showdown-3d/table.css`):**
   - `compactSelectionPrompt()` condenses visible `.table-selection` prompts to `<= 10` tokens inside a dark backdrop pill so aiming text no longer collides with 3D deck labels, while `#sd-prompt` keeps the full sentence for `aria-describedby`.
2. **Painted Card Faces (`src/ui/showdown-3d/table-ui.js`):**
   - Removes the redundant `.table-card-kind` text row (`◆ Troop`, `✦ Spell`), replaces `1 tribute` with `★1`, and uses `COMPACT_CARD_RULES` (`✦ −1 ●`, `✦ Stun`, `◇ +1 ATK`, etc.) so non-troop rules fit on one line without truncating. Full rules remain in `.table-card-original` and `card.title`.
3. **3D World Labels & Zone Rail (`src/ui/showdown-3d/scene.js`, `src/ui/showdown-3d/table.css`, `src/ui/showdown-3d/referee-observer.js`):**
   - Empty 3D board props (`Location`, `Traps 0/2`, `Graveyard 0`) render no floating label; populated zones render compact badges (`11`, `✝ 1`, `▲ 1`) with `data-zone-title` / `data-zone-count` preserved for [`referee-observer.js`](../../src/ui/showdown-3d/referee-observer.js) and [`browser-showdown-singularity.mjs`](../../scripts/browser-showdown-singularity.mjs).
   - Clips the `#sd-zones` graybox rail leak below the 3D viewport while floating non-empty `button[data-graveyard]` pills cleanly in the top-left band.
4. **Night Shift Saloon (`src/ui/saloon-billy-table.js`, `src/ui/showdown-3d/night-shift-saloon.js`, `src/ui/showdown-3d/outpost.css`, `src/ui/showdown-3d/saloon-tables.css`):**
   - Preserves the painted Dragon (`Wanted on the frontier`), Billy, Bone Wall, and Headless Horseman artwork, compacts redundant explainer paragraphs to screen-reader text (`.saloon-sr-only`) so clicking `Fire for 1 · Proposed` reveals the full painted Headless Horseman Turn-9 takeover above the fold on `1280x820`, and tucks `.saloon-stage` into `<details class="saloon-ledger-drawer">` (auto-opened for `?saloon=review`, live mode, and portrait fallback).

## Commands Run

- `node --test tests/assets/links.test.mjs tests/game/dec4-steering.test.js tests/match/art-first-minimal-ui.test.js tests/match/night-shift-camp.test.js tests/match/billy-replay.test.js tests/match/saloon-showcases.test.js tests/match/referee-browser.test.js`
- `node scripts/stage-pages.mjs` and `node scripts/check-pages-tree.mjs --browser`
