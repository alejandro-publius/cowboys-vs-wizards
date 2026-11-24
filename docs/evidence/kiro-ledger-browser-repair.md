# Ledger browser check repair (Kiro CLI, native worker lane 09-ledger-browser)

Agent: Kiro CLI (scoped native worker). Date: 2026-11-21 (America/Los_Angeles).
Scope: `scripts/browser-ledger-check.mjs`, this note. Not staged or committed; the Kiro integration worker owns that.

## Reported failure

Independent release review at `e1e2d325958b`: at 390x844, on the first ledger open,
`scripts/browser-ledger-check.mjs` line 133 (`assert.equal(opened.rows, 29)`) saw 32 rows. Zero page errors.

## Cause (source inspection; not yet reproduced by a run here)

The selector counted ledger furniture, not extra cards.

- The old query was `#camp-ledger tbody tr`, which counts every table body row inside the ledger.
- `src/ui/sheriffs-ledger.js` `ledgerHtml` now places the Billy replay (`billyReplayHtml`, `src/ui/billy-replay.js`)
  before the card table. That replay renders a second `.sd-ledger-table.sd-billy-seat-table`
  ("Cowboy win rate by who opens") with one row per `SEAT_ROWS` entry: All starts, Cowboys open, Wizards open.
  That table adds 3 rows, and 29 + 3 = 32.
- The product data agrees on 29 cards: `SHOWDOWN_SPECS` in `src/game/card-specs.generated.js` has 29 entries,
  `LEDGER.catalog.count` is 29, and `LEDGER.cards` in `src/ui/sheriffs-ledger.data.js` has 29 entries (lines 11–39).
  The card table renders one row per `LEDGER.cards` entry (`ledgerRows`). No product change is needed.
- The old `l.querySelector('.sd-ledger-wrap')` also picked the Billy seat table's wrapper first, so `wrapScroll`
  reported the wrong table. It was reported only, not asserted.

## Change

In `scripts/browser-ledger-check.mjs`, the "Enter opens the ledger" step now:

- scopes rows and `wrapScroll` to the card table region, `.sd-ledger-wrap[aria-labelledby=ledger-cards]`;
- asserts the row count, the visible row count (`getClientRects`) and the Not observed count equal `LEDGER.catalog.count`;
- asserts `LEDGER.cards.length === LEDGER.catalog.count`, the row names follow `LEDGER.cards` in order, and the
  summary shows `<count> cards`;
- records `allTableRows` (every `tbody tr` in the ledger) in the report for comparison.

These assertions are unchanged: viewport and element overflow, the ruleset run line, the review lines, the
keyboard walk, the region focus, the close, and the absence of the ledger on Boot Hill's first turn.

## Verification (first session; superseded below)

Pending at the time. That session could not run shell commands. Every `execute_bash` call returned
"The permission request failed before it was answered", including `pwd`. These were not run:

```
npm run build
node scripts/browser-ledger-check.mjs dist/cowboys-vs-wizards-board-duel.html .artifacts/sheriffs-ledger
```

There is no observed outcome for either viewport (390x844, 1440x900), and the fix has not been shown to pass.

## Job 16 rerun (observed failure)

Report `.artifacts/kiro/ledger-rerun/browser-ledger.json`: at 390x844 the row fix held (29 rows, 29 visible,
29 Not observed, `allTableRows` 32, zero page errors). The run then failed at the single-Tab check:
`null !== 'region'`. The one Tab from the opened summary landed on a Billy replay control, which comes first in DOM
order. 1440x900 was not reached.

## Focus repair (Kiro CLI, 2026-11-22, America/Los_Angeles)

Real focusable controls between the summary and the card table (source inspection, then confirmed by the run):
`src/ui/billy-replay.js` line 82, two `data-billy-line` buttons; lines 86–90, three step buttons inside a `hidden`
group (not focusable until a line is chosen); line 94, the "How to verify this replay" `<details>` summary; the
seat audit's "Who wins when they go first?" summary. Then `src/ui/sheriffs-ledger.js` line 67, the card table
wrapper `role="region" aria-labelledby="ledger-cards" tabindex="0"`.

The one-Tab assertion in `scripts/browser-ledger-check.mjs` was replaced. After Enter opens the ledger, the script now:

- asserts focus is on the ledger summary;
- presses Tab up to 8 times and requires the region labelled `ledger-cards` as the last stop;
- requires every intervening stop to be visible (`getClientRects`, not `visibility:hidden`) and inside `#ledger-billy`,
  and every stop to stay inside `#camp-ledger` (no escape, no `BODY`);
- presses Shift+Tab the same number of times and requires the exact reverse of the intervening stops, ending on the
  original summary (no trap);
- presses Enter on the summary and waits for the ledger to close.

Unchanged: the collapsed-ledger and Boot Hill visibility check, the Camp walk to the summary and back, the 29-row
card table assertions, overflow, the ruleset line, the Night Shift review lines, the Boot Hill first-turn check,
both viewports and the page error check. This script has no heading or private-hand assertion to keep; none was
added or removed. No app code changed, so the existing `dist/cowboys-vs-wizards-board-duel.html` (built 2026-11-22
21:22 for job 16) was reused without rebuilding.

## Verification (run 2026-11-22, America/Los_Angeles)

```
node scripts/browser-ledger-check.mjs dist/cowboys-vs-wizards-board-duel.html .artifacts/kiro/ledger-focus-retest
```

Exit 0, 12 of 12 checks passed, 0 page errors. Report: `.artifacts/kiro/ledger-focus-retest/browser-ledger.json`
(local artifact, not committed).

| Viewport | Result |
| --- | --- |
| 390x844 | Pass, 6 of 6 checks |
| 1440x900 | Pass, 6 of 6 checks |

Observed order at both viewports, forward from the ledger summary (5 Tabs):

1. `button[data-billy-line=baseline]` "Current Billy · 2 attack"
2. `button[data-billy-line=candidate]` "Proposed Billy · 1 attack"
3. `summary` "How to verify this replay"
4. `summary` "Who wins when they go first?"
5. Cards region (`role=region`, `aria-labelledby=ledger-cards`)

Shift+Tab ×5 retraced 4, 3, 2, 1, then the ledger summary. The browser showed no accessibility defect: the
intervening stops are visible, labelled controls in DOM order, and the hidden step buttons are skipped. The failure
was a stale one-Tab expectation. Whether the Billy replay should sit before the card table is a layout decision for
the integration worker or Fable, not a defect this check found.

Not run: `npm run build` (no app change), other browser scripts, unit tests. Not staged, committed or pushed.

## Known risk to check on the first run (superseded by the runs above)

After the ledger opens, the script presses Tab once from the summary and expects `role="region"` (the card table).
The Billy replay now sits before the card table and has focusable buttons (`data-billy-line`, `src/ui/billy-replay.js`
line 82). That suggests one Tab may land on a Billy button instead. This is inferred from the source and has not been
observed. If the run fails there, record the observed focus order, then decide the intended stop with the
integration worker. Do not drop the keyboard assertion.
