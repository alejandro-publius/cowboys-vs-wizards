# Kiro evidence: Outrider vs Sheriff on The Bone Fence (assignment 1, K-093/K-097)

- Worker: Kiro CLI worker, branch `kiro/showdown-sprint-outrider`, base `96adf60`.
- Kind: scripted simulation (bot vs bot). No human playtest, no browser replay, no Kiro
  hooks, specs or workflows exercised.
- Acceptance and seed policy (seeds 0-999) were committed before the first run:
  commit `79cfb18`.
- Experiment, commands and full results: [experiments/showdown-outrider/README.md](../../experiments/showdown-outrider/README.md).
- Checks: `node --test experiments/showdown-outrider/outrider.test.js` (8 pass);
  `node experiments/showdown-outrider/run.mjs`; `node experiments/showdown-outrider/run.mjs --replay`.

Estimate under a one-ply greedy Cowboy and a fixed-stream level-0 Wizard: the Outrider deck
won 935/1000, the Sheriff deck 985/1000. All 50 discordant pairs had a ride taken. A ride past
troops was offered in 561 games and blocked by Guard in 411. With rides turned off the two decks
played 1000/1000 identical games. Design follow-up belongs to Fable.
