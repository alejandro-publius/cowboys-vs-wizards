# Showdown refusal guidance and Chrome route checks

Antigravity authored the initial PR at `c531728` against `93db9f3`. Codex reviewed the guidance against the rules, corrected the route checks, and ran them on 2026-11-27 UTC with main at `f4ad5a7`. The staged illustrated index had SHA-256 `563043069e920feda4b0f218f5f5765302fdb7724f190d8e8c6055ec4b98ae43`.

## Refusals and play

Missing tribute now names a free troop in the player’s hand when one can be played. A spell without a legal enemy target can be held for a later turn. The unchanged “One troop a turn.” message appears after a summon.

| Check | Observed result |
| --- | --- |
| `node --test tests/match/haunted-mischief.test.js` | All 4 tests passed, including an enemy Ghostly troop that Deadeye cannot target and changes to hidden opposing cards from both seats. |
| `browser-showdown-check.mjs` on the staged graybox | All 22 checks passed, including two campaign wins, card rewards, three reloads, disabled-card behavior and seat privacy. |
| `browser-showdown-keyboard-check.mjs` on the staged graybox | All 7 checks passed. Tab, Shift+Tab, Enter and Escape completed Boot Hill and returned focus to the Camp offer. Mouse summons, picks and cancellations preserved scroll and focus. |

A longer tribute hint moved the page 39 pixels when the player clicked Sheriff in the opening hand. The shorter “Need 1 troop. Play Sheriff.” hint kept the scroll position at 208 pixels before and after that click in the same test.

## Route checks

The audit served the staged Pages build over loopback in Chrome 158 at 1440 × 900 with reduced motion enabled. It inspected control names in Chrome’s accessibility tree, active landmarks, expected polite live regions, visible label and description references, document metadata and IDs, browser exceptions, console errors and HTTP errors. The table records the opening state. The Even Fight hand varies with its deal.

| Route | Exposed controls | Polite regions | Findings |
| --- | ---: | ---: | ---: |
| `/` | 4 | 0 | 0 |
| `/?saloon=review` | 15 | 2 | 0 |
| `/?outrider=case-e` | 16 | 2 | 0 |
| `/?room=replay` | 6 | 0 | 0 |
| `/?even-fight=1` | 18 | 3 | 0 |
| `/graybox/` | 1 | 0 | 0 |
| `/showdown/` | 19 | 1 | 0 |
| `/poker/` | 9 | 1 | 0 |

Seven landings exposed one main landmark. The Saloon exposed its named modal dialog. Pressing Enter on a shot in the Saloon or a branch in the Replay Room produced fresh text in an exposed polite live region. Speech output, visual contrast and WCAG conformance require separate evaluation.

In a disposable copy, the graybox Play button had its name removed, a duplicate ID was added, and its description pointed to a missing element. The audit reported all three findings on that route and exited 1. The other seven routes still ran.

```sh
node scripts/stage-pages.mjs
node scripts/browser-accessibility-audit.mjs
node scripts/browser-showdown-check.mjs dist/web/graybox/index.html
node scripts/browser-showdown-keyboard-check.mjs dist/web/graybox/index.html
```
