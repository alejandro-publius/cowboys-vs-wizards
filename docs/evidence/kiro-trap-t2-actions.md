# Kiro trap T2: set-trap action and legal list (issue #90)

Author: Kiro. The coordinator invoked the work as a Kiro CLI V3 run on Claude Opus 5.5. The session's own system context names the client as "Kiro IDE" (session `sess_0482853e-6d51-450b-bb09-5a61f6095b8a`); both labels are recorded without choosing one. Model in this session's `session.json`: `modelId: "claude-opus-5.5"`.
Credits: the session's `session.json` and `messages.jsonl` held no `usage` value when this note was written (2026-11-17 10:19 PST). No credit figure is recorded, and none is inferred.
Branch: `kiro/trap-actions-90`, base main `8b89a24` (after T1, PR #91). Date: 2026-11-17 (America/Los_Angeles).
Scope: T2 in [tasks.md](../../.kiro/specs/trap-zone/tasks.md), headless rules only, per [trap-prototype-contract.md](../submission/trap-prototype-contract.md) sections 2 and 3 (A + X). Follows [kiro-trap-t1-state.md](kiro-trap-t1-state.md).

## Change

- [src/game/actions.js](../../src/game/actions.js)
  - New action `{ type: "set-trap", side, revision, cardId, actionId? }`. The shared checks run first in the existing order. The set-trap checks then run in contract section 3 order: `traps-disabled`, `card-not-in-hand`, `not-a-trap`, `trap-too-late` (`round === MAX_ROUNDS`), `trap-zone-full`, `trap-after-spell`.
  - When accepted, the card leaves the hand, `sides[side].trap = { cardId, setRound: round }`, `castUsed = true`, `tactical = "trap"`, and the revision rises by one. There is no RNG draw. The action emits `{ type: "trap-set", side, cardId, revision, actionId? }`.
  - On a trap match only (`state.traps?.enabled`), a summon after a set is rejected with `summon-after-trap`, a cast after a set with `cast-after-trap`, and an accepted spell sets `tactical = "spell"`. `summon-after-spell` and `cast-used` are unchanged for spells. Flag off, spells add no `tactical` key.
  - `applyAction(state, action, { cards = CARDS } = {})`: the optional `cards` catalog is read only by the `not-a-trap` check.
- [src/game/legal.js](../../src/game/legal.js): `legalActions(state, side, { cards = CARDS } = {})` lists one `set-trap` per trap card in hand, after spells and before `end-phase`. The list includes it only when the match has traps on, the cast is unused, `round < MAX_ROUNDS` and the zone is empty. The existing kind, star and relocate lookups read the same `cards` argument, which defaults to `CARDS`.
- [tests/game/trap-actions.test.js](../../tests/game/trap-actions.test.js): 12 tests, new.

## Test-only trap fixture

`CARDS` and `DECKS` are frozen, and no trap name, ID, copy count or deck change is approved. The test file therefore defines `TEST_CARDS = { ...CARDS, "test-fixture-trap-1": { kind: "trap", ... }, "test-fixture-trap-2": ... }` and passes it as the `cards` option. It places a fixture ID in the Cowboy hand by editing a cloned `createMatch(0, { traps: true })` state. No shipped catalog, deck, spec JSON or generated file changes, and one test asserts that `CARDS` holds no `kind: "trap"` card. The option is one defaulted parameter on two functions. There is no registry or injection layer.

Limit: a fixture state is built by hand, so it is not a dealt match, and its hand holds a card that is in no deck. Callers that pass `cards` must include every `CARDS` entry unchanged. `legalActions` still throws on a hand ID missing from its catalog, as it did before.

## Not done (later tasks)

- T3: the trap's armed check and `trap-trigger` in `resolveClash`. A set trap stays in the zone across rounds and does nothing.
- T4: `publicState` and event redaction. The `trap-set` event carries `cardId` for every viewer, and the public view does not yet copy `trap` or `traps`, so `legalActions` on a public view lists no `set-trap`.
- T5 and T6: CPU and presenter. The CPU never sees a trap card, since none is dealt.
- The `[ ]` T2 box in tasks.md is left for the coordinator.

## Commands run (actual results)

- `node --test tests/game/trap-actions.test.js`, first run: 8 pass, 4 fail. All four failures were test faults. `undefined` as an options argument picked up the helper's default. A second set used the same card, so it got `card-not-in-hand`, which is correct under section 3 order. A comparison called `legalActions` on a fixture hand without the catalog, and it threw. After fixing the tests: 12 pass, 0 fail. No engine change was needed between the two runs.
- `node --test` on trap-actions, trap-state, match, cpu and invariants, once, before the test fixes. The failure output I filtered matched the trap-actions failures above; per-file counts were not captured. The other four suites passed in the later `npm test` run.
- `npm test` (`scripts/verify-duel.mjs`), once: 243 tests, 243 pass, 0 fail, 0 skipped. The sourced animation structure check passed 2/2. This script runs the Node suites only. The headless Chrome seed 0 and seed 60 replay was not run (pending).
- Seed parity against base: `scripts/play-match.mjs` from a `git archive 8b89a24` copy against the working tree, for seeds 0 and 60, with the default CPU and with `--cowboy random --wizard random`. The SHA-256 of the trace output is identical in all 4 cases. For example, seed 0 default is `5978b623…4c942` and seed 60 default is `1a60048a…ae11e`. Seed 60 default: cowboy wins (base-destroyed) in round 9 after 40 actions.
- In-test parity: a first-legal-action policy over full matches for seeds 0 and 60 gives the same action and event log with the flag off, with `{ cards: CARDS }`, with the fixture catalog, and with `traps: true` and no trap card dealt.
- `node scripts/check-links.mjs`: 159 Markdown files, 567 relative links and images, 0 broken. `git diff --check`: no output, exit 0.
