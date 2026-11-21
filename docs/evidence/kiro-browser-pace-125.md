# Browser pace measurement: default vs `?pace=fast` (issue #125)

Date: 2026-11-17, 15:26–15:29 PST (America/Los_Angeles). Author and executor: Kiro CLI 3.4.0, single bounded worker, session model `claude-opus-5.5` (from session context). No usage-credit figure was emitted by the runtime, so none is recorded. Base: main `d0a9450bdd64af60a0c1203195f7bf4a640eff9e`, branch `kiro/browser-pace-125`. Scope: measurement only. No change to `src/`, cards, decks, traps, art, 3D, animation, sound, settings, package or CI files.

## Method

[`scripts/browser-pace-measure.mjs`](https://github.com/alejandro-publius/cowboys-vs-wizards/blob/ea183ee29dbdcde00105cc4db3ba8bc39eb8f4df/scripts/browser-pace-measure.mjs) serves `dist/web/` from a `127.0.0.1`-only Node HTTP server and drives installed headless Chrome over the DevTools protocol. It uses no dependency and makes no remote request. Each run gets a fresh temporary profile, which is deleted afterwards. A host resolver rule maps every host except 127.0.0.1 to NOTFOUND, and any non-loopback request fails the receipt. The game is operated only through real CDP input: `Input.dispatchMouseEvent` press and release on the element's centre (after an `elementFromPoint` hit check), and `Input.dispatchKeyEvent` for Escape.

Instrumentation needs no `src/` change. A read-only probe added with `Page.addScriptToEvaluateOnNewDocument` records:

- each `pointerdown`, `click` and `keydown` event's `event.timeStamp`, in a capture-phase window listener;
- every change to the overlay (`#match` `data-status`, the selected hand card, slot health labels, Base orbs, hand counts, result), seen by a `MutationObserver`, stamped with `performance.now()` and with the time of the next `requestAnimationFrame` callback.

All intervals use the page's own clock, so CDP transport and Node polling are excluded. "Next frame" is the start of the next animation frame after the DOM change. Headless Chrome has no display, so this is not a photon or paint time.

Route per run: `?mode=match&deck=starter&seed=N`, plus `&pace=fast` in fast mode only. On each Cowboy turn the script clicks the first playable hand card, presses Escape, then clicks End phase. Selection and cancel leave the engine state untouched, so the match plays out from the CPU and End phase alone. In both seeds this route reached "Match over" during round 3, so three turns cover the whole match. Mode order alternates per sample (sample 0: default first; sample 1: fast first; sample 2: default first).

## Command and environment

```sh
npm run build -- --web
node scripts/browser-pace-measure.mjs --seeds 0,60 --samples 3 --turns 3 --out /tmp/pace125-full.json
```

- Chrome/157.0.8103.79 headless, GPU `ANGLE (Apple, ANGLE Metal Renderer: Apple M1)`, 1440×900, darwin arm64 24.1.0, Node v26.0.0.
- `dist/web/index.html` SHA-256 `b9969dd742e44e1a4ab9ae1a23b62c955a09bcd9c64c9861b8e81e79edae6753`. The same hash came out of the post-check rebuild.
- 12 runs (2 seeds × 2 modes × 3 samples), 3 min 05 s total. Receipt `pass: true`, 0 remote requests, 0 console errors. Page load to first accepting input: median 1116 ms (461–2744). The JSON receipt stayed in `/tmp` and is not committed.

## Results (measured, real Chrome input, n = 3 per cell)

Values are in ms: median (min–max).

Input acknowledgement (all turns, both seeds, both modes):

| Input | Ack | Range of the 12 per-turn medians |
| --- | --- | --- |
| Card click | `aria-pressed=true` in DOM | 3.3–6.6 |
| Card click | next frame | 12.7–14.5 |
| Escape key | selection cleared in DOM | 2.1–3.6 |
| Escape key | next frame | 9.1–15.4 |
| End phase click | status leaves `accepting_input`, next frame | 11.8–14.7 |

Default and fast fall in the same range on every input-ack row. The pace setting changes no input path, and none was expected.

End phase to the next Cowboy input (or the match result):

| Seed | Turn | Wizard turn seen | default | fast |
| --- | --- | --- | --- | --- |
| 0 | 1 → round 2 | yes | 7449.3 (7432.9–7451.0) | 4968.7 (4948.6–4980.9) |
| 0 | 2 → round 3 | no | 2786.1 (2784.1–2801.8) | 2267.3 (2267.0–2269.9) |
| 0 | 3 → match over | yes | 3867.4 (3850.8–3867.6) | 2800.2 (2783.6–2816.5) |
| 60 | 1 → round 2 | no | 2768.0 (2767.2–2800.6) | 2268.4 (2266.4–2284.0) |
| 60 | 2 → round 3 | yes | 7467.7 (7417.6–7483.8) | 4950.4 (4948.5–4953.6) |
| 60 | 3 → match over | no | 1531.8 (1517.7–1534.1) | 1450.3 (1434.0–1451.6) |

End phase click to the first `cpu_turn` status, on turns where one appeared: default 499.4–515.8, fast 231.3–234.5 (per-turn medians).

Under these conditions (one machine, three samples, passive Cowboy route), fast mode reached the next input sooner on every turn. The gap was about 2.5 s on turns with a Wizard turn, about 0.5 s on round changes without one, and about 0.08 s at match end on seed 60. The min–max ranges do not overlap in any cell. These numbers describe wall-clock pacing. They are not a measured improvement in input responsiveness, and no human judged whether fast feels better.

## Impact order (observed overlay states)

For every seed and turn, the ordered list of distinct overlay board states between the End phase click and the next input was **identical** across all six runs (3 default, 3 fast), and the end state matched. Seed 0 showed 5, 3 and 4 states per turn, and seed 60 showed 3, 5 and 3. The overlay reflects the Presenter's displayed state, so this is DOM-level evidence that slot health, Base orb and hand-count changes occurred in the same order. It does not cover 3D cue timing, which the probe cannot observe. A MutationObserver merges renders made within one task, so the comparison is coarser than the per-event list.

Renderer-level order comes from the existing Node replay instead (`node --test tests/match/pace.test.js`, 5/5 pass, run today): seeds 0 and 60 CPU-vs-CPU produce an identical renderer call sequence at default and fast pace on a fixed-cue fake clock. That is a **LOGICAL** check, not a Chrome measurement.

## Source facts (not measured)

- `src/match/pace.js` overrides only `cpuDelay` and the `round-start`, `phase-start` and `phase-end` pauses. Clash, result, draw, damage and defeat pauses and all renderer cue lengths are untouched, as asserted by `tests/match/pace.test.js`. No animation impact timing changed in this issue, because no file under `src/` changed.
- `FAST_PACE.drawHidden` (120) and `drawVisible` (300) are defined but never applied: they are not referenced in `presenter.js`, `controller.js` or `main.js`. These results therefore contain no hidden or visible draw split.

## Checks run

- `node --test tests/match/pace-browser.test.js`: 7/7 pass. It covers argument parsing, mode/query selection, mode alternation, the summary maths, order comparison and receipt shape. It launches no browser and asserts no timing threshold.
- `npm test`: 320/320 pass (313 baseline plus the 7 above), with 2/2 GLB structural checks.
- `npm run build -- --web`: built `dist/web/index.html`.
- `node scripts/check-links.mjs`: 184 Markdown files, 682 relative links and images, 0 broken.
- `git diff --check`: no whitespace errors.

## Limitations

- One Apple M1 machine, headless Chrome with the Metal GPU, n = 3. There is no phone, Safari, Firefox, throttled CPU or display pipeline.
- The route is passive: the Cowboy never summons or attacks, so clash-heavy turns under player play are not sampled.
- The probe's MutationObserver and frame callbacks add a small cost to both modes equally.
- No screen reader, human playtest, or claim of clarity or fun.

## Follow-up recommendation

Consider applying the hidden/visible draw split (`drawHidden` 120, `drawVisible` 300) in a **separate** reviewed PR. It needs a presenter change that keeps the visible Cowboy card flight intact. Re-run this script before and after that change. Default pacing should not change on the strength of this measurement alone.
