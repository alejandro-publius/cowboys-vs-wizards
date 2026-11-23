# Night Shift saloon: tasks

Implements [design.md](design.md). Tick an item only after its check actually
ran. Environment for the runs below: native Kiro CLI 3.5.0 V3,
`--model claude-opus-5.5`, Node 26.0.0, Apple Git 2.39.5, on 2026-11-22
(Pacific). Apple Git 2.39.5 predates `GIT_NO_LAZY_FETCH`, so on it only
`protocol.allow=never` blocks a lazy fetch.

## Implementation

- [x] 1. Event contract and saloon view in `src/ui/showdown-3d`, opened from
  the illustrated Camp. _Requirements: 1, 3.3–3.5, 5, 7_
- [x] 2. Durable best-effort journal with separate event and activity boards.
  _Requirements: 2.6–2.7_
- [x] 3. Headline hook call sites: `job`, `block`, `cast`, `wanted` (via
  `task_update` only), `bell`. _Requirements: 2.1–2.5_
- [x] 4. `.kiro/hooks/night-shift-activity.json` binding 14 automatic V3
  phases. _Requirements: 1.6_
- [x] 5. Morning patch notes [`scripts/saloon-patches.mjs`](../../../scripts/saloon-patches.mjs)
  and tests [`tests/match/night-shift-patches.test.js`](../../../tests/match/night-shift-patches.test.js).
  _Requirements: 4, 5.2_
- [x] 6. Loopback server `scripts/night-shift-saloon.mjs`. _Requirements: 3.1–3.2_
- [x] 7. Recording `src/ui/night-shift-recording.json` from a real capture.
  _Requirements: 6_

## Verification

- [x] Focused saloon tests: 73/73 passed. Includes temporary-Git patch tests
      (true merge under its merge hash, unmerged candidate absent).
- [x] Main `9ce9e16`: zero qualifying existing-card stat changes.
- [x] `job`: a successful fenced preparer reset issued a job.
- [x] `block`: the product-fence guard denied a harmless out-of-scope file
      attempt; no file was written.
- [x] `cast`: the production showdown-balancer changed scratch
      `cowboy-billy.attack` 2 → 1; the original stayed 2.
- [x] `wanted`: native `/spec run wanted-lantern-wraith` completed a disposable
      verification task naming the existing drafted Lantern Wraith and pinned a
      Wanted poster.
- [x] `bell`: a real Stop confirmed a passing gate stamp that checked fast-check
      G1–G4 at seed 23820 ×60 each, verify-duel, deck-balance
      `--decks 1 --from 0 --count 4`, plus the native trace.
- [x] Recording: 5 sorted headline events and 25 real ambient samples,
      2026-11-22T23:53:59Z to 2026-11-23T00:05:31Z; 8 of 14 bound phase types.
- [x] Live mode in a browser on the same origin worked and stopped polling on
      close.
- [x] WebGL-off portrait mode: keyboard replayed all 5 events; no feed requests.
- [x] `?saloon=live` off loopback stayed recorded: on a simulated non-loopback
      HTTPS origin in Chromium, the real bundled page replayed the 5 recorded
      actions and issued zero feed requests.
- [x] Reduced-motion pass: both mobile runs used
      `prefers-reduced-motion: reduce`.
- [x] Focus returned to the opener on close: at 1280×800, 390×844 and
      320×740, the keyboard stepped all 5 real events and Escape returned
      focus to the Camp button.
- [x] Mobile pass: no horizontal overflow; dialog clientWidth/scrollWidth was
      354/354 at 390×844 and 284/284 at 320×740.
- [x] Live reader: with the real localhost reader open, a new native Kiro
      PreToolUse fence refusal appeared without reload. The Sheriff acted, the
      Ledger count went 2 → 3, and the refused marker stayed absent.
- [x] Suites at the first integrated revision: 734/734 game tests, 4/4 Kiro
      Power, 29/29 Night Watch. The PR reports the counts for its final
      revision.

## Human review

- [ ] Playtest notes on clarity of the four miniatures and the ambient lane.
