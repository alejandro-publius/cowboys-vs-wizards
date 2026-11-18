# Coordinator Chrome verification — active-clash pacing (#128)

Run date: November 17, 2026 (PST). ORIGINAL Cowboys vs Wizards, feature-flags unchanged. **Kiro authored benchmark implementation commit `e179085`; the coordinator independently ran and reviewed the browser measurement.** This document is coordinator evidence, not Kiro-authored gameplay code or a human playtest.

## Reproduction

```sh
node scripts/browser-pace-measure.mjs --route clash --seeds 0,60 --samples 3 --turns 2 --out /tmp/cvw-128-independent-clash.json
```

- Receipt SHA-256: `858fc5a6eeb7894c3b1e63c58f26db291e7247b97ab380acd5c0199222110536`. The raw receipt remains local at `/tmp/cvw-128-independent-clash.json` and is not committed.
- Chrome 157.0.8103.79 (headless); ANGLE Metal / Apple M1; Node 26 on macOS. Page-load-to-input median 1263 ms (range 470–2833).
- **12/12** real CDP runs completed: two seeds × two pacing modes × three samples, two turns each, 24 observed turn playbacks.
- Receipt `pass: true`; **zero** remote requests, **zero** console errors, **zero** missing summons. All four seed/turn combinations have identical observed DOM board-state order and end state across the six corresponding runs, with identical summoned card ID and lane.
- A health value for an existing troop decreased between post-summon and post-turn states in **all 24/24 turn playbacks**. Thus genuine battle-health changes were observed, not just card placement.

## Wall-clock timing (ms, median of three samples per mode)

| Seed | Turn | Summon click → troop visible (default / fast) | End phase click → next input (default / fast) |
| --- | --- | --- | --- |
| 0 | 1 | 350.6 / 350.6 | 10065.9 / 7199.8 |
| 0 | 2 | 348.4 / 350.1 | 4066.4 / 3535.5 |
| 60 | 1 | 349.6 / 350.2 | 3548.6 / 3031.5 |
| 60 | 2 | 348.8 / 350.8 | 8232.8 / 5747.5 |

Fast pacing reached the next input sooner in all four tested seed/turn pairs. Summon-to-DOM acknowledgment was approximately equal. This is **measured wall-clock latency**, not evidence of 3D animation impact timing, display photons, subjective pacing, or balance. The browser overlay cannot verify rendered cue timing. A preexisting unrelated headless Chrome ran on the same host, so results are machine- and load-specific. No external processes were changed.

## Independent coordinator checks

- `node --test tests/match/pace-browser.test.js tests/match/pace.test.js`: **15/15 passed**.
- `npm test`: **323/323 Node tests passed**, and **2/2 GLB structural checks** (not animation-quality verification).
- `npm run build -- --web`: succeeded.
- `node scripts/check-links.mjs`: **185 Markdown files, 683 relative links, 0 broken**.
- `git diff --check origin/main`: no whitespace errors.
- Draft PR #130 passed GitHub CI before this documentation-only coordinator evidence addition; CI must pass again on the updated head before merge.

## Scope and gate

Only the developer-only benchmark script, focused test, and evidence are touched. Production gameplay, default seed-0/seed-60 rules, AX trap card identity/copy counts/deck migration, models, 3D impact effects, art, sound, deployment, and human testing remain unchanged or unapproved. Any hidden-versus-visible draw pause change requires its own reviewed approval.
