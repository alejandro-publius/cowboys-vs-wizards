# Art-First Minimal UI Pass (`antigravity/art-first-minimal-ui`)

- **Author / Tooling:** Antigravity (isolated feature branch `antigravity/art-first-minimal-ui`). No native Kiro CLI session is claimed in this note.
- **Goal:** Let the painted card portraits, 3D miniatures/battlefields, and pixel Night Shift Saloon stage lead visually while preserving 100% of full-sentence descriptions in `#sd-prompt`, `.table-card-original`, and `aria-*` for screen readers and keyboard navigation.

## Changes

1. **Card faces ([`src/ui/showdown-3d/table-ui.js`](../../src/ui/showdown-3d/table-ui.js)):** Replaced truncated multi-word prose on `.table-card-face` (`"Stun an enemy troop: it cannot..."`) and redundant kind headers (`"◆ Troop"`, `"✦ Spell"`) with crisp icon + micro-rules (`COMPACT_CARD_RULES`: `✦ −1 ●`, `✦ Stun`, `✦ All foes −1 ●`, `△ −2 ●`, `△ Cancel`, `◇ +1 ATK`, `◇ +2 ●`, `▰ Lawmen +1`, `▰ Undead +1`) so portraits get larger vertical space and zero cards truncate across the 29-card catalog.
2. **3D board aiming prompt & zone labels ([`src/ui/showdown-3d/table-ui.js`](../../src/ui/showdown-3d/table-ui.js), [`src/ui/showdown-3d/scene.js`](../../src/ui/showdown-3d/scene.js), [`src/ui/showdown-3d/table.css`](../../src/ui/showdown-3d/table.css)):**
   - Added `compactSelectionPrompt` (`<= 10` tokens, e.g. `Pick target · or Take cover`, `Strike Base · Trap set! · or Cover`) so visual cues never collide with 3D props while `#sd-prompt` retains full rule text for `aria-describedby`.
   - Hid empty 3D zone labels (`0` traps, `0` graveyard, empty location ring) and shortened non-empty stack labels (`11`, `✝ 2`, `▲ 1`) while preserving `data-zone-title` / `data-zone-count` for [`src/ui/showdown-3d/referee-observer.js`](../../src/ui/showdown-3d/referee-observer.js) and [`scripts/browser-showdown-singularity.mjs`](../../scripts/browser-showdown-singularity.mjs).
   - Floated `#sd-zones` out of normal document flow so graybox text rails no longer bleed below the 3D viewport, exposing only non-empty Boot Hill graveyard buttons (`✝ <n>`) in the bottom-left corner.
3. **Night Shift Saloon ([`src/ui/saloon-billy-table.js`](../../src/ui/saloon-billy-table.js), [`src/ui/showdown-3d/night-shift-saloon.js`](../../src/ui/showdown-3d/night-shift-saloon.js), [`src/ui/showdown-3d/outpost.css`](../../src/ui/showdown-3d/outpost.css), [`src/ui/showdown-3d/saloon-tables.css`](../../src/ui/showdown-3d/saloon-tables.css)):**
   - Widened the pixel Saloon stage (`1.28fr` vs `0.72fr`), enlarged Billy and Bone Wall card portraits (`60x54`), trimmed the shot header to `Billy 2 → 1` (`Fire · 2` / `Fire · 1`), wrapped `.saloon-stage` (`Notice board & cast`) in a `<details class="saloon-ledger-drawer">` collapsed by default in 3D view (auto-opened for `?saloon=review` and live/portrait fallbacks), and fixed `#f2dfc2`-on-`#f2dfc2` summary contrast inside `.saloon-decision` (`#3a1f12`).
4. **Steering & word-budget guard ([`.kiro/steering/interface-area.md`](../../.kiro/steering/interface-area.md), [`tests/match/art-first-minimal-ui.test.js`](../../tests/match/art-first-minimal-ui.test.js)).**

## Reproduce

```sh
node --test tests/match/art-first-minimal-ui.test.js tests/match/night-shift-camp.test.js tests/match/billy-replay.test.js tests/game/dec4-steering.test.js tests/assets/links.test.mjs
node scripts/verify-duel.mjs
```
