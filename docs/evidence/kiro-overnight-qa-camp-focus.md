# Overnight QA: Camp return focus with a card offer open (graywave overnight-qa)

Date: 2026-11-19, about 23:40 PST (America/Los_Angeles). This was a Kiro agent session using Claude Opus 5.5 on Alex's Mac, with kiro-cli 3.5.0 installed; the session metadata names the client as Kiro IDE. Branch `kiro/graywave-overnight-qa`, base `db80cd0`. Every run was a bot driving native headless Chrome over the DevTools protocol (Input.dispatchKeyEvent and mouse events). No human played. Nothing here supports any claim about clarity or fun.
Spec: [`.kiro/specs/showdown-camp-return-focus/bugfix.md`](../../.kiro/specs/showdown-camp-return-focus/bugfix.md). I wrote it by hand in Kiro's bugfix layout. It did not come from a native Kiro bugfix-spec run.

## Defect: public actions, expected, actual

| Step (fresh profile, `?seed=0`) | Expected | Actual on base `db80cd0` |
| --- | --- | --- |
| Keyboard: Play, Boot Hill, win | result offers 2 cards | as expected (Covered Wagon, Deadeye) |
| Enter on "Back to camp" without choosing | focus on first offered card | focus on `#camp-home` (Main menu) |
| Enter again | still in Camp | title screen shown, Camp hidden |

A rival win (the Stargazer, post-Trail fixture) did the same before the fix: focus went to `#camp-home`. After the fix it went to the offered card.

## Red and green

- Base build sha256 `60166523…fe7afd`. `browser-showdown-keyboard-check.mjs` with new step 4b: the first 4 checks pass, then it fails with `Back to camp with an offer open focuses the first offered card, not #camp-home`.
- Fixed build sha256 `a3fe84c4…d4bbf` (one statement in `src/app.js` `toCamp`): keyboard 7/7, trail 16/16, modes 13/13, main graybox check 22/22, `npm test` 578 pass and 0 fail. No page errors.

## Other paths probed (temporary probe, not committed)

These were observed the same way before and after the fix:

- Builder Cancel by Enter returns focus to `#camp-build`.
- Opening the between-games swap by Enter focuses the first row button.
- A Camp duel started by Enter, solo or two players (curtain up), leaves focus on `body`; the next Tab reaches `#sd-home`. Saving the best-of-three swap by Enter also leaves focus on `body`. This is open and was not changed. Whether a new duel or the curtain's "I'm ready" should take focus is a presentation decision. The earlier focus work (`kiro-graywave-focus.md`) tabbed into the hand at this point.
- Report data: each playtest line holds only the duel name, win, turns, seconds, whether the rules were opened, the duel id, the deal seed and a random run id (`src/match/showdown-playtest.js`). It holds no name, device or browser data. Two-player games write nothing (modes check: storage byte-identical).
