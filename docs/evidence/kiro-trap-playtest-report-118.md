# Trap placeholder lab: local playtest report export (issue #118)

Date: 2026-11-17 (America/Los_Angeles). Worker: Kiro, one bounded worker. The session context names client Kiro IDE and model `claude-opus-5.5`; the brief asked for Kiro CLI 3.4 V3, which this worker could not confirm from inside its session. The session emitted no selected-model record or credit metadata to this worker, so none is recorded here. Base: `69b79fe` (main after #117). One local commit. Not pushed, not merged.

**No human playtest was run.** The page now has a place for a person to write notes; no person has used it. Every note in the tests is a fixed test string labelled as automated.

## Problem

The #108/#116 lab can play FIXTURE, BASE, T1 and T2 against an easy, normal or hard Wizard, but there was no way to save what a human tester thought about the spell-versus-trap choice, the one-round arming delay or pacing next to the exact match they played. Issue #118 asks for a private, local-only report export, with no feedback collected by the worker.

## Change

- [playtest-report.js](../../experiments/trap-placeholder/playtest-report.js) (new, pure: no DOM, clock, random source, storage or network). `createPlaytestReport()` builds schema `cowboys-vs-wizards/trap-placeholder-playtest-report` v1 field by field: `source: "synthetic-developer-lab"`, a disclaimer, the active scenario and Wizard CPU, the pinned seed, a public match summary (status, round, active side, result), counts of `trap-set`, `trap-trigger`, `spell`, `phase-end` per side and `round-start` from the Cowboy-projected events, an optional sanitized public event list, and `humanNotes`. Each event type has an explicit field list; card IDs must be in the active catalog; numbers are bounded integers; only plain objects (prototype Object or null) are read; a Wizard `trap-set` never keeps a card ID. Notes are own string properties only, control and bidi characters removed, trimmed, at most 1000 code points; anything else is `""`. With status `idle` (after Leave) the report has no match, seed or events.
- [index.html](../../experiments/trap-placeholder/index.html), [app.js](../../experiments/trap-placeholder/app.js): a "Playtest report (optional, local only)" section below the log with four labelled empty `<textarea>`s (`maxlength` 1000), an "Include the public event list" checkbox, "Export current playtest report" and "Clear notes". Export runs only on click and downloads `trap-playtest-<scenario>-<cpu>-seed-<seed>.json` from a Blob URL. Notes are never cleared automatically. No other app logic changed; the export controls do not touch focus handling.
- [style.css](../../experiments/trap-placeholder/style.css): textarea font and focus outline only.
- [README.md](../../experiments/trap-placeholder/README.md): schema, privacy boundary, the triggered-trap reveal, and session and notes rules.

Not changed: `src/`, `lab.js`, `scenarios.js`, existing tests, cards, decks, art, models, audio, packages, CI, `docs/kiro-build-log.md` (coordinator-owned).

Documented boundary: a trap's card ID appears in `trap-trigger` events, because the engine reveals a trap when it springs ([view.js](../../src/game/view.js)). A Wizard trap's ID can therefore appear in an export made after it sprang, never before.

## Verification (this run, 2026-11-17)

| Check | Result |
| --- | --- |
| `node --test tests/experiments/trap-placeholder-report.test.js` (new) | 7 of 7 pass, 0 skipped (Chrome 157.0.8103.79) |
| `node --test tests/experiments/trap-placeholder.test.js` (#108) | 7 of 7 pass |
| `node --test tests/experiments/trap-placeholder-scenarios.test.js` (#116, includes its Chrome smoke) | 8 of 8 pass, 0 skipped |
| `node --test tests/experiments/trap-placeholder-keyboard.test.js` (#110, real Chrome keys) | 1 of 1 pass, 0 skipped |
| `npm test` | node:test 313 of 313 pass, 0 skipped; asset structural checks 2 of 2 (structure only) |
| `node scripts/check-links.mjs` | 177 Markdown files, 647 links, 0 broken (with this note staged) |
| `git diff --check` | clean |

What the new [test](../../tests/experiments/trap-placeholder-report.test.js) checks:

- Schema: exact top-level keys in order, synthetic source and disclaimer, T1/easy seed 0, notes all `""` by default, file name `trap-playtest-T1-easy-seed-0.json`, byte-identical on repeat (no clock).
- Seeds 0 and 60 in FIXTURE, BASE, T1, T2 (normal Wizard, played to a result through the controller): counts equal an independent count of `lab.events()`, 0 events dropped, the result equals the public view's, two runs give identical JSON, and without the event list the counts are unchanged.
- Real fixtures (FIXTURE 0 and 60, T1 0, T2 60): stopped with a Wizard trap set and not yet sprung, the report contains none of the Wizard trap IDs and the Wizard `trap-set` has only `type` and `side`; after the Wizard trap springs, its `trap-trigger` carries the ID and no other event does.
- Hostile input: sentinel fields (`secret`, `rng`, `deck`, `hand`, `state`, `timestamp`, a `/Users/...` path, `__proto__`, `actionId`), a Wizard `trap-set` with a card ID, unknown card IDs, unknown types, non-objects, an object with an inherited `type`, notes with an extra key and an inherited note, a view with a Wizard hand and rng, invalid settings, seed and status. The sentinel string, the Wizard trap ID, the seed-like value and the path never appear; `Object.prototype` is not polluted. The run first found that inherited properties were read (an inherited note and an inherited event `type` reached the report); `plain()` and the notes reader were fixed to read own data only, and the test kept.
- Bounds: non-strings become `""`; CR/LF, NUL, U+202E and U+2028 are handled; notes stop at 1000 code points (emoji counted whole); more than 500 events are capped with `eventsTruncated: true`.
- Session: T1 seed 0 played into round 2; a refused seed with changed settings leaves the report unchanged; Start with FIXTURE/hard seed 60 equals a fresh lab's report; Restart returns to the fresh report; Leave gives `match: null`, `seed: null`, no events, all 10 counts 0, and typed notes kept.

Chrome smoke (headless Chrome 157.0.8103.79, 127.0.0.1 server started by the test, CDP, no dependency). Observed in this run: notes empty on load; T1 chosen by script plus `change` event and seed 0 started with the form submit; a fixed test sentence entered with `Input.insertText`; End phase pressed until the Wizard set a trap; focus was still in the note box after playback; a real mouse click on the export button produced a completed Chrome download from a `blob:http://127.0.0.1:...` URL. The first file was `trap-playtest-T1-normal-seed-0.json` with seed 0, scenario T1, the typed sentence only in `spellVersusTrap`, 14 events (equal to the visible log lines), 1 Wizard trap set, 0 triggers and no Wizard trap ID. A second export at the end recorded a loss (base-destroyed) in round 3. The Wizard trap had not sprung by then because the script fields no Cowboy troop; the reveal after a trigger is covered by the Node test, not by this Chrome run. After Leave the third export had `match: null` and kept the note; Clear notes emptied all four boxes. All 20 requests went to the loopback origin or `blob:`; cookie empty, local and session storage empty; 0 runtime exceptions, 0 console errors.

## Limits

- No human feedback exists. These checks say nothing about clarity, meaningfulness, pacing or fun.
- The textareas and buttons are native and were driven by script and CDP mouse/text input, not by human keyboard or screen-reader users.
- The Chrome smoke saw no Wizard trap spring; the after-trigger case is Node-only.
- Counts are tallies under scripted play; they are not balance or choice-quality evidence.

## Independent coordinator verification (November 17, 2026)

After Kiro authored scoped commit df7efad and the completed runFinished
V3 session event, the coordinator independently inspected the
seven-file diff, private-data allowlist, and local-only export wiring,
then reran these checks against base 69b79fed573067be1d3d3993602cf9d1c60e0d87:

- node --test tests/experiments/trap-placeholder-report.test.js:
  **7/7 pass, 0 skipped**, including actual Chrome 157 local Blob JSON
  download, T1 seed 0, typed synthetic test note, valid redacted JSON,
  no external requests or browser runtime exceptions, and export
  before and after match end / leave.
- node --test tests/experiments/trap-placeholder-scenarios.test.js:
  **8/8 pass, 0 skipped** including real Chrome BASE/T1/T2 smoke.
- node --test tests/experiments/trap-placeholder-keyboard.test.js:
  **1/1 pass, 0 skipped** with real Chrome keyboard interactions.
- node --test tests/experiments/trap-placeholder.test.js:
  **7/7 pass**.
- npm test: **313/313 Node tests pass** and 2/2 existing GLB
  structural checks pass (not animation quality).
- node scripts/check-links.mjs: **177 Markdown files, 647 relative
  links, 0 broken**.
- git diff HEAD^ HEAD --check: **pass**.
- Kiro CLI version 3.4.0 was verified at launch. The final V3 stream
  selected model claude-opus-5.5 and reported
  **18.070479799668323 session credits** (emitted usage metadata,
  not account billing). This coordinator-only verification supplements
  the worker evidence above, which lacked that usage receipt.

No real-person feedback was gathered by this task. Human notes are
blank in the app until someone voluntarily types them. A publicly
triggered trap identifier is intentionally revealable after trigger,
but an unrevealed enemy trap identity and private state are excluded.
No published UI, deck/card/art/model/animation/audio or external
telemetry was changed or approved.
