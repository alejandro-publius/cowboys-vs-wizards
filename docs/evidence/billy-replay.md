# Billy and Bone Wall

Open Camp, choose Camp ledger, then open the Sheriff’s Ledger. The two controls replay the same attack on seed 726421019 with the Cowboys starting. Both versions produced the same first 29 events. On turn 7 Billy attacked the two-orb Bone Wall. At 2 attack he cleared it and the Cowboys won on turn 13. At 1 attack it kept one orb and the Wizards won on turn 20.

Kiro proposed the one-point change before this fresh-seed run. The candidate is available for design review. [Original Kiro proposal and tuning results](kiro-contest-run.md)

| Fresh-seed measurement | Billy at 2 attack | Billy at 1 attack |
| --- | ---: | ---: |
| Cowboy wins | 3,052 / 5,000 (61.04%) | 2,646 / 5,000 (52.92%) |
| Starting player wins | 2,972 / 5,000 (59.44%) | 2,902 / 5,000 (58.04%) |

Each of 2,500 deals, seeds 726420000–726422499, ran with both starting sides and both versions of Billy. Both seats used the level-2 bot and the standard even-match decks. In 549 paired matchups the winner changed from Cowboys to Wizards and in 143 from Wizards to Cowboys. We chose the example after recording the full cohort. The figures describe faction performance with these decks and bots.

## Run the checks

From a Git checkout with Node and tar installed, run the first command for the example or the second for the example and all 10,000 games.

```sh
node scripts/verify-billy-replay.mjs
node scripts/verify-billy-replay.mjs --full
```

The verifier extracts the original engine, card inputs and compiler at `eedab9385931e093e156fdb7885c470eb2ec64eb`. A shallow checkout can use its own HEAD when those four Git objects match. It checks the two card source hashes, compiles the isolated candidate and runs each version to its final turn. The full check compares the aggregate counts and hashes every matched pair’s winners and ending turns in seed and starting-side order. The expected CSV SHA-256 is `73f25c8310fabc34b28165a0b6e1cfac8004b2f384ca2d240b302cb0158d8747`.

Claude Code drafted the Ledger interaction, focused tests and first verifier. Codex measured and reproduced the fresh-seed sample, corrected the verifier, and integrated the player view with the existing card portraits. A separate read-only Kiro CLI review checked the turn, both endings, the win totals and how the verifier hashes each paired result. Codex then ran the verifier across all 10,000 games.
