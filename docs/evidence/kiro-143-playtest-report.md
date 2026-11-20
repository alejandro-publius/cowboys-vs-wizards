# Issue 143: Camp playtest log and report (graywave-report)

Date: 2026-11-19 (America/Los_Angeles). Work by Kiro CLI on branch `kiro/graywave-report`, base `0137f8d` (the integrated Camp).

## Change

- `src/match/showdown-playtest.js` (new): the log store. Key `cvw-showdown-playtest-v1` (the prototype's key). Lines use `logged`/`report` from `src/game/showdown/playtest.js` unchanged. Each line keeps name, won, turns, seconds, rules, plus `duel` id, deal `seed` and a random `run` id. A `run` id already logged is ignored. Unknown fields are dropped on read and write. Blocked or full storage keeps the log in memory and reports `saved() === false`.
- `src/ui/showdown-screen.js`: one `playtest.add` call next to the existing once-only `campaign.settle`.
- `src/ui/showdown-camp.js`: a "Playtest report" disclosure with the prototype's note text, a read-only labelled textarea, a "Copy report" button (clipboard, else select the text) and a status line. A not-saved note appears when storage fails.
- `src/app.js`: creates the log and passes it to both screens.
- The graybox has no hotseat, so every logged duel is a solo Trail duel. Progress, rewards and rules are untouched.

## Verification (actual runs)

- `node --test tests/match/showdown-playtest.test.js`: 3 of 3 pass. Covers one line per run across a reload, field stripping, unreadable JSON, and blocked or missing storage.
- `npm test`: 535 of 535 pass.
- `npm run build`, then `node scripts/browser-showdown-check.mjs dist/cowboys-vs-wizards-board-duel.html /tmp/graywave-report-browser`: 23 of 23 checks pass in fresh headless Chrome at `?seed=0`, with 101 mouse clicks and no page errors. New checks:
  - Leaving an unfinished duel logs nothing, and the report reads "No duel has been finished yet."
  - The Boot Hill win is logged once with exactly the eight fields.
  - The choice, the return to Camp and a reload add no line.
  - After the reload the Camp report shows the one win. "Copy report" answered "Copied."
  - After Raven Roost and two more reloads the log holds exactly two lines, and the report lists both.
- Logged Boot Hill line from that run: `{"name":"Boot Hill","won":true,"turns":17,"seconds":1,"rules":false,"duel":"trail","seed":0}` (run id omitted). The duel took 1 s because a script played it. This is not a human result.

## Open

- `rules` is always false, because the graybox has no "All the rules" panel. The reused report line therefore reads "Opened "All the rules" during 0 of N duels". Fable to decide on keeping, rewording or dropping that line.
- New UI strings for Fable to confirm: "Copy report", "Copied.", "Selected: press Ctrl+C or Cmd+C to copy.", "This browser did not save the playtest report, so a reload will lose it."
- Separating three first-time players: one log per browser profile. There is no per-player reset (the prototype's reset also erases progress). Use a fresh browser profile for each player, or decide on a reset control.
- Human playtests: none run. No human results are claimed.
