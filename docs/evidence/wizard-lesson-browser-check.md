# Wizard lesson browser check (CLI worker, 2026-11-23)

Owner paths: `scripts/browser-wizard-lesson-check.mjs`, this note. Receipts go only to
`.artifacts/wizard-lesson-browser/`. No `src/` change, no build or `build.json` rewrite, no
training or model call, no push.

## Verified in Chrome on November 23

Claude Code wrote the browser check. The coordinator ran it in Chrome against the local build
`4bdd86b45098+local`, fresh from `node scripts/stage-pages.mjs`. All three checks passed on each of
`/`, `/3d/`, and `/graybox/`. The accepted-policy flow used a simulated receipt with its fixture markers
intact. The real native receipt remains pending and the page correctly kept the original Wizard.

## Routes, as this checkout stages them (read from source and the staged files)

Both builds have one entry, `src/app.js` (`scripts/build-graybox.mjs`). The lesson is mounted for
every build. The Camp control has a different location on the illustrated pages.

| Route label | Staged file | Build | Lesson entry (real controls) |
|---|---|---|---|
| `/graybox/` | `dist/web/graybox/index.html` | graybox | Play (`#menu-play`) → Camp "Experiment" → `#camp-wizard-lesson` |
| `/` | `dist/web/index.html` | illustrated | Camp (`#menu-play`) → Practice room (`[data-camp-destination="camp-practice"]`) → "Challenge replays" summary → `#camp-wizard-lesson` |
| `/3d/` | `dist/web/3d/index.html` | illustrated copy of `/` | same as `/` |

Every route also opens the lesson at `?lesson=saved`. This query is ignored when `?turn`,
`?outrider`, `?practice` or `?wizard` is present (`src/app.js:239`). After a finished solo Cowboy
duel against a level-2 Wizard (Open range, the Coven rival, the last hunts without arrivals), the
result shows "Review a Wizard move" (`#sd-review`).

So the illustrated DOM does carry the lesson. Its control sits two clicks deep, inside the
Practice room's collapsed "Challenge replays". `camp-outpost.js:136-139` moves the whole
Experiment section there. Chrome exercised both Camp routes.

Static facts about the staged files (checked with file reads, not in a browser):
- The three staged pages were built at 23:44:22–23 on 2026-11-22, after the last change to
  any lesson source (`src/app.js` and `showdown-screen.js` at 23:42:57). Each contains
  `cvw-wizard-lesson-v2` and `camp-wizard-lesson`. The script checks this freshness by file
  times again and refuses stale pages unless `--allow-stale` is passed.
- **`src/ui/showdown-3d/wizard-lesson.css` is not in any build.** `build-graybox.mjs` does not
  list it, and no `.wizard-lesson` or `.wl-*` rule appears in `dist/web/**`. The lesson page
  therefore renders with only the shared graybox and Showdown styles. On the illustrated route,
  its legibility over the frontier art is unchecked. Fixing this is a coordinator change to the
  build file list; this worker does not make it. The report records it as `pages[].markers.lessonCss`.

## Inputs

- Native episode: `.artifacts/wizard-lesson/native-bait-episode.json`. Seed 0, Wizard first,
  markedIndex 5, Hellfire.
- Native receipt: `.artifacts/wizard-lesson/native-training-receipt.json`. Schema
  `wizard-lesson-receipt/2`, **status `pending`**, reason "rival: no grounded counterexample in
  seeds 0-200". It records one coach run (`wl-a5b7723edb372351`) and no rival or reviser run,
  with episodeKey `ep1-92c0c36f`. The script computes this episode's key on the engine and
  requires the receipt to name it. That way, a rejection shown in the browser is a status
  rejection, not a key mismatch. The browser smoke confirmed the matching key and the state rejection.
- **SIMULATED fixture:** `scripts/wizard-lesson/fixture.mjs` (`simulatedLesson` and
  `simulatedReceipt`) builds a receipt for the same episode. The script writes it to
  `.artifacts/wizard-lesson-browser/simulated-fixture-receipt.json` with `fixture: "simulated"`
  and `simulated-*` run ids intact. The page must label it "Accepted simulated fixture: … no Kiro
  run produced it". It is not evidence that any native Kiro lesson exists.

## What the script exercises (per route, each check in a fresh Chrome context)

- `native`: real controls only.
  1. Camp entry → empty page → open the episode file (`#wl-episode-file`).
  2. The marked move is preselected. Select another move, then reselect it. "That was bait" →
     Hellfire-bait report, Pending label, opt-in disabled.
  3. Export the episode (download compared with the input file; name
     `wizard-lesson-episode-<key>.json`).
  4. Import the pending receipt. Expected: Rejected, source imported. The label must not claim
     the runs happened, and the trainer's reason and coach run must be shown. Opt-in stays
     disabled (a forced click does not check it), and no lesson Wizard is shown.
  5. "Rematch this deal": "Lesson rematch, original Wizard". The episode's first Wizard move
     opens the duel. The episode's Cowboy moves are clicked (wagon, Lasso on troop 0, End turn),
     and the original Wizard must play the marked Hellfire again.
  6. Finish the rematch: "Same deal again" and "Back to the lesson", no review button, and no
     playtest or save change.
  7. Back to the lesson, then a reload at `?lesson=saved`: still Rejected.
  8. "Forget this lesson": back to Pending, no stored receipt, and the rematch is original.
  9. Escape ×3: marked view → selection cleared → Camp.
- `fixture` (SIMULATED):
  1. `?lesson=saved` with no saved lesson → open the episode, mark it, import the fixture.
     Expected: an accepted simulated label, simulated run ids, opt-in offered and off, and a
     lesson Wizard advice that differs from the original.
  2. Opt-in off rematch: original Wizard, which repeats the Hellfire.
  3. Opt-in on rematch: lesson Wizard, which does not cast Hellfire at that turn.
  4. A non-receipt file leaves the lesson unchanged.
  5. After a reload the receipt is re-checked and opt-in is off (opt-in is never stored).
  6. Forget → Pending.
- `after-duel`:
  1. A synthetic Trail-complete save, then Open range at `?seed=7`, lost by ending every turn.
  2. The result offers "Review a Wizard move". It opens the lesson with that duel's Wizard moves.
     Mark one: Pending, and export is enabled only for a Hellfire bait.
  3. Close → Camp.

Every check also fails on page errors and on any request outside the loopback origin. Scripted
Chrome only: no human played, so nothing here speaks to clarity or fun.

## How to run (coordinator)

```sh
# Reuse dist/web if it is still newer than the lesson sources (the script checks), or restage first:
#   node scripts/stage-pages.mjs        # rewrites dist/web/ only; no --commit, so no build.json
npx -y -p playwright-core@1.64.1 node scripts/browser-wizard-lesson-check.mjs
# narrower runs:
npx -y -p playwright-core@1.64.1 node scripts/browser-wizard-lesson-check.mjs --routes graybox --only native
npx -y -p playwright-core@1.64.1 node scripts/browser-wizard-lesson-check.mjs --routes root,3d --only native,fixture
```

Exit codes: 0 means every check passed. 1 means a failed check (each failure is printed with its
route label). 2 means bad flags or a missing or stale staged page. 3 means Playwright or Chrome
is unavailable. Outputs: `.artifacts/wizard-lesson-browser/report.json`, the simulated fixture
receipt, and `<route>/native/exported-episode.json`.

Known risks to watch on the first run:
- The illustrated board may intercept clicks on hand cards. `scripts/referee/browser.mjs`
  drives the same page by clicks, so this is not expected.
- The lesson Wizard's opening turn could differ from the original's. If it does, the Lasso
  target in the fixture check's opt-in-on rematch may not exist, and the check aborts with that
  selector in its message.
