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

Wording ("Practice Boot Hill", the note, "Deal 0/60") is first-draft and needs Fable's approval like the other
Camp labels.

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

## Limits
- The duels were played by a naive scripted click policy, not by a person. These runs say nothing about clarity
  or fun, and no screenshot was reviewed for appearance.
- The canonical receipt script `scripts/browser-showdown-practice.mjs` belongs to the workflow worker. It was not
  run here.
- Not pushed and no PR opened. `docs/kiro-build-log.md` is left to the coordinator.
