# Review: Camp-edited deck reaches The Bone Fence (K-006, K-034, K-036)

Reviewer: Kiro, native Workflow child `wf-code-reviewer`, child 2 of 2 (workflow `wf_7842c6f41bde684c`), independent of the implementer child `wf-coder` (workflow `wf_0caa098302291536`). Reviewing commit `220cb4e` on `kiro/showdown-deck-to-combat` against base `7fdc234`. Date 2026-11-20 (America/Los_Angeles). Scripted checks only, not a human playtest.

**Verdict: APPROVE.** No blocking findings.

## 1. Scope and hygiene (OBSERVED)

- `git diff --name-only 7fdc234 220cb4e -- src` is empty. The commit changes three files: `scripts/browser-showdown-deck-check.mjs`, `docs/evidence/showdown-deck-to-combat.md` and `docs/kiro-build-log.md`. The diff adds no `window.`/`globalThis` global, no `export` and no `localStorage.setItem`.
- The capture is test-side only: a CDP `Debugger.setBreakpoint` condition that logs `arguments[0]` and the Cowboy deck, then returns false. It records no Wizard deck or hand. The hand it reads is the player's own `#sd-hand` buttons.
- The check uses a fresh `mkdtemp` Chrome profile and asserts `localStorage.length === 0` before Play. Storage is only read through `rawSave()`. The career is entered through `#menu-play`, then the Camp, then `[data-duel=trail]`.

## 2. Build and run (OBSERVED, this review)

- `node scripts/build-graybox.mjs` printed `Built dist/cowboys-vs-wizards-board-duel.html (graybox, build 220cb4eeedfb)`.
- `node scripts/browser-showdown-deck-check.mjs dist/cowboys-vs-wizards-board-duel.html /tmp/rev-deck-*/pos` printed `6 checks passed` and exited 0. Boot Hill and Raven Roost were both won on seed 0. The Bone Fence seed was 3. The logpoint resolved at line 130, column 9379. The career used 89 mouse clicks. Every other step used keys only (step 5 lists them).
- In the built bundle, `secondPlayerCards:` occurs once, inside `function gr(e,{baseOrbs:t=5,first:r,secondPlayerCards:o=hn,decks:s={},…}={}){`. That is the minified `createShowdown` of `src/game/showdown/rules.js:47`, and the logpoint sits at its body entry.

## 3. Independent Node reproduction (OBSERVED; throwaway `/tmp` file, deleted)

Source: `progress.js` (`newSave`, `settle`, `choose`, `deckProblems`, `duelFor`) and `rules.js` `createShowdown`.

- The starting deck is Sheriff 8, Billy 5, Deadeye 3. After the Boot Hill win, the offer is `[covered-wagon, deadeye]` and Covered Wagon is taken. After the Raven Roost win, the offer is `[outrider, deadeye]` and Outrider is taken.
- The default deck is Sheriff 4, Billy 5, Deadeye 3, Covered Wagon 2, Outrider 2. The collection is Deadeye 3, Covered Wagon 3, Outrider 3.
- The edited deck (Sheriff −1, Outrider +1) is Sheriff 3, Billy 5, Deadeye 3, Covered Wagon 2, Outrider 3. It totals 16 and `deckProblems` returns `[]`.
- `duelFor(save, "trail")` at `wins: 2` is **The Bone Fence**. Its `options.decks.cowboy` equals the edited deck.
- `createShowdown(3, options)` gives this Cowboy opening hand:
  - edited deck: `outrider-3, outrider-1, deadeye-3, billy-5`
  - default deck: `outrider-2, covered-wagon-2, deadeye-2, billy-4`
- The two hands differ. Both match the evidence doc. The full dealt Cowboy library (hand plus deck) counts exactly Sheriff 3, Billy 5, Deadeye 3, Covered Wagon 2, Outrider 3.

## 4. Negative controls (OBSERVED, this review)

- `DECK_CHECK_EXPECT=default` exited 1 with `AssertionError: captured {"seed":3,"cowboy":[["cowboy-sheriff",3],…,["cowboy-outrider",3]]}, expected [["cowboy-sheriff",4],…,["cowboy-outrider",2]]`.
- `DECK_CHECK_EXPECT=offByOne` exited 1 with the same capture, against expected `[…,["cowboy-billy",6],…,["cowboy-outrider",2]]`.
- The check discriminates on full per-card equality, not on totals of 16:
  - `capturedIs` compares `JSON.stringify` of the ordered `Object.entries` of the deck passed to the real `createShowdown`, plus the seed.
  - `handIs` compares the exact on-screen hand ids with Node's deal.
  - `captures.length === 1` is asserted.
- INFERRED: a build that ignored the edit would pass the default deck, so `capturedIs(EDITED)` would fail. A build that passed no deck would make the condition throw, so no capture would be recorded and the `captures.length === 1` assertion would fail.

## 5. Cancel and keyboard (OBSERVED)

- After Cancel, the check asserts that the raw stored string is equal before and after (`assert.equal(afterCancel.raw, before)`, 304 bytes), that the Camp lists the old deck, and that focus is on `#camp-build`.
- A later `deepEqual(saved, {...expected, deck: EDITED})` would also catch any cancelled draft leaking into the next edit (INFERRED from the code).
- Recorded keys:
  - Cancel path: Tab ×3, Enter (Build deck); Enter (Sheriff −); Tab ×8, Space (Covered Wagon +); Tab ×5, Enter (Cancel).
  - Save path: Enter (Build deck); Enter (Sheriff −); Tab ×11, Space (Outrider +); Tab ×1, Enter (Save).
  - Reload and launch: Tab ×1, Enter (`#menu-play`); Enter (`[data-duel=trail]`).
- Every key is a CDP `Input.dispatchKeyEvent`. `press()` (the mouse) is called only inside `winTrail`/`playGame`.
- Regression: `node scripts/browser-showdown-keyboard-check.mjs dist/cowboys-vs-wizards-board-duel.html` printed `7 checks passed`.

## 6. Gaps (non-blocking)

- One career path (seed 0 for both wins), one edit and one Bone Fence seed (3). Node chose seed 3 so that the hands discriminate.
- The Trail wins and in-duel play use the mouse. Only the deck edit, cancel, save, reload entry and launch use the keyboard. Escape is not exercised, and the builder has no Escape binding.
- The Bone Fence seed is set through the existing `?seed=` URL parameter on reload. That is an existing page feature, not a save write.
- The build label differs between runs (`7fdc234a59ba` for the implementer, `220cb4eeedfb` for this review) because it is the commit hash. No `src/` difference.
- No human playtest; nothing here supports claims about clarity or fun.
