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
