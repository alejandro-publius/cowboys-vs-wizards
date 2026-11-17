# Trap placeholder lab: scenario and Wizard CPU selectors (issue #116)

Date: 2026-11-17 (America/Los_Angeles). Worker: Kiro (single worker, Kiro IDE session; the session context names model `claude-opus-5.5`). The session emitted no usage or credit metadata to this worker, so none is recorded. Base: `eca06e3` (main after PR #115). One local commit. Not pushed, not merged.

## Problem

The #108 lab could only play the FIXTURE setup (one extra fixture trap in each opening hand, 13 cards per side). Issue #116 asks for a developer-only way to play the shipped decks (BASE) and the #114 12-card replacement scenarios (T1, T2) against a chosen Wizard CPU level, in the same placeholder page, before any production trap card, art, model, animation or sound is chosen.

## Change

- [scenarios.js](../../experiments/trap-placeholder/scenarios.js) (new, pure, browser-safe): `openingFor(seed, "BASE" | "T1" | "T2")`. BASE is `createMatch(seed)`. T1 and T2 call `createMatch(seed, { traps: true })` and relabel spell copy 2 (T1) or both copies (T2) after the shuffle to the #114 IDs `test-fixture-deck-trap-<side>-<copy>`. It does not import [sim.js](../../experiments/trap-deck-sim/sim.js), which needs `node:crypto`.
- [lab.js](../../experiments/trap-placeholder/lab.js): `createLabEngine(scenario)` and `createLab({ scenario, cpuLevel })` (defaults FIXTURE and normal, so the #108 lab is unchanged); the Wizard chooses with `cpuFor(level)(publicState, { cards })`. `createLabSession` applies settings on Start only: with changed settings it marks the old lab stale (its `onChange` is ignored), calls its `controller.leave()`, and builds a fresh lab with an empty log. A refused seed keeps the current match. `trapText` reports "traps not enabled in this scenario" when the view has no trap zone (BASE).
- [app.js](../../experiments/trap-placeholder/app.js) and [index.html](../../experiments/trap-placeholder/index.html): two native `<label>`/`<select>` controls in the seed form (scenario, Wizard CPU). The status line names the active scenario with its real card count, the Wizard level, and "Settings changed: they apply on Start." while the selects differ from the active match. Restart keeps scenario, level and pinned seed. No URL flag, no link from the game.
- [README.md](../../experiments/trap-placeholder/README.md): scenario table and Start-only rule.

Not changed: `src/`, existing tests, `experiments/trap-deck-sim/`, CSS, cards, decks, packages, CI, assets. Controller, Presenter, `legalActions` and `publicEvents` are the shipped ones; the lab adds no rule.

## Verification (this run, 2026-11-17)

| Check | Result |
| --- | --- |
| `node --test tests/experiments/trap-placeholder-scenarios.test.js` (new) | 8 of 8 pass, 0 skipped |
| `node --test tests/experiments/trap-placeholder.test.js` (existing #108) | 7 of 7 pass |
| `node --test tests/experiments/trap-placeholder-keyboard.test.js` (existing #110, Chrome 157.0.8103.79) | 1 of 1 pass, not skipped |
| `npm test` | exit 0; node:test 313 of 313 pass, 0 skipped; asset structural checks 2 of 2 |
| `node scripts/check-links.mjs` | 175 Markdown files, 631 links, 0 broken |
| `git diff --check` | clean |

What the new [test](../../tests/experiments/trap-placeholder-scenarios.test.js) checks:

- FIXTURE default: `createLab()` settings are FIXTURE/normal, `cpuFor("normal") === chooseAction`, openings equal the #108 construction, and seeds 0 and 60 give the #108 receipt (Wizard wins round 5 with 72 events; round 7 with 106 events).
- BASE: opening deep-equals `createMatch(seed)` with no `traps` key on seeds 0 and 60, and the lab's views match the shipped default controller's views step for step through a full match.
- T1 and T2: opening deep-equals sim.js `openingFor(seed, scenario)` for seeds 0 to 199 (BASE too); 12 cards per side; T1 has 1 spell and 1 trap, T2 0 spells and 2 traps; starting side and rng equal BASE; every changed position was a spell copy.
- `CARDS` and `DECKS` are frozen and unchanged after every scenario; no synthetic ID is in them.
- Every CPU level, on both sides, in all four scenarios, seeds 0 to 39: each choice is in `legalActions` and accepted by `applyAction`.
- Every scenario by level, seeds 0 and 60, through the controller: terminal result, identical replays (events and every snapshot), no Wizard trap ID in the log before its own `trap-trigger`, none in views, displayed views, options or messages unless already in the Wizard discard. BASE has no trap event; FIXTURE, T1 and T2 each had a trigger.
- Session: unchanged settings reuse the same controller; an invalid seed with changed settings keeps the match; changed settings leave the old controller (idle) while its CPU step was queued, the old log gains nothing, no callback arrives from the old lab, the new log equals a fresh T1/hard lab; Restart keeps T1/hard and pinned seed 0; Leave leaves no pending scheduler entry; unknown scenario or level throws.

Chrome smoke (same test file, Chrome 157.0.8103.79 headless, 127.0.0.1 server started by the test, CDP with no dependency). Selects are set by script plus a `change` event, and Start is `requestSubmit()` on the form, so this is not a keyboard check of the selects. Moves are scripted `click()` calls. Observed:

| Scenario | Wizard | Seed | Result | Cowboy trap sets by click | Trap springs in log |
| --- | --- | --- | --- | --- | --- |
| BASE | normal | 0 | loss (base-destroyed) | 0 | 0 |
| T1 | easy | 60 | loss (base-destroyed) | 2 (one before and one after the scripted Restart) | 1 |
| T2 | hard | 0 | loss (base-destroyed) | 2 | 1 |

Each run also checked the pending-settings note, the status after Start and after Restart, the log reset on switch, deck plus hand at most 12, the BASE "traps not enabled" zone texts, and that no Wizard deck trap ID was in the page HTML before the first Wizard trap sprang. 0 runtime exceptions and 0 console errors. The Cowboy loses because the script mostly ends the phase; this says nothing about balance.

## Limits

- Synthetic traps only. These results are not balance evidence and claim no real trap card.
- The leak check in Chrome stops after the first Wizard trap springs; the Node test checks each Wizard trap ID separately.
- The keyboard behavior of the new selects is native and was not driven by key events. Nobody has tested the page with a screen reader or with human keyboard users. The status line is `aria-live="polite"` and now longer, so it may be verbose.
- `docs/kiro-build-log.md` is coordinator-owned and was not edited.

## Independent coordinator verification (2026-11-17)

The coordinator reviewed the bounded seven-file diff separately from
Kiro's authored commit 03b17f7, verified exact base
eca06e3df6a42f057fce5201b251e974a22f91d0 and reran:

- node --test tests/experiments/trap-placeholder-scenarios.test.js:
  **8/8 pass, 0 skipped**. Actual Chrome headless 157 localhost smoke
  exercises BASE/normal seed0, T1/easy seed60 and T2/hard seed0;
  0 runtime errors; seed-0..199 deck parity verified against #114.
- node --test tests/experiments/trap-placeholder.test.js:
  **7/7 pass**.
- node --test tests/experiments/trap-placeholder-keyboard.test.js:
  **1/1 pass, 0 skipped**, real Chrome keyboard input, seeds 0/60.
- npm test: **313/313 Node tests**, 2/2 existing GLB structural
  checks, which do NOT establish visual motion quality.
- node scripts/check-links.mjs: **176 Markdown files, 638 links,
  0 broken**.
- git diff HEAD^ HEAD --check: pass.
- Kiro CLI 3.4.0 verified at invocation; the completed V3 JSONL
  emitted runFinished, selected claude-opus-5.5 and reported
  **18.89213352769486 session credits** (tool metadata, not an
  account invoice). The worker's opening note about missing usage
  describes what Kiro itself recorded before this separate review.

The coordinator authored this appended evidence, not the
Kiro implementation. No production catalog/deck/3D/animation/audio,
art, app entry point, CI or deployment changes; user approval for
production trap identity/copies and human/screen-reader validation
remain separate.
