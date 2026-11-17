# Opt-in default/fast pacing feedback (#66)

Date: 2026-11-17 Pacific. Base: main `63b834a9018331cb269fa0fcd02cb67b4fffa06e`. Scope: `scripts/browser-match-check.mjs` only, plus this evidence note. Kiro CLI V3 (noninteractive, isolated `kiro/pace-feedback-66` worktree) authored the script changes. The coordinator reviewed the exact diff and executed the commands below. Kiro did **not** execute these checks: its headless run stopped at a blocked `list_directory`/shell approval after file edits. `--effort low` was requested, but Kiro's automatic model explicitly reported no effort levels; do not claim a low-effort setting took effect.

## Instrumentation

New flags `--pace default|fast` and `--pace-measure` are opt-in. Fast adds `?pace=fast` to the page URL, default/unflagged do not. Existing seeded click/replay paths and expected step counts are unchanged. Timings use Node's monotonic `performance.now()`, starting **after** real Chrome DevTools mouse click delivery and ending at the first observed next Cowboy `accepting_input` state. Each observation is recorded in `browser-run.json` with its round/step label and observed status, and printed under `--summary`. Timings include game/CPU turn work and up to a 60 ms polling interval plus snapshot evaluation, not simply animation delay or the complete input event latency.

## Coordinator-run checks, on this commit's worktree before commit

- `git diff --check`: no whitespace errors (pre-evidence script diff).
- `node --check scripts/browser-match-check.mjs`: exit 0.
- `npm run build -- --web`: exit 0, built `dist/web/index.html`.
- `npm run build`: exit 0, built `dist/cowboys-vs-wizards-board-duel.html`, required by the browser harness.
- Chrome `157.0.8103.52`; built HTML SHA-256 `7ad145c9e245a1e22b73a13a690663108d0d45505a8ae343a07819685f71a547` on all four browser checks. Every timing reached `accepting_input`; each run logged 0 console errors.

| Replay | Mode | Browser steps | Observed end-phase → next Cowboy turn (ms) |
| --- | --- | --- | --- |
| Seed 0 | default | 8/8 | step 5: 10091.6 |
| Seed 0 | fast | 8/8 | step 5: 7224.1 |
| Seed 60 showcase | default | 4/4 | rounds 1–5: 3595.6, 8775.8, 3621.6, 11059.2, 4130.1 |
| Seed 60 showcase | fast | 4/4 | rounds 1–5: 3062.6, 6301.9, 3063.4, 8246.6, 3550.8 |

All checks used `node scripts/browser-match-check.mjs` with the indicated `--seed`, `--summary --pace-measure --pace`, and isolated `--out-dir .artifacts/kiro/pace-{mode}-{seed}`. Seed 60 included `--showcase`. Generated screenshots and JSON receipts remain in the ignored local `.artifacts/kiro/` directory; none are claimed to be publicly hosted. No real phone/Safari or human playtest was run.

## Interpretation and next review

These are **one** observed pass per configuration, not evidence of a causal speedup. The default-to-fast differences are positive in these six observations, but test order, renderer scheduling, hardware/cache state and game-phase variation are uncontrolled. Larger timed samples with randomized ordering and measurement starting before click dispatch would be required for reliable comparative latency claims. The largest observed differences within seed 60 occur in rounds 4 and 2; do not change presentation timing based solely on this table. No game logic, default pace, artwork, source provenance, trap cards, or licensed assets were modified.

Execution attribution: Kiro CLI V3 wrote the harness code. Coordinator ran syntax, builds, and real Chrome seeded checks; this task did not run any Kiro Workflow, Crew review, Power test or hook, regardless of those files being present in the repository.
