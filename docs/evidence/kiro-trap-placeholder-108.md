# Trap placeholder lab (issue #108)

Date: 2026-11-17 (America/Los_Angeles). Worker: Kiro (single worker). The coordinator launched this session with model `claude-opus-5.5`. The session emitted no client-version or credit metadata, so no credit figure is recorded here. Base: main `dedfbe9` (after #107). Branch: `kiro/trap-placeholder-108`. One local commit. Not pushed.

## Problem

The A + X trap prototype (flag `traps`, frozen, off in the shipped game) was reachable only from Node tests. Issue #108 asks for a local-only, headless-first placeholder lab to play it in a browser before any art, model, animation, audio or trap card identity work is approved.

## Change

New files only:

- `experiments/trap-placeholder/lab.js`: the pure half. It defines two anonymous fixture traps (`lab-fixture-trap-c`, `lab-fixture-trap-w`, name "Placeholder trap (test fixture)"), and `LAB_CARDS` holds `CARDS` unchanged plus those two. It has an engine wrapper (`createMatch(seed, { traps: true })` plus one fixture per opening hand; `applyAction`, `legalActions` and `publicState` with the catalog; it records `publicEvents(events, "cowboy")` for the log). It also has a no-op placeholder renderer covering the full Presenter interface, `createLab` (the shipped `createController` with CPU `chooseAction(view, { cards })`), the developer `commandList` (legal summon and spell entries from `legalActions`, with labels from catalog names) and log/trap-zone text. This helper is needed so Node can test the lab without a DOM.
- `experiments/trap-placeholder/index.html`, `app.js`, `style.css`: the native-button page. It shows three lanes per side, troop health, base orbs, round and phase, hand, deck and discard counts, trap zones, status (`aria-live="polite"`), the event log (`role="log"`, can be hidden), a seed field, and Start, Restart, Leave and End phase buttons. Hand, lane, Confirm, Skip and Cancel go through `controller.input`. The command list goes through `controller.submit`. It has no URL flag, no remote URL and no link from the game.
- `experiments/trap-placeholder/README.md`: loopback instructions (`python3 -m http.server`) and the experimental/synthetic warning.
- `tests/experiments/trap-placeholder.test.js`: 7 tests.

No change to `src/`, `apps/`, `assets/`, existing tests or docs, `package.json`, CI or build scripts, the entry point, cards or decks. No new mechanic and no dependency.

## Tests

| Test | Covers |
|---|---|
| seeds 0 and 60 play to a result via input (trap), command list and endPhase; two runs give identical event logs and onChange snapshots | deterministic replay, legal dispatch |
| redaction across every snapshot: no Wizard hand, deck, seed or rng; the Wizard `trap-set` has no `cardId`; the Wizard fixture ID appears in no log entry before its `trap-trigger` and in no view while still set; the face-down marker is shown | event and view redaction |
| cancel applies nothing; restart during `cpu_turn` replays the same as a fresh controller; leave drops the queued CPU step and leaves 0 pending timers | restart, cancel, stale callbacks |
| the command list equals the legal summon and spell entries; labels use catalog names; a spell entry dispatches and the list is empty while playing | legalActions-only choices |
| the placeholder renderer has every Presenter method with finite times | presenter contract |
| `CARDS` has no trap; fixtures are absent from `CARDS`/`DECKS`; decks stay at 12; `createMatch(0/60)` and the default controller have no `traps` key | no production change, flag-off default |
| the page has no `http(s)://`, no URL parsing, no `innerHTML`; `src/main.js` and root `index.html` do not mention the lab | local-only page |

Fixture-match receipt (rules `orb-duel-draft-1+traps`, Cowboy plays the CPU rule through the lab paths, Wizard plays the CPU rule, one fixture trap per side). Synthetic, not balance:

| Seed | Winner | Reason | Round | Public events |
|---|---|---|---|---|
| 0 | wizard | base-destroyed | 5 | 72 |
| 60 | wizard | base-destroyed | 7 | 106 |

## Commands and results

- `node --test tests/experiments/trap-placeholder.test.js`: 7 tests, 7 pass.
- `npm test` (`scripts/verify-duel.mjs`; the new test is not in its directories): 306 tests, 306 pass; asset structure check 2/2.
- `node scripts/check-links.mjs`: 171 Markdown files, 613 relative links, 0 broken (after the commit, so the new README and note are included).
- `git diff --check`: clean.

## Browser smoke (actually run)

Installed Google Chrome (headless `--headless=new`, temporary profile), driven over the DevTools protocol by a temporary script kept outside the repo and then deleted. Served with `python3 -m http.server 8108 --bind 127.0.0.1`. The script clicked DOM buttons with `.click()`, playing a naive bot: on the first trap opportunity it chose the trap and then Cancel, next time it chose the trap and then Confirm, it ran the first command once per round, and otherwise it pressed End phase. Then Restart, then Leave.

| Seed | Trap cancel / set | Commands | End phase | Final status | Log lines | Trap springs logged | After Restart | After Leave | Page errors |
|---|---|---|---|---|---|---|---|---|---|
| 0 | 1 / 1 | 2 | 3 | terminal, loss (base-destroyed), round 3 | 35 | 2 (Cowboy, Wizard) | accepting_input, round 1, log 0 | idle, log 0 | none |
| 60 | 1 / 1 | 3 | 4 | terminal, loss (base-destroyed), round 4 | 51 | 2 (Cowboy, Wizard) | cpu_turn, round 1, log 0 | idle, log 0 | none |

The only non-200 HTTP response was `/favicon.ico` 404. These outcomes come from the naive click bot and differ from the Node receipt, which plays the CPU rule.

## Limits

- No screenshot, keyboard-only, screen-reader or human playtest was run. Native buttons are keyboard-operable by default, but nobody verified that here. Focus can drop while buttons are disabled during playback.
- Fixture traps are synthetic. Trap card name, art, copy count, deck migration, UI copy and balance stay blocked on the user (contract section 10). Human and art gates stay blocked.
