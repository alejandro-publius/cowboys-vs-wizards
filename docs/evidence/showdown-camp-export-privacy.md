# Showdown Camp export privacy (K-094)

Kiro CLI recorded the expected result before running the clipboard check.

## Expectation (recorded before running)

A tester presses the normal Camp **Copy report**. The clipboard must equal the report box and show, for every
well-formed logged duel, its name, won/lost, turns, time and "read the rules", plus the build lines and saved
career totals. It must contain none of the harmless canary strings planted in fields the report does not print.

One way a fake pass could arise: the planted data never reaches the page (wrong origin, the save is reset, the
clipboard read returns stale or empty text), so "no canary" holds trivially. Controls are listed under Results.

## Run (2026-11-20, America/Los_Angeles; Kiro CLI, scripted headless Chrome)

```
node scripts/build-graybox.mjs
node scripts/browser-showdown-camp-export-check.mjs dist/cowboys-vs-wizards-board-duel.html /tmp/kiro-camp-export-out
node --test tests/match/showdown-playtest.test.js
```

Page build label `dc0bf91e28e1` (the base commit this check was written on). Chrome: system Google Chrome,
`--headless=new`, fresh temporary profile deleted after the run, page served over loopback HTTP,
`Browser.grantPermissions` clipboardReadWrite for that origin only. Result: 7 of 7 browser checks, 8 of 8 Node tests.

Planted fixture (21 unique harmless `ZZCANARY-…-7f3q` strings, no real data):
- playtest log: an older-build row with `note`, `player`, `email`, `when` and canary run/duel ids; another build's
  lost row with `device`, `location`; the prototype's offline shape (no run/duel/seed/build); a row whose `build`
  is not a public label; a two-player shaped row with `seat`, `hand`, `otherHand`, `traps`; two malformed rows and
  two non-objects;
- a valid v2 save (one Trail win) with extra `note`, `player`; v1 save, refused-save copy, keepsake record and lane
  profile each holding a canary; an unrelated key; a sessionStorage value; a cookie.

Controls against a fake pass, all asserted:
1. The detector finds all 21 canaries in a dump of the planted storage.
2. After Play opened the Camp, all 21 are still in the page's storage and the Camp offers Raven Roost (the planted
   save was resumed, not reset).
3. Copy report was pressed by a real mouse event, answered "Copied.", and `navigator.clipboard.readText()` equals
   the report box, which contains the duel this run just played (line 6, this build).
4. The planted rows' public fields appear: lines 1-5 below and `2 on 0123456789ab`.

Copied text (scripted bot win on line 6; its "0 s" is bot speed, not a player time):

```
Showdown playtest report
Finished 6 duels in 6 min of play: won 4, lost 2.
Reached: Trail 2 of 6 won, rivals 0 of 4, Wanted hunts 0 of 10, even-match wins 0.
First loss: duel 2, Raven Roost.
Lost most often: Raven Roost, 2 times.
Opened "All the rules" during 1 of 6 duels.
Cards in the deck now: sheriff x4, billy x5, deadeye x3, covered-wagon x2, outrider x2.
This report is from game build dc0bf91e28e1.
Duels by build: 1 build not recorded; 2 on 0123456789ab; 3-5 build not recorded; 6 on dc0bf91e28e1.
Reached and the deck are the saved career, which can include duels finished on other builds or before this log began.

Duel by duel:
1. Boot Hill: won in 9 turns, 71 s, read the rules
2. Raven Roost: lost in 12 turns, 2 min
3. Raven Roost: lost in 6 turns, 30 s
4. Boot Hill: won in 8 turns, 45 s
5. Raven Roost: won in 7 turns, 60 s
6. Raven Roost: won in 9 turns, 0 s
```

No canary and no unprinted field name appears in the copy. Finishing the duel rewrote the log and save with
known fields only; the old row's canary run and duel ids stay stored (kept for de-duplication) and are never
printed. Other keys, sessionStorage and the cookie are untouched and unread by the report.

## Finding

No privacy defect observed at the stored-log, save or clipboard boundaries, so no runtime code changed.
`tests/match/showdown-playtest.test.js` gains one Node test pinning this (green on the unchanged code; no
red/green pair because nothing was broken).

## Limits

- A row's `name` is any string from storage and is printed as is. Both writers (graybox, reference prototype)
  store only the duel's public name, so private text there needs a hand edit of localStorage. Not changed:
  restricting names to the current duel list could drop real rows of renamed duels; that is a design call.
- One seed (0), one Trail duel, Chrome only, one origin. The two-player row was planted; hotseat writing no line
  is covered by `scripts/browser-showdown-modes-check.mjs`, not re-run here.
- Scripted bot and planted data only. Says nothing about a human tester's clarity or experience.
