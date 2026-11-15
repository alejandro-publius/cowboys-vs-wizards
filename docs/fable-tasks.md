# Fable work queue

Prepared by Codex at the user's request. Jobs below are not started. The existing
demo is preserved on local main; folder cleanup is on codex/repo-layout.

## Coordinator: run A and B only

1. Work in this repository, not the home directory. Read AGENTS.md and check
   git status and git worktree list.
2. Use separate prepared worktrees: .worktrees/fable-summons (branch
   fable/summon-rules) and .worktrees/fable-assets (branch fable/asset-audit).
   Run A and B concurrently if worker agents are available, otherwise sequentially.
   Never put two workers in the same working directory.
3. Each worker reads only its brief and relevant code. Both jobs use Node's
   built-in tests and need no package install or renderer build. No new packages,
   art generation, UI redesign, recursive agent teams or repeated critique loops.
4. Each worker commits its owned files and writes its own small evidence note.
   Inspect the two diffs and check results once. Stop before integration or C.
5. Report commit IDs, commands/results and blockers. Origin is unresolved.
   Verify the user's existing repo URL, actual base branch and ancestry before
   opening draft PRs. If local history differs, port scoped changes to branches
   from the actual remote base. Never force-push or create a replacement repo.
   Complete local work even when publishing is blocked.

Only the coordinator edits shared package/lock files, README, this queue,
.kiro/, shared logs or entry points. Record Fable work as Fable. Kiro can later
reconcile the spec and implement UI; do not launch duplicate engine work.

## A — Seeded decks and atomic tribute summons

**State:** ready, not started. Depends only on cleanup.

**Owned paths:** src/game/cards.js, src/game/state.js, src/game/actions.js,
tests/game/summon.test.js, docs/evidence/fable-summon.md.

Read the rules and known spec errors in docs/kiro-task-01.md as reference only;
do not execute its larger engine task or modify the Kiro spec.

Deliver a small pure API for seeded 12-card-per-side setup with unique IDs,
four-card opening hands, three slots and five base orbs; then one summon per
active side's action phase, paid atomically. Costs: 1–4 stars = zero troops,
5–6 = one, 7+ = two. Full-board tribute can reuse a vacated slot.

Reject wrong-side, duplicate/stale, already-used, invalid and unpaid actions
without changing the input state, card ownership or RNG. Every card remains in
exactly one of deck, hand, board or discard. Document the API in the owned note.

Boundary: no combat, spells, CPU, turn progression or rendering yet.
Verify with node --test tests/game/summon.test.js: seed replay, full-board
sacrifice, stale/retried action, invalid-selection rollback and card conservation.
Tests may supply valid mid-match fixtures for full-board cases.

## B — Read-only asset report

**State:** ready, not started. Independent of A.

**Owned paths:** scripts/audit-assets.mjs, tests/assets/audit.test.mjs,
docs/evidence/fable-assets.md.

Read assets/models/, the earlier inventory and docs/character-animation-plan.md.
Implement a dependency-free GLB report: file size, vertex/triangle counts where
defined, skins/joints and clip names, sorted by filename. Validate GLB v2 header
length and chunk bounds; reject truncation and invalid JSON. Unknown geometry
counts must be reported as unknown, not zero. Never modify the input assets.

Inspect all eight exports; name missing rigs/clips and concrete next actions.
Metadata cannot prove grip, smoothness or visual quality.

Verify node --test tests/assets/audit.test.mjs using small binary fixtures for
invalid headers/truncated chunks, then node scripts/audit-assets.mjs. Record the
actual output summary in the owned note. Do not load every reference document.

## Later jobs, in dependency order

| Job | Depends on | Completion evidence |
| --- | --- | --- |
| C: turns and clash | A reviewed | Simultaneous damage, spells, phase limits, round-9 result and deterministic replay tests |
| D: legal CPU | C reviewed | Completes seeded matches using its own hand and public board only |
| E: cards and orbs | C reviewed | Visible deck/hand, select/cancel/tribute/confirm and 1–5 troop orbs; browser interaction check |
| F: one wizard cast | B reviewed | Correct grip, anticipation and impact at board-camera scale; actual rendered evidence |

Assign later paths when the preceding API exists. E and F share the renderer,
so run them sequentially. No whole-game rewrite, Firebase, paid asset generation
or deployment is included in this queue.
