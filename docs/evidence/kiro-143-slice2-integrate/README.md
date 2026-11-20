# Issue 143 slice 2 integration (graywave)

Kiro CLI integration worker (Claude Opus 5.5), 2026-11-19, 21:34 PST (America/Los_Angeles).
Branch `kiro/graywave-integrate`, base `github/main` `24dd11c` (PR 144 merge). Verified code tree: `6ade89e`.

## What was combined

| Worker branch | Commit | How |
| --- | --- | --- |
| saves | `d5b964d` | merged as `96b75bc`, the tree-identical copy already in the camp lineage, so the commit appears once |
| camp | `0137f8d` | merge, no conflict |
| accept | `e009df5` | merge, no conflict |
| catalog | `44d31ee` | merge, no conflict |
| report | `7ade278` | merge; `src/ui/showdown-camp.js` conflict resolved by keeping both sides |
| cues | `a0da6ce` | merge; `showdown-screen.js` and `showdown.css` conflicts resolved by keeping both sides |

Integration commits by this worker:

- `6815cba`: lane-captured cards stay owned. See below.
- `c74a7d6`: a stronger Run B. `scripts/browser-showdown-trail-check.mjs` now also requires the persisted Showdown record. No assertion was removed.
- In the cues merge, `scripts/browser-showdown-cues-check.mjs` enters Boot Hill through the Camp tile. Its harness gets a campaign that pays nothing, because slice 2's screen settles every finished duel. No assertion changed.

The pilot packaging commit `bc8390f` was not merged. It is independent and its distributable is already delivered.

## Lane-era ownership (slice 2 done-when 2)

- `src/game/showdown/inherited.js` (pure) copies `laneCapturedCards(storage)` into its own key, `cvw-showdown-inherited-v1` = `{v: 1, source: "cvw-player-v1", cards: [...]}`.
  - The record only grows. It is written only when a card is new.
  - A damaged record is never overwritten.
  - Blocked storage keeps ownership in memory and shows the existing not-saved note.
- The Camp lists each card once, by name, after "Collection:". A lane card is marked "(from the lane game)", followed by "Cards from the lane game stay owned. They are not in your Trail deck and are not in save codes."
- A card owned in both games is shown at the Showdown count, never the sum. Both records are kept unchanged.
- No change to `progress.js`, `migrate()`, the Trail, the deck, bounties, offers, rewards, Scout or `cvw-player-v1`.
- Inherited ownership is local to this browser. It is **not** in the portable save code (`savecode.js` carries only the v2 progress). Portability is open.

## Results on `6ade89e` ([run-summary.txt](run-summary.txt))

- `npm test`: 556 of 556, plus both GLB structure checks.
- `sh scripts/check-card-specs.sh`: exit 0.
  - Catalog round trip: `export-cards.mjs` and `export-card-library.mjs` left `prototypes/showdown/cards.csv`, `docs/cards.csv` and `docs/card-types.csv` unchanged.
  - No `OVERLAY` or `FRESH` in `cards.js`.
- The six PR 144 prototype Chrome suites all exit 0 on `dist/showdown.html` (`fc17ef48…`), unchanged from the PR 144 integration:
  - access 34 ok
  - onboarding 31 ok
  - hotseat 47 ok
  - savecode 27 ok
  - bo3 47 checks
  - campaign 55 ok
- Graybox offline and `--web` builds are byte-identical (`0a9973d3…`). The web build is the hosted `/graybox/` page. On each build:
  - `browser-showdown-check.mjs`: 23 of 23. Covers Camp, the Trail, privacy, the playtest log and report, and `?mode=lanes` and `?mode=match` still loading the lane duel. [receipt](browser-showdown.json)
  - `browser-showdown-trail-check.mjs`: 16 of 16. [receipt](browser-showdown-trail.json)
    - Run A: a new player wins Trail duels 1 and 2 by clicks. Each reward equals the reference and survives reloads.
    - Run B: a lane veteran sees Captured Dragon on screen as owned on load and again after a win and reload. The persisted inherited record lists it, the lane key is byte-identical, and the Trail and deck are unchanged.
- `browser-showdown-cues-check.mjs`: 5 of 5. All ten cue kinds and their subcases, rapid actions, and reduced motion are covered. [receipt](browser-showdown-cues.json)
- Accept worker's strict Run B on the tree before the ownership fix (`91bef76`): fails at "collection names Captured Dragon". This was expected. [output](strict-runB-before-fix.txt)
- Compat harness A1–A5 (`cli-progression/experiments/showdown-profile-compat`, loader = the Camp's progress object): **7 of 14 pass**. [table](compat-A1-A5.md)
  - A2–A5 pass on every case.
  - **A1 still fails on all 7 capture cases.** A1 checks `owned(progress)`, and the progress object is deliberately unchanged.
  - This failure is not counted as met.
- The same 14 fixtures against the persisted record, with the lane key removed before reload: 14 of 14 list exactly the lane captures, once each. [table](inherited-record-cases.md)
- 3D/art untouched: no file under `assets/`, models, render or animation code changed against `github/main`.

## Open

- **Fable (smallest decision):** may a lane-captured Legendary count in the Showdown progress collection, and so be equippable, before the Trail is done? If yes, what does that boss's Showdown bounty pay? (F1/F2 in the compat handoff.)
  - Until Fable decides, A1 fails, and ownership is display plus a separate persisted record.
- F3–F5 remain open: partial lane hunts, lane frontier cards, and Start over/save-code portability of inherited cards.
- Wording added here and by the workers is Fable's to approve.
- Human playtests: none run, none claimed.
