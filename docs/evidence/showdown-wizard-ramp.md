# Wizard preview ramp: first-attempt bot win counts

Kiro CLI, 2026-11-20 (America/Los_Angeles), branch `kiro/showdown-wizard-trials`, base `d480aa6`.
Bots on both seats. Nothing here measures a person. These are estimates under the stated conditions only.

Rerun: `node scripts/showdown-wizard-ramp.mjs [--from 0] [--count 300] [--out rows.jsonl]`, about 12 s.
The script reads the runtime duels from `createWizardPreview(...).trailDuel()` in `src/match/showdown-wizard-campaign.js`. That module is not in this branch: app integration supplies it. Each duel uses its own deck, Bases, opener (`first: "wizard"`) and Cowboy bot level. Every attempt is a first attempt, so the Wizard Base is 5 with no grit. The Wizard seat is careless (`playTurn` level 0, the same bot as `prototypes/showdown/trail-sim.mjs`) or careful (level 2).

## Measurements, Wizard wins of 300 (seeds 0 to 299)

| Duel | Original run (d480aa6, brief's table rebuilt in the script) | Runtime module (career worker's file, unchanged from the brief) |
| --- | --- | --- |
| 1. Dry Gulch | 298 / 300 | 298 / 300 |
| 2. Wagon Ring | **122** / 289 (red) | **122** / 289 (red) |
| 3. Trapline Pass | **115** / 262 (red) | **115** / 262 (red) |
| 4. High Noon | 51 / 193 | 51 / 193 |

Each cell is careless / careful. All 2,400 per-seed results (winner, reason, turns) were compared and match between the two runs. Codex measured the same four starting pools independently and got matching results. The original run had no draws and no turn-cap endings.

- **Dry Gulch** meets the brief's target of at least 295 careless wins.
- **Wagon Ring** and **Trapline Pass** are misses as measured. Neither duel was changed here, and no target pass is claimed for them. `../ruling.md` (Fable) adjudicates them: it gives a new Wagon Ring deck one evaluation, and ships Trapline Pass at Cowboy Base 3 with the careless miss accepted. Neither ruling change is in the measured module. Both need a rerun after integration.
- **High Noon** is unchanged by the ruling.

The original run's extra analyses are kept outside Git as private receipts: simple-bot counts, Cowboys-open and grit baselines, reward ablations, and the fixture's tribute and full-board controls. They are not part of the shipped script.
