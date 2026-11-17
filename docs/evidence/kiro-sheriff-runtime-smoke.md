# Sheriff runtime smoke (Kiro, 2026-11-16 America/Los_Angeles)

Kiro ran one bounded smoke verification of the final combined code. It grants no new artistic approval and does not claim deployment. The Sheriff source retarget and visual review, and Fable's Escape implementation, remain their authors' work.

- Base commit: `e7cddfd516332ca2eb3851e32971ebb23ac34852`, branch `kiro/sheriff-runtime-smoke`.
- Build: `npm run build`, exit 0. `dist/cowboys-vs-wizards-board-duel.html` SHA-256 `ed353a3354b07d172c6c4cbf0b5115d0886c29951d09c7fb01e5564c27ac6702` (56,550,995 bytes). Log: `.artifacts/kiro-sheriff-runtime-smoke/build.log`.
- Browser: `node scripts/browser-match-check.mjs --seed 0 --summary --out-dir .artifacts/kiro-sheriff-runtime-smoke/browser`, exit 0, run once. Chrome 157.0.8103.52. Log: `.artifacts/kiro-sheriff-runtime-smoke/browser.log`.
- Receipt: `.artifacts/kiro-sheriff-runtime-smoke/browser/browser-run.json` (untracked, with 4 screenshots). Its page SHA-256 matches the build above. It reports `uncommittedChanges: true`; the only untracked item in `git status` is `node_modules`.
- Observed per `browser-run.json`: 8 of 8 steps (ids 1-8), none pending, `flags` empty, `earlierAttempts` empty, `consoleErrors` empty (0).
  1. Match mode loads, seed shown
  2. Illustrated hand and catalog cards, flip to deck back
  3. Select then cancel (button, Escape)
  4. Sheriff summon: lane, confirm, troop and orbs
  5. End phase, CPU acts, clash changes counts
  6. Play to a result
  7. Restart during clash playback, pinned seed restarts clean
  8. Demo switch and back

Not checked: the 134 Node tests (run by the coordinator), `--escape` and `--showcase` modes, Sheriff idle animation appearance, performance, the web build, and the deployed site.
