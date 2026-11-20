# K-095 experiment turn: one Dragon decision, playable from Camp (overnight-turn worker)

**Status:** experiment for Fable's review. It is not a bounty, and no rule, card, reward, wording ruling or Scout change was made. It was performed by a Kiro CLI worker (Claude Opus 5.5) on `kiro/graywave-overnight-turn`, 2026-11-19 America/Los_Angeles. All checks here were run by scripts. No human played it.

## Source decision

Counter checkpoint `s3-C5-dragon-resting` in `experiments/showdown-dragon-strategy/counter-output.json` on `kiro/graywave-dragon-referee` (`d264466`). Setup: Graveyard Dragon hunt 5, seed 3, Cowboy turn 5. The Cowboys have Ranger 2/4 and the shared Dynamiter, with a Bear Trap set. The Wizards have Dragon 4 orbs resting and Jack-o'-Lantern 1/1 in cover. Referee outcomes under the public-information Cowboy policy:

- A, Ranger attacks the Dragon: Cowboy win on T15, bases 2-0.
- B, Ranger attacks the Jack (the policy's own choice): Wizard win on T10, bases 0-3.

The canonical engine has not changed since the referee's base `4d52642` (`git diff` shows only `savecode.js` and the session's two-player code).

## Route

- Direct URL: `?turn=dragon-c5`. Only ids in `TURNS` (`src/match/showdown-turn.js`) open. Any other value leaves the normal main menu.
- Camp: Play, then `#camp-turn-dragon` in `#camp-experiment`. `src/app.js` appends it, so `showdown-camp.js` is unchanged.
- The decision is played on the normal Showdown screen. `#sd-restart` retries during the turn, `#sd-again` ("Retry") retries after the result, and `#sd-home` or `#sd-camp` return to Camp.

## How it is safe

The URL carries only an allowlisted id, never actions or JSON. `createShowdownSession` replays the 7 recorded Cowboy actions from a fresh `createShowdown(3, hunt-5 options)`. It checks each action against `legalActions`, and the unchanged level-2 bot plays the Wizard turns. If the replay does not land on Cowboy turn 5, the session refuses to open. The screen still reads only `viewFor(cowboy)`. A `turn` duel skips `campaign.settle` and the playtest line, so saved progress is never written.

## Checks run (exact results)

| Command | Result |
| --- | --- |
| `node --test tests/match/showdown-turn.test.js` | 6/6. Allowlist; landing equals referee `atChoice`; A reaches `{cowboy, T15, 2-0}`; B reaches `{wizard, T10, 0-3}`; retry is identical; tampered prefix refused |
| `node --test tests/match/showdown-*.test.js prototypes/showdown/rules.test.js prototypes/showdown/contract.test.js` | 64/64 |
| `npm test` | 584/584 |
| `npm run build`, then `node scripts/browser-showdown-turn-check.mjs dist/cowboys-vs-wizards-board-duel.html <out>` | 18/18 in headless Chrome. Camp control by mouse; choice A by mouse; Restart; choice B by keyboard only; result shows Retry with no reward or grit; Retry; Back to camp returns focus to the control; direct URL; reload; browser Back; non-allowlisted `?turn` values; 375×740 with no sideways scroll; saved career byte-identical throughout; no page errors |
| `browser-showdown-check`, `-keyboard-check`, `-modes-check`, `-trail-check` on the same build | 22/22, 6/6, 13/13, 16/16 |

In the browser runs, the "play it out" step only presses End turn after the choice, so both of those lines lost. The policy-line outcomes are verified in the Node test, not in the browser.

## Not done

- Native Kiro Crew browser handoff was attempted (`browser-harness` 0.1.13, Crew's registered harness) and blocked. Alex's running Chrome has no remote debugging enabled (`DevToolsActivePort not found`). Enabling it needs a human approval in Chrome, so it was not forced.
- No Crew recording or video exists (Video 58 / X-033). The only capture is headless-Chrome screenshots from the check script, kept outside the repo.
- No human takeover or human playtest took place.
