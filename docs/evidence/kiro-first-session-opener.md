# First-session opening duel: seed 690 (Kiro)

2026-11-18, America/Los_Angeles. Kiro IDE agent (Claude Opus 5.5) in worktree
`kiro-first-session`, branch `kiro/first-session`, base `e779c6f`.
Brief: Fable 5.2, `.artifacts/coordination/first-ten-minutes-kiro-brief.md`,
acceptance cases 1 and 2 only.

## Change
- `src/graybox.js`: `GUIDED_SEED` 60 → 690. Only How to Play → Start guided duel
  uses it. `?seed=`, seed links and replay keep their seeds, including 60.
- `src/match/guide.js`: comments only. `OPENER_TIP` is unchanged.
- `tests/match/first-session-opener.test.js`: acceptance checks.

## Verified (Node, engine plus selection clicks, Normal Wizard = `chooseAction`)
- AC1: seed 690, `rideOut: false`, starter deck. At the first Cowboy input it is round 1,
  the Wizard has acted, Wizard Base 5 with Skeleton (3 orbs) in lane 1, Cowboy Base 5 with
  an empty board, hand Sheriff, Sheriff, Deadeye, Billy, and `guideLine(opener)` = `OPENER_TIP`.
- AC2 block script: Victory in round 5, Cowboy Base 4, Wizard Base 0. Reproduces the brief.
- AC2 race script: Victory in round 3, Cowboy Base 2, Wizard Base 0. Reproduces the brief.
- `node --test tests/match/first-session-opener.test.js`: 4/4 pass.
- `npm test`: 391/391 Node tests pass, and the GLB structure check passes.
- `npm run build`: built `dist/cowboys-vs-wizards-board-duel.html`.

## Pending
- Browser pass and recording of the guided duel (not run).
- Acceptance cases 3–9 (bounty surfacing, Wraith order, Wraith Posse) are out of scope.
- `src/main.js` (art build) still starts its guided match on seed 0. It was left unchanged.
