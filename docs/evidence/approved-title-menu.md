# Approved illustrated main menu — November16,2026
User-approved GPT Image artwork is now the opening screen. Codex implemented the integration, with Codex helpers on profile/deck rules and review; this is not attributed to Kiro or Fable.

## Working behavior
- Play initializes the existing 3D match on demand. Main menu pauses scheduler time and card animations; Play resumes. A completed match starts afresh.
- How to Play describes the shipped lanes, tribute costs, spell order, life orbs and match limit.
- Settings persist attack-demo sound, reduced card motion and Auto/Battery saver graphics. Blocked storage falls back to session-only with an accurate notice.
- Achievements are earned only by accepted human summons/spells, completed matches, wins and saved decks. No backfilled or invented progress.
- Build Deck uses the four existing Cowboy types: exactly12 cards, at most6 of each, at least1 Sheriff. New selections take effect on the next match/restart. Default6/3/1/2 and Wizard deck remain unchanged. These are deck-construction limits, not a claim that every deck is balanced.
- `?mode=match&deck=starter&seed=0` and seed60 keep named demonstration routes reproducible independently of saved decks. `?mode=demo` preserves the exchange.
- Desktop uses the exact approved still artwork with accessible native controls; portrait uses larger text controls. No new character motion or ambient animation was authored.

## Observed verification
- `node scripts/verify-duel.mjs`:156/156 tests; both shipped animated GLBs pass their structural checks.
- Web build succeeds.
- Real isolated Chrome menu run:11 checks passed, zero runtime/console errors. Covers all native targets, keyboard/escape focus, settings persistence, initially locked achievements, validated deck save, four decoded card images, actual seeded custom-deck hand, real summon unlock, mid-clash pause/resume and390px portrait touch controls.
- Existing full seed0 Chrome match replay:8/8, zero console errors.
- Visually reviewed desktop title, loaded deck builder and portrait screenshots. The initial deck screenshot was taken before its background images loaded; the harness now waits for all four to decode.
- Local raw receipts/screenshots: `.artifacts/title-menu/`. Historical run names v2/v3 reflect the added image-load assertion; do not call them new results without rerunning.

## Source map
`src/ui/title-menu.{js,css}`, `src/ui/layout.html`, `src/profile/player-profile.js`, `src/game/deck-builder.js`, existing state/cards/main integration, and `scripts/browser-menu-check.mjs`. Art provenance: `assets/menu/README.md`.

Still outside this release: animated title effects, Wizard-side deck editing, online/cloud saves and the deferred gameplay expansion ideas.
