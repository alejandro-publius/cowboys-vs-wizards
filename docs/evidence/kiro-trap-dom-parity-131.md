# Trap lab engine-to-DOM parity in real Chrome (issue #131)

Date: 2026-11-17, 18:34–18:36 PST (America/Los_Angeles). Author and executor: Kiro, single bounded worker, running in the Kiro IDE client (session `sess_ac83278b`), not Kiro CLI. Requested model from the session context: `claude-opus-5.5`. The runtime emitted no usage-credit figure, so none is recorded. Base: main `dda6597dc8950d2d0498cf18f5925ad3bb3463f1`, branch `kiro/trap-dom-parity-131`. Scope: developer-only verification. No change to `src/`, cards, decks, the lab, art, models, animation, sound, packages, CI or deployment.

## What is compared

[`scripts/browser-trap-parity-131.mjs`](../../scripts/browser-trap-parity-131.mjs) opens the developer-only [trap placeholder lab](../../experiments/trap-placeholder/README.md) in headless Chrome. It uses scenario T1 (12 cards per side: 1 spell and 1 anonymous synthetic trap) with Wizard CPU normal, on seeds 0 and 60. At every stable point (`accepting_input` or `terminal`) it makes three comparisons:

1. **The page's own engine public view against its DOM.** A CDP `Debugger` breakpoint on the last line of `render()` (`app.js` line 185) pauses the page. One `Debugger.evaluateOnCallFrame` then reads `controller().view()`, `displayed()`, `options()`, `events()`, and the DOM that this `render()` call has just written, all in the same paused frame. The read is atomic and changes nothing on the page. The breakpoint is removed before resuming.
2. **Visible DOM fields against that view.** The status line (status, seed, round of 9, phase, result), and for both sides: base orbs and orb glyphs, deck, hand and discard counts, and each of the three lanes (name, health, maximum, orb glyphs, attack, or empty). It also checks both trap-zone lines, the Cowboy allowance line, the Cowboy hand (name, kind and `data-key` ID per position), and that every event-log line equals `eventLine(event)`.
3. **The page against an independent Node mirror.** A Node mirror runs the same lab engine (`createLabEngine("T1")`) on the shipped controller, scheduler and `cpuFor("normal")`, and receives the same recorded inputs. The page view must deep-equal the mirror view and `publicState(mirrorFullState, "cowboy")`. The page event data must equal the mirror's. `displayed()` must equal `view()`.

**Redaction:** whenever the mirror's full engine state holds a set Wizard trap, the page view must show exactly `{ faceDown: true, setRound }` and the DOM must read `Enemy trap: set (face-down)`. No hidden Wizard ID (hand, deck or set trap) may appear in the page HTML or the page view. The view must have no Wizard `hand`, and no Wizard `trap-set` event may carry `cardId`.

**Inputs:** real CDP mouse presses (`Input.dispatchMouseEvent`, after an `elementFromPoint` hit check) on the page's own buttons. A fixed policy picks them: first a zero-tribute summon from the developer command list (`controller.submit` of a `legalActions` entry), then the synthetic trap hand card and Confirm (`controller.input`, the selection path), then End phase. The Scenario select, CPU select and seed field are set by script with a change event, as the #116 smoke does. Start is a real click.

**Network:** the server listens on `127.0.0.1` only. A Chrome host-resolver rule maps every other host to NOTFOUND, and any non-loopback request fails the run. The script adds no dependency.

## Commands and environment

```sh
node --test tests/match/trap-dom-parity.test.js
npm test
npm run build -- --web
node scripts/browser-trap-parity-131.mjs --out .artifacts/kiro/trap-parity-131-a.json
node scripts/browser-trap-parity-131.mjs --out .artifacts/kiro/trap-parity-131-b.json
```

- Chrome/157.0.8103.79 headless, 1280×900, darwin 24.1.0 arm64, Node v26.0.0.
- Lab file SHA-256: `app.js` `c5eaae2e…b31d`, `lab.js` `272d5b6d…c995`, `scenarios.js` `10b3dc52…2b30`, `index.html` `21a5f897…9407` (full values in the receipt).
- Two consecutive runs: 44.9 s and 43.5 s. Both had `pass: true`, 0 mismatches, 0 console errors and 0 remote requests. Both produced the same digest over inputs and parsed DOM per stable point: `5ed6ca24e0762e843034647f5161eaa811972d27a0f5b3b84762d0b4d52bae5a`. The JSON receipts were written to `.artifacts/kiro/` (gitignored), read for this note, then deleted. They are not committed. Rerun the commands above to reproduce them.

## Results (observed, these two seeds only)

| Seed | First side | Real inputs (in order) | Stable points | Result (Cowboy view) | Trap coverage |
| --- | --- | --- | --- | --- | --- |
| 0 | Cowboy | summon Sheriff lane 1, End, summon Sheriff lane 2, End, End, End | 7 | loss, base-destroyed, round 4 | Wizard set its synthetic trap in round 1. It stayed hidden at 2 stable points and then sprang (1 Wizard `trap-trigger`) |
| 60 | Wizard | summon Sheriff lane 1, trap card `test-fixture-deck-trap-cowboy-2`, Confirm, End, summon Sheriff lane 2, End, End, End, summon Sheriff lane 1, End | 11 | loss, base-destroyed, round 5 | Cowboy set its trap by card and Confirm. It sprang once. The Wizard set no trap |

Across 18 stable points on both seeds, the page view equalled the Node mirror and `publicState` of the mirror's full state. Every compared DOM field equalled the page's displayed view, with one exception, described next. The redaction check found no leak.

## Finding (lab display, not fixed here)

At `terminal` the status line reads `Phase: Wizard` while the engine view has `activeSide: null`. `app.js` prints "Wizard" for any `activeSide` that is not the Cowboy. This happened once per seed. The script reports it as a known finding instead of a mismatch, and only for that exact case. The phase must match at every other point. `experiments/` is outside this task's owned paths, so the lab is unchanged.

## Limits

- The page's **full** engine state is not reachable through existing interfaces. The controller keeps it in a closure and the lab exposes only public reads. The hidden Wizard trap therefore comes from the Node mirror's full state. The mirror is tied to the page at every stable point by deep equality of the public view and the event data. Equality of hidden state inside the browser is inferred from determinism, not read directly.
- The page is read only at stable points, while each Cowboy turn waits for input. Intermediate presenter playback frames are not compared. The Debugger pause adds latency only, and the scheduler's outcome does not depend on time.
- The lab is served from source, not from `dist/web/`. The shipped game keeps traps off. `npm run build -- --web` was run only as a regression check of the build (`dist/web/index.html` SHA-256 `b9969dd7…6753`). The worktree had no `node_modules`, so for this one build a temporary symlink pointed to the main checkout's `node_modules` (three 0.180.0, rapier 0.12.0, esbuild 0.28.2, matching `package.json`). The symlink was removed afterwards. Nothing was installed and no network was used.
- This covers two seeds, one policy and the normal CPU only. It makes no claim about clarity, balance or appearance. No human has played these matches.

## Other checks run

- `node --test tests/match/trap-dom-parity.test.js`: 6 of 6 pass. It checks the mirror on seeds 0 and 60: two plays are identical, every input is accepted, and every stable point compares clean against a test-only DOM rendering. Each of the following mutations is caught: lane health, attack, glyph, name or emptied lane, base orbs, deck count, round, phase, hand, unparsable status line, and seven redaction leaks.
- `npm test` (`scripts/verify-duel.mjs`): 329 of 329 pass, 0 skipped, and the GLB structure preflight passes.

Not updated: `docs/kiro-build-log.md`, which the coordinator owns. Pending: a coordinator log entry.
