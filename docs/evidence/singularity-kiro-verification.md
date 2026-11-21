# Verifying the Singularity replay with Kiro CLI

The approved illustrated replay is `172890d0cd812b6665804e0b92313f7c698c33fe`. The verification work preserves its runtime source and art. The 11.25-second film was rendered from that replay separately. Its SHA-256 is `4f0e86661533b864a2b017f3fd244c11cf1aa192e9d9c0b1fa70f8babc6eeb79`.

## Applying the Kiroween session

- **11:29–16:12.** Write requirements, design and tasks for one feature before doing the work. Here the [spec](../../.kiro/specs/singularity-preview-verification/requirements.md) describes verification of an existing, visually approved replay.
- **21:14–22:41 and 48:23–49:17.** Give independent tasks to parallel CLI workers. One worker dealt with generated Showdown states and the other drove the actual illustrated gallery. They used a scoped custom Kiro agent profile in separate worktrees.
- **16:42–18:26.** Test invariants across many inputs and prove the check can fail. Opus 5.5 caught a stale test asserting that every non-troop had zero replays. It added 240 generated layouts and negative controls for a dropped hit and a split impact. All nine presentation tests passed. The ordinary single-target game action was checked separately.
- **46:38–47:23.** Review in a fresh context. The workflow’s reviewer opened a fresh agent session, matched the Chrome receipt to the built HTML by SHA-256 and assessed each of the five requirements.

## Evidence for the submission

- [Presentation tests](../../tests/match/showdown-3d-presentation.test.js) cover 240 generated layouts, both authored replays, the regular single-target spell and the dropped and staggered hit controls.
- [Browser receipt](showdown-singularity/browser-receipt.json) records 16 passing checks and the HTML digest. Chrome sampled the real gallery animation. All three Sheriffs changed from three orbs to two in adjacent samples, with no partial frame. The Skeleton reached the graveyard and the Dragon ended at four orbs. Both previews gave the same result with reduced motion.
- [Workflow](../../.kiro/workflows/singularity-preview-verification.workflow.json) builds the approved game, runs the Node and Chrome checks in parallel and hands the results to an independent reviewer. [Run `wf_b0ee10926300c2b6`](showdown-singularity/workflow-receipt.json) completed all stages. The independent reviewer returned PASS and matched the Chrome receipt to the built HTML. The checks cover replay timing and outcomes in headless Chrome.
- Runtime and art are byte-identical to the approved revision in Git. The demonstrated area cast is a deterministic gallery scenario. The normal game card remains single-target.

## Suggested demo edit

Show the Singularity hit first. Cut to the CLI workflow tree and the Chrome receipt showing `3/3/3 → 2/2/2`. Return to the Skeleton card reaching the graveyard. This takes roughly 15 seconds and gives the judges a specific design decision, a Kiro workflow and an observable result.

> We locked the combat art, then used Kiro CLI to protect how it plays. One worker checked 240 board layouts. Another drove the actual Card gallery. The browser saw all three Sheriffs lose their orb on the same frame, and the tests rejected both a missed hit and a late one.
