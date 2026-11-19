---
inclusion: fileMatch
fileMatchPattern: ["src/game/**", "scripts/verify-duel.mjs", "scripts/simulate-matches.mjs", "scripts/deck-balance.mjs", "scripts/sync-card-specs.mjs"]
---

# Game rules area

- `src/game/` stays pure: no DOM, rendering, filesystem, network or model imports.
- The current rules and known contradictions are in `docs/kiro-task-01.md`.
  Use them as the baseline when comparing design alternatives.
- Card specs are generated (`card-specs.generated.js`). Change specs under `.kiro/specs/duel-card-pipeline/cards/`, then run `sh scripts/check-card-specs.sh`.
- Apply each action once. Keep replay deterministic for a given seed. Follow
  the documented health bounds for the rules being implemented.
- Run the closest affected rules test first; `node scripts/verify-duel.mjs` is the broader integration check. No renderer build needed.
