# Dragon Fire balance run

Kiro CLI wrote the matched-seed harness for Fable. Codex ran it, counted draws as half a win to match Fable's prior analysis, and excluded hits to an already empty Base from the finishing-blow counter.

Run from the repo root.

```sh
node scripts/dragon-fire-balance.mjs --from 70000 --count 250 --groups 2 --out .artifacts/coordination/balance.json
```

Each of 500 seeds played both first seats. Four deck/rules configurations ran with both Normal and Hard bots against Default Wizard and Stargazer. The run had 1,000 games per configuration and matchup and 16,000 total. Each entry below is a paired difference in Cowboy score share, in percentage points. A win earns one point and a draw earns half.

| Bots | Wizard deck | Dragon Posse, Fire on versus off | Billy replacement, Fire on versus off |
| --- | --- | ---: | ---: |
| Normal | Default | +1.70 | −2.05 |
| Normal | Stargazer | +0.15 | −6.60 |
| Hard | Default | +4.35 | −3.05 |
| Hard | Stargazer | +4.40 | −4.95 |

Fire applies to both dragons in the engine. The Billy control has no Captured Dragon, so it shows how the active rule changes play in a deck facing only the Wizard Dragon. Turning Fire on raised the Dragon deck's score in both Hard cells. The JSON records each side's burns, first seats, draw rates and separate seed groups. The bots and these decks model a narrow part of the game. Fable's release decision keeps Fire in the authored arc and awaits first-time human observations.
