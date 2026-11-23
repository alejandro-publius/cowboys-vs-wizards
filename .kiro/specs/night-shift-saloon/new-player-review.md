# New-player review: Night Shift saloon

Reviewer: one native Kiro CLI agent (model `claude-opus-5.5`) working in the
`12-expert-reviews` worktree. The same agent wrote every review in this panel,
each through a different lens.

This is a reading of the player-facing strings and the recording. It is not
a playtest: no person played, and no clarity or fun claim is made. The
spec's only unticked item is still the human playtest ([tasks.md](tasks.md),
"Human review").

Lens: a Showdown player opens Camp → Night Shift saloon with no knowledge of
Kiro. What do they have to decode?

## N1. The words on screen describe developer tooling, not the game

- **Question:** Can a player who knows only Showdown tell what the Sheriff
  refused and why it matters?
- **Record:**
  [`night-shift-saloon.js`](../../../src/ui/showdown-3d/night-shift-saloon.js)
  lines 32–37:
  - `BLOCK_REASONS.balancer`: "Refuses a tool call or file write outside the
    task's scope"
  - `RULE_NAMES`: "Balancer guard", "Completion check", "Task check"
  - The bell: "Rings the bell: the stop passed its checks"
  - The proposal heading: "Scratch proposal, not merged"
  - The patch heading: "Merged on main"
- **Observed (from the strings):** Most of these labels use software terms:
  tool call, file write, scope, balancer, stop, scratch, merged and main.
  None of them names a Showdown concept. The room has no line that
  explains that an AI agent tried card changes overnight.
- **Status:** open. This needs a playtest, then a wording decision by the
  user.
- **Acceptance check:** In a human playtest of the recorded replay, a player
  who has not seen it before says in their own words what the Wizard's
  proposal was (Billy attack 2 → 1), whether it reached the game (it did
  not), and why the Sheriff acted. Record the notes in tasks.md "Human
  review".

## N2. The recorded ambient lane is mostly one actor

- **Question:** Requirement 1.6 has generic phases "stir the four
  miniatures". In the recording, does the activity spread across them?
- **Record:** The `activity` list in
  [`src/ui/night-shift-recording.json`](../../../src/ui/night-shift-recording.json).
- **Observed (counted in the file):** Of 25 activity records, Singularity has
  18, the Wizard 3, the Bounty Hunter 3 and the Sheriff 1. The first activity
  record (00:01:56Z) comes 8 minutes after the first headline event, the
  `job` at 23:53:59Z. No activity record falls between that first event and
  three seconds before the second one.
- **Effect:** In the shipped replay, the "ambient" signal mostly shows
  Singularity moving. A new player may read this as Singularity being the
  main character rather than a dispatcher.
- **Status:** open. This is an observation about the recording; the
  playtest should judge whether it matters.
- **Acceptance check:** The playtest notes record which miniature the player
  thinks is "in charge" and whether the ambient motion helped or distracted.
  If Fable or the user wants a balanced lane, a new real capture replaces the
  recording. Records are not to be edited by hand (requirement 6.2).

## N3. Passed reading: the start and end states are explained

- **Record:** `IDLE_CAPTION` reads "Press Play to watch the recorded shift."
  The last step adds "End of the recording.". Pause says "Paused.". An empty
  patch list says "No card changes merged in this shift.". An empty Ledger
  says "The Sheriff has not refused anything.". The mode label shows
  **Recorded** and the capture date.
- **Status:** answered (the strings exist). Whether players understand them
  is pending the playtest.
- **Acceptance check:** In the same playtest, the player finds Play without
  help and can say that the shift is a recording, not live.
