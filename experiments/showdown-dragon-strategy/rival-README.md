# Rival: held-out counterexample to the seed-3 C5 Ranger claim (evidence only)

EXPERIMENT ONLY. This changes no rules, cards, AI, rewards, wording or assets. Existing experiment files are read
and left unchanged. `rival-search.mjs` calls the canonical engine in `src/game/showdown/` without changes. Fable
owns any design reading of this.

| File | What it holds |
| --- | --- |
| `rival-search.mjs` | The held-out search, the hidden-information check and the shrink |
| `rival-cases.json` | The receipt: summary, one row per seed, and replayable fixtures for seed 3 and the shrunk case |
| `rival-crew-receipt.json` | The Crew Bot memory and check-in receipt: what ran, where, and what it observed |

```
node experiments/showdown-dragon-strategy/rival-search.mjs   # rewrites rival-cases.json; byte-identical on rerun
git status --short                                           # empty afterwards
```

## Claim under test

This is the `s3-C5-dragon-resting` checkpoint from `counter.mjs`, also Line 2 of the decision card in `README.md`.
The setting is hunt 5, seed 3, Cowboy turn 5. The Cowboys have a Ranger 2/4, a Dynamiter and a Bear Trap set. The
Wizards have the bounty Dragon 3/4, resting, and a Jack-o'-Lantern 1/1 in cover.

- Ranger attacks the Dragon: **Cowboy wins on T15**.
- Ranger attacks the Jack (the policy's choice): **Wizard wins on T10**.

The README's condition for the claim: hitting the resting Dragon works when the attacker survives the hit-back or a
trap is set.

## Protocol

- Held-out seeds are 64-127, run in ascending order. Every earlier script used seeds 0-63.
- Both seats use the same policies as `counter.mjs`. The Cowboys run `planTurn` on a state rebuilt from
  `viewFor(state, "cowboy")`, copied verbatim. The Wizards run the unchanged `playTurn(state, hunt level)`.
- Each pair uses the same C5 picker as `counter.mjs`. A is the first legal attack on the bounty Dragon. B is the
  first legal attack on the Base or on another troop. Both lines start from one reachable state, after the policy's
  own card plays that turn.
- The search records the state hash, checks that both moves are legal, and runs a no-hidden-reads check. That check
  re-deals the Wizard hand, deck and traps and the Cowboy deck order 3 times and confirms the prefix, A and B do not
  change.
- A seed counts as a counterexample when the claimed condition holds, A loses and B wins.
- One deviation from `counter.mjs`: the planner does not re-plan after a forced move has already ended the game.
  Held-out seeds hit this case, and the old harness would crash on it. Seeds 0-19 never hit it.

## Results (`rival-cases.json`)

- Pairs tested: 60 of 64. Four seeds (83, 85, 93, 106) had no bounty Dragon on the board at C5.
- Every pair passed: both moves legal, and no hidden reads.
- Wins: A won 30 times and B won 32. The two choices gave different winners on 20 seeds.
- The claimed condition held on 48 pairs, and A won 27 of them.
- Counterexamples: 64, 70, 80, 82, 87, 95, 105, 111, 113, 119 and 122.
- The seed-3 reference, rebuilt by this script, gives the same results as `counter-output.json` (`c15`, `w10`).

**Shrunk counterexample: seed 70.** The shrink keeps the case with the fewest visible differences from the seed-3
position, then the lowest seed. Seed 70 has 3 differences. Every other counterexample has 5 or more.

| | Seed 3 | Seed 70 |
| --- | --- | --- |
| Cowboy board | Ranger 2/4, Dynamiter 3/1 | Ranger 2/4, Covered Wagon 1/4 |
| Wizard board | Dragon 3/4, Jack 1/1 cover | Dragon 3/4, Jack 1/1 cover |
| Cowboy trap set | Bear Trap | **none** |
| Wizard Base | 3 | 4 |
| Ranger → Dragon | Cowboy T15 | **Wizard T14** |
| Ranger → Jack | Wizard T10 | **Cowboy T17** (the policy's choice) |

At seed 70 the opposite choice, attacking the Jack, wins. The visible difference that matches the claim's own
mechanism is the trap. On seed 3, the Bear Trap finishes the Dragon on its first swing after the Ranger damaged it.
On seed 70 no trap is set, the damaged Dragon (3/2) survives, and the Ranger is left at 1 orb.

The held-out rows support that split, though they do not prove it. Take the held-out pairs where a Ranger attacks the
Dragon and survives the hit-back:

| Cowboy trap | Pairs | A wins | A loses and B wins |
| --- | --- | --- | --- |
| set | 5 | 5 | 0 |
| not set | 11 | 5 | 2 (seeds 70, 105) |

No held-out seed matches the full seed-3 profile (Ranger survives and a trap is set) while A loses. The search
therefore found no direct reversal under identical visible conditions. Seed 70 also differs in the second Cowboy
troop and the Wizard Base. Reachable positions alone cannot isolate the trap as the single cause. Testing that would
need an edited, unreachable state, so this run does not do it.

These are estimates from one deterministic bot line per seed under fixed draws. None is a forced win, and none says
anything about clarity or fun, which need human playtests.

## Crew Bot memory and check-in (`rival-crew-receipt.json`)

- **Native, worked.** A real Kiro Crew Bot, `overnight-rival`, has its own memory store. It saved this claim to that
  store as 3 lessons keyed `rival-claim-s3-c5`. Its thread context was then cleared. After the reset it retrieved
  the claim with `memory_recall` and restated it correctly.
- **Native, blocked.** One Daily Goal Reminder was armed for 23:42 PST, but it never started a turn. Manual
  triggers returned `409 job is already running`, and no run record was written. The one check-in that ran was a
  message sent to the Bot's standing thread on Alex's behalf. It was not the scheduled reminder.
- Every check-in switch is off now. The Bot, its memory and its goal are kept.
