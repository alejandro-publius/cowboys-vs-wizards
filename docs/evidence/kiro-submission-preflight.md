# Kiroween submission preflight

The candidate at `1d8f381` adds the existing MIT license to the playable duel at `2d4867a`. A clean checkout installed with `npm ci`, passed 104 Node tests and built the static game. The Orb Duel spec is tracked under root `.kiro/`.

## Chrome replay on the static build

On November 16, 2026, Mac Chrome 157.0.8103.52 loaded the static build at 1440 × 900 over HTTP from `/web/` on localhost. Both recordings used the same HTML SHA-256, `e77d68508f2dc8f570f9d4053774662b31ae1a9def04a45120183593016ead6a`.

| Seed | Checks | Console errors | What ran |
| --- | ---: | ---: | --- |
| 0 | 8 of 8 | 0 | Illustrated hand and catalog, selection and cancellation, Sheriff summon, CPU clash, match result, restart during playback and attack-demo round trip. |
| 60 | 4 of 4 | 0 | Two tributes summon Mounted Billy with five orbs. Singularity moves him to the center with three orbs. His attack drops the Dragon from five orbs to two before Billy leaves the board. |

Kiro CLI 3.3.0 called `inspect_duel_replay` with target `web`. The tool returned `pass` for the seed-0 receipt and confirmed the hash against `dist/web/index.html`. A resumed Kiro session read the completed seed-60 browser receipt and confirmed that it recorded the same hash. The MCP verdict covers seed 0. [Replay tool](../../.kiro/powers/orb-duel-review/server.mjs)

To reproduce, run `npm ci`, `node scripts/verify-duel.mjs` and `npm run build -- --web`. Serve `dist` with `python3 -m http.server 48181 --bind 127.0.0.1 --directory dist`. From a second terminal, run:

```sh
node scripts/browser-match-check.mjs --url http://127.0.0.1:48181/web/ --seed 0 --summary --out-dir .artifacts/kiro/preflight/opening
node scripts/browser-match-check.mjs --url http://127.0.0.1:48181/web/ --showcase --summary --out-dir .artifacts/kiro/preflight/showcase
```

The Mac checkout has the test summary and Kiro transcripts under `.artifacts/kiro/preflight/`. The `showcase/` directory contains the mounted summon, faceoff and result frames. [Route to record](../morning-handoff.md#the-duel-to-film)

## Clash property check

Codex ran Kiro’s **Property 3: Clash completeness** in a copy of the presenter. Its normal run passed across seeds 0–99 and covered 741 clashes and 2,734 attacks, including 539 attacks by troops defeated in the same clash. A deliberate edit in the copy suppressed those attacks’ animation calls. The same property failed on seed 0 with two animations for three damage events. The committed presenter passed the clean preflight. [Property test](../../tests/match/presenter.test.js)

## Evidence for judging

| Criterion | Evidence from this build | Evidence to collect for submission |
| --- | --- | --- |
| Potential impact | A player can choose a card, see its legal lane, confirm a summon and get an immediate visual explanation of the CPU clash. The seed-0 run covers that loop. | Observe a first-time player choosing a summon and ending their turn unaided. |
| Technological implementation | Kiro’s Requirements-First spec, seeded presenter properties, replay Workflow and build-hash review have executed receipts. The property check above exercises an omitted attack. | Capture the actual Kiro run beside the playable release. |
| Design | Illustrated cards carry into the 3D arena. Summons, orbs, clash and the graveyard show what each action did. | Capture a full round and the resulting board from the released build. |
| Innovation and idea | A two-tribute Western gunfighter survives a wizard’s lane displacement long enough to fire in a simultaneous clash. Seed 60 reproduces the combination. | Use the faceoff and impact to show why choosing a lane matters. |
| Presentation | The opening match and showdown are scripted and reproducible on one static build. | Replay the public URL, capture the resulting build hash and record the public YouTube demo under three minutes. |

The current receipts cover local Chrome. The functional public URL, public GitHub release with a detectable license and the published demo are submission items. [Official rules](https://kiroween.devpost.com/rules)
