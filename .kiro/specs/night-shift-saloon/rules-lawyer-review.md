# Rules lawyer review: Night Shift saloon

Status: open

Findings as recorded below: L1, L2 and L3 are open; L4 is answered.
This line was added on 2026-11-22 (America/Los_Angeles) by the native Kiro
proof-scorecard pass so the scorecard can read the outcome. The findings below
are unchanged.

Reviewer: one native Kiro CLI agent (model `claude-opus-5.5`) working in the
`12-expert-reviews` worktree. The same agent wrote every review in this panel,
each through a different lens.

Method: compared [requirements.md](requirements.md), [design.md](design.md)
and [tasks.md](tasks.md) with the code and the checked-in recording. No
command ran in this pass, because the session's shell calls were refused
before they could start.

Lens: are the glossary and the evidence statements literally true?

## L1. The "Stat range" in the glossary is wrong, and three modules disagree with it

- **Question:** The glossary defines Stat range as "what
  `scripts/sync-card-specs.mjs` accepts for a troop: integer `attack` 0 or
  more, `health` 1 to 5, `stars` 1 or more". Is that what the compiler
  accepts, and do the saloon checks use it?
- **Record:**
  - Compiler: [`sync-card-specs.mjs`](../../../scripts/sync-card-specs.mjs)
    line 77 refuses attack 0 for every deck troop ("attack must be a positive
    integer"). Only `validateShowdownOnly` allows 0.
  - Patch reader:
    [`saloon-patches.mjs`](../../../scripts/saloon-patches.mjs) lines 49–55
    (`PATCH_RANGES`). Attack 0 to `MAX_SAFE_INTEGER`, health 1–5, stars 1 to
    `MAX_SAFE_INTEGER`. Its comment says "0 only for Showdown-only troops",
    but the reader does not check `showdownOnly`.
  - Browser validator:
    [`night-shift-events.js`](../../../src/ui/night-shift-events.js) lines
    12–13 (`STAT_MIN = 0`, `STAT_MAX = 12` for all three fields).
- **Observed (by reading):**
  1. A `cast` with health 0 → 12 passes `cleanEvent`. The compiler would
     refuse both values.
  2. A `readMainPatches` record with stars 12 → 13 or attack 13 is produced
     by the reader, then dropped by `cleanPatch` on the browser side. This
     contradicts requirement 5.2, which says only `readMainPatches` decides
     patches.
  3. A main commit that changes a deck troop's attack 1 → 0 would be shown
     as a patch, although that card cannot compile.
- **Exposure today:** None of these values is in the recording. The design
  says main `9ce9e16` has no qualifying patch.
- **Status:** open. The same cause, several stat-range copies, is the top
  blocker raised in
  [night-shift-repair/rules-lawyer-review.md](../night-shift-repair/rules-lawyer-review.md)
  R1.
- **Acceptance check:**
  - The glossary states the compiler's real rule (attack at least 1, or 0
    for a `showdownOnly` troop).
  - `PATCH_RANGES` and `STAT_MIN`/`STAT_MAX` come from one exported range, or
    a test asserts they are equal.
  - `tests/match/night-shift-patches.test.js` gains a case where stars
    12 → 13 on main is either emitted and displayed, or dropped by both
    reader and browser.

## L2. The time range claimed for the recording's activity is the headline events' range

- **Question:** design.md "Recorded replay" and tasks.md "Recording" say the
  25 ambient activity samples run "from 2026-11-22T23:53:59Z to
  2026-11-23T00:05:31Z". Is that true?
- **Record:** [`src/ui/night-shift-recording.json`](../../../src/ui/night-shift-recording.json).
- **Observed (counted in the file):**
  - Headline events: 5 records, sorted, from `2026-11-22T23:53:59.070Z`
    (`job`) to `2026-11-23T00:05:31.356Z` (`bell`).
  - Activity: 25 records, from `2026-11-23T00:01:56.799Z` (`SessionStart`)
    to `2026-11-23T00:05:28.038Z` (`PostToolUse`).
  - The 8 phase types are `SessionStart`, `UserPromptSubmit`, `PreToolUse`,
    `PostToolUse`, `PostFileSave`, `PermissionRequest`, `Stop` and
    `SessionEnd`.
  - The counts (5 events, 25 samples, 8 of 14 phase types) are correct. The
    stated range belongs to the events, not the activity.
- **Status:** open (evidence wording).
- **Acceptance check:** design.md and tasks.md either give the activity
  range as 00:01:56Z–00:05:28Z, or say that the range covers the whole
  recording.

## L3. The server accepts a third Host the spec does not list

- **Question:** design.md "Live transport" says that a Host other than
  `127.0.0.1:<port>` or `localhost:<port>` is refused. Does the server allow
  exactly those two?
- **Record:** [`scripts/night-shift-saloon.mjs`](../../../scripts/night-shift-saloon.mjs)
  line 19: `LOOPBACK_NAMES = ['127.0.0.1', 'localhost', '[::1]']`. The server
  listens on `127.0.0.1` only (line 18, `startSaloon`).
- **Observed:** `Host: [::1]:4179` is accepted. That Host can arrive only as
  a hand-set header on the IPv4 socket. It is an IP literal, so DNS
  rebinding cannot produce it, and the deviation carries no known risk. It is
  still outside the written rule.
- **Status:** open (spec and code mismatch, low risk).
- **Acceptance check:** Either design.md and requirement 3.2 list `[::1]` as
  accepted, or `LOOPBACK_NAMES` drops it. A server test asserts the
  documented result for `Host: [::1]:<port>`.

## L4. Passed reading: only `task_update` creates a Wanted poster

- **Question:** Requirement 2.5 excludes raw `tasks.md` saves and
  `PostTaskExecution`. Does the hook code agree?
- **Record:** The header of
  [`scripts/saloon-hooks.mjs`](../../../scripts/saloon-hooks.mjs) says
  `wanted` comes from `PreToolUse` and `PostToolUse` with `tool_name` exactly
  `"task_update"`. It requires a decoded `{updated: true}` response and an
  `oldStatus` that is not `"completed"`. It notes that standalone task phases
  "did not dispatch in two observed runs".
- **Status:** answered, as far as the header comments go. This pass did not
  trace the function bodies.
- **Acceptance check:** A saloon hook test feeds a `PostFileSave` of a
  `tasks/bounties/<boss>/tasks.md` with a new `[x]`, and separately a
  `PostTaskExecution` payload. Neither may write a `wanted` event.
