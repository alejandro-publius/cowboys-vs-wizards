# Night Shift saloon: requirements

Base: main `9ce9e16`. Showdown is the supported game. The saloon changes no game
rule, live card stat or asset. Design: [design.md](design.md). Tasks and
evidence: [tasks.md](tasks.md).

## Introduction

The Night Shift saloon is a view in the illustrated Showdown build
(`src/ui/showdown-3d`), opened from the illustrated Camp. Four original game
miniatures react to Kiro hook outcomes from a Night Shift balance run. An ambient
lane lists every accepted event as text. Morning patch notes list card stat
changes that are on main. A stat edit in a scratch snapshot is a proposal, never
a patch note.

Data sources:

- **Live**: `node scripts/night-shift-saloon.mjs`, a read-only loopback server
  that projects the local hook journal and local Git history.
- **Recorded**: the checked-in `src/ui/night-shift-recording.json`, used by every
  other build and URL.

## Glossary

- **Event**: a headline hook fact `{id, at, kind, ...}`, `kind` one of `job`,
  `block`, `cast`, `wanted`, `bell`.
- **Activity**: an ambient record of an automatic hook phase. Stored fields are
  only `kind`, `actor` and `phase`.
- **Patch**: `{id, at, kind: "patch", card, field, before, after, commit}` read
  from main's first-parent history.
- **Proposal**: a `cast` event. It describes a scratch edit that is not on main.
- **Main**: the first-parent chain of `refs/remotes/origin/main`, else
  `refs/heads/main`.
- **Slug**: lowercase ASCII letters and digits in hyphen-separated words, at most
  48 characters.
- **Stat range**: what `scripts/sync-card-specs.mjs` accepts for a troop: integer
  `attack` 0 or more, `health` 1 to 5, `stars` 1 or more.

## Requirement 1: miniatures and the ambient lane

1. `job`: Singularity SHALL hand out a job.
2. `block`: the Sheriff SHALL stop the action and name the refused rule.
3. `cast`: the Wizard SHALL cast at the card and show `card field before → after`
   labelled **Proposal**, with the direction in words.
4. `wanted`: the Bounty Hunter SHALL pin a Wanted poster with the boss painting.
5. `bell`: Singularity SHALL ring the bell after a verified Stop.
6. Activity from generic phases SHALL only stir the four miniatures. It SHALL NOT
   create a headline event.
7. Every accepted event SHALL appear as text in the ambient lane in time order.
   Patches SHALL stay in the morning notes.
8. Art SHALL come from approved assets in `assets/`.

## Requirement 2: events come from real hook outcomes

1. `job` SHALL be recorded only after a successful fenced preparer reset
   (`node scripts/contest-balance.mjs reset` exited 0 with a fresh reset status).
   Any other start, step or command SHALL NOT record `job`.
2. `bell` SHALL be recorded only after a release-gate Stop with a fresh passing
   stamp.
3. `block` SHALL be recorded only when a guard refused an action.
4. `cast` SHALL be recorded only after an allowed balancer write that changed
   exactly one stat of a scratch card on disk, compared with the snapshot taken
   before the call. A denied call takes no snapshot.
5. `wanted` SHALL be recorded only from automatic `PreToolUse` then `PostToolUse`
   on `task_update`, when the call set `status: "completed"`, the prior snapshot
   shows the task was not completed, the boss task is checked on disk, and the
   task names a drafted boss (`tasks/bounties/<boss>/boss.json`). A raw
   `tasks.md` save, an arbitrary task completion or `PostTaskExecution` SHALL NOT
   create a poster.
6. Recording SHALL be best effort and durable: it never throws, never changes
   the hook's exit status or output, and stores a repeated fact once.
7. Only allowlisted fields SHALL be stored or served. Prompts, file contents,
   other paths, credentials and free text SHALL NOT be.

## Requirement 3: live transport

1. The server SHALL listen on `127.0.0.1:4179` by default, serve the illustrated
   build at `/` and `{events, patches, activity}` at `/night-shift/events`.
2. It SHALL accept only same-origin `GET` and `HEAD`, refuse a foreign `Host` or
   cross-origin request, send no CORS allow headers and write no file.
3. The browser SHALL enter live mode only for `?saloon=live` on an `http:`
   loopback page, poll only its own origin, add only unseen ids, and stop polling
   when the saloon closes.
4. Every other build and URL SHALL use the recording and make no feed request.
5. The browser SHALL validate, dedupe and sort the feed and drop anything the
   shared contract rejects.

## Requirement 4: morning patch notes

1. `readMainPatches(root)` in [`scripts/saloon-patches.mjs`](../../../scripts/saloon-patches.mjs)
   SHALL read local Git only, from main as defined above, never `HEAD`, the
   working tree, tags or other branches.
2. A side-branch commit SHALL count only through the merge that brought it into
   main, under the merge's hash.
3. Only an in-place change to `.kiro/specs/duel-card-pipeline/cards/<slug>.json`
   where a top-level `attack`, `health` or `stars` is in range on both sides and
   differs SHALL count, one patch per changed stat.
4. Missing, shallow or partial history SHALL give only what present local objects
   prove. The reader SHALL NOT throw, write or fetch.
5. A note SHALL show "main commit", the short hash and the commit time, and
   SHALL NOT claim the change is deployed.

## Requirement 5: proposal versus shipped

1. A `cast` SHALL always be labelled **Proposal** and never appear in the morning
   notes.
2. Only `readMainPatches`, or a copy of its output in the recording, SHALL create
   a patch.

## Requirement 6: recorded replay

1. The replay SHALL be labelled **Recorded** with the capture date.
2. The recording SHALL contain only real journal output and `readMainPatches`
   output.

## Requirement 7: access

1. Every control SHALL work from the keyboard with a visible focus ring.
2. New events SHALL be announced in a polite live region.
3. With `prefers-reduced-motion: reduce`, miniatures SHALL hold still; the lane
   carries the same information.
4. Without WebGL the saloon SHALL fall back to a portrait room with the same
   events.
