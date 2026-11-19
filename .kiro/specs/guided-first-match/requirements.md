# Requirements: Guided first match preview (issue #35)

**Status: implemented behind `?guide=1` (Kiro CLI 3.4.0 V3, from main 965bd70); not merged, not human-reviewed.** Ownership of `src/match/guide.js`, `tests/match/guide.test.js` and the card-model and `src/main.js` wiring moved from Rachel to this Kiro CLI run (transfer reported by the coordinator in GitHub #35). The correction changes `src/ui/cards.js` visibility so idle tips are visible in the existing `role="status"` prompt; selection buttons stay hidden without a selection. Results per ID are in `docs/evidence/kiro-guided-first-match.md`.

Goal: opt-in `?guide=1` adds one short line of advice at each step of the first two rounds, in the existing prompt's place.

Menu follow-up by Codex. An explicit action in How to Play opens the same guidance with the starter deck and seed 0. The original query route remains available.

| ID | Requirement | Executable check |
| --- | --- | --- |
| GF-1 | On `?mode=match&deck=starter&seed=0&guide=1` THE guide SHALL cover, in order: choose a card, choose a lane, confirm, end the phase, what the first clash did, the first summon that needs a sacrifice. | `tests/match/guide.test.js` walks the real seed 0 match through the selection states and asserts the ordered steps. |
| GF-2 | EACH line SHALL be one sentence, use the game's own words (How to Play in `src/ui/title-menu.js`), and be true for the current board. | Per-line test against the real public view; vocabulary check against How to Play; one-sentence check. |
| GF-3 | THE guide SHALL stop after round two or the first sacrifice summon, whichever is later. | Test plays on and asserts nothing is returned after the later of the two. |
| GF-4 | Advice SHALL NOT name a card the Wizard holds or anything else the player cannot see. | Input is the Cowboy public view only; output is equal across different Wizard hands; no Wizard card name appears unless that card is on the board. |
| GF-5 | THE guide SHALL NOT choose for the player or block a legal move. | Pure function returning text or nothing; legal actions are identical with and without it. |
| GF-6 | Screen readers SHALL announce the line as they announce the prompt. | Code check that it renders in the prompt element; **pending human screen-reader check**. |
| GF-7 | WITHOUT `?guide=1` the prompt text SHALL be identical to today's. | Model test plus the actual browser check comparing guide-off and guide=0 against the original 965bd70 build at twelve steps; both passed. See the dated evidence for browser and scope. |
| GF-8 | THE guide SHALL address points where real players got stuck in issues #19 and #20, if notes exist. | Coordinator checked issues #19 and #20: no player notes were available for this run. No human findings or acceptance are invented; future feedback remains open. |
| GF-9 | `node scripts/verify-duel.mjs` SHALL pass; no art, panel, arrow or animation added. | Command and `git diff --stat`. |
| GF-10 | WHEN the player chooses Start guided duel before the first match, THE game SHALL start a seed-0 starter duel with hints, preserve the saved deck, and resume the same match from the main menu. Ordinary Play after the guided match ends SHALL use the normal opening settings. | `scripts/browser-menu-check.mjs` exercises keyboard start, starter hand, visible hints, saved-deck retention and pause/resume. Desktop Safari also exercised returning to ordinary Play after the guided match ended. |
