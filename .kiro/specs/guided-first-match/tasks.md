# Tasks: Guided first match preview (implemented by Kiro CLI 3.4.0 V3; see docs/evidence/kiro-guided-first-match.md)

- [x] 1. Read issues #19 and #20 for player notes (GF-8) — no player notes available to this run (coordinator reports none on #19/#20); nothing invented
- [x] 2. `src/match/guide.js`, pure function (GF-1 to GF-5) — done
- [x] 3. `tests/match/guide.test.js` against real seed 0 and a stop-rule case (GF-1 to GF-5) — done, 9 tests
- [x] 4. Show the line in the prompt via card-model and cards, off by default (GF-6, GF-7) — done in card-model.js only
- [x] 5. `src/main.js` wiring for `?guide=1` — done
- [x] 6. Prompt equality check without the parameter (GF-7) — done (GF-7 test + browser prompt comparison)
- [x] 7. `node scripts/verify-duel.mjs` (GF-9) — done, 193 Node tests passed
- [ ] 8. Browser and screen-reader check of three lines in place (GF-6). Pending human/browser. — browser run done for 4 states; screen-reader check NOT done (pending human)
- [x] 9. Correction pass: idle tips visible via `guideShown` (card-model.js, cards.js), neutral wording, `scripts/browser-guide-check.mjs` against a `965bd70` build, 6 screenshots, verify-duel exit 0. Screen-reader and human checks remain NOT done.
