# Night Shift saloon: design

Implements [requirements.md](requirements.md). Base: main `9ce9e16`. Nothing in
`src/game/` changes, and the saloon never feeds back into rules, cards or
balance runs.

## Run it

| Mode | Command | Open |
| --- | --- | --- |
| Recorded | `node scripts/build-graybox.mjs --diorama --contest` | the built illustrated page, then Camp → Night Shift saloon |
| Live | `node scripts/night-shift-saloon.mjs` | `http://127.0.0.1:4179/?saloon=live`, then Camp → Night Shift saloon |

## Data flow

Hooks write to a durable, best-effort local journal in ignored storage. The
journal keeps two separate boards: headline events and ambient activity.
Activity retention is bounded and never displaces headline events. The live
server reads the journal and `readMainPatches(root)` per request and returns
`{events, patches, activity}`. The browser validates that payload in live mode,
or the checked-in recording in every other mode, and renders the same view.

## Miniatures and events

| kind | extra fields | Miniature | Action |
| --- | --- | --- | --- |
| `job` | none | Singularity | hands out a job |
| `block` | `rule` | Sheriff | stops the action, names the rule |
| `cast` | `card`, `field`, `before`, `after` | Wizard | casts, labelled **Proposal** |
| `wanted` | `boss` | Bounty Hunter | pins a Wanted poster |
| `bell` | none | Singularity | rings after a verified Stop |

Every event has a bounded `id` and an ISO UTC `at`. `card` and `boss` are slugs.
`field` is `attack`, `health` or `stars`, with values in the stat range. Wanted
posters map a bounty id to its boss painting and never pass an unknown id to the
atlas. Replay keeps the last Wanted poster, the last proposal and the Sheriff's
ledger (count per rule, refusals in order).

The illustrated stage is optional. If it is missing, throws or is partial, the
portrait room shows the same events. A stage that throws later is closed once
and not called again.

## Hook outcomes

| Event | Recorded when |
| --- | --- |
| `job` | the fenced preparer ran `node scripts/contest-balance.mjs reset`, it exited 0 and the reset status is fresh |
| `bell` | the release-gate Stop passed with a fresh stamp |
| `block` | a guard refused the action |
| `cast` | the balancer `PreToolUse` snapshot was taken, the call was allowed, and `PostToolUse` found exactly one changed stat of a scratch card on disk |
| `wanted` | `PreToolUse` then `PostToolUse` on `task_update`: status `completed`, the prior snapshot shows it was not, the boss task is checked on disk, and it names a drafted boss |

`task_update` is the only registered Wanted capture. `tool_response` arrives as
a JSON string and is parsed; only `updated: true` counts. `PostTaskExecution`
handling exists in code but is not registered. A raw `tasks.md` save or an
arbitrary task completion does not create a poster.

Every call site records after the hook has decided, builds `cast` from files on
disk, passes only allowlisted facts, and uses a stable key per invocation so a
retry or a concurrent duplicate stores one event.

## Ambient activity

`.kiro/hooks/night-shift-activity.json` binds 14 automatic Kiro CLI V3 phases,
one named command per trigger, no manual triggers. Each stored record holds only
`kind`, `actor` and `phase`. The actor comes from allowlisted role metadata,
then a domain fallback, otherwise Singularity. Generic phases only stir the four
miniatures. Malformed or unknown input writes nothing. A live poll that brings no
new activity stirs nobody.

## Live transport

- Binds `127.0.0.1:4179` by default. `/` serves the illustrated build with
  `no-store`; `/night-shift/events` serves `{events, patches, activity}`. A
  missing build gives 503 while the feed still works.
- Only `GET` and `HEAD`. Other methods and paths are refused. A `Host` other than
  `127.0.0.1:<port>` or `localhost:<port>`, or a cross-origin request, is refused.
  No `Access-Control-Allow-*` headers. No writes.
- Browser: live mode needs `?saloon=live` on an `http:` loopback page. It polls
  its own origin, adds only unseen ids, and stops polling when the saloon closes.
  Every other build reads the recording and makes no feed request.

## Morning patch notes

[`readMainPatches(root)`](../../../scripts/saloon-patches.mjs):

1. Tip: `refs/remotes/origin/main^{commit}`, else `refs/heads/main^{commit}`.
   Full ref names only, so a tag or branch named like main cannot stand in.
2. Walk at most 400 first-parent commits with `--diff-merges=first-parent` over
   `.kiro/specs/duel-card-pipeline/cards`, renames off. Keep `M` entries for
   `cards/<slug>.json` only.
3. Read the 24 most recent card-modifying commits that have a local first parent.
   Check blob presence with `rev-list --objects --missing=print`; skip absent
   blobs and mark the result partial. Read present blobs of 64 KiB or less.
4. Emit one patch per top-level stat in range on both sides that differs. Oldest
   first, last 64 kept. `at` is the committer time. `id` is
   `patch-<12 hex>-<field>-<10 hex of sha256(commit, card, field)>`.
5. Cache complete results per real path and tip (8 entries). Shallow or partial
   results are not cached.

Safety: `GIT_*` is cleared, then `GIT_NO_LAZY_FETCH=1`, `-c protocol.allow=never`,
`GIT_NO_REPLACE_OBJECTS=1`, `GIT_OPTIONAL_LOCKS=0`, `GIT_TERMINAL_PROMPT=0` and
`GIT_CEILING_DIRECTORIES` are set. Each Git call times out at 3 seconds and the
whole read at 6; output is capped. Any failure returns `[]`. Git 2.31 or later is
required for `--diff-merges`.

Display: "Morning patch notes · `<Card> <field> <before> → <after>` · main commit
`<short hash>` · `<date>`". Never "deployed".

On main `9ce9e16` no existing card has a qualifying stat change, so the notes are
empty. The historical tweak `5c66ce8` was made on a side branch before its card
reached main, so main's first-parent diff introduces the card and shows no patch.

## Proposal versus shipped

| | Proposal | Patch note |
| --- | --- | --- |
| Source | `cast` from a scratch snapshot | `readMainPatches` on main |
| Label | **Proposal** | main commit `<hash>` |
| In morning notes | never | always |

## Recorded replay

`src/ui/night-shift-recording.json` was captured from the real journal. It holds
5 headline events, sorted, and 25 ambient activity samples from
2026-11-22T23:53:59Z to 2026-11-23T00:05:31Z, covering 8 of the 14 bound phase
types. The view shows a **Recorded** badge and the capture date.

## Access

Native buttons in tab order, Escape closes the saloon. New events go to an
`aria-live="polite"` region, one sentence each. Reduced motion holds still poses
with no walking, particles or camera moves.
