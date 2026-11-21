---
inclusion: fileMatch
fileMatchPattern: ["src/game/**", "scripts/verify-duel.mjs", "scripts/simulate-matches.mjs", "scripts/deck-balance.mjs", "scripts/sync-card-specs.mjs"]
---

# Game rules area

- `src/game/` stays pure: no DOM, rendering, filesystem, network or model imports.
- Showdown rules live in `src/game/showdown/`; their text is
  `prototypes/showdown/RULEBOOK.md`. Check them with
  `node --test prototypes/showdown/rules.test.js prototypes/showdown/contract.test.js tests/game/showdown-presenter.test.js`.
- The lane duel is retired and no current build plays it
  (`docs/design/release-line.md`, issue 143); `/3d/` redirects to `/`. Its
  last rules and 3D source are at commit
  `ea183ee29dbdcde00105cc4db3ba8bc39eb8f4df`, and its known contradictions are
  recorded in `docs/kiro-task-01.md` as history. Do not assign lane rules work
  unless the user reopens it.
- Card specs are generated (`card-specs.generated.js`). Change specs under `.kiro/specs/duel-card-pipeline/cards/`, then run `sh scripts/check-card-specs.sh`.
- Apply each action once. Keep replay deterministic for a given seed. Follow
  the documented health bounds for the rules being implemented.
- Run the closest affected rules test first; `node scripts/verify-duel.mjs` is the broader integration check. No renderer build needed.
