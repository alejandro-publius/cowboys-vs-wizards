# K-096: Boot Hill practice from the Camp (entry worker)

Date: 2026-11-20, 14:23 PST (America/Los_Angeles). Implemented by Kiro (agent session
`sess_a39dbf9e-6907-4059-9df4-9b47043b1e12`, claude-opus-5.5) on branch `kiro/showdown-practice-entry` from `ce5d224`
(PR 174). Game commit `1b2136f40ffb`. Codex verification is separate and pending.

## Change
- `src/match/showdown-practice.js` (new, pure): allowlist `[0, 60]`; `practiceSeed` accepts only the exact strings
  `"0"` and `"60"`; `practiceFromQuery` rejects a repeated `practice` parameter; `practiceDuel(seed)` is
  `bootHill()` (Trail duel 1 on `newSave()`: starter deck, no grit), renamed "Practice: Boot Hill", id
  `practice:<seed>`, with "Practice: nothing here is saved." before Boot Hill's unchanged lesson.
- It uses the screen's existing no-settle path, `kind: "turn"` (`src/ui/showdown-screen.js` `finish()` returns
  before the playtest line and `campaign.settle`; `again()` re-deals the same seed; the result offers "Retry").
  No change to the screen, rules, cards, AI, rewards or save format.
- `src/app.js`: a collapsed `details#camp-practice` ("Practice Boot Hill") at the end of the Camp, with two native
  links `#camp-practice-0` / `#camp-practice-60` (`href="?practice=0|60"`, labels "Deal 0", "Deal 60") and
  `data-build` set to the page's existing build label. A plain click or Enter opens the duel in-page; a modified
  click follows the href. `?practice` is read after `?turn` and `?outrider`. `?seed` is unchanged.

Fable 5.2 reviewed the quoted Camp disclosure, both deal labels and the in-duel practice text on November 20 and approved them for release. That review covered the wording. Browser behavior was checked separately below.

## Checks run (all on the committed tree, build label `1b2136f40ffb`)
| Command | Result |
| --- | --- |
| `node --test tests/match/showdown-practice.test.js` | 3 of 3 pass (allowlist, starter-deck Boot Hill vs. an advanced career, deterministic deal equal to Camp's Boot Hill on the same seed) |
| `npm test` | 635 of 635 Node tests pass |
| `node scripts/browser-showdown-check.mjs dist/cowboys-vs-wizards-board-duel.html` | 22 checks pass |
| `browser-showdown-keyboard-check`, `browser-showdown-turn-check`, `browser-showdown-outrider-check` (same page) | 7, 29 and 23 checks pass |
| Temporary loopback Chrome check, kept outside Git, on `dist/cowboys-vs-wizards-board-duel.html` and `dist/web/index.html` (both SHA-256 `400896728e901b735fc29bc84c54087ba1100630035064d9379ef97e033862a9`) | 12 checks pass on each |

The temporary check, headless Chrome over DevTools on `http://127.0.0.1:<port>/`:
1. Normal career: Play -> Camp -> Boot Hill (`?seed=0`), played out by DOM clicks: `cvw-showdown-save-v2` and
   `cvw-showdown-playtest-v1` are written (a win, "New in your collection"; career at 1 win).
2. The Camp control is collapsed and holds exactly the two links above.
3. For each deal: Enter on Play, the summary and the link opens the duel without navigation; a direct
   `?practice=<seed>` load shows identical `#sd-status`, `#sd-lesson`, `#sd-prompt`, `#sd-hand`, `#sd-board` and
   `#sd-log` text (turn-1 prompt "Nobody attacks on the opening turn"). Restart and Retry give the same state; two
   finishes show only Retry and Back to camp; Back to camp focuses the link; every localStorage key is
   byte-identical.
4. With the 1-win career saved and with empty storage, `?practice=0` opens the same state.
5. `?practice=` and the values `1 00 060 60.0 %200 -0 0x0 1e1 abc`, plus `0&practice=60`, leave the title screen.
   `?seed=0` does not change deal 60. `?turn=dragon-c5` and `?outrider=case-e` win over `?practice=0`;
   `?mode=lanes&practice=0` opens practice. Storage stays byte-identical over all of these loads. No page errors.

## Follow-up: lane keepsake import on a direct practice boot (2026-11-20, Kiro, commit `ffe645dfddbf`)
Coordinator finding (`legacy-check.mjs`, outside Git): on a brand-new origin holding only an unimported lane profile that
had cleared every hunt of the first lane boss (Graveyard Dragon; built with `createProfileStore` and `recordBounty`),
loading `?practice=0` wrote `cvw-showdown-inherited-v1` at boot, because `createCampaign` imported keepsakes in its
constructor. The isolation claim above was therefore wrong for that case at `1b2136f`.

Fix: `createCampaign(storage, {deferImport})`. The default (`false`) and every existing caller behave as before.
`src/app.js` passes `true` only when a valid `?practice` actually opens (no `?turn`, no `?outrider`). Then the
constructor writes nothing, and `campaign.enter()`, called by the Camp's `toCamp`, reloads the stored career and runs
the ordinary `joinInherited` import once. A second `enter()` does nothing. No UI, rule or save-format change.

| Check | Before: page from `1b2136f` (SHA-256 `40089672…862a9`) | After: page from `ffe645d` (SHA-256 `aa232319…242c977`) |
| --- | --- | --- |
| `node --test tests/match/showdown-practice.test.js`: 3 new tests (deferred campaign writes nothing until `enter()` and imports once; `enter()` loads a career another tab saved; blocked storage) | 3 of 3 new tests fail (the option did not exist) | 6 of 6 pass |
| Temporary loopback Chrome check, one fresh profile per case: fresh origin | pass | pass |
| Lane profile with the earned Dragon: direct `?practice=0`, finish, Retry, `?practice=60` write no key; Back to camp then imports the keepsake once (Camp lists it "from the lane game"); a return and a root reload import nothing more; `cvw-player-v1` unchanged | **fail**: key written at the `?practice=0` boot | pass |
| Lane profile, ordinary root boot: keepsake imported at boot, as designed | pass | pass |
| Blocked `localStorage`: practice opens, finishes and returns to the Camp; a Camp Boot Hill then settles in memory and the Camp says it could not be saved | pass | pass |
| Normal career with a lane profile: Play -> Boot Hill (`?seed=0`) writes the save and playtest keys (1 win); a later direct practice and Camp return leave every key byte-identical | pass | pass |
| A career saved by another tab during a direct practice is what the Camp then loads (Trail duel 2 opens), and Camp entry rewrites no key | **fail**: Camp kept the boot snapshot and opened Boot Hill | pass |

On `ffe645d` also: `npm test` 638 of 638; `browser-showdown-check` 22, keyboard 7, turn 29 and Outrider 23 checks pass on
`dist/cowboys-vs-wizards-board-duel.html` (identical to the `--hosted` build). The coordinator's own Playwright script was
not run here: Playwright is not installed in this checkout. The 12-check entry script above was not rerun on `ffe645d`.

Scope of the isolation claim now: a direct `?practice=0|60` boot writes no storage key until the player enters the Camp.
Entering the Camp is a real Camp visit and runs the ordinary keepsake import. A boot of the root, or a `?turn` or
`?outrider` boot, still imports keepsakes at boot, as before.

Playtest log, second follow-up (commit `a8a34b72cf92`): the coordinator's `tab-history.mjs` showed that after a direct
practice, Back to camp listed "No duel has been finished yet" although another tab had stored a Raven Roost line, and the
next duel overwrote it. `createPlaytestLog` (`src/match/showdown-playtest.js`) now reads its key on first use, not at
creation. Practice uses no log, so the first Camp render reads the lines stored by then. Callers are unchanged, and blocked
storage keeps the log in memory. Red/green: the new unit test fails at `ffe645d` and passes at `a8a34b7`. A temporary
two-tab CDP check in one Chrome profile ran on the page from `ffe645d` (SHA-256 `aa232319…242c977`): both checks failed, the
report lacked Raven Roost and the stored log became `["Boot Hill"]`. On the page from `a8a34b7` (SHA-256 `717499d7…c894b777`)
both pass: the report shows Raven Roost, and after a normal Boot Hill the log is `["Raven Roost","Boot Hill"]`. On
`a8a34b7`: `npm test` 639 of 639; `browser-showdown-check` 22, keyboard 7 and Camp export 7 checks pass. There is no live
sync between tabs: once a tab has read the log, it does not see lines another tab adds later, as before.

## Limits
- The duels were played by a naive scripted click policy, not by a person. These runs say nothing about clarity
  or fun, and no screenshot was reviewed for appearance.
- The canonical receipt script `scripts/browser-showdown-practice.mjs` belongs to the workflow worker. It was not
  run here.
- Not pushed and no PR opened. `docs/kiro-build-log.md` is left to the coordinator.
