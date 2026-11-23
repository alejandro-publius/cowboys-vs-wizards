# Card Forge refusals: verify CLI component checks

Agent: Kiro (Kiro CLI session), working in a detached checkout. Date: not checked in this session (America/Los_Angeles).
Scope: component checks only. No native `player-card-forge` workflow ran, no author agent wrote a
draft, and no forged card round took place. Nothing was committed, pushed or published.

## What was added

`tests/match/card-forge-rejections.test.js` runs the real `node scripts/card-forge.mjs verify` CLI.
The existing `tests/match/card-forge.test.js` tests the pure schema, the guard and
`inspectRun`/`planPrepare`, but never runs `verify`. Each new case builds an isolated temporary
workspace holding:

- a byte-identical copy of `scripts/card-forge.mjs` (each verdict's `tool.script` hash must equal the checkout's script),
- copies of the live card JSON (`.kiro/specs/duel-card-pipeline/cards/`) and the three files `verify` hashes as live,
- a run folder as `prepare` leaves it, with real sha256 bindings,
- sentinel files for an accepted PASS candidate (`.artifacts/card-forge-archive/.../verdict.json`) and a release stamp (`.artifacts/kiro/contest-gates/stamp.json`),
- its own `TMPDIR`, so a leftover snapshot would be visible.

Every case asserts the following. Only `verdict.json` is added in the workspace, and all other files keep their hashes, including the live cards, the accepted candidate and the release stamp. No snapshot directory remains. `applied` is false, `games` and `slot` are null, and `live-cards-unchanged` passes. A file-level hook also checks that the checkout's own live card files hash the same after the suite.

| Scenario | Exit | Failed checks | What the player sees |
|---|---|---|---|
| attack 0 / stars 9 / health 6 | 1 | `draft-schema` | `FAIL draft-schema: attack 0 is outside 1..6` (and similar) |
| Slot `wizard-hellfire` (a real card, not a brief troop) | 1 | `draft-schema` | `baseCard wizard-hellfire is not one of the brief's base troops` |
| Faction `outlaw-billy` | 1 | `draft-schema` | `baseCard must be a troop id such as cowboy-billy` |
| request.txt edited after prepare, valid draft | 1 | `request-unchanged` | `FAIL request-unchanged: request.txt matches the bytes prepare staged` |
| brief.json widened to admit `wizard-dragon`, draft uses it | 1 | `brief-unchanged` | draft passes the schema against the tampered brief; only the brief hash refuses it |
| prepare.json base changed to `bbbb…`, brief keeps `aaaa…` | 1 | `sandbox` | `FAIL sandbox: git archive bbbbbbbbbbbb: fatal: ...` |
| verify run a second time after a FAIL, with a corrected draft | 2 | n/a | `card-forge: .artifacts/card-forge/verdict.json already exists; run prepare for a new request`; first verdict byte-identical |

For schema refusals the verdict lists only the pre-snapshot checks, and `draft` is null. The header reads `card-forge verify: FAIL`. For a schema-valid draft the header names the variant, for example `FAIL for "Dusty Pete" in the cowboy-billy slot`.

## Observations for the coordinator (not changed here; script not owned)

- **Provenance gap:** `verify` does not compare `brief.base` with `prepare.json`'s `base`, and it does not check `prep.schema`. `inspectRun`, which runs during `prepare`, checks both. The base-mismatch case is refused only because the commit cannot be extracted (`sandbox`). No dedicated check names the mismatch. `prepare.json` is not hash-bound by anything, so a recorded base that differs from the brief's but does exist would be extracted and played. That outcome was not run.
- **Message clarity:** failed checks print their positive description, for example `FAIL request-unchanged: request.txt matches the bytes prepare staged`. A player could read that as success.

## Checks actually run

- `node --test tests/match/card-forge-rejections.test.js`, first run: exit 1. Three cases failed because the test expected a bare `FAIL` header, but the header names the draft when the draft is valid. I fixed the test assertion. The script did not change.
- `node --test tests/match/card-forge-rejections.test.js`, second run: exit 0, 5 tests, 5 passed, 0 failed, about 1.1 s.
- `git status --short`: exit 0. The only new files from this task are the test and this note. `.kiro/agents/native-forge-failures.json` and `node_modules` were already untracked before this work.

Pending: an actual native workflow run with a forged card; a human read of the refusal messages.
