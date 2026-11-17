---
inclusion: fileMatch
fileMatchPattern: ["src/game/**", "scripts/verify-duel.mjs", "scripts/simulate-matches.mjs", "scripts/deck-balance.mjs", "scripts/sync-card-specs.mjs"]
---

# Game rules area

- `src/game/` stays pure: no DOM, rendering, filesystem, network or model imports.
- Numeric rules and known contradictions are in `docs/kiro-task-01.md`. Do not invent mechanics to fill gaps.
- Card specs are generated (`card-specs.generated.js`). Change specs under `.kiro/specs/duel-card-pipeline/cards/`, then run `sh scripts/check-card-specs.sh`.
- Apply each action once. Keep replay deterministic for a given seed. Health orbs stay between one and five per living troop.
- Smallest check: `node scripts/verify-duel.mjs`. No renderer build needed.
