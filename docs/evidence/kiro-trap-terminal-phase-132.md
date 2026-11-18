# Trap lab terminal phase label (issue #132)

Date: 2026-11-17, finished 21:33 PST (America/Los_Angeles). Author and executor: Kiro CLI 3.4.0 V3, invoked with `--model claude-opus-5.5` in isolated worktree `.worktrees/kiro-trap-terminal-phase-132` (session `sess_3784150a-8c88-42c5-a337-6d2307f53320`). The streamed `session_usage` emitted **6.805755833167496 credits**, independently read by the coordinator. Requested model selection does not independently prove backend-model identity or account-wide balance. Base: main `1d5a78cdf3aada8f8a3b13ac601e1f9a345c41cb`, branch `kiro/trap-terminal-phase-132`. Scope: developer-only trap placeholder lab. No change to `src/`, cards, decks, rules, art, models, animation, audio, packages, CI or deployment.

## Problem

The #131 parity run ([kiro-trap-dom-parity-131.md](kiro-trap-dom-parity-131.md)) recorded one known finding. After the result, the engine public view has `activeSide: null`, but [`app.js`](../../experiments/trap-placeholder/app.js) `render()` printed `Phase: Wizard`. It used `activeSide === VIEWER ? "Cowboy" : "Wizard"`, so a null side was shown as the Wizard. The comparator in [`browser-trap-parity-131.mjs`](../../scripts/browser-trap-parity-131.mjs) accepted that one case as a finding instead of a mismatch.

## Change

- `experiments/trap-placeholder/app.js`: new `phaseLabel(side)` returns `Cowboy` for the viewer, `Wizard` for the enemy, and `none` for any other value, including null. The status line uses it. Live Cowboy and Wizard labels are unchanged. Only the status text of this lab changed. Gameplay, controller input and the BASE (traps off) scenario are untouched.
- `scripts/browser-trap-parity-131.mjs`: the status regex accepts `Phase: (Cowboy|Wizard|none)`, and `none` parses to `null`. The phase check is now strict: `check("phase", read.status.phase, view.activeSide)` at every stable point, terminal included. `TERMINAL_PHASE_FINDING` and its exception are removed. The receipt keeps its `findings`/`knownFindings` fields, which are now 0.
- `tests/match/trap-dom-parity.test.js`: the test-only `fakeDom` uses the new wording. The seed 0/60 mirror tests now require zero findings at every point. A new test checks the terminal point of seeds 0 and 60. In that test, `activeSide` is null, the status reads `Phase: none. Result: …`, the status contains no `Phase: Wizard`, and the comparator returns no mismatch and no finding. It also checks that the old `Phase: Wizard` wording (and `Phase: Cowboy`) at terminal is a strict mismatch, `phase: DOM "wizard" vs view null`, and not a finding. Finally, it checks that live points keep `Phase: Cowboy` and that `Wizard` still parses. It also asserts that app.js no longer contains the `=== VIEWER ? "Cowboy" : "Wizard"` inference.

## Checks run (observed)

```sh
node --test tests/match/trap-dom-parity.test.js   # 7 tests, 7 pass
npm test                                           # 330 tests, 330 pass; sourced-animation structural check 2/2 PASS
node scripts/browser-trap-parity-131.mjs --out .artifacts/kiro/trap-phase-132-a.json
node scripts/browser-trap-parity-131.mjs --out .artifacts/kiro/trap-phase-132-b.json
node scripts/check-links.mjs
git diff --check
```

Environment: Chrome/157.0.8103.79 headless, 1280×900, Node v26.0.0, darwin arm64. Breakpoint `app.js` line 193 (the last line of `render()`, moved from 185 by the new helper). Lab SHA-256 in the receipt: `app.js` `56e05a87…dd23`; `lab.js`, `scenarios.js` and `index.html` are unchanged from #131 (`272d5b6d…c995`, `10b3dc52…2b30`, `21a5f897…9407`). The receipts were taken on the uncommitted working tree (`dirtyTracked: true`, head `1d5a78c`) holding exactly this change. They were written to `.artifacts/kiro/` (gitignored), read for this note, then deleted.

Two consecutive real-Chrome runs: 44.5 s and 44.1 s. Both had `pass: true`, 0 mismatches, 0 known findings, 0 console errors and 0 remote requests. Both had the same digest, `1a4681f09ea425fdfc10893249cff0a6bbc0a22d688cb02b3def8b9267f78c07`. The digest differs from #131's `5ed6ca24…` because the terminal status text changed, as intended.

| Seed | Accepted Cowboy inputs (real CDP clicks, in order) | Stable points | Terminal DOM status (parsed) | Result |
| --- | --- | --- | --- | --- |
| 0 | Summon Sheriff to lane 1, End, Summon Sheriff to lane 2, End, End, End | 7 | `terminal`, round 4 of 9, phase `none` (null), Result loss (base-destroyed) | Wizard set its synthetic trap in round 1. It stayed hidden at 2 points and then sprang once |
| 60 | Summon Sheriff to lane 1, trap card `test-fixture-deck-trap-cowboy-2`, Confirm, End, Summon Sheriff to lane 2, End, End, End, Summon Sheriff to lane 1, End | 11 | `terminal`, round 5 of 9, phase `none` (null), Result loss (base-destroyed) | Cowboy set its trap. It sprang once. The Wizard set no trap |

Inputs, stable-point counts and results equal the #131 run. The phase check compared the DOM against the view strictly at all 18 points, and every comparison matched.

## Not run

`scripts/verify-duel.mjs` and the default renderer build were not run because nothing in `src/` or the shipped game changed. No human playtest was done. This note makes no clarity claim.
