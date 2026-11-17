# Trap placeholder lab (issues #108 and #116)

**Experimental, synthetic, local only.** This is a developer lab for the frozen A + X trap prototype. It is not released UI, not gameplay art and not linked from the game. Traps stay off in the shipped game (`createMatch(seed)` with no `traps` option). In the default FIXTURE scenario each side gets one anonymous test-fixture trap in its opening hand, defined only in [lab.js](lab.js). The fixture is not a card, deck entry, copy count or balance result. There are no models, animation, audio or art. The page uses plain native buttons and text. Nobody has reviewed it for accessibility.

## Run it

Serve the repository root over loopback HTTP. ES modules do not load from `file://`.

```sh
python3 -m http.server 8108 --bind 127.0.0.1
```

Then open `http://127.0.0.1:8108/experiments/trap-placeholder/index.html`. Stop the server with Ctrl+C. No build step and no dependency are needed. The page imports `src/game` and `src/match` directly.

## What it shows

- Both sides' three lanes, with each troop's health orbs and attack; base life orbs; round and active phase; deck, hand and discard counts.
- Your trap zone with its identity and set or armed state. The enemy zone reads only "set (face-down)" until the trap springs.
- A status line (`aria-live="polite"`), an optional public event log (`role="log"`), a seed field (seeds 0 and 60 replay deterministically), and Start, Restart and Leave.

## Scenarios and Wizard CPU (issue #116)

Two native selects in the seed form, both developer-only. A change applies only when you press Start (or Enter in the seed field); until then the status line says "Settings changed: they apply on Start." and the match in progress is untouched. Restart keeps the active scenario, CPU level and pinned seed.

| Scenario | Deck per side | Trap flag |
| --- | --- | --- |
| FIXTURE (default) | shipped 12 plus one extra fixture trap in the opening hand: 13 cards, not a 12-card deck | on |
| BASE | shipped 12, exactly `createMatch(seed)` | off; the trap zones read "traps not enabled in this scenario" |
| T1 | 12: spell copy 2 relabelled to an anonymous synthetic trap (1 spell, 1 trap) | on |
| T2 | 12: both spell copies relabelled (0 spells, 2 traps) | on |

T1 and T2 relabel after the shuffle ([scenarios.js](scenarios.js)), so the seed, shuffle, starting side and every other ID match BASE. They use the same IDs as the #114 simulation; the page cannot import [sim.js](../trap-deck-sim/sim.js) because it uses `node:crypto`, and a Node test checks that both give the same opening for seeds 0 to 199. The synthetic traps are labels for this lab, not cards or a claim about any real trap.

The Wizard CPU select (easy, normal, hard; default normal) picks `cpuFor(level)` from `src/game/cpu.js`. Normal is the unchanged `chooseAction` the lab used before. You always play the Cowboy.

A Start with changed settings leaves the old controller (`controller.leave()` advances the scheduler epoch, so no queued CPU step, timer or playback survives), ignores any later callback from it, clears the log and starts a fresh controller. A refused seed keeps the current match. The status line names the active scenario, its real card count and the Wizard level.

## Controls

All choices come from the existing `legalActions`. The lab adds no rule.

- Hand buttons, lane buttons and Confirm, Skip move and Cancel drive the real selection path (`controller.input`). A trap is set this way: choose the trap, then Confirm, or Cancel.
- The developer command list shows every legal summon (with tribute and lane) and spell (with target and optional move) and sends the chosen entry to `controller.submit`. Labels use names from the existing card catalog.
- End phase calls `controller.endPhase()`.
- The Wizard CPU runs through the existing controller and scheduler (`requestAnimationFrame` drives `scheduler.tick`). Restart and Leave advance the scheduler epoch, so a queued CPU step from the old match is dropped.

Keyboard focus (issue #110): every control is disabled while a move plays. If you used the keyboard (Enter or Space) for an accepted action, the lab returns focus at the next `accepting_input` to the same control if it is still enabled, otherwise to the first playable hand card, otherwise to End phase. It does nothing after a mouse action or any pointer press, or when you moved focus to another enabled control during playback. It never presses a button for you.

Remaining caveats, from a Chrome automation run only: Cancel disables itself after clearing a selection, so focus stays on a disabled Cancel until you Tab (Tab and Shift+Tab still move from it). If the match ends, focus is not restored. Nobody has tested this with a screen reader or with human keyboard users.

```sh
node --test tests/experiments/trap-placeholder-keyboard.test.js
```

This drives installed Google Chrome over the DevTools protocol on a 127.0.0.1 server it starts itself. It skips when Chrome is not at the default macOS path.

## Data boundary

The DOM reads only `controller.view()`, `displayed()`, `options()`, `status()` and `message()`, and the event log stores `publicEvents(events, "cowboy")`. Full engine state stays inside the controller. The renderer is a no-op placeholder that returns fixed durations. It satisfies the Presenter interface and is not animation evidence.

## Tests

```sh
node --test tests/experiments/trap-placeholder.test.js
node --test tests/experiments/trap-placeholder-scenarios.test.js
```

The scenario test also runs a Chrome smoke of BASE, T1 and T2 (skipped when Chrome is not at the default macOS path). It sets the selects by script with a change event, not by keyboard.

Evidence: [docs/evidence/kiro-trap-placeholder-108.md](../../docs/evidence/kiro-trap-placeholder-108.md), [docs/evidence/kiro-trap-keyboard-110.md](../../docs/evidence/kiro-trap-keyboard-110.md) and [docs/evidence/kiro-trap-scenario-selector-116.md](../../docs/evidence/kiro-trap-scenario-selector-116.md).
