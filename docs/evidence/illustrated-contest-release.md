# Illustrated Showdown release checks

Codex ran these checks on November 22, 2026. The browser receipt covers staged commit `3c5bb34548de501e37bd84cd3223551014918f61`. Its root HTML SHA-256 was `b6093e3c7f488c53cc70624ce071d35e7710ed2cceb383a8da0664485f3e3273`. These were local checks of the Pages tree with Node v26.0.0 and headless Chromium. The deployed build has its own identity check in the Pages workflow.

```sh
node scripts/stage-pages.mjs --commit 3c5bb34548de501e37bd84cd3223551014918f61
CHROME=/path/to/chromium node scripts/check-pages-tree.mjs --commit 3c5bb34548de501e37bd84cd3223551014918f61 --browser
```

```text
ok - build.json names the illustrated root; /3d/ serves the same bytes
ok - / and /3d/ use the diorama; /graybox/ gives a lightweight Camp entry
ok - the four single-file pages include no retired lane game or separate assets
ok - /cowboys-vs-wizards/: Play on a clean profile opens the Camp (first Trail duel Boot Hill)
ok - /cowboys-vs-wizards/graybox/: Play on a clean profile opens the Camp (first Trail duel Boot Hill)
ok - /cowboys-vs-wizards/showdown/: the Showdown reference page loads without errors
ok - the illustrated title opens the playable Ride or Fight? challenge and Camp is reachable
ok - the /3d/ deep link opens the second case and accepts an attack on a troop
Pages tree checks passed (8); report .artifacts/pages-tree/pages-tree.json
```

## Portable Sheriff proof

Codex installed dependencies with `npm ci` and reproduced the four sealed game-record hashes from a fresh checkout of `028c7fb`. The following replay passed again with the stricter `--finding` validation at `3c5bb34`. The historical seal and verdict are unchanged. [Reproduction command and results](night-shift/guard-sheriff-health-3-to-4/README.md)

```text
verify cowboy-sheriff-health-3-to-4-e813ae8a-f2abc83: ok (games replayed); recorded verdict rejected; tool script differs from the current file
Finding: reconstructed report checked against the sealed proposal.
```

As a control, the reconstructed finding without `--rerun` exited 2.

```text
night-review: --finding requires --rerun to verify the reconstructed report
```

The first-time player comprehension check requires separate participant observations. [GitHub Actions run on the initial release commit](https://github.com/alejandro-publius/cowboys-vs-wizards/actions/runs/45075345856)

