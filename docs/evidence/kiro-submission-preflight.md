# Kiroween submission preflight

The candidate at `46592c7` includes the playable duel, the existing MIT license and the card registration pipeline. A clean checkout installed with `npm ci`, passed 107 Node tests and built the static game. The Orb Duel spec and card save hook are tracked under root `.kiro/`. [Card registration evidence](kiro-card-pipeline.md)

## Chrome replay on the static build

On November 16, 2026, Mac Chrome 157.0.8103.52 loaded the static build at 1440 × 900 over HTTP from `/web/` on localhost. Both recordings used the same HTML SHA-256, `34a72d68d90e5bade1985a35a80586b054f92658a32f57d4282aaba5968dd0cc`.

| Seed | Checks | Console errors | What ran |
| --- | ---: | ---: | --- |
| 0 | 8 of 8 | 0 | Illustrated hand and catalog, selection and cancellation, Sheriff summon, CPU clash, match result, restart during playback and attack-demo round trip. |
| 60 | 4 of 4 | 0 | Two tributes summon Mounted Billy with five orbs. Singularity moves him to the center with three orbs. His attack drops the Dragon from five orbs to two before Billy leaves the board. |

Kiro CLI 3.3.0 called `inspect_duel_replay` with target `web`. The tool returned `pass` for the seed-0 receipt and confirmed the hash against `dist/web/index.html`. Kiro read the completed seed-60 browser receipt and confirmed that it recorded the same hash. A rebuild after the check-wrapper change reproduced that hash. The MCP verdict covers seed 0. [Replay tool](../../.kiro/powers/orb-duel-review/server.mjs)

To reproduce, run `npm ci`, `node scripts/verify-duel.mjs` and `npm run build -- --web`. Serve `dist` with `python3 -m http.server 48181 --bind 127.0.0.1 --directory dist`. From a second terminal, run:

```sh
node scripts/browser-match-check.mjs --url http://127.0.0.1:48181/web/ --seed 0 --summary --out-dir .artifacts/kiro/preflight/opening
node scripts/browser-match-check.mjs --url http://127.0.0.1:48181/web/ --showcase --summary --out-dir .artifacts/kiro/preflight/showcase
```

The Mac checkout has the test summary and Kiro transcripts under `.artifacts/kiro/preflight-card-pipeline/`. The `showcase/` directory contains the mounted summon, faceoff and result frames. [Route to record](../morning-handoff.md#the-duel-to-film)

## Transparent player hand

On November 16, Kiro CLI 3.3.0 removed the hand’s brown backing and extended the 3D canvas behind the cards. Codex verified the rendered hand and corrected the camera framing after the first replay exposed a shifted summon landing. A 390 × 844 Chrome pass confirmed that the ground continues behind the hand, the empty area passes input through to the canvas, and the playable card can be selected after the hand scrolls.

The game code at `e1e901d` passed 107 Node tests. Chrome observed 8 of 8 opening checks and 4 of 4 Mounted Billy showcase checks at 1440 × 900 with zero console errors. Both checked the static HTML with SHA-256 `d28cf20a580506e5442fe62355be97a5305c00acaa649e711c968b860756e095`. The Kiro transcript and Chrome receipts are in `.artifacts/kiro/hand-overlay/` in the `kiro-first-turn` worktree on the Mac.

## Kiro compaction check

On November 16, Codex ran `kiro-cli chat --v3 --trust-workspace --agent duel-presenter` on `861af78` and invoked `/compact` after four turns. `PreCompact` logged the Git revision. `PostCompact` received the summary and returned the replay plan along with receipt `861af78-1794855476196`. In a resumed Kiro CLI 3.3.0 session, Kiro named seed 0 for the opening and seed 60 for the Mounted Billy showdown and quoted that exact receipt from its context. [Hook profile](../../.kiro/agents/duel-presenter.json) · [Receipt script](../../scripts/duel-compaction.mjs)

The hook appends the phase, revision, receipt ID, and whether Kiro supplied a summary to `.artifacts/kiro/duel-compaction.jsonl`. The game checks are defined in the existing replay scripts.

## Kiro Crew browser playtest

On November 16, Kiro Crew 0.12.2 opened seed 0 in its managed Chromium and used its browser tools to play the first turn. Its snapshots identified Sheriff as playable, marked lane 1 as the selected destination, and reported Sheriff at three life orbs after the summon. Crew ended the turn and observed round 2 and the Wizard response.

Crew saved a round 2 screenshot in its browser snapshot folder on the Mac. The image showed boxed developer labels above two Skeleton tokens. Codex removed the labels in `2d8d14c`. The updated Mac build at `4282c9e` passed the five Chrome opening checks with zero console errors, and its round 2 screenshot showed the tokens and orbs with the labels removed. All 107 Node tests passed. The replay and screenshot are in `.artifacts/kiro/token-labels/` in the playable worktree.

## Fable audit and latest static replay

Fable 5.2 reviewed the clean candidate at `66b6cb9`. It verified the MIT license, 26 files under root `.kiro/`, and a largest tracked asset of about 3.7 MiB. It flagged local-only play instructions and dead evidence links, which Codex corrected. A fresh read of the public remote on November 16 found `main` at `37960ed`, 52 commits behind the audited candidate. [Play instructions](../../README.md#play)

Chrome 157 replayed the static build at 1440 × 900. Seed 0 observed 8 of 8 checks and seed 60 observed 4 of 4 checks, with zero console errors. Both receipts cover HTML SHA-256 `0295185db7b77700ae249bdfd2898fe396529a79d00e767dff6ac68459b31b92`. The documentation and hook changes also rebuilt to that same hash.

## Live release

Kiro CLI 3.3.0 drafted the GitHub Pages workflow in its own worktree. Codex reviewed the action versions and permissions, configured Pages, and published the tested build at `9326453`. The [deployment run](https://github.com/alejandro-publius/cowboys-vs-wizards/actions/runs/43939606327) passed all 107 Node tests and recorded HTML SHA-256 `978e44753eb98dd2713b785fd43b91d9d58ab8cc17c211911e24df80b521697d`.

Chrome 157 replayed the release from GitHub Pages at 1440 × 900. Seed 0 passed 8 of 8 checks. Seed 60 passed 4 of 4 checks. Both reported zero console errors, and the served HTML matched the hash recorded in GitHub Actions. [Opening duel](https://alejandro-publius.github.io/cowboys-vs-wizards/?seed=0) · [Mounted Billy showcase](https://alejandro-publius.github.io/cowboys-vs-wizards/?seed=60) · [Deployment workflow](../../.github/workflows/pages.yml)

## Illustrated cards in motion

While recording the demo, Claude Fable 5.2 found cream rectangles on the summon and draw animations. Both moving cards copied the illustration and paper layers from the hand. The copies needed the same depth and corner radius as the hand, so Codex applied those values to both. A Chrome frame captured during the Sheriff summon shows the original illustration in flight.

The opening replay now checks that the illustrated face is in front of the paper, as well as checking its landing position. The change at `5b69ac7` passed 107 Node tests and the opening replay passed 8 of 8 checks with zero console errors. The updated web HTML SHA-256 is `62944140752eee187b2af23425d494d0eefc27b27b2096ccee9c1eb4d6c6e371`. The two recordings use that web build. [Replay check](../../scripts/browser-match-check.mjs)

## Clash property check

Codex ran Kiro’s **Property 3: Clash completeness** in a copy of the presenter. Its normal run passed across seeds 0–99 and covered 741 clashes and 2,734 attacks, including 539 attacks by troops defeated in the same clash. A deliberate edit in the copy suppressed those attacks’ animation calls. The same property failed on seed 0 with two animations for three damage events. The committed presenter passed the clean preflight. [Property test](../../tests/match/presenter.test.js)

## Evidence for judging

| Criterion | Evidence from this build | Evidence to collect for submission |
| --- | --- | --- |
| Potential impact | A player can choose a card, see its legal lane, confirm a summon and get an immediate visual explanation of the CPU clash. The seed-0 run covers that loop. | Observe a first-time player choosing a summon and ending their turn unaided. |
| Technological implementation | Kiro’s Requirements-First spec, seeded presenter properties, replay Workflow and build-hash review have executed receipts. The property check above exercises an omitted attack. | Capture the actual Kiro run beside the playable release. |
| Design | Illustrated cards carry into the 3D arena. Summons, orbs, clash and the graveyard show what each action did. | Capture a full round and the resulting board from the released build. |
| Innovation and idea | A two-tribute Western gunfighter survives a wizard’s lane displacement long enough to fire in a simultaneous clash. Seed 60 reproduces the combination. | Use the faceoff and impact to show why choosing a lane matters. |
| Presentation | Both routes passed on GitHub Pages. The served HTML matched the deployment hash. | Publish the recorded demo on YouTube and add the link to the entry. |

The public game and MIT-licensed source are available. The entry still needs the published demo URL. [Official rules](https://kiroween.devpost.com/rules)
