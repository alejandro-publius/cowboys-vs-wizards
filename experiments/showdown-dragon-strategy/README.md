# Showdown Dragon strategy experiment (evidence only)

EXPERIMENT ONLY. Nothing here changes rules, cards, combat stats, AI, rewards, UX or assets, and nothing in
`src/`, `scripts/`, `prototypes/` or `tests/` imports this folder. All three scripts call the canonical engine in
`src/game/showdown/` unchanged, from pinned main `4d52642575a75c60b1d2337b80c479dd30f2c181`.

| File | Author (Kiro CLI worker) | What it holds |
| --- | --- | --- |
| `wizard.mjs`, `wizard-cases.json` | `kiro/graywave-dragon-lines` @ `ef005e7` | Wizard Dragon checkpoints and their receipts |
| `counter.mjs`, `counter-output.json` | `kiro/graywave-dragon-counter` @ `3077aae` | Cowboy counterplay checkpoints, deck sample |
| `contract.json` | lines worker (was `../graywave-dragon-contract.json`) | shared case contract; sha256 `c1c5a8d4…da33e` |
| `referee.mjs`, `referee-receipt.json` | `kiro/graywave-dragon-referee` | independent re-check and generated properties |

The referee changed `counter.mjs` in one place only: it now reads the committed `contract.json`, not a file outside
the checkout, and records that path relative to the repo. Its stdout is unchanged.

## Commands (from a clean checkout of this branch, Node 22+, no install needed)

```
node experiments/showdown-dragon-strategy/wizard.mjs --write     # rewrites wizard-cases.json receipts; byte-identical
node experiments/showdown-dragon-strategy/wizard.mjs --case hunt5-s1-t6-sweep-target
node experiments/showdown-dragon-strategy/wizard.mjs --scan      # seeds 0-63, both finders
node experiments/showdown-dragon-strategy/counter.mjs            # rewrites counter-output.json; byte-identical
node experiments/showdown-dragon-strategy/counter.mjs --scan 0 19
node experiments/showdown-dragon-strategy/referee.mjs            # rewrites referee-receipt.json; byte-identical
git status --short                                               # empty after all three
node --test prototypes/showdown/rules.test.js prototypes/showdown/contract.test.js   # 29/29, engine untouched
```

## Protocol

- `hunt5`: Graveyard Dragon hunt 5 of 5 from `duelFor` (Wizard level 2, Wizard Base 4, Cowboys first,
  Cowboy deck `deckAfter(6)`). The bounty Dragon `wizard-dragon-0` lands by itself at the start of Wizard turn 4
  with 4 orbs, with no tribute, and rests that turn.
- `open`: both standard `DECKS`, starter from the seed. This is the reference page's two-player table
  (`prototypes/showdown/main.js`, `{decks: DECKS}`). It is not the solo Open range, which uses the player's saved
  deck. The hand Dragon `wizard-dragon-1` needs `summon` with 2 tributes and may attack that turn.
- Policy: the engine's level-2 `planTurn`/`playTurn(state, 2)`. Counter's Cowboy runs `planTurn` on a state rebuilt
  from `viewFor(state, "cowboy")`.
- An alternative line forces only its first actions. The same policy then finishes that turn and the whole game.

## Referee results (`referee-receipt.json`)

| Check | Result |
| --- | --- |
| R1: every prefix replays legally, and each of its turns equals canonical `playTurn(start, 2)` for both seats | 3/3 cases. 5, 4 and 6 turns, all equal |
| R2: both lines start from one state (same full-state hash, same deck order) | 3/3. Hashes `536e4c9b`, `61e1e990`, `8d7d76f1` |
| R2: first action legal; rest of the turn equals canonical `playTurn`; replayed result equals the receipt | 6/6 lines |
| P1: no hidden reads. `planTurn` is unchanged after re-dealing the opponent's hand, deck and traps, the seed and the planner's own deck order | PASS, 1068 re-deals (hunt5 and open, seeds 0-23, turns 2-10) |
| P1 fault injection: a planner that peeks at the opponent's hand | caught, 112 failing states. Shrunk `open s21 t10 → s21 t1 → s1 t1` |
| P2: counter's public-view Cowboy policy compared with the engine planner on the real state | 0 differences in 71 Cowboy states |
| P3: bounty Dragon lands inside `end` with 0 tributes and rests; a hand Dragon is a 2-tribute summon and ready; a Sweep never changes a Base | PASS. 64 games, 32 landings, 10 hand summons, 80 sweep fights (18 with a covered victim) |

P3 also counted 36 Dragon fights where the defender's own overflow reached the Base, and 2 Dragon attacks on a Base,
which never sweep. That overflow is the fight's `baseDamage`. Sweep adds none.

The property's first harness run failed on hunt5 seeds 2, 17 and 19, where the Base lost less than `baseDamage`.
The cause was in the check, not the engine: the Base clamps at 0. The property now compares against
`max(0, base - baseDamage)`.

Referee findings on the worker reports:
- The counter report says its seed-1 Cowboy line differs from the contract because the contract used full-state
  planning. P2 does not support that explanation. On seed 1, turns 1-7, both policies give identical plans.
  The contract line is the policy's own C5 choice: B\*, which attacks the Jack. The counter's Cowboy win on seed 1
  (`--scan`: `A=c9`) is the other C5 choice, hitting the resting Dragon. Both are legal from the same state.
- In `open-s27`, the planner line plays a Raven, which draws one card. The Dragon line does not. Both lines share the
  deck order, so the later draws shift by one card. That shift comes from the choice itself, not from a re-deal.
- Not re-checked: the lines worker's statement that the planner never summoned the Dragon at the 23 open checkpoints.
  The scan reproduces the flips (W→C on seeds 10, 22, 27, 41, 46; C→W on seed 31), and the hunt flips 8 of 23
  (seeds 1, 3, 5, 26, 32 W→C; 12, 47, 51 C→W).

Every result here is one deterministic bot line with fixed draws. None is a forced win, and none says anything
about fun or clarity. Those claims need human playtests.

## Fable decision card: the Graveyard Dragon (hunt 5)

**Line 1, Wizard, `hunt5-s1-t6-sweep-target`, turn 6.** The Wizard sees Dragon 4, Base 2. The Cowboys have
Billy 3 and Sheriff 3, Base 5, and 1 face-down trap. There are 7 legal moves. The policy summons a Raven first in
both lines, then:
- `{attack, slot 0, target 0}`: the Dragon hits Billy and Sweep takes the Sheriff to 2. **Wizard wins on T12.**
- `{attack, slot 0, target 1}`: the Dragon hits the Sheriff and Sweep takes Billy to 2. **Cowboy wins on T11.**

The Sweep orb lands either way. What decides the game is which Cowboy survives at 2 orbs.

**Line 2, Cowboy, `s3-C5-dragon-resting`, turn 5.** The Cowboys have Ranger 2/4 and a Bear Trap set. The
Wizards have the Dragon 3/4 resting and Jack 1/1 in cover. Both lines share the prefix: summon a Dynamiter.
- Ranger attacks the resting Dragon (4→2; Ranger 4→1). The Bear Trap then kills the Dragon on its first swing.
  **Cowboy wins on T15**, with 0 Sweeps.
- B\*, the policy's choice: Ranger attacks the Jack. **Wizard wins on T10.**

**Surprising counterexample, `s18-C5`.** Hitting the resting Dragon with a Ranger 2/3 loses on **T6**. The Ranger dies
to the 3-orb hit-back, and the empty board takes 5 Base orbs in one Wizard turn. Attacking the Skeleton instead
loses later, on T8. So "hit the resting Dragon" only works when the attacker survives the hit-back or a trap is set.
Both conditions are visible to the Cowboy player.

**Rule-change hypothesis: none.** Under these conditions the hunt already offers real choices. One target choice
flipped the result in 8 of 23 hunt checkpoints, and the Cowboy's resting-Dragon choice reverses on visible facts.
The open-table hand Dragon is a different question: the planner did not pick it, and forcing it lost more often
than it won (5 against 1). That question is left to Fable. No balance or wording conclusion is drawn here.
