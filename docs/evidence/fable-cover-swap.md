# Cover swap: a Ride Out variant

November 18, 2026, Pacific. Claude Code (Fable 5.2) built this on `fable/graybox-cover-swap`, based on `64d3849`. It prototypes the untested adjustment suggested in [the Ride Out note](kiro-ride-out.md). It is opt-in. Default matches and current Ride Out matches play as before. No art, model or animation was added. No person has played it yet.

## The rule

Current Ride Out moves one troop into an empty neighbouring lane. The variant also lets the move enter a neighbouring lane that holds a friendly troop, and the two trade places. Both keep their orbs. Everything else is Ride Out as it stands: the move spends the turn's summon, cannot follow a summon or a spell, and a spell may follow it. The Wizard CPU sees the same move through its legal actions and scores it as it scores any ride-out.

**Decision it adds.** Under current Ride Out a troop can leave a bad matchup only by leaving its lane open. The swap lets a player change who faces whom while every lane stays covered.

**Cost.** One sentence of rules ("an occupied lane swaps the two troops") and one more click, because with two troops the player first picks which one moves. No new button, card or allowance.

## Two links, one board

Run `npm run build`, then open `dist/cowboys-vs-wizards-board-duel.html` with one of these address endings:

- Current Ride Out: `?mode=cover-ride`
- Cover swap: `?mode=cover-swap`

Both open on the same position: seed 162 under current Ride Out rules with the Normal CPU playing both sides, stopped at the Cowboy's turn in round six. Restart in the ☰ menu returns to it.

| | Lane 1 | Lane 2 | Lane 3 |
| --- | --- | --- | --- |
| Wizard (Base 3) | Wizard, 4 orbs | Skeleton, 1 orb | empty |
| Cowboy (Base 4) | Sheriff, 2 orbs | Billy, 3 orbs | empty |

The hand is Billy, Billy, Sheriff. The Cowboy acts second this round, so End turn resolves the clash and the previews are exact.

What one turn does, as the page previews it and as the clash then played:

| Choice | Offered on | Cowboy Base | Wizard Base | Troops that fall |
| --- | --- | --- | --- | --- |
| End turn without moving | both | 4 | 3 | your Sheriff, the Skeleton |
| Ride Billy into lane 3 | both | 3 | 1 | your Sheriff |
| Swap the Sheriff and Billy | cover swap only | 4 | 3 | the Skeleton |

After the swap, Billy is on 1 orb facing the Wizard on 2, and the Sheriff is on 1 orb in lane 2. On the current Ride Out link, Ride Out selects Billy and offers only lane 3. On the swap link it asks which troop moves, and Billy can still ride into lane 3. Summoning stays available on both links.

The lane preview for a ride-out now also names the troops that would fall, on both links. Without that, the swap and holding still showed the same two Base numbers. This changes the preview text on existing Ride Out matches when a troop would fall. Default matches have no such preview.

`?mode=match&seed=0&deck=starter&rideOut=swap` plays a full duel from round one with the swap rule.

## What was checked

- **Rules, 13 tests** in `tests/game/cover-swap.test.js`, each case for both factions: the swap trades the two troops and keeps orbs and cards; it shares the summon allowance and cannot follow a spell; only neighbouring lanes swap; a refused swap changes nothing; every listed action is accepted from the state and from the public view; without the flag an occupied destination is still refused; the Normal CPU takes the swap on a board built for it.
- **Board and flow, 4 tests** in `tests/match/cover-swap.test.js`: both links start from the same state apart from the rule; the previews, prompts, cancel, confirm and clash go through the controller and Presenter; the clash log names the swap.
- **The tests catch a broken rule.** Eight deliberate breaks of the rule, the legal list, the public view, the Presenter and the board setup each failed at least one of those tests.
- **All 353 tests** under `tests/game` and `tests/match` pass, and `npm test` exits 0.
- **Unchanged matches.** 1,600 CPU matches (seeds 0–399, Normal and Hard, default rules and current Ride Out rules) produced identical states, legal lists, actions and events under the base commit's `src/game` and this branch's. 73 ride-outs were played in them.
- **Browser.** In headless Chrome on the built page: both links opened on the same status line, Bases, lanes and hand; each choice in the table above ended as previewed; Cancel and Restart restored the board; the swap disabled Ride Out for the turn and left the hand unchanged; the existing `?mode=ride-out` lesson still gave its documented result; a default match showed no Ride Out wording. No page errors.

## Not done

- No balance run. The CPUs can use the swap, but how often they do, and whether it changes winners or match length, is unmeasured.
- One board, chosen because a swap helps there. It was the lowest seed in 0–1499 with a Cowboy turn in rounds one to seven that resolves the clash and where holding loses a troop, every current ride-out costs Base orbs, and a swap saves the troop with the Base untouched.
- The swap is listed once from each of its two troops, so a legal list holds it twice. Both leave the same board.
- Safari and human play.
