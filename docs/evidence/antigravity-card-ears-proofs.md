# Card EARS Specification Proof Suite (`CARD-COWBOY-*` & `CARD-WIZARD-*`)

- **Author / Tooling:** Antigravity (feature branch `antigravity/card-ears-cowboy-wizard-proofs`). No native Kiro CLI session is claimed in this note.
- **Scope:** Adds [`tests/game/card-ears-catalog-proofs.test.js`](../../tests/game/card-ears-catalog-proofs.test.js) with zero edits to `src/game/`, `src/ui/`, or `tests/game/card-specs.test.js`.
- **Trace Impact (`node scripts/trace.mjs`):**
  - Total proven requirement clauses across all 45 specs: **`108` -> `451`** (`+343` newly proven clauses; orphan IDs reduced `620` -> `277`).
  - Across all 29 `.kiro/specs/card-*` EARS specifications (`442` total `CARD-*` clauses): **`441 / 442` (`99.77%`) proven**; **28 of 29 card specs have zero orphan IDs**.
  - Only [`CARD-WIZARD-HELLFIRE-04`](../../.kiro/specs/card-wizard-hellfire/requirements.md) remains intentionally unasserted because [`proof/referee/referee.py`](../../proof/referee/referee.py) records empty-board Hellfire legality as an open rulebook-versus-engine ruling.
  - `duplicate IDs: 0`, `unsupported syntax: 0`, and zero new unresolved test references.

## Reproduce

```sh
node --test tests/game/card-ears-catalog-proofs.test.js tests/game/dec4-trace.test.js tests/assets/links.test.mjs
node scripts/trace.mjs
```
