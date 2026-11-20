---
name: showdown-ride-decision
description: Answer a player's question about taking or declining a ride in Cowboys vs. Wizards Showdown (an Outrider riding past enemy troops to strike the Base), such as "Why would I decline this ride?". Call inspect_ride_decision first and give ride advice only when it reports advice.allowed.
---

A "ride" is the Showdown Outrider's attack past standing enemy troops to the Wizard Base for 1 orb (blocked when a Wizard troop has Guard). Declining means attacking a troop instead. Answer from the game's verified evidence, never from general strategy.

1. Call `inspect_ride_decision` with `{}`. Accept no path, URL, seed or command. Do not read repo files instead.
2. Report from the tool output only:
   - `game.commit` and `game.sourceLabel` (or `game.recordedCommit`/`game.sameCommit` on older cases), `verdict` with each `reasons` entry, `status` and `caseId`.
   - Each entry in `pages`: `current` true with its `sha256`, or its `problem`.
   - Links. `links.local.url` is verified only as page bytes at this head; give its `serve` command with it. `links.public.url` is the canonical mirror link; say it is not verified live and quote `links.public.rule`. For older cases, `replayUrl` (or say there is none).
   - The position from `decision.position` in plain words: both Bases, both boards, the Cowboy hand, `decision.ride` and `decision.decline`. Board slots are numbered from 0, as in `slot`; name the troop in that slot.
3. If `advice.allowed` is false, say you cannot give a reason to decline (or take) this ride from verified evidence, and list each `advice.reasons` entry. Do not offer general strategy and do not describe outcomes.
4. If `advice.allowed` is true, `advice.scope` is "this example only". Explain using only `judgeOnly`: each choice's `winner` and `turn`, and its `line` (Bases and troops are `[Cowboy, Wizard]` at the start of a turn where they changed). Say what riding gains and what it costs in this example, with the numbers. Then say `advice.general` is false and quote `advice.generalReason`: do not turn the example into a rule (for example about the rider's health). Keep the `judgeOnly.note` limits. The position stays separate from these outcomes; the game itself shows the position with no outcome.
5. `stale`, `rejected`, `malformed`, `absent` or `unavailable` mean the recorded decision no longer matches the game: give no link as current, no outcome and no advice, and say it must be re-derived by the coordinator.

The position shows the Cowboy seat's public view only. Wizard hand, traps and both deck orders are counts. This is a rules-level check, not a Chrome replay or a human playtest.
