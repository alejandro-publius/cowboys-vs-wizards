# The Night Shift: Sheriff's Ledger in the Showdown Camp

Worker: Kiro CLI, job `night-ledger`, branch `kiro/graywave-night-ledger`, November 19, 2026 (America/Los_Angeles). Base: main `4d52642`.
Design: Fable 5.2's "The Night Shift" idea. Its screenshot was not available to this worker, so the layout is a plain graybox reading of the brief (see Open decisions). No card, rule, balance, reward or Scout change.

## What it is

A collapsed `<details>` at the end of the Camp (after the Trail, Your cards and the playtest report). Opened, it shows:

- **Whole ruleset (not per card):** the newest Showdown run in [night-watch-showdown/scout-pair-reports.json](night-watch-showdown/scout-pair-reports.json), report `fa15c87e1701`, commit `3dd47f1` against `a9aa828`, seeds 0–999, 2,000 games, first player 1,142 (57.1%), Cowboys 1,188 (59.4%), 0 draws, 318 rule tests, shift verdict steady. Labelled as estimates for that bot and those seeds, and as not measuring later commits.
- The seven Showdown engine properties SP1–SP7 (`tests/game/showdown-properties.test.js`), listed as ruleset-wide.
- One row per card of the 29-card catalog, in catalog order: name, side, kind, rarity, starter-deck copies (from `DECKS`), its spec file and requirement link. R1.1 is linked only to the eight cards that requirement names; the other 21 link R1 (`.kiro/specs/duel-card-pipeline/requirements.md`). No design author or credit is shown.
- **Latest result per card:** "Not observed" for all 29, because no run records per-card data (the night-meter contract also states `cards.measured: false`). "Pending" appears when no run is recorded.

## Files

- `scripts/build-sheriffs-ledger.mjs`: deterministic generator; `--check` exits 1 when the payload is stale. Optional `--receipt <file>` reads a `night-watch-receipt/1` receipt (draft contract `graywave-night-meter-contract.md` next to the worktrees, outside the repo) and refuses one that claims per-card measurements. Optional `--per-card <file>` is accepted only for the same mode, commit and seed range, and catalog types.
- `src/ui/sheriffs-ledger.data.js`: generated payload (about 8 KB, static, no network).
- `src/ui/sheriffs-ledger.js`: view (pure row/summary functions plus `mountLedger`).
- `src/ui/showdown-camp.js`: one import, one `<details id="camp-ledger">`, one `mountLedger` call. `src/ui/showdown.css`: eight scoped lines.
- `.kiro/hooks/check-sheriffs-ledger.json`: PostFileSave on card specs, Night Watch evidence JSON or the ledger files runs `node scripts/build-sheriffs-ledger.mjs --check`.
- `tests/match/sheriffs-ledger.test.js`, `scripts/browser-ledger-check.mjs`.

## Checks run (Node v26.0.0, macOS, headless Chrome)

- `node --test tests/match/sheriffs-ledger.test.js`: 8 passed. Covers byte-for-byte regeneration, 29 catalog rows, R1.1 links against the requirement text, run tied to commit and seeds, Not observed / Pending, and per-card and receipt matching. The per-card counts and the receipt in the tests are labelled test-only samples, not measurements.
- `node --test tests/match/showdown-session.test.js tests/match/showdown-cues.test.js tests/match/showdown-campaign.test.js tests/match/showdown-playtest.test.js tests/game/card-specs.test.js tests/match/sheriffs-ledger.test.js`: 35 passed.
- `npm run build`, then `node scripts/browser-showdown-check.mjs dist/cowboys-vs-wizards-board-duel.html`: 23 checks passed (Camp, Trail duels 1–2, reloads, privacy, `?mode=lanes`, `?mode=match`).
- `node scripts/browser-ledger-check.mjs dist/cowboys-vs-wizards-board-duel.html`: 10 checks passed at 390×844 and 1440×900. [Receipt](night-shift-sheriffs-ledger/browser-ledger.json). It found the ledger collapsed below the Trail, Boot Hill uncovered in the first viewport, no horizontal overflow open or closed (390 px: page 390 px, ledger right edge 375 px), Tab reaching Boot Hill before the summary (focus outline solid 2px), Enter opening and closing the ledger, the table region focusable, and no ledger in Boot Hill's first turn.
- Later repair (2026-11-20): after the Camp began focusing Boot Hill on entry, the Tab step above failed, because it blurred that control first and so started the walk after it. The check now enters by Enter on Play and counts the entry focus as the first stop. It requires Boot Hill before the summary, then a Shift+Tab retrace to Boot Hill. It passes 12/12 and fails on an unreachable Boot Hill or a ledger ahead of it. See [overnight-check-repair.md](overnight-check-repair.md).
- Hook command: `--check` exited 1 on a deliberately altered payload and 0 after restoring it. The hook matcher was tested against sample paths. A real Kiro IDE save trigger was **not** observed.

Scripted browser runs support claims about layout, flow and focus. Appearance and clarity have not been reviewed or playtested.

## Integration with `kiro/graywave-modes` (trial, not kept)

A scratch merge of `kiro/graywave-modes` at `605e826` into this branch conflicted only in `src/ui/showdown-camp.js` (the import line: keep modes' `face` import and add `import {mountLedger} from "./sheriffs-ledger.js";`) and `src/ui/showdown.css` (keep both blocks, modes' first). The ledger's `<details>` and `mountLedger` call merged cleanly. On that merged tree: `npm run build`; 37 Node tests passed (ledger, modes, session, cues, campaign, playtest); `browser-ledger-check.mjs` 10, `browser-showdown-modes-check.mjs` 13 and `browser-showdown-check.mjs` 23 checks passed. The scratch branch was deleted; the coordinator does the real integration.

## Open decisions (Fable / Alex)

- Placement and wording follow the brief, not Fable's screenshot, which this worker did not have.
- What a per-card metric means (for example, games the card was played in, and its side's wins) is undefined. The generator accepts only `{games, wins}` matched to the run, and the view labels it "Side won W of G". The night-meter receipt measures no per-card data.
- No Fable-approved balance band exists. The ledger shows the shift verdict only, not the meter's lean verdict.
