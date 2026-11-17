# T1 trap playtest seed kit (issue #120)

**Experimental, synthetic, local only.** A deterministic list of six seeds for a person to try later in the local [trap placeholder lab](../trap-placeholder/README.md) with the T1 scenario (12 cards per side: one spell and one anonymous synthetic trap). It approves no trap card name, copy count, deck, art, 3D model, animation or audio. No human has played these seeds for this kit. The kit holds no observations, results or win rates.

## Print the plan

```sh
node experiments/trap-playtest-kit/run.mjs
node experiments/trap-playtest-kit/run.mjs --out experiments/trap-playtest-kit/seed-plan.md
```

The first command prints Markdown to stdout and writes nothing. Only `--out <path>` writes a file, with the same bytes as stdout. The committed [seed-plan.md](seed-plan.md) is that output, and the test checks they match byte for byte.

## How seeds are picked

[seeds.js](seeds.js) is pure and browser-safe: no clock, random source, storage, network, DOM or `node:` import. For each seed 0 to 9999, it reads the Cowboy's T1 order from `openingFor(seed, "T1")` in [scenarios.js](../trap-placeholder/scenarios.js). It also builds `createMatch(seed)` (BASE) and requires the same starting side, active side and rng, 12 cards per side, and every ID of both sides at its BASE position. The only change allowed is spell copy 2 relabelled to the synthetic trap.

Position is the index in the shuffled 12-card deck. Positions 0 to 3 are the opening hand. Position p (4 to 11) is drawn at the start of round p - 2, one draw per side per round from round 2. That is when the card would arrive if the match is still going. It is not a draw seen in a played match.

| Cat | Rule (Cowboy T1 positions) | First side |
| --- | --- | --- |
| A | trap and remaining spell both at 0-3 | Cowboy |
| B | trap at 0-3, spell at 4-11 | Wizard |
| C | spell at 0-3, trap at 5 or 6 (round 3 or 4) | Cowboy |
| D | trap at 6 or 7 (round 4 or 5), spell anywhere | Wizard |
| E | trap at 10 (round 8; set then, it arms only for the round 9 clash) | Cowboy |
| F | trap at 11 (round 9, where setting is rejected as `trap-too-late`) | Wizard |

Categories are filled A to F in order. Each takes the lowest seed that passes its rule, starts with the fixed side above and is not already picked. The fixed sides give exactly three Cowboy-first and three Wizard-first seeds. C and D overlap when the trap is at 6 with the spell in the opener; the plan lists every category a seed matches. The optional T2 example, separate from the six, is the lowest seed with both Cowboy T2 traps in the opening hand.

The plan lists only Cowboy positions. It never prints the Wizard's deck order or trap position, which are hidden during play.

## Running one seed in the lab

1. Serve the repository root on loopback: `python3 -m http.server 8108 --bind 127.0.0.1`, then open `http://127.0.0.1:8108/experiments/trap-placeholder/index.html`.
2. Set Scenario to "T1", Wizard CPU to "normal", type the seed and press Start. The status line should name T1, 12 cards and the seed.
3. Play the match as the Cowboy.
4. After the match, type notes in the four Playtest report boxes: only what you noticed while playing, in your own words. Leave a box empty if you have nothing to say. Do not type personal information.
5. Press "Export current playtest report". The JSON file downloads locally.
6. Optional paired run: notes stay typed across Start, so after the T1 export press "Clear notes". Set Scenario to "BASE" (shipped decks, traps off), keep the same seed and CPU, press Start, play, write notes and export again. BASE has the same shuffle and first side, with spell copy 2 where T1 has the trap.

Keep the exported files on your machine or share them only through the project's own channels. Do not paste them into external websites or tools. Hidden match data is not in the export, but the event list and notes are still yours to control.

## Reading the result

- A, B and C describe when a spell-or-trap choice could come up. The player decides whether to make it, and only notes written after play say whether it was noticed or mattered.
- B, C and D assume nothing about what the player has already played when the trap arrives.
- E and F depend on the match reaching round 8 or 9. A match can end sooner, so the late trap may never be drawn. In F the trap is drawn in round 9 and cannot be set.
- The T2 example shows two copies of one trap in hand with one trap zone, a duplicate-trap saturation case, not a spell-or-trap choice.
- Knowing the trap position before play can change how someone plays. A second person can choose the seed if that matters.
- One person playing six seeds is a small qualitative sample. It is not balance or usability evidence by itself.

## Test

```sh
node --test experiments/trap-playtest-kit/seeds.test.js
```

Not part of `npm test`. It recomputes every category from BASE `createMatch` alone and checks the lowest-seed choice, 12-card decks, unchanged positions, untouched `CARDS` and `DECKS`, agreement with the #114 simulation's `openingFor`, and the trap's arrival round, using end-phase-only engine steps (no troops played, not a playtest). It also checks that E can set its trap in round 8 and F is refused with `trap-too-late`, that `seeds.js` stays pure, and that the CLI writes nothing without `--out` and its output matches `seed-plan.md`.

Evidence: [docs/evidence/kiro-trap-playtest-kit-120.md](../../docs/evidence/kiro-trap-playtest-kit-120.md).
