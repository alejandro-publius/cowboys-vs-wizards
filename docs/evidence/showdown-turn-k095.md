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

## Later repair (2026-11-20)

The browser Back step originally required the title screen. That held only over `file://`. Over HTTP, Chrome's back/forward cache restores the Camp, and the step failed (overnight-verify Finding 1). The check now also takes an HTTP(S) URL and records which normal entry it saw. It passed 18/18 on file (title) and over HTTP at `/cowboys-vs-wizards/` (Camp, restored by the cache). See [overnight-check-repair.md](overnight-check-repair.md).

## Not done

- Native Kiro Crew browser handoff was attempted (`browser-harness` 0.1.13, Crew's registered harness) and blocked. Alex's running Chrome has no remote debugging enabled (`DevToolsActivePort not found`). Enabling it needs a human approval in Chrome, so it was not forced.
- No Crew recording or video exists (Video 58 / X-033). The only capture is headless-Chrome screenshots from the check script, kept outside the repo.
- No human takeover or human playtest took place.

## Second decision: seed 70 (K-008, 2026-11-20)

Performed by the paired Kiro CLI worker (Claude Opus 5.5) on `kiro/showdown-sprint-paired` from `2fcf39b`, 2026-11-20 America/Los_Angeles. All checks below were run by scripts. No human played it, and no tester feedback exists.

**Source.** Rival case `hunt5-s70-C5-ranger` in `experiments/showdown-dragon-strategy/rival-cases.json` (see `rival-README.md`): the same hunt-5 save, Cowboy turn 5 and C5 picker as seed 3, on held-out seed 70. Landing: Cowboy base 5, Wizard base 4. Ranger 2/4 and Covered Wagon 1/4 against Dragon 3/4 resting and Jack-o'-Lantern 1/1 in cover. No Cowboy trap is set. Fixture outcomes under the same public-information Cowboy policy and unchanged level-2 bot:

- A, Ranger attacks the Dragon: Wizard win on T14 (`w14`).
- B, Ranger attacks the Jack (the policy's own choice): Cowboy win on T17 (`c17`).

These are single deterministic bot lines under fixed draws. They are not forced wins and say nothing about human play.

**Prefix.** The 7 Cowboy actions in `TURNS["dragon-c5-70"]` are the canonical policy's own actions from the fresh deal, from turn 1 to its first turn-5 attack (Sheriff; end; Ranger with the Sheriff as tribute, Deadeye, attack; end; Covered Wagon). They were recorded by rerunning the policy copied from `rival-search.mjs` in a scratch script outside the repo. The same script reproduced the existing seed-3 prefix exactly. No state was assigned or edited. The Node test replays each prefix through the engine alone and checks that the full engine state hash equals the fixture's `atChoiceHash` (`fa80caa710a1` for seed 3, `abbe27d20382` for seed 70).

**Route.** `?turn=dragon-c5-70`, and `#camp-turn-dragon-70` ("Try another Dragon turn") next to `#camp-turn-dragon` in `#camp-experiment`. `?turn=dragon-c5` and its entry are byte-for-byte unchanged. The new lesson text adds no trap, outcome or bounty wording. It is a draft for Fable.

**Checks run (exact results).**

| Command | Result |
| --- | --- |
| `node --test tests/match/showdown-turn.test.js` | 11/11. Allowlist is exactly both ids (near-miss ids refused); both prefixes reach the fixture state hash; seed 70 landing view with hidden zones as counts; seed 70 A gives `{wizard, T14, 0-4}`, B gives `{cowboy, T17, 4-0}`, matching `rival-cases.json`; seed 3 A/B unchanged; retry identical for both ids after either target; neutral-lesson guard |
| `node --test tests/match/showdown-*.test.js prototypes/showdown/rules.test.js prototypes/showdown/contract.test.js` | 69/69 |
| `npm test` | 606/606 |
| `npm run build`, then `node scripts/browser-showdown-turn-check.mjs dist/cowboys-vs-wizards-board-duel.html <out>` | 29/29 in headless Chrome over `file://`. Adds for seed 70: Camp control by mouse; choice A by keyboard; Restart; choice B by mouse; played out; Retry; Back to camp focuses `#camp-turn-dragon-70`; direct URL and reload; near-miss ids open the menu; 375×740 Camp has both controls, no sideways scroll, choice by tap. Saved career byte-identical throughout |
| `node scripts/stage-pages.mjs`, served locally at `http://127.0.0.1:8763/cowboys-vs-wizards/`, same check | 29/29. Back restored the Camp through the back/forward cache, as recorded before |
| `browser-showdown-check`, `-keyboard-check`, `-modes-check`, `-trail-check` on the file build | 22/22, 7/7, 13/13, 16/16 |

As before, the browser "play it out" step only presses End turn after the choice, so those lines lost. The policy-line outcomes are verified in the Node test only.

**For testers (pending, none run).** After a tester plays, open the decision and ask one open question: "What made you choose that target?" Links: seed 3 `https://alejandro-publius.github.io/cowboys-vs-wizards/?turn=dragon-c5` (live); seed 70 `https://alejandro-publius.github.io/cowboys-vs-wizards/?turn=dragon-c5-70` (works only after this branch is merged and Pages redeploys). Locally, use Play, then Camp, then either Experiment control. Do not say which choice the bot line favours before asking.

**Not done.** No human or native Kiro Crew browser run took place. The hosted seed-70 link is unverified until a deploy. No hidden-information re-deal check was rerun for the session itself; `rival-cases.json` records `hiddenReadFree: true` for both cases from `rival-search.mjs`.
