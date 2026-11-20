# Showdown slice 2, the first hour: tasks

Author: Kiro CLI (Claude Opus 5.5), 2026-11-19, America/Los_Angeles.

**Status: backfilled.** Tasks marked done were implemented before this spec existed, by the slice 2
workers merged on `kiro/graywave-integrate` (see
[`docs/evidence/kiro-143-slice2-integrate/README.md`](../../../docs/evidence/kiro-143-slice2-integrate/README.md)).
The marks record that the code and its tests exist on `cd764f1`, not that this spec drove them. Only T8 and
T9 were done in this job.

- [x] T1 Move `progress.js`, `trail.js`, `playtest.js` to `src/game/showdown/`; prototype paths re-export (FH-R1.1, FH-R4.1). Worker: saves (`96b75bc`).
- [x] T2 `campaign-store.js` over a passed-in Storage: load, migrate v1, refuse, keep refused, blocked storage, lane profile read-only (FH-R3.1–FH-R3.8, FH-R5.6, FH-R7.2). Worker: saves.
- [x] T3 Ramp in `npm test` and the Trail 1–2 cushion test (FH-R4.2, FH-R4.3). Worker: saves.
- [x] T4 Camp screen and title routing; lane duel kept at `?mode=lanes` and `?mode=match` (FH-R2). Worker: camp (`0137f8d`).
- [x] T5 Playtest log over `cvw-showdown-playtest-v1` and the Camp report (FH-R3.9). Worker: report (`7ade278`).
- [x] T6 Inherited record and Camp ownership display (FH-R5.1–FH-R5.5, FH-R7.1). Integration commit `6815cba`.
- [x] T7 Browser acceptance: new player Run A and lane veteran Run B, with the persisted record required (FH-R5.7, FH-R6). Workers: accept (`e009df5`), integration (`c74a7d6`).
- [x] T8 This spec, the slice 2 section of `docs/requirement-test-map.md`, and comments in each slice 2 test naming the requirement it proves. No assertion, title or behaviour changed. `prototypes/showdown/progress.test.js` is left untouched so FH-R4.1 stays literally true.
- [x] T9 Focused Node tests re-run after T8 (see the job report).
- [x] T10 Fable decided F1/F2 on 2026-11-19 (PR 148 issuecomment-7031816529): no carryover, bounties unchanged. FH-R7.2 revised; compat A1 flipped and imported as `tests/game/showdown-keepsake-compat.test.js` (14 cases).
- [x] T11 The same ruling settles F3–F5: partial hunts and Frontier cards do not carry, Start over resets Showdown only, save codes exclude keepsakes. FH-R7.3 revised; tested against the reference reset and `savecode.js`.
- [ ] T15 Slice 3: test the graybox Camp's own Start over once it exists (`test.todo` in the keepsake compat test).
- [ ] T12 Add an automated purity check for `src/game/showdown/` (FH-R1.2), if the coordinator wants one. Not done here: it would be a new check, not a citation.
- [ ] T13 Human playtest of the first hour (clarity, fun). Pending, none claimed.
- [ ] T14 Land the Scout fix (`7e8e6eb`) before slice 2, per the PR 147 brief, and re-run the slice 2 checks.
