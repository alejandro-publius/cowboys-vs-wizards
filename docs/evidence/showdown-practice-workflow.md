# Showdown practice replay workflow (K-049, K-083)

Kiro IDE agent session (Kiro, claude-opus-5.5) on macOS, November 20, 2026, America/Los_Angeles. QA
instrumentation only; `src/` is unchanged by this work. The game feature it checks (Camp
`#camp-practice`, `?practice=0` / `?practice=60`) is the entry worker's commit `1b2136f`, merged locally.

- Harness: [`scripts/browser-showdown-practice.mjs`](../../scripts/browser-showdown-practice.mjs)
  (`--help`; Playwright-core from the existing `node_modules`, system Chrome, no new dependency).
- Recipe: [`.kiro/workflows/showdown-practice-replay.workflow.json`](../../.kiro/workflows/showdown-practice-replay.workflow.json).
  It is the Showdown counterpart of `orb-duel-replay`, which is unchanged and still serves the 3D lane build.
  Shape (video 55, 5:05-5:18): one build step, a `parallel` node with `joinPolicy: "all"` (in Kiro's
  documented semantics the first failing branch aborts the other), one seed per branch, then a join step.

## What one seed checks

In two fresh Chrome contexts, each holding a planted advanced career (`cvw-showdown-save-v2`, Trail won and
a card taken) and one playtest log row, the harness opens the deal from the Camp
(`#menu-play` → `#camp-practice` → `#camp-practice-N`) and from the direct URL `/?practice=N`. Each time it:

1. reads the public opening off the page (turn, whose turn, own hand by card type, both Bases' orbs and
   hand/deck/graveyard counts, both boards) and requires it to equal the opening this tree's engine deals
   (`createShowdownSession({seed, duel: bootHill()}).view()`, cowboy seat);
2. clicks the first enabled hand card and requires it to leave the hand, a Cowboy troop to appear, the log
   to grow and the feedback to read `Last: … arrived.`;
3. presses Back to camp and requires every localStorage key and value, the Camp text and the playtest
   report to be unchanged (also after a fresh root load on the direct route), and focus on the opening link;
4. requires no page errors and no request off loopback.

The build label is read from the page's own playtest report line and `#camp-practice[data-build]`, and must
appear in the HTML; the HTML SHA-256 is computed from the served file. The receipt holds only the public
opening, its SHA-256 fingerprint, digests of the storage dump, the label, revision and HTML digest.

The join refuses on the first failure: missing/unreadable receipt, schema keys, seed order (0 then 60), a
failed receipt, an opening that is not the deal this tree computes for that seed, a different HTML digest,
a revision or label other than this checkout's HEAD, or equal fingerprints.

## Native run

Run `wf_c9b66d8bcb494073` at source `36f6a01a757cb18402b3c0db5c8b2ac6825eb90c`, started with `run_workflow`
on the saved recipe, status **completed**; every child signalled success.

| Step | Session | Result |
| --- | --- | --- |
| build | `sess_3d61f4d5-d06b-44e7-a893-9e77805b156e` | exit 0, tree clean, build `36f6a01a757c`, HTML SHA-256 `d5e8bde443d25197166da3d93d9f4668b06592414ed30a408d05231f5f59d4eb` |
| seeds / seed-0 | `sess_8eb8380f-d162-4502-aef9-6c02b6e7b3e4` | exit 0, PASS, fingerprint `aa4b306e212b9e31…`, hand billy, sheriff, billy, sheriff |
| seeds / seed-60 | `sess_bd6d39af-6462-483d-a93a-ee6c602f9e18` | exit 0, PASS, fingerprint `6c5f3c105b6ee7f2…`, hand sheriff, deadeye, sheriff, billy |
| join | `sess_acc76fb2-d9e5-4c28-832d-36155bdfe6f4` | `join-exit=0`, PASS; `controls-exit=0`, 6/6 as expected |

Join controls (same run): genuine pair accepted; duplicate (seed 0 twice) refused "is seed 0, expected
seed 60"; swapped refused "is seed 60, expected seed 0"; seed-60 receipt relabelled as seed 0 refused "not
the seed-0 deal"; missing refused "missing receipt"; stale (ce5d224 label and another digest) refused
"stale or other build". Both seeds' first action was a Sheriff (`Last: The Cowboys' Sheriff arrived.`);
storage digest `da2e2cd1…` before and after on every route. Chrome 158.0.8127.37 headless.

Before the merge, the same harness on the base build `ce5d224` failed (no `#camp-practice`), as it should.
Receipts are under `.artifacts/practice/wf/` (ignored, not committed).

## Join fix and confirming run

A torn receipt (still `pass: true`) was accepted when its camp route's `storage.after` differed from
`storage.before`, or when `routes.direct.failures` held a failure (Codex's challenge, reproduced here:
`changed-save ACCEPTED`, `route-reports-failure ACCEPTED`). The join now checks each route with
`routeContradiction` (no failure, errors or off-loopback requests; equal well-formed storage digests;
the first action changed hand, board and log; Camp unchanged) and turns any thrown shape error into a
refusal. Four controls were added: `changed-save`, `route-reports-failure`, `no-storage`, `null-route`.

Confirming run `wf_384b3083ff34881b`, completed, at frozen source `24b581ad758094393c383baed1d38cf731cc398c`
(this fix merged with the final entry head `0031e07`): build (`sess_702f2885-…`) exit 0, clean, build
`24b581ad7580`, HTML SHA-256 `ac1ff64e52753cc01d171f38143711d0421cc7264acf9e630665ad6d7256a9ed`; seed-0
(`sess_8e8482d4-…`) and seed-60 (`sess_6f49b3ce-…`) exit 0 PASS, fingerprints unchanged; join
(`sess_5a234bc1-…`) PASS, controls 10/10 (genuine accepted, nine refused). The challenge script in strict
mode then refused both cases on these receipts.

## Limits

- Scripted Chrome only; no human played. Nothing here supports clarity or fun claims.
- The failure branch of the parallel node was not exercised natively: making a seed fail would need a
  game edit. Refusals were exercised in the join's controls, not by an aborted native run.
- Both seeds finish in seconds, so concurrency rests on the parallel node, not on measured overlap.
- Seed openings are compared with this tree's engine, which is the same code the page bundles; the check
  proves the page shows that deal, not that the deal is fair.
