# Trap deck replacement simulation (trap-deck-sim-114-v1)

Rules: BASE `orb-duel-draft-1`, T1/T2 `orb-duel-draft-1+traps` with anonymous fixture traps (effect X, shared allowance A).
Seeds 0-199 and 200-399; same CPU level on both sides. Decks 12 cards per side; T1/T2 relabel shipped spell copies after the shuffle.
Synthetic fixture cards, CPU against CPU, deterministic seeds. Not a human balance measurement.

## Results per configuration (all seeds)

| CPU | Deck | n | Cowboy starts | Cowboy wins | Wizard wins | Draws | Starter wins | Base destroyed | Mean end round | Actions | Casts C / W |
|---|---|---|---|---|---|---|---|---|---|---|---|
| normal | BASE | 400 | 187 | 171 | 186 | 43 | 225 | 337 | 7.29 | 12785 | 577 / 598 |
| normal | T1 | 400 | 187 | 183 | 174 | 43 | 201 | 300 | 7.55 | 13319 | 306 / 319 |
| normal | T2 | 400 | 187 | 184 | 151 | 65 | 156 | 240 | 8.03 | 14136 | 0 / 0 |
| hard | BASE | 400 | 187 | 181 | 186 | 33 | 126 | 383 | 5.71 | 10134 | 512 / 545 |
| hard | T1 | 400 | 187 | 201 | 176 | 23 | 119 | 371 | 5.94 | 10582 | 270 / 279 |
| hard | T2 | 400 | 187 | 195 | 174 | 31 | 132 | 342 | 6.35 | 11212 | 0 / 0 |
| easy | BASE | 400 | 187 | 158 | 128 | 114 | 156 | 200 | 8.21 | 13071 | 0 / 0 |
| easy | T1 | 400 | 187 | 182 | 147 | 71 | 158 | 235 | 8.04 | 13475 | 0 / 0 |
| easy | T2 | 400 | 187 | 184 | 151 | 65 | 156 | 240 | 8.03 | 14136 | 0 / 0 |

## Completion round histogram (rounds 1-9, all seeds)

| CPU | Deck | R1 | R2 | R3 | R4 | R5 | R6 | R7 | R8 | R9 |
|---|---|---|---|---|---|---|---|---|---|---|
| normal | BASE | 0 | 0 | 13 | 9 | 19 | 72 | 92 | 83 | 112 |
| normal | T1 | 0 | 0 | 8 | 16 | 27 | 43 | 63 | 87 | 156 |
| normal | T2 | 0 | 0 | 7 | 13 | 10 | 23 | 45 | 81 | 221 |
| hard | BASE | 0 | 0 | 15 | 59 | 167 | 47 | 48 | 27 | 37 |
| hard | T1 | 0 | 0 | 45 | 49 | 99 | 61 | 49 | 32 | 65 |
| hard | T2 | 0 | 0 | 69 | 35 | 38 | 59 | 52 | 39 | 108 |
| easy | BASE | 0 | 0 | 13 | 7 | 8 | 16 | 30 | 64 | 262 |
| easy | T1 | 0 | 0 | 8 | 14 | 7 | 25 | 51 | 63 | 232 |
| easy | T2 | 0 | 0 | 7 | 13 | 10 | 23 | 45 | 81 | 221 |

## Trap and spell role metrics (all seeds, matches unless marked phases)

| CPU | Deck | Side | Spells / traps in deck | Spell role removed | Trap seen | Matches with set (sets) | Matches with trigger (triggers) | Held with full zone: matches (phases) | Spell+trap in hand phases | Trap in hand in round 9 |
|---|---|---|---|---|---|---|---|---|---|---|
| normal | T1 | cowboy | 1 / 1 | no | 353 | 341 (341) | 324 (324) | 0 (0) | 59 | 12 |
| normal | T1 | wizard | 1 / 1 | no | 360 | 344 (344) | 326 (326) | 0 (0) | 67 | 16 |
| normal | T2 | cowboy | 0 / 2 | yes | 400 | 400 (703) | 393 (662) | 95 (96) | 0 | 44 |
| normal | T2 | wizard | 0 / 2 | yes | 394 | 394 (690) | 389 (659) | 95 (95) | 0 | 45 |
| hard | T1 | cowboy | 1 / 1 | no | 313 | 306 (306) | 273 (273) | 0 (0) | 62 | 7 |
| hard | T1 | wizard | 1 / 1 | no | 304 | 297 (297) | 279 (279) | 0 (0) | 65 | 7 |
| hard | T2 | cowboy | 0 / 2 | yes | 383 | 383 (612) | 371 (549) | 85 (86) | 0 | 24 |
| hard | T2 | wizard | 0 / 2 | yes | 371 | 371 (590) | 354 (539) | 87 (87) | 0 | 27 |
| easy | T1 | cowboy | 1 / 1 | no | 377 | 352 (352) | 348 (348) | 0 (0) | 195 | 25 |
| easy | T1 | wizard | 1 / 1 | no | 378 | 352 (352) | 340 (340) | 0 (0) | 192 | 26 |
| easy | T2 | cowboy | 0 / 2 | yes | 400 | 400 (703) | 393 (662) | 95 (96) | 0 | 44 |
| easy | T2 | wizard | 0 / 2 | yes | 394 | 394 (690) | 389 (659) | 95 (95) | 0 | 45 |

## First trap round: exact #87 odds, opening order, and seen during play (all seeds)

Exact and opening columns are unconditional (the whole 12-card order). The runtime column counts only rounds the match reached, so it is lower in later rounds and is not a rate comparable to the exact odds. Column 'never' = no trap reached the hand before the match ended.

| Deck | Source | R1 | R2 | R3 | R4 | R5 | R6 | R7 | R8 | R9 | never |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | exact x 400 | 133.3 | 33.3 | 33.3 | 33.3 | 33.3 | 33.3 | 33.3 | 33.3 | 33.3 | 0 |
| T1 | opening order, cowboy | 128 | 37 | 39 | 39 | 36 | 33 | 29 | 24 | 35 | 0 |
| T1 | opening order, wizard | 137 | 34 | 36 | 42 | 28 | 34 | 26 | 26 | 37 | 0 |
| T1 | seen in play, normal, cowboy | 128 | 37 | 39 | 38 | 34 | 32 | 20 | 13 | 12 | 47 |
| T1 | seen in play, normal, wizard | 137 | 34 | 36 | 42 | 26 | 31 | 22 | 16 | 16 | 40 |
| T1 | seen in play, hard, cowboy | 128 | 37 | 39 | 35 | 29 | 20 | 10 | 8 | 7 | 87 |
| T1 | seen in play, hard, wizard | 137 | 34 | 36 | 39 | 21 | 11 | 15 | 4 | 7 | 96 |
| T1 | seen in play, easy, cowboy | 128 | 37 | 39 | 38 | 34 | 32 | 24 | 20 | 25 | 23 |
| T1 | seen in play, easy, wizard | 137 | 34 | 36 | 42 | 26 | 32 | 23 | 22 | 26 | 22 |
| T2 | exact x 400 | 230.3 | 42.4 | 36.4 | 30.3 | 24.2 | 18.2 | 12.1 | 6.1 | 0.0 | 0 |
| T2 | opening order, cowboy | 212 | 60 | 41 | 31 | 22 | 18 | 9 | 7 | 0 | 0 |
| T2 | opening order, wizard | 226 | 47 | 33 | 31 | 27 | 13 | 14 | 9 | 0 | 0 |
| T2 | seen in play, normal, cowboy | 212 | 60 | 41 | 31 | 22 | 18 | 9 | 7 | 0 | 0 |
| T2 | seen in play, normal, wizard | 226 | 47 | 33 | 31 | 25 | 13 | 13 | 6 | 0 | 6 |
| T2 | seen in play, hard, cowboy | 212 | 60 | 41 | 28 | 19 | 12 | 7 | 4 | 0 | 17 |
| T2 | seen in play, hard, wizard | 226 | 47 | 33 | 24 | 20 | 9 | 7 | 5 | 0 | 29 |
| T2 | seen in play, easy, cowboy | 212 | 60 | 41 | 31 | 22 | 18 | 9 | 7 | 0 | 0 |
| T2 | seen in play, easy, wizard | 226 | 47 | 33 | 31 | 25 | 13 | 13 | 6 | 0 | 6 |

## Matched-seed Cowboy score delta against BASE

Score per match: Cowboy win 1, draw 0.5, loss 0. Delta = T score - BASE score on the same seed and CPU level, in percentage points. Interval: mean +- 1.96 sd / sqrt(n), a normal approximation that treats seeds as independent shuffles. The Wizard delta is the negative.

| CPU | Deck | Seeds | BASE Cowboy share | T Cowboy share | Delta (pp) | 95% interval (pp) | Seeds with a changed result |
|---|---|---|---|---|---|---|---|
| normal | T1 | 0-199 | 50.0% | 51.5% | +1.5 | -6.4 to +9.4 | 97 |
| normal | T1 | 200-399 | 46.3% | 50.7% | +4.5 | -2.9 to +11.9 | 80 |
| normal | T1 | 0-399 | 48.1% | 51.1% | +3.0 | -2.4 to +8.4 | 177 |
| normal | T2 | 0-199 | 50.0% | 53.5% | +3.5 | -5.2 to +12.2 | 114 |
| normal | T2 | 200-399 | 46.3% | 54.8% | +8.5 | +0.3 to +16.7 | 104 |
| normal | T2 | 0-399 | 48.1% | 54.1% | +6.0 | +0.0 to +12.0 | 218 |
| hard | T1 | 0-199 | 53.0% | 53.8% | +0.8 | -6.3 to +7.8 | 67 |
| hard | T1 | 200-399 | 45.8% | 52.5% | +6.8 | -0.7 to +14.2 | 72 |
| hard | T1 | 0-399 | 49.4% | 53.1% | +3.8 | -1.4 to +8.9 | 139 |
| hard | T2 | 0-199 | 53.0% | 56.0% | +3.0 | -4.9 to +10.9 | 88 |
| hard | T2 | 200-399 | 45.8% | 49.3% | +3.5 | -4.4 to +11.4 | 86 |
| hard | T2 | 0-399 | 49.4% | 52.6% | +3.3 | -2.3 to +8.8 | 174 |
| easy | T1 | 0-199 | 55.3% | 59.0% | +3.8 | -3.2 to +10.7 | 96 |
| easy | T1 | 200-399 | 52.3% | 49.8% | -2.5 | -9.6 to +4.6 | 97 |
| easy | T1 | 0-399 | 53.8% | 54.4% | +0.6 | -4.3 to +5.6 | 193 |
| easy | T2 | 0-199 | 55.3% | 53.5% | -1.8 | -9.3 to +5.8 | 105 |
| easy | T2 | 200-399 | 52.3% | 54.8% | +2.5 | -5.1 to +10.1 | 114 |
| easy | T2 | 0-399 | 53.8% | 54.1% | +0.4 | -5.0 to +5.7 | 219 |

## Run digests (sha256 of per-match action/event/result digests, first 16 hex)

- normal/BASE: `f6b09947cd0e058b`
- normal/T1: `71bc9e2d633c95b3`
- normal/T2: `f736a820672dbec0`
- hard/BASE: `3c4bef1b918a0add`
- hard/T1: `397c2420719309eb`
- hard/T2: `42ddfd9c29b71c31`
- easy/BASE: `68e65e618808c39f`
- easy/T1: `8a6083c878c387fc`
- easy/T2: `f736a820672dbec0`
