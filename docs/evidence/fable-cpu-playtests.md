# Job D: deterministic CPU, match runner and bounded playtests

Work by Fable (Claude Fable 5.2, Claude Code worker), 2026-11-15, on branch
`fable/cpu-playtests`, built on job C (`docs/evidence/fable-match-engine.md`). Not
Kiro or Codex work. No engine rule or API was changed. No engine bug was found.

**These are bot-against-bot results. They are not proof of balance or fun, and a
random Cowboy is not a human.** They show that matches finish, which cards the
heuristic plays, and which patterns its own play produces. Code:
`src/game/cpu.js` (`chooseAction(view)`), `scripts/play-match.mjs` (trace, and the
runner `playMatch(seed, bots)`), `scripts/simulate-matches.mjs`, 8 tests in
`tests/game/cpu.test.js`. Reports and traces: `docs/evidence/cpu-playtests/`.

## Heuristic

One clash of lookahead, no search, no opponent model. An action is scored by the
position it would leave after the next clash if the opponent added nothing more:
- +5 per own base orb left, −4 per enemy base orb left (an even block beats an even race);
- +1000 if the enemy base would be at zero, −1000 if its own would be;
- plus the worth of each own surviving troop, minus each enemy surviving troop,
  where worth = 2 × attack + remaining health.

Order within a phase (the engine forbids a summon after a spell):
1. the best summon, if it scores strictly higher than ending the phase now, so a
   tribute is paid only when the new troop, lanes included, is worth more;
2. else the best spell, if it gains at least 3 over ending now: a kill, a kill set
   up for this clash, or a Singularity move that changes base damage (one point
   of chip damage alone gains 1 and is held back);
3. else `end-phase`.

Ties go to the action `legalActions` lists first (hand order, then slot). A phase
is at most three actions and a match at most 54 (the runner throws beyond that).
The weights are the first values written; no tuning run was made. It works for
either side and returns `null` when it has no legal action. `random` (scripts
only) picks uniformly among legal actions, `end-phase` included, with a mulberry32
generator seeded from the match seed and the side.

## Commands and results

Node v26.0.0, from the repository root. All exit codes 0 unless stated.

| Command | Result |
| --- | --- |
| `node --test "tests/game/*.test.js"` | 38 tests, 38 pass, 0 fail (30 existing, 8 new) |
| `node scripts/play-match.mjs --seed 14` | exit 0, 21 lines |
| `node scripts/play-match.mjs --seed x`, `node scripts/simulate-matches.mjs --count 20000` | exit 2, usage on stderr (count cap is 10,000) |
| `node scripts/simulate-matches.mjs --from 0 --count 20 --cowboy cpu --wizard cpu` | smoke, 0.09 s wall |
| `node scripts/simulate-matches.mjs --from 0 --count 1000 --cowboy cpu --wizard cpu --out docs/evidence/cpu-playtests/cpu-vs-cpu-seeds-0-999.json` | run A, 0.76 s wall |
| `node scripts/simulate-matches.mjs --from 0 --count 1000 --cowboy random --wizard cpu --out docs/evidence/cpu-playtests/random-cowboy-vs-cpu-wizard-seeds-0-999.json` | run B, 0.46 s wall |

Both runs: seeds 0–999, rules `orb-duel-draft-1`, every match finished within the bound.

| | Run A: CPU vs CPU | Run B: random Cowboy vs CPU Wizard |
| --- | --- | --- |
| Cowboy wins / Wizard wins / draws | 425 / 472 / 103 | 29 / 945 / 26 |
| Cowboy starts (480): Cowboy / Wizard / draw | 270 / 159 / 51 | 17 / 458 / 5 |
| Wizard starts (520): Cowboy / Wizard / draw | 155 / 313 / 52 | 12 / 487 / 21 |
| Winner acted first / second in the final round | 262 / 635 | 363 / 611 |
| Base destroyed / round limit | 819 / 181 | 995 / 5 |
| Final round 3, 4, 5, 6, 7, 8, 9 | 31, 26, 55, 183, 198, 218, 289 | 233, 393, 221, 81, 39, 19, 14 |
| Actions per match: min / mean / max | 9 / 31.99 / 40 | 9 / 18.45 / 40 |
| Opening hand with no free summon: Cowboy / Wizard / starting side | 23 / 40 / 35 | same seeds, same hands |
| Starting side with no free summon: won / lost / drew | 0 / 35 / 0 | 12 / 20 / 3 |
| Second side with no free summon: won / lost / drew | 1 / 27 / 0 | 7 / 21 / 0 |
| Sheriff / Billy / Mounted Billy summons (matches) | 4850 (999) / 2194 (955) / 191 (191) | 2235 (987) / 1104 (743) / 146 (146) |
| Skeleton / Wizard / Dragon summons (matches) | 4792 (1000) / 2218 (964) / 200 (200) | 3048 (1000) / 1137 (819) / 144 (144) |
| Deadeye / Singularity casts (matches) | 1433 (889) / 1513 (909) | 1056 (785) / 755 (589) |

## What was observed, and likely causes

- **No free summon in the opening hand loses.** In run A, 62 of 63 such hands lost
  (all 35 on the starting side): tribute troops and spells cannot act on an empty
  board, so that side passes while the other adds a troop each round. Both decks
  have 6 free troops of 12, so the chance is 15/495, about 3% per side; 23 against
  40 is variation over these seeds.
- **The side that starts round 1 wins more: 583 against 314** (run A). The winner
  acted second in the final round in 635 of 897 decided matches: the second actor
  sees the opponent's summon before the clash, and the round-1 starter acts second
  in rounds 2, 4, 6 and 8. Rules and heuristic (it never plans for the reply) are
  not separated here.
- **Wizard 472, Cowboy 425.** Wizard started 520 of these seeds and does a little
  better in both seats (as starter 313/520 against 270/480). Singularity's move is
  the only difference between the sides that the CPU uses. Not tested further.
- **Higher tiers enter play**: Billy and Wizard in about 96% of matches; Mounted
  Billy and Dragon (one copy, two tributes) in 191 and 200 of 1,000.
- **18% of CPU matches reach the round cap**, 10% are draws: mirrored blocking trades evenly.
- **Run B is one-sided (945 wins).** The random Cowboy ends its phase as readily as
  it summons, so it often skips its summon; 626 matches end by round 4.

## Traces (`docs/evidence/cpu-playtests/trace-seed-<n>.txt`, CPU vs CPU)

- **14**: Cowboy starts with three Billys and Mounted Billy and must pass; it draws
  a Sheriff in round 2, already at 4 orbs. Wizard wins in round 3 (11 actions) by
  sacrificing a Skeleton for a Wizard in an open lane.
- **27**, **47**: Wizard starts with no Skeleton against three Sheriffs, passes
  rounds 1 and 2, takes 1 then 2 damage, summons its first Skeleton in round 3 and
  loses that round (10 actions; both traces have the same actions).
- **17**: round-limit draw, 40 actions, 4 orbs each: mirrored blocking, and damaged
  Wizards and Billys replaced by fresh copies in the same lane.
- **19**: both bases destroyed in round 6, a draw by simultaneous clash.

## Hidden information

The CPU reads its own hand, both boards and both base counts. At every decision of
CPU-against-CPU matches on seeds 0–49 (over 1,000 points) the test builds a second
full state with the opponent's hand refilled from the opponent's deck (same counts)
and both deck orders reversed, and requires the same decision. Another test plays
seeds 14, 27 and 47 through the runner with a spy bot that must receive only the
public view keys (no `seed`, `rng`, `actionIds`, deck or opponent hand).

Sanity check, one bounded pass: the test helper leaked the full `sides` into the
view and the CPU ended its phase when the opponent's hand held a spell. Result: 5
pass, 3 fail of the 8 CPU tests; the hidden-information test failed on its decision
assertion at `seed 0 revision 0` (two fixture tests sharing the helper failed too).
Both files were restored from backups, compared byte for byte; rerun 38 pass, 0 fail.

## Limitations

1. One clash ahead only: the first actor assumes the opponent adds nothing, and
   nothing is planned for later rounds, the hand or the deck.
2. The summon is chosen before the spell is considered, so a spell kill that would
   open a better lane for the summon is not found.
3. A spell is still cast for a troop kill in the last round, though only bases decide.
4. Replacing a damaged troop with a copy of itself is legal and the CPU does it
   often; whether it should be legal is a rules question, not changed here.
5. Weights are untuned: an opponent for a first playable, not a strength benchmark.
