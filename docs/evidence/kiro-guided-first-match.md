# Guided first match preview (issue #35)

Work by Kiro CLI 3.4.0 V3 (not Codex, not Rachel) on branch of main `965bd70`. Not pushed, not merged. Specs: `.kiro/specs/guided-first-match/`.

**No human observations are available** for issues #19 and #20 (coordinator checked: no player-note comments). GF-8 is therefore not addressed from player evidence, and no human acceptance is claimed.

## Behavior
Opt-in `?mode=match&deck=starter&seed=0&guide=1`. `src/match/guide.js` (pure) returns one sentence or null from the Cowboy public view, the selection options and a progress record. `cardModel({guide})` appends it after the normal prompt, in the existing `role="status"` prompt element. `src/main.js` wires `?guide=1` and resets progress per match. Stops once round 3 is reached and a Cowboy tribute summon has happened, and at the result. Without `guide=1` nothing is passed, so the prompt is unchanged. `src/ui/cards.js` is unchanged.

## Checks actually run
| Command | Result |
| --- | --- |
| `node --test tests/match/guide.test.js` | 9 tests, 9 pass (after one fix of my own wrong expectation and a test helper missing `revision`) |
| `node scripts/verify-duel.mjs` (once, after the work) | Node suites: 193 tests, 193 pass, 0 fail; GLB structure preflight ran. Final exit status not captured separately (output piped), no failure output seen |
| `node scripts/build.mjs`, then headless Chrome 157.0.8103.52 via DevTools protocol (temporary script, deleted), real mouse clicks, file URL of `dist/` | Guide on and off, seed 0, no console exceptions |

| GF | Evidence |
| --- | --- |
| GF-1 | test "GF-1" lines in order (below); browser prompts match |
| GF-2 | test: one sentence, vocabulary terms present in title-menu/selection/clash-log, lanes and card names match options. Truth rests on the real seed 0 events |
| GF-3 | tests: null after round 2 with tribute summon, continues without it, null at result and Wizard phase, fresh progress on restart. Browser: round 3 idle shows only the normal prompt |
| GF-4 | test swaps Wizard hand and deck: same line; no Wizard card name in any line |
| GF-5 | test: view, options, progress and legal actions unchanged; guide only returns text |
| GF-6 | code check only (prompt element has `role="status"`). **No screen-reader test was run; no announcement claim.** |
| GF-7 | test: prompt equal with guide absent/null/empty at every seed 0 step; browser: guide-off prompts at 10 states, and every guide-on prompt starts with the guide-off prompt. Comparison is between two runs of this build, not against a pre-change build |
| GF-8 | Not addressed; no notes |
| GF-9 | verify-duel above; no art, panel, arrow or animation added |

## Advice lines seen in Chrome (seed 0, guide on)
Prompt text, normal prompt first, guide line second (`browser-guided-prompts.json` has all, and the guide-off runs):
1. Round 1, choose card: "Choose a glowing card in your hand to summon a troop or cast a spell, or end your phase."
2. Lane: "Pick one of your open lanes (lane 1, lane 2, lane 3) for Sheriff."
3. Confirm: "Confirm to summon Sheriff, or cancel to choose again."
4. End phase: "You have no playable card, so end your phase to start the clash."
5. Round 2 start, first clash result: "The round 1 clash: Your Sheriff in lane 1 hit the Skeleton: 3 → 2 orbs (and 1 more event)."
6. Tribute: "Choose 1 of your troops to sacrifice for Billy, then pick a lane."
7. Then lane and confirm lines for Billy, then "You have already summoned this round, so cast a spell or end your phase."
8. Round 3: no guide line.

## Screenshots (1440x900, normal board view, Chrome headless)
`docs/evidence/guided-first-match/`: `1-choose-lane.png`, `2-confirm.png`, `3-tribute-sacrifice.png` (guide line visible in the selection panel), `4-idle-clash-line-panel-hidden.png` (round 2 start). Appearance was looked at for 3 only; no visual acceptance by a human.

## Limits and blockers
- **The prompt sits in the selection panel, which `cards.js` hides when no card is selected.** The idle lines (choose a card, end phase, first clash result) are in the DOM but not visible, as screenshot 4 shows, and hidden content is probably not announced. Fixing it needs a layout/style or `cards.js` change outside this brief's boundary. Decision for the coordinator.
- The guide line repeats the normal prompt's meaning and says "lane" where the prompt says "tile".
- Wording was chosen by this run; the plan listed it as an open decision for Rachel and Alex.
- Only seed 0 route walked in the browser; the optional seeds 0 to 99 check was not built.
- `docs/kiro-build-log.md` not updated (outside the owned files); coordinator to add the entry.
