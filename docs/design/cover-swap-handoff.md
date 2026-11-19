READY

# Cover swap: opt-in Ride Out variant

Claude Code (Fable 5.2), November 18, 2026, Pacific. Branch `fable/graybox-cover-swap`, commit `6389eca` on top of `64d3849`. Local only, not pushed.

## Links

Both open the same round-six board (seed 162). Paste the whole address into the browser's address bar; the ending selects the rule.

- Current Ride Out:
  `fable-cover-swap/dist/cowboys-vs-wizards-board-duel.html?mode=cover-ride`
- Cover swap:
  `fable-cover-swap/dist/cowboys-vs-wizards-board-duel.html?mode=cover-swap`

`dist/` is ignored by git and is built. Rebuild with `npm run build`. SHA-256 of the checked build: `cd6f04c09ed7285e58225af8c311d1b8e1654f92ce9389a20ef0344e67101292`.

## The board and the one-turn difference

Wizard Base 3: Wizard on 4 orbs in lane 1, Skeleton on 1 orb in lane 2. Cowboy Base 4: Sheriff on 2 orbs in lane 1, Billy on 3 orbs in lane 2. Lane 3 is empty on both sides. Hand: Billy, Billy, Sheriff. The Cowboy acts second, so End turn resolves the clash.

| Choice | Offered on | Cowboy Base | Wizard Base | Troops that fall |
| --- | --- | --- | --- | --- |
| End turn without moving | both links | 4 | 3 | your Sheriff, the Skeleton |
| Ride Billy into lane 3 | both links | 3 | 1 | your Sheriff |
| Swap the Sheriff and Billy | swap link only | 4 | 3 | the Skeleton |

On the current link, Ride Out selects Billy and offers only lane 3. On the swap link, Ride Out asks which troop moves; pick the Sheriff, then lane 2, then Confirm Ride Out. Restart in the ☰ menu returns to the board.

## What changed

- Rule: `createMatch(seed, {rideOut: true, rideSwap: true})`. A ride-out may enter a neighbouring lane held by a friendly troop and the two trade places, orbs kept. It spends the summon allowance and follows every other Ride Out rule. The Wizard CPU can use it.
- Graybox: `?mode=cover-ride`, `?mode=cover-swap`, and `?rideOut=swap` for a full duel. No menu entry, art, model or animation was added.
- One visible change outside the swap: a ride-out's lane preview now also names the troops that would fall, on current Ride Out matches too. Without it the swap and holding showed the same two Base numbers.
- Files: `src/game/{actions,lanes,legal,state,view}.js`, `src/match/{clash-forecast,clash-log,presenter,selection}.js`, `src/graybox.js`, new `src/match/cover-swap-lesson.js`, new `tests/game/cover-swap.test.js`, new `tests/match/cover-swap.test.js`, new `docs/evidence/fable-cover-swap.md`.

## Verified

- **Focused rules tests:** `node --test tests/game/cover-swap.test.js`, 13 pass. Both factions for every case: the trade keeps orbs and cards, shares the summon allowance, cannot follow a spell, only neighbours swap, a refused swap changes nothing, every listed action is accepted, and without the flag an occupied destination is still refused.
- **Board and flow tests:** `node --test tests/match/cover-swap.test.js`, 4 pass.
- **The tests catch a broken rule:** eight deliberate breaks (the trade itself, the flag check in both directions, the legal list in both directions, the public view, the Presenter, the board setup) each failed at least one test. All were reverted.
- **Whole suites:** `node --test tests/game/*.test.js tests/match/*.test.js`, 353 pass, 0 fail. `npm test` exits 0. `node scripts/check-links.mjs`, 0 broken.
- **Default and current Ride Out matches unchanged:** 1,600 CPU matches (seeds 0–399, Normal and Hard, default rules and current Ride Out rules) gave identical states, legal lists, actions and events under the base commit's `src/game` and this branch's. 73 ride-outs were played in them.
- **Browser, headless Chrome on the built page, 32 checks, no page errors:**
  - Both links opened on the same status line, Bases, lanes and hand.
  - Current link: Ride Out offered only lane 3. Riding there and ending the turn gave Bases 3 and 1 with the Sheriff lost. Ending the turn without moving lost the Sheriff and the Skeleton.
  - Swap link: the Sheriff could move into Billy's lane. The preview showed both Bases unchanged and only the Skeleton falling. Cancel restored the board. After Confirm the two troops had traded lanes with their orbs, Ride Out was disabled and the hand was unchanged. End turn left Billy and the Sheriff alive on 1 orb each, the Wizard on 2, and the clash log said "Your Sheriff in lane 1 and your Billy in lane 2 swapped lanes".
  - Restart returned to the same board on both links.
  - `?mode=ride-out` still gave its documented lane 3 preview and result. A default match showed no Ride Out wording. `?mode=match&seed=0&deck=starter&rideOut=swap` started at round 1 with the swap note.

## Remaining issues

- No balance run. How often the CPUs swap, and whether it changes winners or match length, is unmeasured.
- No person has played it, and Safari was not tried.
- The links need the address ending. Opening the file from Finder, or with `open` on macOS, may drop it and show the main menu instead.
- A swap appears twice in a legal list, once from each troop. Both leave the same board.
- The browser check and the base-commit comparison are throwaway scripts in `.artifacts/cover-lab/` and are not committed.
