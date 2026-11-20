---
inclusion: fileMatch
fileMatchPattern: ["src/game/**", "scripts/verify-duel.mjs", "scripts/simulate-matches.mjs", "scripts/deck-balance.mjs", "scripts/sync-card-specs.mjs"]
---

# Game rules area

- `src/game/` stays pure: no DOM, rendering, filesystem, network or model imports.
- Showdown rules live in `src/game/showdown/`; their text is
  `prototypes/showdown/RULEBOOK.md`. Check them with
  `node --test prototypes/showdown/rules.test.js tests/game/showdown-presenter.test.js`.
- The lane duel's rules (`src/game/*.js` outside `showdown/`) and known
  contradictions are in `docs/kiro-task-01.md`. They stay only because the
  earlier 3D build (`src/main.js`, `/3d/`) imports them; the graybox no longer
  plays them (`docs/design/release-line.md`, issue 143). Use them as the baseline when
  comparing lane design alternatives.
- Card specs are generated (`card-specs.generated.js`). Change specs under `.kiro/specs/duel-card-pipeline/cards/`, then run `sh scripts/check-card-specs.sh`.
- Apply each action once. Keep replay deterministic for a given seed. Follow
  the documented health bounds for the rules being implemented.
- Run the closest affected rules test first; `node scripts/verify-duel.mjs` is the broader integration check. No renderer build needed.
