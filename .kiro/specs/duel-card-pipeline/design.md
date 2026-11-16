# Design: duel card pipeline

## Flow
Edit card spec -> save -> hook -> `sh scripts/check-card-specs.sh` -> sync, sync `--check`, `node --test tests/game/card-specs.test.js` -> the matching receipt in `.artifacts/kiro/`.

## Components
- Card specs (R1): `.kiro/specs/duel-card-pipeline/cards/*.json`, owned by the card-spec task, together with `scripts/sync-card-specs.mjs` and `tests/game/card-specs.test.js`.
- Hook (R4): `.kiro/hooks/sync-duel-card-specs.json`, schema v1, trigger `PostFileSave`. The matcher `(^|/)\.kiro/specs/duel-card-pipeline/cards/[^/]+\.json$` is anchored to the card subtree. The generated catalog lives outside it, so regeneration cannot retrigger the hook.
- Wrapper (R4): `scripts/check-card-specs.sh` runs the three commands, appends one `label: exit N` line each, and exits with the first non-zero status.
- Workflow (R5): `.kiro/workflows/card-summoning-circle.workflow.json`, inputs `{"card":"string","proposal":"string"}` referenced as `{{card}}` and `{{proposal}}`. Steps all use `wf-coder` and pass `{{previous.output}}`: author-proposal (file tools only; validates the key, then edits one field or reads), review-spec (independent check of the JSON against the proposal and requirements), register-check (runs the wrapper once), balance-sample (`node scripts/simulate-matches.mjs --from 0 --count 100 --cowboy cpu --wizard cpu`).

## Decisions
- `card` and `proposal` are data, never interpolated into a shell command. `card` becomes a path only after the key pattern and existence check.
- Authoring is limited to one existing field in one existing spec, inside the isolated workflow workspace, using the inherited spec schema. It adds no fields or files.
- Review, check and balance steps edit nothing; the generated catalog is written only by sync.
- Rules in `src/game/` are untouched by this lifecycle apart from reading the generated catalog.

## Verification
- Wrapper: exit status and `card-hook.txt`.
- R2: the data-driven card spec test compares the catalog with the expected deck order.
- The observed save hook, both Workflow trials and the Crew balance preview are recorded in the [card pipeline evidence](../../../docs/evidence/kiro-card-pipeline.md).
