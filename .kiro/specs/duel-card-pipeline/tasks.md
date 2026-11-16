# Tasks: duel card pipeline

- [ ] 1. Card specs, one JSON per card, for all eight cards (R1, R2). Parallel task.
- [ ] 2. `scripts/sync-card-specs.mjs` with generate and `--check` (R3). Parallel task.
- [ ] 3. `tests/game/card-specs.test.js`, data-driven, checks deck order and stats (R2). Parallel task.
- [x] 4. `scripts/check-card-specs.sh` runs sync, sync `--check` and the targeted suite, logs exit codes, propagates failure (R4). Written; not yet run.
- [x] 5. Hook `.kiro/hooks/sync-duel-card-specs.json`, v1 PostFileSave, anchored to the card subtree (R4). Written; real trigger pending.
- [x] 6. Workflow `.kiro/workflows/card-summoning-circle.workflow.json`, three steps (R5). Written; run pending.
- [x] 6a. Workflow gains a `proposal` input and a first `author-proposal` step; `review-spec` checks the authored JSON (R5). Written; run pending.
- [ ] 7. Coordinator: after integration, save a card spec to trigger the hook, run the workflow with an isolated Skeleton health proposal and with `review existing`, and record observed results in `docs/kiro-build-log.md`.
