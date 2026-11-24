# Night Shift saloon: live browser witness of native Kiro hooks

Kiro (native Kiro CLI agent session `native-saloon-live-witness`), November 22, 2026,
21:39–21:46 PST (America/Los_Angeles). Branch `kiro/native-saloon-live-witness`,
base `e1e2d325958b82c5f99e54c4831484901d994508`. Follows the hook-only audit in
`.artifacts/kiro/native-saloon-lifecycle.md` (ignored), which saw native hook records
but no browser, and inferred a 3000 ms poll from source.

## Question

On a fresh loopback page with the live room open (`?saloon=live`), does a fresh Kiro
file operation reach the journal and appear in the Saloon with its actor and phase?
How long from the journal record's `at` to the first visible change? Do the public and
replay views stay free of live data, and does the feed stay free of raw tool input?

## Route used (all existing except the check script)

Kiro write tool → `.kiro/hooks/night-shift-activity.json` → `scripts/saloon-activity.mjs`
→ `.artifacts/night-shift-saloon/activity/` → `GET /night-shift/events` from
`scripts/night-shift-saloon.mjs` (started in-process by the check with `startSaloon`)
→ `src/ui/showdown-3d/night-shift-saloon.js` in the built page
`dist/cowboys-vs-wizards-showdown-3d.html`, entered by Play → Camp → Night Shift saloon.

## Changed behavior

`src/ui/showdown-3d/night-shift-saloon.js`: new `LIVE_POLL_MS = 1000` and pure
`pollDelay(mode, document)`. The live room polls every 1000 ms only while
`document.visibilityState === "visible"`; a hidden page, an unknown visibility state and
any non-live mode wait `POLL_MS` (3000 ms, unchanged). Recorded mode still never polls,
a closed room still stops polling, and `RETRY_MS` (8000 ms) after a failed poll is
unchanged. No visuals, gameplay, labels, recording or tutorial changed.

`scripts/browser-saloon-live-check.mjs` (new): headless Chrome over CDP with a fresh
profile, using the same launcher and client as `scripts/browser-showdown-singularity.mjs`.
Instrumentation added to the page: a fetch wrapper that copies each feed response, and a
MutationObserver on the actor portraits. Latency is the wall time of the animation frame
after the first actor change (stir class or ambient line) following the first poll that
carried the record, minus the record's `at`. The script writes no record to the real
journal.

## Commands and outcomes

1. `node scripts/build-graybox.mjs --diorama`: built at base (`e1e2d325958b`), and again
   after the change (`e1e2d325958b+local`). The rebuilt bundle contains the
   `visibilityState==="visible"` delay function.
2. Baseline, before the change:
   `node scripts/browser-saloon-live-check.mjs .artifacts/saloon-live-witness/baseline --samples 4 --wait 300`.
   READY at 05:41:58.193Z (21:41:58 PST). Kiro then created 4 scratch files with its
   write tool (`fs_write`). Result: **10 of 11 checks passed, 1 failed** (the 2000 ms
   target).
3. `node --test tests/match/night-shift-camp.test.js` after the change: 18 tests,
   18 pass, 0 fail.
4. After the change:
   `node scripts/browser-saloon-live-check.mjs .artifacts/saloon-live-witness/tuned --samples 5 --wait 300`.
   READY at 05:44:39.144Z (21:44:39 PST). Kiro created 5 scratch files with `fs_write`.
   Result: **13 of 13 checks passed** (the pure `pollDelay` case check and the visible
   poll-gap check were added with the change). 0 page exceptions.

The receipts are in ignored `.artifacts/saloon-live-witness/{baseline,tuned}/receipt.json`.
The automatic screenshot is `.artifacts/saloon-live-witness/tuned/saloon-live.png`. The
scratch files are `.artifacts/saloon-live-witness/scratch/{baseline,tuned}-*.txt`; each
holds one harmless token line.

## Native samples (real hooks fired by Kiro's write tool; not synthetic)

Each sample is the `PostFileCreate` record written by the hook for one `fs_write`.
The "shown line" is the Singularity's ambient line in the DOM at the first visible change.

| Run | Record | at (UTC) | Shown line | Journal → poll | Journal → visible |
|---|---|---|---|---|---|
| baseline (3000 ms) | a-5a7d082314f6a97cfbf14a82 | 05:42:12.852 | Singularity sees a tool set back down | 556 ms | 558 ms |
| baseline | a-805949e7722c60cff3c70db0 | 05:42:16.312 | Singularity sees a page get saved | 151 ms | 154 ms |
| baseline | a-cb20f946327e56d1a8741cc7 | 05:42:19.312 | Singularity sees a page get saved | 184 ms | 187 ms |
| baseline | a-0ac69f32edde22fe788aaaf8 | 05:42:22.736 | Singularity sees a tool being reached for | 2814 ms | **2818 ms** |
| tuned (1000 ms) | a-43c2be671229ac46f1cc9498 | 05:44:55.274 | Singularity sees a tool set back down | 824 ms | 827 ms |
| tuned | a-da22c4cac7392b9411067d84 | 05:44:58.543 | Singularity sees a tool set back down | 643 ms | 646 ms |
| tuned | a-654f97dddb8a98b18b274356 | 05:45:01.922 | Singularity sees a page get saved | 351 ms | 354 ms |
| tuned | a-170b943aecdc1268f4975956 | 05:45:04.748 | Singularity sees a tool set back down | 612 ms | 615 ms |
| tuned | a-9582ca63f3e6abcd4ca32174 | 05:45:09.184 | Singularity sees a page get saved | 295 ms | 298 ms |

Every sample stirred the Singularity portrait. The ambient element had a non-zero box
in all 9. Its text equalled the shared `activityLabel` of the actor's newest record in
that poll in 9 of 9.

All records in each window (every phase: PreToolUse, PostToolUse, PostFileCreate,
PostFileSave, one PermissionRequest), journal → visible:
- baseline: 19 records, min 60 ms, median 467 ms, max 2920 ms. Poll gaps 3024–3094 ms.
  Round trip 23–53 ms.
- tuned: 23 records, min 207 ms, median 547 ms, max 1030 ms. 32 poll gaps of
  1027–1132 ms. Round trip 25–128 ms.

The baseline misses came only from the poll interval. The fetch took ≤ 53 ms and
rendering took about 3 ms. The 2818 ms sample waited 2814 ms for the next poll. The
synthetic fixture also took 2440 ms at baseline. After the change, the fixture took 438 ms.

## Public, replay and hidden views

- Loopback page without `?saloon=live`, saloon open 7 s: 0 feed requests, "Recorded Kiro
  shift", "step 0 of 5" (both runs).
- `file:` page with `?saloon=live` (recorded-only): 0 feed requests in 7 s, recorded label
  and the "only plays when the game runs on this computer" note (both runs).
- Hidden page, emulated by overriding `document.visibilityState`/`hidden` in the page
  (CDP has no real tab-visibility switch here): gaps 3029, 3030 and 3031 ms after the
  change. The baseline gaps were 3027, 3028 and 3028 ms.
- Room closed with Back to map: 0 feed requests in 7 s (both runs).

## Raw tool input

Tuned run: in 34 poll bodies, every activity record had only `id, at, kind, actor, phase`.
The run checked 34 canaries: the 9 scratch file names and stems, their token lines,
`fs_write`, `str_replace`, `tool_input`, `toolInput`, `scratch`, `.artifacts` and the home
path. None appeared in the saloon dialog's text, titles or aria-labels, or in any poll
body. The baseline run checked 19 canaries in 10 bodies, also with 0 leaks.

## Fixture (synthetic, labelled)

This sample is separate from the native samples. The check copied the build to a
temporary root, started the same server on it, and wrote one record with `recordActivity`
(hunter/PreTaskExecution). The room showed "Hunter sees a task start" 438 ms after the
record's `at` (2440 ms at baseline). The temporary root was removed. Nothing was written
to the real journal.

## Findings that need a decision (recorded, not chosen)

1. **The file-create phase itself was never on screen.** One write produces PreToolUse →
   PostFileCreate → PostFileSave → PostToolUse within about 0.7 s. The room shows only each
   actor's newest record per poll. The line "Singularity sees a new page appear" therefore
   appeared in 0 of 9 samples. The room showed the same write's later PostFileSave or
   PostToolUse line instead, or in the slow baseline sample the next tool call's
   PreToolUse. Showing every phase, or ranking file phases above tool phases, would change
   the ambient presentation. That decision goes to Fable.
2. **The 2000 ms target has no approved source.** The target comes from the earlier audit
   prompt, and no design doc in this checkout states it. The 1000 ms live poll value was
   chosen as the narrow tuning this assignment allowed. It is not an approved metric.
3. **The ambient line is clipped on screen in the illustrated view.** At 1440×900 the
   screenshot shows "Singularity sees a tool being reac…" (CSS `white-space: nowrap;
   overflow: hidden` for `data-view="3d"`). The DOM holds the full actor and phase line,
   but the visible phase words can be cut off. This comes from one rendered frame, not a
   human review. Changing it would touch approved visuals.

## Limits and remaining blockers

- One machine, one Chrome build, headless, 9 native samples (4 baseline, 5 tuned), one Kiro
  session. The results are estimates under these conditions.
- A record is matched to a write by phase: PostFileCreate fires only on file creation, and
  in this window only Kiro's `fs_write` calls created files. The journal stores no tool name.
- "Visible" means the next animation frame after the DOM change, with a non-zero box for
  the element. It is not a human observation, and the 3D stage's own animation was not timed.
- The hidden-page check uses an emulated visibility state, not a real background tab.
- At 1000 ms, the server reads up to 64 activity files and the patch list each second.
  The round trip stayed ≤ 128 ms. CPU cost was not profiled.
- `docs/kiro-build-log.md` is coordinator-owned and was not updated.
