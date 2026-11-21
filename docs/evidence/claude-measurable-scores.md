# Measurable quality of the entry pages (November 20, 2026)

Claude (Claude Opus 5.5, in a Claude Code–based cloud session) at Alex's request: "lift the scores on anything quantifiable" for the Kiroween Devpost entry. Measured on `main` at `ea183ee` (after PR #179, the Wizard preview, and PR #180, earned decks) and on branch `claude/measurable-scores` rebased onto it. It changes no rule, card, number, wording in the game, art or save format. Every figure below comes from a run in this session; nothing is carried over from an earlier receipt.

## What was measured, and how

`scripts/browser-page-audit.mjs` (added here) serves the built pages gzip-compressed on loopback, as Pages serves them, and walks the graybox through eight screens (title, Camp, Camp with every disclosure open, Boot Hill, a picked card, the deck builder, the Wizard preview at `?wizard=1` and its first duel) at 1440×900 and at a 390×844 phone. It checks the axe-core and Lighthouse rules that apply to these pages (names, labels, ARIA, landmarks, headings, lists, contrast, links in text, scrollable regions, WCAG 2.5.8 target size), tabs through every screen for a visible focus indicator, and records text under 12 px, targets under 44 px, console errors, failed requests and Chrome's own issues. It is an independent approximation: axe-core and Lighthouse were not installed, and **no Lighthouse score is claimed**.

```sh
npm run build && node prototypes/showdown/build.mjs
npx -y -p playwright-core@1.64.1 node scripts/browser-page-audit.mjs dist/cowboys-vs-wizards-board-duel.html dist/showdown.html
```

Chrome 153 (Linux, headless). Both runs used the same script on the same machine.

## Before and after

| Measure | `main` `ea183ee` | This branch |
| --- | --- | --- |
| Accessibility violations, graybox, 16 screen and size combinations | 2 (no main landmark on the title screen, at both sizes) | **0** |
| Keyboard focus stops without a visible indicator (124 stops) | 0 | 0 |
| Graybox text under 12 px, worst screen | 11.5% (deck builder) | **0%** |
| Graybox touch targets under 44 px | 102 of 118 | **0 of 118** |
| Touch targets under WCAG 2.5.8's 24 px (after its spacing exception) | 0 | 0 |
| Lowest text contrast, graybox | 7.37:1 | 7.37:1 |
| Search description: graybox / Showdown page | none / none | 129 / 151 characters |
| Link-preview tags on the graybox (`og:title`, `og:description`, `og:image`, `og:url`, `og:type`, `twitter:card`) | 0 of 6 | **6 of 6** |
| Console errors, failed requests, Chrome issues | 0 | 0 |
| Graybox transfer (gzip) | 44,125 bytes | 44,680 bytes |
| First contentful paint, phone profile, CPU ×4, median of 3 | 204 ms | 204 ms |
| Slowest interaction (Play, Boot Hill, first card), same profile | 72 ms | 72 ms |
| Markdown links whose `#section` names a missing heading | 4 (one in the judge guide) | **0**, now checked by `scripts/check-links.mjs` |
| The README's five graybox browser checks that pass | 4 of 5 (Combat cues fails at the trap step) | **5 of 5** |

The timing profile does not throttle the network on loopback, so it shows main-thread work, not download time. The timings match; the change adds 555 bytes of markup and no script.

## The changes

- `src/ui/graybox.html`: the title screen is a `main` landmark like the other three screens (only one is ever shown); a search description, canonical address, theme colour and link-preview tags. The preview image is the approved title art, unaltered, from the repository (`assets/menu/title-screen.webp`, see `assets/menu/README.md`).
- `src/ui/graybox.css`, `src/ui/showdown.css`: buttons at least 44×44 px (they were 40 px tall; the deck builder's − and + were 36 px wide), disclosure rows 44 px tall (they were 22 px), the practice deal links 44 px tall, and the small labels (card type line, key hints, WANTED/CAPTURED) at 12 px instead of 11.7 px and 10.2 px.
- `prototypes/showdown/index.html`: a search description and theme colour.
- `scripts/check-links.mjs`: a `#fragment` on a link to a Markdown page, or on a same-page link, must name a heading as GitHub renders it, or an explicit anchor. The Kiro doc-save hook runs this checker, so it now catches renamed headings too. The four stale anchors (judge guide, project status, closeout queue, competitive benchmark) point at the renamed headings.
- `scripts/browser-showdown-cues-check.mjs`: the fatal Bear Trap line has read "defeated before it struck" since `a4472f3`; the check still expected "attack was cancelled" and failed on `main` at the trap step. It now expects each subcase's own wording.
- Tests: `tests/assets/page-head.test.mjs` (fails on `main`, passes here) and an anchor test in `tests/assets/links.test.mjs`.

## Checks run on this branch

- `npm test`: 651 tests, 646 passed. The 5 failures are the five test files that import `three`, which this sandbox could not install (no package registry access); they fail the same way on `main` here, and CI installs `three`.
- Browser checks on the final build, all passing: `browser-showdown-check` 22, `browser-showdown-modes-check` 18, `browser-showdown-keyboard-check` 7, `browser-showdown-trail-check` 16, `browser-showdown-cues-check` 5, `browser-showdown-turn-check` 29, `browser-showdown-camp-export-check` 7, `browser-showdown-deck-check` 6, `browser-showdown-outrider-check` 23, `browser-ledger-check` 12, `browser-showdown-wizard-check` (pass), and `browser-showdown-practice` for deals 0 and 60 with their join. Linux Chrome stood in for the macOS path the scripts name.
- `node scripts/check-links.mjs`: 326 Markdown files, 1,068 relative links, 63 section anchors, 0 broken (4 broken on `main`).

## Found while measuring, not changed here

**Balance band.** The Sheriff's Ledger target is 45–55% for both the first player and the Cowboys. Night Watch's own simulator (`apps/night-watch/backend/showdown_sim.mjs`, level-2 bots, both seats per deal) gives, on `main` `df05adb` (no engine file has changed since): first player 57.10% and Cowboys 59.40% on deals 0–999, 58.25% and 61.05% on deals 1000–1999. On a local test merge of PR #170 (`63f8d87`) into `df05adb`: 49.50% / 51.80% and 51.40% / 54.10%, matching the PR's table exactly. The decision is Fable's and Alex's.

**PR #170 against today’s `main`.** A test merge into `df05adb`, and again into `ea183ee`, conflicts only in `docs/kiro-build-log.md`, but `npm test` on it has 13 failures beyond the 5 environment ones (full suite on `df05adb`; the two failing suites reproduce on `ea183ee`): `tests/game/showdown-bear-trap.test.js` (2; for seed 18 the trap now catches `wizard-imp-2`, not `wizard-imp-1`) and `tests/match/showdown-outrider-gate.test.js` (11; both Outrider fixtures replay to different results under the new rules, which the gate is designed to treat as stale). Both suites reached `main` after PR #170's base `7fdc234`. The merge needs those fixtures and seeds refreshed, or the Outrider positions retired, first.

## Not covered

The earlier 3D build at `/3d/` was not built or measured (Three.js and Rapier could not be installed here). No physical phone, Safari, screen reader or human player was involved. The link previews were checked as tags, not rendered by each platform; some platforms may not show a WebP preview image.
