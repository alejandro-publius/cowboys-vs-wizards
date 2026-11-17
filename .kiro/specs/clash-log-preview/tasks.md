# Tasks: Clash log preview (retrospective)

- [x] 1. Implement `clashLog` and wiring (Rachel, `4fb0f88`; not Kiro work)
- [x] 2. Seed 60 example tests, `tests/match/clash-log.test.js` (Rachel)
- [x] 3. Requirements-to-check table (this folder, Kiro CLI, retrospective)
- [x] 4. Generated property suite `tests/match/clash-log-properties.test.js` (Kiro CLI). Run: `node --test tests/match/clash-log-properties.test.js`
  - _Requirements: CL-1, CL-2, CL-3, CL-4, CL-5_
- [x] 5. Mutation evidence in an isolated copy (Kiro CLI); see the evidence note
- [ ] 6. Browser check: no new element without `?log=1` (CL-8). Pending.
- [ ] 7. Screen reader and live region check (CL-7). Pending human.
- [ ] 8. `node scripts/verify-duel.mjs` on the PR head (CL-9). Pending.
