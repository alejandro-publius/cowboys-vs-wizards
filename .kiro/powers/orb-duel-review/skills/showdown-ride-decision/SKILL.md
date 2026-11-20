---
name: showdown-ride-decision
description: Answer a player's question about taking or declining a ride in Cowboys vs. Wizards Showdown (an Outrider riding past enemy troops to strike the Base), such as "Why would I decline this ride?". Call inspect_ride_decision first and give ride advice only when it reports advice.allowed.
---

A "ride" is the Showdown Outrider's attack past standing enemy troops to the Wizard Base for 1 orb (blocked when a Wizard troop has Guard). Answer from the game's verified evidence, never from general strategy.

1. Call `inspect_ride_decision` with `{}`. Accept no path, URL, seed or command. Do not read repo files instead.
2. Report from the tool output only:
   - `game.commit` (and `game.recordedCommit`, `game.sameCommit`), `closure.current` against `closure.recorded`, and any `closure.changedFiles`.
   - `build.sha256` (or its `error`) and `replayUrl`. If `replayUrl` is null, say the game has no link that opens this decision.
   - `verdict` with each `reasons` entry, `status` and `caseId`.
   - The position from `decision.position` in plain words: both Bases, both boards, the Cowboy hand, and the offered `decision.ride`.
3. If `advice.allowed` is false, say you cannot give a reason to decline (or take) this ride from verified evidence, and list each `advice.reasons` entry. Do not offer general strategy, do not use `evidence.note` as advice, and do not describe outcomes.
4. If `advice.allowed` is true, explain only the reason recorded in `evidence`, with its denominators, and the `replayUrl` to try it.
5. `stale`, `rejected`, `malformed`, `absent` or `unavailable` mean the recorded decision no longer matches the game: say it must be re-derived by the coordinator.

The position shows the Cowboy seat's public view only. Wizard hand, traps and both deck orders are empty lists; counts are public. This is a rules-level check, not a Chrome replay or a human playtest.
