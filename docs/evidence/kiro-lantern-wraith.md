# Lantern Wraith: the second Wanted boss

Date: 2026-11-18 (America/Los_Angeles). Worktree `kiro/graybox-hand-readability`, base commit `64d3849`. Kiro handed the implementation to the coordinator for integration.

## Attribution

Kiro did the design, implementation and checks in one Kiro IDE agent session (model: Claude Opus 5.5). It used no workflow, subagent, hook trigger, Tripo call, network access or new asset. Kiro ran the card-spec pipeline (`sh scripts/check-card-specs.sh`) by hand. This session did not record a credit figure. The original Dragon hunts are Kiro work from `5b08822`, and Codex integrated them in `72e0beb`. This change leaves both untouched.

## What players see

**Before:** Wanted showed one poster, the Graveyard Dragon. Its five hunts unlocked Captured Dragon. Progress was the total length of `clearedHunts`.

**After:** Wanted shows two posters, each with its own five hunts, progress line and reward. Choose either boss.
- **Lantern Wraith** (Wizard boss: 2 attack, up to 4 orbs, never in a starter deck). During round 1 one Wizard lane carries the Wraith's mark:
  - "Wraith drifts here before the clash", shown as a dashed outline, when the move will happen.
  - "Wraith's marked lane is taken: it holds", shown as a dotted outline, when a troop stands in that lane.
  - The clash preview starts with "The Lantern Wraith drifts from lane X to lane Y first." The clash log reads "Lantern Wraith drifted from lane X to lane Y". The mark disappears after the first clash. The Wraith never moves again.
- Clearing all five Wraith hunts earns **Lantern Snuffer** and unlocks **Captured Wraith**. Build Deck then offers the card and a **Load Wraith Posse** button, which swaps one Sheriff for the Wraith.
- **Captured Wraith:** one copy, 3 stars, no tribute, 2 attack, 2 orbs. It trades the Sheriff's durability (1 attack, 3 orbs) for damage. It also gives the deck another free summon. Billy has the same attack but costs a tribute and has 4 orbs. Captured Dragon hits for 3 but costs a tribute. Each costs a deck slot and adds no rule.
- Dragon hunts, their IDs, Bounty Hunter, Clean Capture, Captured Dragon and Load Dragon Posse behave as before. Clean Capture applies to either boss.

## The rule and its seam

`state.bountyDrift = {round: 1, destination}` exists only on Wraith hunts. `pendingDrift(state)` in `src/game/clash.js` returns the move, or null when:
- the Wraith is gone,
- the marked lane is taken, or
- the marked lane is not adjacent.

`resolveClash` applies the move first through `shiftTroop` and emits the existing `ride-out` event with `drift: true`. The presenter plays that event with its existing move path. The lane mark (`card-model.js`), the clash preview (`clash-forecast.js`), the summon and Deadeye previews and the engine all call this one function. That keeps the telegraph and the outcome identical.

## Exact solutions (lanes as shown, 1-3; the player acts first in round 1)

| Hunt | Board | One-clash solution | Tempting mistake (verified) |
| --- | --- | --- | --- |
| Gallows Lantern (4201) | Wraith 3 orbs, lane 2, marked lane 1. Your Mounted Billy is in lane 2. Base 2. | **Ride Out lane 2 → 1, End turn.** Billy meets the Wraith in its new lane: 3 → 0. | End turn: the Wraith drifts, hits your empty lane 1, and your Base falls 2 → 0. Escaped. |
| Chapel Bell Tower (4202) | Wraith 3, lane 2, marked lane 3, which a 1-orb Skeleton holds. Your Mounted Billy is in lane 2 and lane 3 is empty. Base 1. | **Summon Sheriff lane 3, End turn.** The mark reads "taken: it holds". Your lane-2 Mounted Billy kills the Wraith. | Deadeye the lane-3 Skeleton: this frees the mark, the Wraith drifts into your open lane 3, and your Base falls. Escaped. |
| Ferry Crossing (4203) | Wraith 3, lane 2, marked lane 3, where your Mounted Billy stands. Base 2. | **End turn (hold).** The Wraith drifts into Billy: 3 → 0. Your Base takes the Skeleton's 1 hit. | Ride Out lane 3 → 2: the Wraith drifts away into the lane you left. Escaped. |
| Blacksmith Forge (4204) | Wraith 3, lane 2, marked lane 3, which a 1-orb Skeleton blocks. Your Mounted Billy is in lane 3. Base 2. | **Deadeye Wizard lane 3, End turn.** Clearing the blocker turns the mark into "drifts here". The Wraith moves into Mounted Billy and falls. (Ride Out lane 3 → 2 also wins in one clash.) | End turn: the Wraith holds in lane 2 and hits your empty lane. Escaped. |
| Lamplighter Row (4205) | Wraith 2, lane 2, marked lane 1, where your 1-orb Sheriff stands. A Skeleton faces your lane-3 Sheriff. Base 1. | **Summon Billy lane 1 (tribute lane 1), End turn.** Billy is in the marked lane when the Wraith arrives: 2 → 0. | Summon Billy lane 3 (tribute lane 3): the Wraith survives the first clash and the hunt goes on. |

The exhaustive search in `tests/helpers/hunt-solver.js` shows that no two boards share the same set of winning first turns. Slower two-clash recoveries exist on several boards.

## Repeat and failure reproduction

Open Wanted, choose **Ferry Crossing** and select **Ride Out** lane 3 → 2, then End turn. Result: "The Lantern Wraith escaped. You can take the hunt again." Progress does not change. Choose Replay and play **End turn**: "Bounty captured" and "1 / 5 Lantern Wraith hunts cleared." Replay it and win again: the count stays at 1 / 5.

## Regular duel with the reward

After clearing all five Wraith hunts, open Build Deck, choose **Load Wraith Posse**, then **Save deck**. Load the page with `?seed=15` and choose Play. The Cowboys start with Captured Wraith in the opening hand. **Summon Captured Wraith** into lane 1 with no tribute. The regression test in `tests/game/wraith-bounty.test.js` takes the same route. Before the Wraith clears, Build Deck neither lists the card nor accepts it. A saved deck that contains a locked reward falls back to the starter deck.

## Commands actually run

| Command | Result |
| --- | --- |
| `node --test tests/game/*.test.js tests/match/*.test.js` (baseline at 64d3849) | 336 pass, 0 fail |
| `node scripts/sync-card-specs.mjs`, `sh scripts/check-card-specs.sh` | specs valid, generated file current, card-specs test 3/3 |
| `node --test tests/game/wraith-bounty.test.js` | 7 pass |
| `node --test tests/game/*.test.js tests/match/*.test.js` (after) | 343 pass, 0 fail |
| `npm run build` | built `dist/cowboys-vs-wizards-board-duel.html` (graybox), sha256 `9ea247f8…f92e9` |
| `npm run build:art` | compiled. It writes the same dist path, so `npm run build` was run again last. |

## Independent Safari playthrough

Codex built the Dragon-only baseline from `64d3849` (HTML SHA-256 `ca8e70b8a903a3419dda560a51318c67e1e1daad6c1016b3c12596394901ede1`) and compared the opening states of all five Dragon hunts and normal seeds 0, 59 and 60. The states matched the updated rules.

With Kiro's graybox HTML at SHA-256 `9ea247f83a2b2c609dfe01c74e8e999e0cdeedce83e11ccbd8af21507cef92e9`, Codex played in a fresh Safari private window. The two posters started at 0 / 5. In Gallows Lantern, the accessible lane label and clash forecast both announced the Wraith's move into lane 1. Ending the turn lost the hunt and left progress at 0 / 5. Riding from lane 2 to lane 1 on replay won, and winning a second time left progress at 1 / 5.

Codex cleared the other four boards using the routes above. The Wraith reached 5 / 5 and unlocked Lantern Snuffer while the Dragon stayed at 0 / 5. After a page reload, Build Deck offered Captured Wraith and Wraith Posse. **Load Wraith Posse → Try draft** opened a normal seed-15 duel. Captured Wraith was playable for free and resolved in Cowboy lane 1 with two orbs. This was a manual coordinator replay of the graybox. Human playtest feedback and demo footage are pending.

The coordinator's full suite passed 384 of 387 checks. Three release fixtures could not bind loopback in the coordinator environment. Kiro then ran `node --test tests/assets/build-identity.test.mjs` in the same worktree and passed all seven checks, including those three fixtures.

In a separate IDE session Kiro updated the [bounty-designer profile](../../.kiro/agents/bounty-designer.json) for the shared boss registry. It drafts encounter, reward and art briefs under `tasks/bounties/`. This update configured the draft process. A run through the revised profile and a weekly schedule are still pending.
