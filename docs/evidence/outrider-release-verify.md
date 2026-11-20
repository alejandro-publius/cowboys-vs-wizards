# Outrider release verification (independent, Kiro CLI)

Verifier: an independent Kiro CLI session (claude-opus-5.5) on Mac, 2026-11-20, about 13:15–13:30 PST. Candidate
`e58fb4b77be7defd46e8927812ab7d1fa4fef57f` (merge of the gate repair 389f60e and Power stage 3 b682117), compared with
`bf510f3`. Local only: nothing was pushed, merged or posted. No human play. No paid model prompt was repeated.
The corresponding public source snapshot is `1fca448`. Its game code is identical. The public reviewer receipt contains run markers and a source digest. The [blind choices](../../experiments/showdown-outrider/decision/reviewer/choices.jsonl) entered public history at `4720860`, before scoring.

Worker evidence: [gate](outrider-gate.md), [Power](showdown-ride-power.md), [search](../../experiments/showdown-outrider/decision/README.md).

## Scope of the diff
Outside the frozen decision data, evidence, specs and tests, the candidate changes only `src/app.js` (one `?outrider=` route
and one Camp control), three new `src/ui`/`src/match` Outrider files, `src/ui/sheriffs-ledger.js` (one appended section),
`scripts/build-graybox.mjs` (gate data passed to the page), the new gate scripts and hook, and the Power. No rule, card,
deck, reward, progress, save, lane, 3D or art file changed. `docs/design/release-line.md` (where PR 170 is cited) was not
changed by the candidate.

## Checks run on a clean detached worktree at the candidate (`npm ci`, then both builds)
| Check | Result |
| --- | --- |
| `npm run build`, `node scripts/build-graybox.mjs --hosted` | both "build e58fb4b77be7; Outrider gate: 10 of 10 fresh; linked case-a, case-e"; both pages SHA-256 `2d85ddb2…c2f4`; tree still clean |
| `node scripts/outrider-gate.mjs --check --ledger` | 10 fresh, 0 stale; Ledger fresh; Night Watch `e813ae8` engine same 4 files |
| `node experiments/showdown-outrider/decision/check.mjs` | 10 cases reproduce |
| `npm test` | 627/627 |
| Showdown, gate, decision and Ledger suites | 166/166 |
| Power tests (`.kiro/powers/orb-duel-review/test/*.test.mjs`) | 29/29 |
| `node scripts/check-links.mjs` | 310 files, 999 links, 0 broken |
| `inspectRideDecision(root, "outrider-camp-case")` | `pass`; head `e58fb4b7…`; hosted and standalone pages current; local link `http://127.0.0.1:47391/?outrider=case-e`; judge-only ride: Wizards win on turn 10, decline: Cowboys win on turn 23 (same as `results/observed.json` case-e); `advice.general` false |
| Installed Power copy (isolated profile) over direct MCP stdio, bound to the clean tree | server 1.5.0; `inspect_ride_decision {}` gives the same `pass` result; `{"case":"../../x"}` refused with -32602; position has Wizard counts only, no seed or prefix |
| `browser-showdown-outrider-check.mjs` over HTTP (the hosted page served; served bytes equal the built file) | 23/23 |
| Verifier-only keyboard pass (Tab/Enter, not committed) over the same served page | 14/14: one Camp button; case-e from the Camp and case-a from the Ledger link; no outcome or cue words in visible text or non-script DOM before the choice; ride lowers the Wizard Base 4 → 3 and leaves troop 0, fight after Restart lowers troop 0 and leaves the Base; Back to camp; save byte-identical; `?turn=dragon-c5` and `?turn=dragon-c5-70` still open; `?turn` wins over `?outrider` |
| `browser-showdown-check`, `-turn-check`, `browser-ledger-check`, `browser-showdown-keyboard-check` | 22/22, 29/29, 12/12, 7/7 |
| Build from `git archive` (no `.git`) and from a depth-1 clone | both build with 10 fresh cases; Ledger says Night Watch engine "not compared (commit e813ae8 is not in this checkout)"; the archive build is "not identified", so the Power gives it no link |

## Negatives (scratch worktree, discarded)
- Ride strike 1 → 2 orbs, committed: `--write` exit 1 (refused), `--check` exit 1 (0 fresh, 10 stale); both builds withhold all
  cases; the stale Ledger payload has no `results` or `research`; Power `stale`, no link, no judge-only, advice not allowed;
  the Outrider browser check 6/6 and the keyboard pass 6/6 on that served page (no control, no links, curated ids open the menu,
  Dragon routes still open).
- Outcome reversal in data: case-e's ride and fight results swapped in `results/observed.json` (still valid JSON): gate exit 1
  (case-e stale, 9 fresh), search checker exit 1, both builds link nothing, Power `stale` with no link or judge-only.
- Page older than the head: Power `stale`, "page was not built from e58fb4b77be7".
- Comment-only `rules.js` commit: gate 10 fresh, Power `pass`; the Ledger reports the Night Watch engine byte difference.

## Public route and limits
- First public route: **Play** → Camp → **Try an Outrider turn** (`#camp-outrider-turn`, `data-outrider="case-e"`), or the
  query `?outrider=case-e`. The duel id is `outrider:case-e`. The Power case `outrider-camp-case` maps to search label `case-e`.
  The Ledger's Position 1 is case-e and Position 2 is case-a. Ids match exactly (`"case-e "` and other ids open the menu).
- The public mirror's `build.json` reported `bf510f3` on 2026-11-20. That mirror ignores `?outrider=case-e` and `case-a`
  (keyboard pass 6/6, read-only), so the canonical public link is not live for this candidate.
- On a fresh build the two Ledger results and the cue text sit in the page script as data for the reveal. They are absent
  from position payloads, the duel view and the DOM before the reveal, but readable in view-source.
- Night Watch numbers describe the whole ruleset (2,000 bot games, seeds 0–999); the Outrider comparison is one bot line per
  choice in two positions. Neither is human play or a general rule.
- Native skill activation was not re-run: the Power's stage-3 receipts (positive `sess_09043bfd…`: skill load, Tool Load,
  `@orb-duel-review/review/inspect_ride_decision {}`; negative `sess_a778765f…`: no call) ran at `a8c8673`, before the Ledger
  repair. The installed copy is byte-identical to the candidate's Power, and its direct MCP readback passes on the final build.
- Hook receipts are Kiro CLI `PostFileSave` runs from the gate worker's session; the IDE was not tested.
