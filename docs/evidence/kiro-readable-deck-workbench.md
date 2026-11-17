# Readable deck workbench (Kiro CLI implementation)

Branch `kiro/readable-deck-workbench`, based on deployed main 599450a. Implemented by the Kiro CLI default agent. The title/menu and the original deck builder are Codex's deployed base. Fable was assigned this redesign but stopped at its usage limit with no tracked edits and is not credited with any implementation. The spec (ee601b4) was read from `.artifacts/kiro-deck-workbench/spec-*.md` and is not merged or edited here.

## Changes
- `src/ui/deck-workbench.js` (new): collection tiles (existing approved card art via `.deck-art`), selected-card detail panel, chosen-deck panel with `N / 12`, per-card counts, validation text, save/restore feedback. Uses `validateDeck`, `COWBOY_CATALOG`, `DEFAULT_COUNTS` and `profile.saveDeck` unchanged. Text on the card text uses the existing catalog stars/attack/health and the Deadeye rule ("removes 1 enemy orb").
- `src/ui/title-menu.js`: `deck()` now calls the workbench; adds/removes a `deck-page` class on the page. Other menus untouched.
- `src/ui/title-menu.css`: scoped workbench styles; plain bordered panels in the existing gold/plum palette, no new art. Select lift is a 0.15s transform, disabled under `prefers-reduced-motion` and the in-game "Reduce card movement" setting.
- `scripts/browser-deck-workbench-check.mjs` (new): focused CDP check.
- No game rules, profile, main.js, assets, dependencies or build scripts changed. Wizard CPU deck and paused matches are not touched.
- Labels kept: `#save-deck`, `Add <card>` / `Remove <card>` (on the chosen-deck rows). Escape still returns to the title and restores focus to Build Deck.

## Checks actually run
| Command | Exit | Result |
| --- | --- | --- |
| `node --test tests/game/deck-builder.test.js tests/game/player-profile.test.js` | 0 | 20 pass, 0 fail |
| `node scripts/build.mjs --web` | 0 | built `dist/web/index.html` |
| `node scripts/browser-menu-check.mjs http://127.0.0.1:8765/?seed=0 .artifacts/kiro-deck-workbench/menu-check` (dist/web via `python3 -m http.server 8765`) | 0 | 11 checks, no errors; existing deck add/remove, blocked invalid save, save, reload and saved-deck-in-match assertions still pass |
| `node scripts/browser-deck-workbench-check.mjs http://127.0.0.1:8765/ .artifacts/kiro-deck-workbench/shots` | 0 | asserts below passed at both viewports |

Asserted at 1280x800 and 390x844 (Chrome headless, CDP): tile width at least 180px (desktop) / 150px (phone; measured 165); no text under 16px in the workbench; add/remove and save targets at least 44x44; no horizontal overflow; opening focus on Main menu; selecting Mounted Billy shows "2 friendly troops" and "3 attack"; removing Billy gives 11 / 12 with Save disabled and the "Choose exactly 12 cards" message; adding Deadeye and saving stores `{sheriff 6, billy 2, mounted 1, deadeye 3}` with visible "Deck saved" feedback; Enter on a focused tile selects it; Escape returns focus to Build Deck; the saved deck reloads.

## Screenshots (not committed)
`.artifacts/kiro-deck-workbench/shots/`: `desktop-1280x800-{default,invalid,saved,reloaded}.png`, `phone-390x844-{default,invalid,saved,reloaded}.png`. I looked at `desktop-1280x800-saved.png` and `phone-390x844-invalid.png`; the others were not individually inspected. Logs: `menu-check.log`, `workbench-check.log` in the same folder.

## Limitations
- Measurements and screenshots are evidence only; no user visual approval is claimed.
- Desktop captured with `captureBeyondViewport`, so the hidden title labels show faintly under the page bottom in that screenshot; this is a capture artifact, not tested in a normal full-page view.
- Only Chrome headless on macOS; no Safari/Firefox or real-touch device run. No screen-reader test.
- Arrow-key navigation inside the card grid was not added; Tab/Enter works.
- Wizard101 reference was used only for the collection-plus-deck organization.

## Codex integration review correction
The Kiro prototype added opaque bordered panels despite the approved no-box direction. Codex removed those panel/card backgrounds, kept existing artwork and palette, and corrected the browser assertion to measure the actual .deck-art width instead of its outer button. Codex also corrected Deadeye wording: the engine permits a spell before a summon, but casting prevents a later summon that turn. No rules changed.

The corrected web build passed the focused browser check at 1280x800 and 390x844: actual card art 187px and 162px; workbench text at least 16px; controls at least 44px; no horizontal overflow. Save/reload, invalid-save blocking, card selection and keyboard return passed. Existing menu check: 11/11, no errors. Card images were decoded before capture. [Desktop](deck-workbench/desktop-1280x800-default.png) · [Phone](deck-workbench/phone-390x844-default.png) · [Measurements](deck-workbench/measurements.json). These corrections and checks are Codex work. User visual approval remains pending.
