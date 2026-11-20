# Hosted /graybox/ without the lane duel on first load (graywave-hosted)

Kiro CLI 3.5.0 worker session (Claude Opus 5.5), branch `kiro/graywave-hosted`, first built on `a9aa828` and rebased onto `main` `ff84403`, 2026-11-19 (America/Los_Angeles). Chrome 158.0.8127.37 headless, Node v26.0.0, MacBookPro17,1.

## Change

- `scripts/build-graybox.mjs --hosted` writes only `dist/web/graybox/`: `index.html` and `chunks/lanes-<sha256-8>.js`. A small esbuild plugin marks `src/app.js`'s existing `import("./graybox.js")` as an external URL, and `src/graybox.js` is bundled on its own as that file. The Showdown modules stay inlined in the page exactly as in the offline file.
- `.github/workflows/pages.yml` runs `npm run build -- --hosted` instead of copying the offline file.
- Offline (`npm run build`) and `--web` paths are untouched. On `a9aa828` both produced SHA-256 `082f01ae…d3ed` (172945 bytes) before and after; on the rebased head both produce `fb388428…2b2e` (174206 bytes), the same as `main` `ff84403`. The offline file has 0 `import(` or `type="module"` occurrences.
- No change to `src/`, the template, CSS, rules or Scout.

## Requested bytes (Chrome DevTools `Network`, cache disabled, fresh profile)

Served by [serve-pages-path.mjs](serve-pages-path.mjs): `dist/web` mounted at `/cowboys-vs-wizards/`, explicit `text/html` / `text/javascript` content types, no compression, `/graybox` → 301 `/graybox/`. Raw is the file size; gzip is Node zlib level 9 of the same bytes (the server sent raw, so gzip is computed, not observed on the wire). Full table: [requests.txt](requests.txt).

| Page | Build | Requests | Raw bytes | gzip-9 bytes |
| --- | --- | --- | --- | --- |
| Showdown (`/graybox/`, `?seed=0`) | main `ff84403` single file | 1 | 174206 | 58833 |
| Showdown | rebased `--hosted` | 1 | 55327 | 18496 |
| `?mode=lanes`, `?mode=match` | main `ff84403` single file | 1 | 174206 | 58833 |
| `?mode=lanes`, `?mode=match` | rebased `--hosted` | 2 | 173539 (55327 + 118212) | 58852 (18496 + 40356) |
| Showdown | a9aa828 single file | 1 | 172945 | 58341 |
| Showdown | a9aa828 `--hosted` | 1 | 54090 | 17993 |
| `?mode=lanes`, `?mode=match` | a9aa828 single file | 1 | 172945 | 58341 |
| `?mode=lanes`, `?mode=match` | a9aa828 `--hosted` | 2 | 172302 (54090 + 118212) | 58349 (17993 + 40356) |
| Showdown, PR #148 head `998645a` | its single file | 1 | 191904 | 64933 |
| Showdown, PR #148 head + this script | `--hosted` | 1 | 84766 | 28094 |

On current `main`, Showdown's first load drops by 118879 raw bytes (−68.2%) and 40337 gzip bytes. The lane routes cost about the same as before (−667 raw, +19 gzip) because about 6.7 kB of shared code is now in both files. No latency claim is made.

## Browser checks

- **Showdown over HTTP** — the stock `scripts/browser-showdown-check.mjs` with [a 24-line instrumentation diff](probe-check.diff) (accept an http URL, enable `Network` with cache disabled, then assert no `lanes-*.js` request before `?mode=lanes` and a 200 for it after). 14 of 14 passed on the rebased head (and on `a9aa828`): Play opens Boot Hill, Boot Hill (`?seed=0`) won by clicks alone, seat privacy, the lane chunk was never requested in the `(none)` and `?seed=0` phases, `?mode=lanes` fetched it and opened the lane duel, `?mode=match` auto-started, 0 page errors. [Receipt](showdown-http.json).
- **Other lane links over HTTP** — `ride-out`, `practice-dynamiter`, `practice-tribute`, `fire-arc` each fetched the lane file and opened the arena with 0 errors; `?mode=lanes&seed=60` fetched it; `?mode=demo` (not a lane mode in `src/app.js`) stayed on the Showdown title as before. [Receipt](lane-modes-http.json).
- **Boot timing under 300 ms emulated latency** (state only, run on `a9aa828`): at `readyState === "complete"` the hosted page already shows the Showdown title (`Play`, `Lane duel (previous rules)`), the same as the a9aa828 file. [Hosted](boot-300ms-hosted.json) · [Baseline](boot-300ms-baseline.json).
- **PR #148 compatibility** (run on `a9aa828`'s script, unchanged since) — temporary detached worktree at `998645a`, this script copied in, #148's own Showdown check instrumented the same way: 25 of 25 passed over HTTP, including Camp, saves and reloads, with no lane request during Showdown. [Receipt](showdown-http-pr148.json). Its offline build still had 0 `import(`.
- **Offline file://** — stock `browser-showdown-check.mjs` on the unchanged offline file: 12 of 12 on both heads.
- `npm test`: 551 of 551 on the rebased head (530 of 530 on `a9aa828`), 0 fail, plus both GLB structure checks.
- Standalone art build (`npm run build:art`, not touched by this change): `browser-match-check.mjs --seed 0` observed 7 of 8 steps, step 2 pending (catalog art `Covered Wagon` not decoded), 0 console errors. The same command on the graybox file timed out waiting for the 3D page, which is expected because that script targets the art build.
- Pages build order locally: `build:art -- --web`, then `--hosted`, then the Showdown prototype, then `build:art -- --web` again. `dist/web/index.html` kept its art hash and `dist/web/graybox/` and `dist/web/showdown/` survived.

## Rejected first attempt

esbuild `splitting: true` with ES module chunks produced 6 files (11 on PR #148) and an import waterfall. Over HTTP the title showed the lane menu with an inert Play until the chunks arrived, and #148's check failed on that. Adding `modulepreload` links made the checks pass, but under 300 ms latency the lane menu was still visible at load for about one extra round trip (Showdown ready at about 630 ms vs. 320 ms). Externalizing only the lane closure removed both problems with fewer files.

## Remaining

- Not measured: on lane routes the title can be painted before the lane file arrives, so its Play may do nothing for about one round trip. The lane checks pass because they wait for the arena.
- Not checked on the live Pages site. Not checked in Safari/WebKit.
