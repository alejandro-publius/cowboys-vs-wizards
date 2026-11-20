# Issue 143 slice 2: browser acceptance for the Camp and Trail

Kiro CLI (claude-opus-5.5) worker `accept`, November 19, 2026 (America/Los_Angeles). Branch `kiro/graywave-accept`, base `24dd11c`. This note covers the check only. No runtime file was changed.

## What was added

[`scripts/browser-showdown-trail-check.mjs`](../../scripts/browser-showdown-trail-check.mjs) runs headless Chrome with a fresh profile per run. It serves the built page from a loopback HTTP server and drives it with CDP mouse presses on visible, enabled, topmost elements only. The page gets no test hook.

- **Run A, new player** (brief slice 2, done-when 3). The player starts from normal entry, clicks Play, and the Camp opens. The script wins Boot Hill, takes the first offered card, wins Raven Roost, reloads with the second offer unclaimed, takes the second card in Camp, and reloads again. Then the Trail tiles, the deck and collection text, and the stored progress must equal the reference `prototypes/showdown/progress.js` result of newSave → settle → choose(offer[0]) → settle → choose(offer[1]). Finally the script opens The Bone Fence and leaves it, and the stored progress must not change.
- **Run B, lane veteran** (done-when 2, on screen). The script writes `cvw-player-v1` with the real lane store (`createProfileStore().recordBounty` for all five Graveyard Dragon hunts) on a blank page of the same origin. This happens before the game is ever loaded, and no Showdown progress is seeded. After a normal load, the lane key must be byte-identical, the Camp must name Captured Dragon after "Collection:", the Trail must be at duel 1, and the deck must be the plain starter. The script then wins Boot Hill and reloads. Covered Wagon must be paid, Captured Dragon must still be named, and the lane key must still list the five hunts.

The script looks up the progress key in storage instead of hard-coding it. The DOM hooks it expects are listed in its header comment.

## Runs (observed)

| Build | Result |
| --- | --- |
| Old baseline `24dd11c` (sha256 `2d60da31…`) | Fails in both runs at "Timed out waiting for the Camp after Play", as expected. |
| Uncommitted camp worker tree copied to /tmp on 2026-11-19 21:08 PST (sha256 `cf8e506d…`; not a commit) | Run A: all 12 checks pass. Boot Hill and Raven Roost were each won on the first attempt with `?seed=0`, in 91 clicks. Run B fails at "collection names Captured Dragon", because that Camp does not show lane captures yet. The later Run B steps were not reached. |

## Pending

- The coordinator should run the check on the combined branch. That run is the first that can exercise all of Run B.
- Lane-capture display waits on Fable F1/F2 (`laneCapturedCards` exists on `kiro/graywave-saves`, and the Camp does not use it yet).
- Human playtests are pending. This check is a bot driving the browser and says nothing about clarity or fun.
