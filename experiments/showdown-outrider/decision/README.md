# One Outrider decision: ride past the troop, or fight it (The Bone Fence)

Kiro search worker experiment. It measures one decision. No card, rule, deck, Trail setting,
bot or save changes. Whether anything here becomes advice or a bounty is Fable's decision.

## Pre-registration (committed before any seed in 1000-1299 was run)

Duel: The Bone Fence, `setup().duel` from `../compare.js` (two-win career deck with 2 Outriders,
Wizard Base 4, Cowboy Base 5, Cowboys first). Wizard: the shipped bot that
`createShowdownSession` runs, `playTurn(state, duel.level)` with level 0. Nothing in it changes.

Cowboy continuation policy (fixed): the Outrider experiment's one-ply greedy, run on
`session.view()` with hidden lists left empty (`simView`), choosing only from `session.legal()`.
Every Cowboy decision, before and after the branch, is made from a fresh `createShowdownSession`
through its public view only.

Branch point: in each fresh deal, the first Cowboy decision where a Ride troop (lowest slot) may
legally strike the Base past standing Wizard troops and may legally attack one of them. The
prefix is every Cowboy action before it (the minimal prefix for that branch). Arms:

- ride: `{type: "attack", slot, target: "base"}`
- fight: `{type: "attack", slot, target: t}`, `t` the first troop target in legal order.

Each arm is a new session opened with the session's own replay (`duel.prefix`, `duel.at`), so
both arms share the same seed, the same shuffle, the same bot and the same position. The run
throws if the two arms' public views or legal actions differ at the branch. After the branch
action both arms continue with the same policy to the end (cap 400 Cowboy decisions).

Ranges (disjoint, fixed): search A 1000-1099 and search B 1100-1199, run by two parallel Kiro
workflow workers; holdout 1200-1299, run once and only after `results/cue.json` is committed.
No seed is dropped or added. Every tried seed is listed with or without a branch.

Pair kinds: `ride-only` (ride wins, fight loses), `fight-only`, `both-cowboy`, `both-wizard`,
`other` (a draw or cap in one arm). A clean reversal is `ride-only` or `fight-only`.

Cue derivation (fixed): over the public numeric cues in `CUE_FEATURES`, both directions and every
threshold seen, the single rule `feature op threshold => fight, else ride` that names the winning
arm in the most clean reversals of A+B (ties: earlier feature, `<=` first, lower threshold).

Holdout support rule (fixed): on 1200-1299 the frozen cue is supported only if there are at least
5 clean reversals, it names the winner in at least 2/3 of them, and in strictly more of them than
always-ride and than always-fight. Otherwise it is reported unsupported. No second holdout.

Controls: (1) branch identity, checked in every pair; (2) determinism: each arm replayed again
gives the same result; (3) same action: ride vs ride gives identical results; (4) the policy's own
choice at the branch is recorded.

Blind reviewer: a named agent (`.kiro/agents/showdown-strategy-reviewer.json`, no tools) receives
only sanitized public boards with neutral labels, run in a separate sanitized workspace. Its
choice and reason are committed before any comparison with outcomes.

## Results (scripted, 2026-11-20 PST, Kiro; bot vs bot, no human play, no browser run)

Wizard: shipped `playTurn` level 0 via `createShowdownSession`. Cowboy: the fixed greedy policy.
Each pair is the same seed, shuffle, bot and branch position.

| range | tried | branch reached | both win | both lose | ride only wins | fight only wins |
| --- | --- | --- | --- | --- | --- | --- |
| 1000-1099 (worker A) | 100 | 62 | 55 | 1 | 2 | 4 |
| 1100-1199 (worker B) | 100 | 62 | 50 | 2 | 5 | 5 |
| 1200-1299 (holdout) | 100 | 60 | 49 | 4 | 5 | 2 |

Clean reversals happen in both directions: 23 in 184 branched pairs (12.5%; 12 ride-only, 11 fight-only) over 300 seeds tried.
At the branch the policy itself chose ride 176 times and another action 8 times.

Cue: the pre-registered derivation on 1000-1199 picked `riderHealth <= 2 => fight`, right in 11 of 16
reversals (always-ride 7, always-fight 9). On the holdout it was right in 3 of 7 (always-ride 5,
always-fight 2), so **unsupported**. Following it won 52/60 holdout branches, against 54 for always
ride and 51 for always fight. No public board cue is proven, and this gives no advice.

Selected cases: all 10 reversals in 1000-1199 at turn 3 or turn 7 (5 ride-only, 5 fight-only).
Labels `case-a` to `case-j` are ordered by a hash of the public view. Seeds are only in
`replay.json`, outcomes only in `results/observed.json`, and no two cases share a public board.

Blind reviewer (`reviewer/RECEIPT.md`, session sess_c01211f2-0841-4c4d-bb6c-65c8c7a9e1b2): it chose
RIDE in all 10, each time reasoning that a 1-attack Outrider cannot kill a 3-orb troop and takes
hit-back damage. Scored afterwards (`reviewer/score.json`): 5/10, the same as always-ride and as always-fight.

Controls (`results/controls.json`, `check.mjs`): every case reopens to the identical public view.
Both arms are legal there, each arm replays identically twice, and ride-vs-ride from two fresh
sessions is identical. All 10 hold. Every pair in the search also asserts branch identity.

Limitations: the reversals belong to this greedy continuation and this level-0 bot. After the branch
the same hidden draws and bot hashes play out differently, so a reversal may reflect downstream
chaos rather than a readable board feature. Only The Bone Fence was tested.

## Commands

    node experiments/showdown-outrider/decision/search.mjs a|b       # one range (workflow workers)
    node experiments/showdown-outrider/decision/check.mjs [--case case-c]
    node --test experiments/showdown-outrider/decision/decision.test.js
