# Showdown first input timing (K-089, K-090)

Kiro CLI (native, macOS), November 20, 2026, Pacific. QA instrumentation only. `src/` is unchanged.
Harness: [`scripts/browser-showdown-first-input.mjs`](../../scripts/browser-showdown-first-input.mjs).
Arithmetic test: [`tests/showdown-first-input.test.js`](../../tests/showdown-first-input.test.js).

## Question

How long does the ordinary graybox take to accept a player's input and show the result? The routes are
menu → Camp → first legal action in Boot Hill (K-089) and Camp → the Outrider's ride-or-fight decision
(K-090). The page has no art yet, so this measures presentation responsiveness only. Earlier seed 0 lane
timing and Camp-ready timing measured neither of these.

## Endpoints (frozen before the first timed run)

Every input is a real CDP mouse press and release at the centre of the control. Before each input the
harness checks that the control is visible, enabled and the topmost element at that point, and it
refuses to click otherwise. The harness never calls page functions and never plays a move by itself.
Each endpoint is a predicate that an injected, observe-only probe tests on every DOM mutation and every
animation frame. The probe arms each predicate before its input and fails the run if the predicate
already holds.

| Step | Input | Endpoint (first time it holds) |
| --- | --- | --- |
| Nav → menu | `Page.navigate` | `#title-screen` shown, `#menu-play` enabled and hit-testable (time since navigation start) |
| Play → Camp | click `#menu-play` | Camp shown, title hidden, the route's Camp control enabled and laid out |
| Camp → duel, Boot Hill | click the Boot Hill tile | `#showdown` shown, Camp hidden, status `Boot Hill · turn 1 · your turn`, an enabled hit-testable hand card |
| Camp → duel, Outrider | click `Try an Outrider turn` | `#showdown` shown, status names the Outrider experiment and `your turn`, the Outrider troop slot (`cowboy-0`) enabled and hit-testable |
| First action, Boot Hill | click the first enabled hand card (`cowboy-sheriff-3` on `?seed=0`) | the card has left the hand, the log grew by one line, one more Cowboy troop is on the board, and the feedback reads `Last: … arrived.` |
| First action, Outrider | click the Outrider troop | the Wizard Base and a Wizard troop are both offered as enabled targets, so the decision is playable |

Latency is the endpoint's `performance.now()` minus the `event.timeStamp` of the `pointerdown` the page
received. That excludes CDP and polling delays. "Frame" is the start of the next `requestAnimationFrame`
after the endpoint. Headless Chrome has no display, so this is not a paint or photon time. A Camp control
below the fold is scrolled into view before its click. The scroll is not timed.

## Controls

- **Build:** one hosted build, `node scripts/build-graybox.mjs --hosted` → `dist/web/index.html`. That is
  118,581 bytes, a single file, sha256 `a64c3734867eaef7101f0416c77983bc3a24257af72918c0193d6a0f2956f781`,
  page build label `dc0bf91e28e1`, built at `dc0bf91` with the Outrider gate reading "10 of 10 fresh; linked
  case-a, case-e". It is served by the harness on loopback HTTP with `cache-control: max-age=600` (the value
  GitHub Pages sends). Every non-loopback request fails the run, as does any page error.
- **Routes (pinned):** Boot Hill `/?seed=0` (fixes the deal); Outrider `/`. Both go through the normal
  menu → Play → Camp path.
- **Browser:** Chrome/158.0.8127.37, `--headless=new`, 1440×900 at DPR 1, background throttling disabled.
- **Cold:** a new Chrome process with a new empty temporary profile, first navigation. The HTTP cache is
  empty, there is no V8 code cache and storage is empty. It is not a cold OS: the Chrome binary and the
  HTML file are already in the OS file cache after the first sample.
- **Warm:** the second navigation in the same process, right after that route's cold pass, with
  localStorage and sessionStorage cleared. The HTTP and code caches are kept. The document came from the
  HTTP cache in 20 of 20 warm runs and in 0 of 20 cold runs, so the server saw 40 requests per run.
- **Samples:** 20 Chrome processes per route, each giving one cold and one warm pass, with the route order
  alternating per sample.
- **p95** is nearest-rank: the values sorted ascending, taking index ⌈0.95·n⌉−1. With n = 20 that is the
  19th of 20 values, so it is close to the maximum and rests on one sample.

## Negative controls (disposable, `--controls`)

The controls are scripts injected into the browser at run time. Nothing is changed on disk. All three
were caught (exit 0):

| Control | What it does | Result |
| --- | --- | --- |
| delay | 300 ms busy wait in a capture `pointerdown` listener on hand cards | first action measured 302.8 and 303.3 ms (cold, warm) |
| swallow | `stopImmediatePropagation` on hand-card clicks, so the action never applies | the run fails: endpoint "action" not met within 3000 ms |
| cover | a transparent full-page sheet over the Camp | the run fails: refused to click the Boot Hill tile, covered by `DIV#fi-cover` |

The first version of the cover control threw a page error because it ran before
`document.documentElement` existed. The run failed on that page error, not on the cover. The control now
waits for `DOMContentLoaded`, and the result above comes from the fixed version.

## Results: run 2 (lower load), 2:00 PM PST

The load average was 5.19 before the run and 7.80 after (8 cores, Apple M1). 71 other Chrome processes
were running. All values are ms; each cell is median / p95 (min–max), n = 20.

| Route | Cache | Nav → menu | Play → Camp | Camp → duel | First action | First action → next frame |
| --- | --- | --- | --- | --- | --- | --- |
| Boot Hill | cold | 37.7 / 48.1 (30.8–50.5) | 14.0 / 18.4 (10.5–21.0) | 13.7 / 15.2 (6.7–16.0) | 6.7 / 10.3 (5.0–11.6) | 12.3 / 15.8 (7.9–16.6) |
| Boot Hill | warm | 39.3 / 42.7 (26.2–44.0) | 10.3 / 12.2 (6.7–12.4) | 15.7 / 16.8 (7.6–19.7) | 6.4 / 7.7 (4.2–8.7) | 12.8 / 15.4 (8.9–16.2) |
| Outrider | cold | 34.8 / 49.4 (30.7–53.1) | 14.6 / 20.9 (9.0–22.3) | 24.4 / 27.2 (11.9–27.4) | 5.9 / 8.1 (3.9–12.1) | 11.3 / 15.8 (7.5–15.9) |
| Outrider | warm | 39.7 / 46.0 (30.4–46.5) | 10.2 / 12.5 (6.9–14.3) | 27.1 / 30.6 (14.8–31.9) | 6.2 / 7.8 (2.9–10.1) | 11.8 / 15.4 (8.6–16.7) |

First-action distributions (input latency, sorted):

- Boot Hill cold: 5 5.1 5.6 5.9 5.9 6.2 6.3 6.5 6.5 6.6 6.8 6.8 6.9 7.1 7.1 7.3 8.4 8.5 10.3 11.6
- Boot Hill warm: 4.2 4.7 5.5 5.7 5.9 5.9 5.9 5.9 6.1 6.2 6.6 6.7 6.7 6.8 6.9 7 7.4 7.6 7.7 8.7
- Outrider cold: 3.9 3.9 4.2 4.7 5.2 5.3 5.3 5.4 5.5 5.6 6.1 6.5 6.6 6.8 6.8 6.8 6.8 7.3 8.1 12.1
- Outrider warm: 2.9 3.5 5 5.1 5.1 5.4 5.8 5.8 6.1 6.1 6.3 6.3 6.9 7.1 7.2 7.2 7.3 7.6 7.8 10.1

## Run 1 (under heavy load), 1:52 PM PST

This run used the same build, browser and command while other workers were active. The load average was
35.1 before and 77.9 after, with 71 Chrome processes running. Each cell is median / p95:

| Route | Cache | Nav → menu | Play → Camp | Camp → duel | First action |
| --- | --- | --- | --- | --- | --- |
| Boot Hill | cold | 34.3 / 45.7 | 15.1 / 18.1 | 13.9 / 14.8 | 5.6 / 7.8 |
| Boot Hill | warm | 39.2 / 44.9 | 10.1 / 11.2 | 13.5 / 18.7 | 5.7 / 7.7 |
| Outrider | cold | 37.0 / 43.1 | 14.7 / 18.5 | 24.8 / 26.4 | 5.6 / 9.0 |
| Outrider | warm | 39.8 / 49.4 | 9.3 / 11.3 | 24.9 / 27.4 | 5.2 / 6.8 |

## Reading (estimates under these conditions)

- On this machine, under these conditions, each timed step reached its endpoint within about 31 ms of the
  input, and every first action within 12.1 ms. Run 1 and run 2 differ by a few ms per cell, even though
  the load average differed by about 7 to 10 times. That is consistent with the work being small and
  single-threaded, but two runs do not establish it.
- Warm did not make Nav → menu faster. The page is one 118 KB inline file on loopback, so there is
  little to fetch or compile from cache. Play → Camp was about 4 ms faster warm in both runs.
- Camp → Outrider landing (median 24 to 27 ms) took longer than Camp → Boot Hill (14 to 16 ms). The
  Outrider turn replays its history before it opens, and that may explain the gap. This was not profiled.
- These numbers are not a gate. They are not comparable across machines, Chrome versions or builds unless
  the same command is run on both sides at the same time. They are no evidence that any release is faster
  or slower. No human playtest was run. Clarity and feel are not judged here.

## Reproduce

```sh
git checkout <commit containing this file>
npm ci
node scripts/build-graybox.mjs --hosted
node --test tests/showdown-first-input.test.js
node scripts/browser-showdown-first-input.mjs --controls          # must print "pass": true
node scripts/browser-showdown-first-input.mjs --samples 20 --out /tmp/first-input.json
```

You need Google Chrome at `/Applications/Google Chrome.app`. A sample takes about 4.5 s. The JSON
receipt records each run's endpoints, load average before and after, Chrome process count, the Chrome
version and the page sha256. Raw receipts and Chrome profiles stay outside Git: profiles are temporary
and deleted after each sample. No screenshots are taken.
