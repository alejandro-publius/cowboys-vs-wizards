# Tasks: CPU difficulty preview (all pending; Rachel implements)

- [ ] 1. Decide how easy and hard differ using the public view only (CD-3, CD-6)
- [ ] 2. Implement levels in `src/game/cpu.js`; `normal` unchanged (CD-2)
- [ ] 3. Tests in `tests/game/cpu.test.js`: normal equivalence on 100 or more seeds, public-view-only, determinism (CD-2, CD-3, CD-4)
- [ ] 4. Level option in `scripts/play-match.mjs` and `scripts/simulate-matches.mjs` (CD-5)
- [ ] 5. Simulate 1,000 or more matches per pairing; write `docs/evidence/cpu-difficulty.md` (CD-5, CD-6)
- [ ] 6. `src/main.js` wiring for `?cpu=` (CD-1)
- [ ] 7. `node scripts/verify-duel.mjs` (CD-7)
- [ ] 8. Browser check without the parameter (CD-1). Pending human/browser.
