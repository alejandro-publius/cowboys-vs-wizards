# Tasks: Beginner Seat Privacy

- [x] 1. Share the existing `viewFor(state, side)` projection with the engine and add opt-in `{seatPrivate: true}` level-0 hashing in `src/game/showdown/rules.js` (`BSP-1`, `BSP-2`).
- [x] 2. Add `tests/game/beginner-hidden-info.property.test.js` verifying seed `6`, `fast-check` shrinking of the live unflagged level-0 leak, and 200-run `fast-check` hidden-information invariance across levels `0`, `1`, `1.5`, and `2` (`BSP-3`, `BSP-4`).
- [x] 3. Record Trail, practice, Outrider Gate, and naive-attacker Boot Hill comparisons in `docs/evidence/antigravity-issue-223-hidden-info.md` (`BSP-2`, `BSP-4`).
