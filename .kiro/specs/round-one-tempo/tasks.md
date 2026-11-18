# Tasks: Round-one tempo
- [x] 1. Record the default seed 0 and seed 60 route SHA-256 at `9603fe4` before editing (RT-1)
- [x] 2. Add the flagged rule to `src/game/clash.js` (RT-3, RT-4, RT-5)
- [x] 3. Add `tests/game/round-one-tempo.test.js` (RT-1 to RT-5). Run: `node --test tests/game/round-one-tempo.test.js`
- [x] 4. Add `scripts/compare-round-one-tempo.mjs` (RT-6, RT-7)
- [x] 5. Run the development sample, seeds 10000–10063 (RT-8)
- [x] 6. Freeze the files, then run the holdout, seeds 20000–20511, twice (RT-8)
- [x] 7. Write `docs/evidence/kiro-round-one-tempo.md` (RT-9, RT-10). Both shield policies fail RT-10.
- [x] 8. Run the closest rules suites and `node scripts/verify-duel.mjs`; check the diff scope (RT-11)
