# Requirements: Guided first match preview (issue #35)

**Status: planned, not implemented.** Rachel owns `src/match/guide.js`, `tests/match/guide.test.js`, the card-model and cards change, and `src/main.js` wiring. Issue #35 tells Rachel not to create `.kiro/` files; this plan exists because Kiro CLI was assigned this folder in issue #44. All checks are pending implementation.

Goal: opt-in `?guide=1` adds one short line of advice at each step of the first two rounds, in the existing prompt's place.

| ID | Requirement | Executable check (pending) |
| --- | --- | --- |
| GF-1 | On `?mode=match&deck=starter&seed=0&guide=1` THE guide SHALL cover, in order: choose a card, choose a lane, confirm, end the phase, what the first clash did, the first summon that needs a sacrifice. | `tests/match/guide.test.js` walks the real seed 0 match through the selection states and asserts the ordered steps. |
| GF-2 | EACH line SHALL be one sentence, use the game's own words (How to Play in `src/ui/title-menu.js`), and be true for the current board. | Per-line test against the real public view; vocabulary check against How to Play; one-sentence check. |
| GF-3 | THE guide SHALL stop after round two or the first sacrifice summon, whichever is later. | Test plays on and asserts nothing is returned after the later of the two. |
| GF-4 | Advice SHALL NOT name a card the Wizard holds or anything else the player cannot see. | Input is the Cowboy public view only; output is equal across different Wizard hands; no Wizard card name appears unless that card is on the board. |
| GF-5 | THE guide SHALL NOT choose for the player or block a legal move. | Pure function returning text or nothing; legal actions are identical with and without it. |
| GF-6 | Screen readers SHALL announce the line as they announce the prompt. | Code check that it renders in the prompt element; **pending human screen-reader check**. |
| GF-7 | WITHOUT `?guide=1` the prompt text SHALL be identical to today's. | Model test comparing prompts with the guide off against current output across the seed 0 steps; **pending browser DOM check**. |
| GF-8 | THE guide SHALL address points where real players got stuck in issues #19 and #20, if notes exist. | **Pending.** Kiro CLI did not read those issues. Rachel reports whether notes exist; none are invented here. |
| GF-9 | `node scripts/verify-duel.mjs` SHALL pass; no art, panel, arrow or animation added. | Command and `git diff --stat`. |
