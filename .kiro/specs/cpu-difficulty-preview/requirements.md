# Requirements: CPU difficulty preview (issue #34)

**Status: planned, not implemented.** Rachel owns implementation (`src/game/cpu.js`, `tests/game/cpu.test.js`, the two scripts, `src/main.js`, `docs/evidence/cpu-difficulty.md`). Issue #34 tells Rachel not to create `.kiro/` files; this plan exists because Kiro CLI was assigned this folder in issue #44. Every check below is pending until Rachel's change lands.

Goal: opt-in `?cpu=easy`, `?cpu=normal` or `?cpu=hard`. Without the parameter the Wizard plays as today.

| ID | Requirement | Executable check (pending) |
| --- | --- | --- |
| CD-1 | WHEN no `cpu` parameter is present, THE Wizard SHALL play exactly as today. | Default path is `normal`, covered by CD-2. **Pending browser check:** load without `cpu` and compare seed 0 moves. |
| CD-2 | THE `normal` level SHALL equal the current opponent move for move on at least 100 seeds. | New test in `tests/game/cpu.test.js` comparing `normal` with today's decisions over seeds 0 to 99 or more. |
| CD-3 | THE `easy` and `hard` levels SHALL use only the public view. | Test in `tests/game/cpu.test.js` built like the existing hidden-information test: same public view, different hidden hand and deck, same action. |
| CD-4 | EACH level SHALL be deterministic for a seed. | Same seed twice gives identical action lists, per level. |
| CD-5 | WITH at least 1,000 matches per pairing against the same Cowboy opponent, win rate SHALL order hard > normal > easy. | `scripts/simulate-matches.mjs` with a level option. `docs/evidence/cpu-difficulty.md` records command, seeds, rules version `orb-duel-draft-1`, results by starting side and match length, worded as an estimate. |
| CD-6 | IF `hard` cannot be made measurably stronger within CD-3, THEN only `easy` and `normal` SHALL ship, and the note SHALL say so. | Evidence note states the outcome. |
| CD-7 | Legal moves, card numbers and rules SHALL be unchanged; no interface change; no new dependency. | `git diff --stat` limited to the issue's file list; `node scripts/verify-duel.mjs`. |
| CD-8 | THE PR SHALL describe each level, the win rates and the three addresses. | Human review of PR text. |

Open decision for Rachel and Alex: how `easy` and `hard` differ. This plan invents no mechanic. Any random element must be seeded from public data only.
