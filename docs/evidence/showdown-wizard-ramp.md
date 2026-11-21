# Wizard preview difficulty check

Fable 5.2 designed four duels to teach tribute and Raise. Kiro CLI ran the shipped engine with a Wizard bot playing each duel from its opening hand. The first two duels introduce the Wizard and the Raven Familiar. Trapline Pass introduces a Cowboy Bear Trap. High Noon introduces the full Cowboy deck.

Wizard wins out of 300 first attempts, seeds 0–299. Each column uses the same deals. *Careless* calls the existing level-0 policy; *careful* uses the level-2 policy. The AI Cowboy uses each duel’s specified policy. These are bot games and each simulation starts without grit.

| Duel | Original careless | Final careless | Final careful |
| --- | ---: | ---: | ---: |
| Dry Gulch | 298 | 298 | 300 |
| Wagon Ring | 122 | 268 | 300 |
| Trapline Pass | 115 | 125 | 276 |
| High Noon | 51 | 51 | 193 |

The original Wagon Ring opponent came from Cowboy Trail duel two. Lowering its Base to 3 gave the careless bot 149 wins. Also raising the Wizard Base to 6 gave it 143. Fable then tried fourteen Sheriffs and two Covered Wagons, with Cowboy Base 4. That deck cleared the predeclared adoption thresholds of more than 149 careless wins and at least 285 careful wins. It finished two short of the original teaching target of 270. The Wagon still requires the player to address Guard.

Fable kept Trapline Pass at Cowboy Base 3. Its careless count missed the 150 target. The 151-win gap between careful and careless policies makes this the duel to observe with a person. Players can retry with grit, and the preview records its progress separately from their Cowboy career.

To reproduce, run `node scripts/showdown-wizard-ramp.mjs` at the repository root. It reads the runtime duel table, the earned decks and the shipped rules. Use `--out results.jsonl` for each deal’s outcome. Codex independently reproduced all eight final counts. No card stats or Cowboy campaign rules changed.
