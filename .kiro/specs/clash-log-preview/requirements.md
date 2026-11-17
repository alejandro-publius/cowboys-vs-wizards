# Requirements: Clash log preview (issue #29)

**Status: retrospective acceptance documentation.** The feature was implemented by Rachel at `4fb0f88` (`src/match/clash-log.js`, `tests/match/clash-log.test.js`, UI wiring) before this document existed. Kiro CLI wrote it afterwards to map the issue's acceptance list to checks. It is not evidence that the implementation was spec-first.

Event contract (`src/game/actions.js`, `src/game/clash.js`): `damage {lane, attacker{side,slot,cardId}, target{kind,side,slot?,cardId?}, amount, before, after}`, `spell {spell, cardId, caster, target{side,slot,cardId}, before, after, destination?}`, `defeat {side, slot, cardId}`, `clash {round}`. `draw` carries no card.

| ID | Requirement | Check |
| --- | --- | --- |
| CL-1 | WHEN a batch of events holds a `clash`, THE clashLog SHALL return `{title, lines}`; otherwise `null`. | `tests/match/clash-log.test.js` test 1; property "no clash event means no log" in `tests/match/clash-log-properties.test.js` |
| CL-2 | THE lines SHALL use only the numbers, lanes and cards each event carries and SHALL NOT recompute damage. | property "one line per described event ... only that event's lanes, orbs and names" (integers on a line equal lane+1, before, after, destination+1) |
| CL-3 | THE clashLog SHALL NOT name a card the player could not see: only `spell`, `damage`, `defeat` events are described. | existing test 4 (seed 60); property "undisclosed hand, deck and draw data ..." (extra `hand`/`deck` fields change nothing; draw events carry no card) |
| CL-4 | WHEN both troops of a lane hit each other, THE clashLog SHALL give a line for each direction. | existing test 2 (seed 60 round 5); property "a clash that damages both troops of a lane ..." |
| CL-5 | THE clashLog SHALL be deterministic and SHALL NOT mutate its input. | property "output is deterministic, and the input events are never mutated" (deep-frozen input) |
| CL-6 | Tests SHALL cover troop hits troop, troop hits Base, defeat, spell. | existing tests 2 and 3; coverage guard in the properties file |
| CL-7 | THE list SHALL be a polite live region showing the latest clash only. | **Pending human/browser check** (screen reader announcement; latest-only display). |
| CL-8 | WITHOUT `?log=1` no new element SHALL be added. | **Pending browser check** (DOM query without the parameter). Not run by Kiro CLI. |
| CL-9 | `node scripts/verify-duel.mjs` SHALL pass. | **Pending**: not run for this documentation and test-only task. |

Readability of the wording is a **pending human playtest**.
