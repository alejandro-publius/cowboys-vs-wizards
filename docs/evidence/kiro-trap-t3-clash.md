# Kiro trap T3: trap trigger at the clash (issue #92)

Author: Kiro. The coordinator invoked the work as a Kiro CLI 3.4 V3 run with `--model claude-opus-5.5`. The session's own system context names the client as "Kiro IDE" (session `sess_39732fca-adce-4c88-add4-f7d10d958cb4`); both labels are recorded without choosing one. Model recorded in this session's `session.json`: `reasoningModelId: "qdev::claude-opus-5.5"`.
Credits: the session's `session.json` and `messages.jsonl` held no credit or billing field when this note was written (2026-11-17 10:26 PST). The only usage value is `contextUsage.usagePercentage`, which measures the context window and is not a credit figure. No credit figure is recorded, and none is inferred.
Branch: `kiro/trap-clash-92`, base main `a327b1b` (after T1 #91 and T2 #93). Date: 2026-11-17 (America/Los_Angeles).
Scope: T3 in [tasks.md](../../.kiro/specs/trap-zone/tasks.md), headless rules only, per [trap-prototype-contract.md](../submission/trap-prototype-contract.md) sections 2, 4, 5 and 9 (A + X). Follows [kiro-trap-t2-actions.md](kiro-trap-t2-actions.md).

## Change

- [src/game/clash.js](../../src/game/clash.js): `resolveClash` calls a new local `triggerTraps` only when `state.traps?.enabled === true`, before the attack snapshot and before any damage.
  - A trap is armed when `round > setRound`. It targets the enemy troop with the highest printed attack (`CARDS[id].attack`), tie to the lowest slot. With no enemy troop it stays set and unspent.
  - Both sides' targets are computed first from the untouched board. No trap leaves its zone until both choices are made, so the result does not depend on `SIDES` order.
  - Then, in `SIDES` order, each trigger clears its zone, pushes the trap `cardId` to its owner's discard and emits `{ type: "trap-trigger", side, cardId, target: { side, slot, cardId }, cancelled }`. `cancelled` is the printed attack. There is no `discard` event.
  - The cancelled troop is left out of the attack snapshot, so it emits no `damage` event (no zero-damage event). It stays on the board, still blocks its lane, takes damage and is defeated normally.
  - The `clash` event is still emitted by `applyEndPhase` in [actions.js](../../src/game/actions.js), so the order is `clash`, `trap-trigger*`, `damage*`, `defeat*`, `result`. `actions.js` is unchanged. No RNG draw. Damage, defeat and result logic and event shapes are unchanged for uncancelled troops.
- [tests/game/trap-clash.test.js](../../tests/game/trap-clash.test.js): 17 tests, new.

## Test-only trap fixture

`CARDS` and `DECKS` stay as shipped and frozen, and no trap card content is approved. The test uses `test-fixture-trap-1` (cowboy) and `test-fixture-trap-w1` (wizard). It places them in a trap zone, or in a hand for `set-trap`, by editing a cloned `createMatch(0, { traps: true })` state. `set-trap` receives them through the existing T2 `cards` option of `applyAction`. `resolveClash` never looks up the trap card. Board troops in fixtures are moved out of that side's own deck or hand, so each side still holds its 12 shipped cards plus the fixture. These hand-built states are not dealt matches. They check rules only and say nothing about balance.

## Tests (contract section 9 names they cover)

- Not armed in the set round: no trigger, the trap stays, and the events equal the same clash without a trap. Set in round N through `applyAction`: no trigger in round N, trigger in round N+1, placed right after `clash`, with the exact event shape and `revision`.
- Target choice across attacks 1, 2 and 3 in all six lane orders, a lone troop, and ties at attack 1 and 2 going to the lowest slot. The wizard trap against the cowboy board follows the same rule.
- No enemy troop: the trap stays set and unspent, and triggers once a troop arrives.
- The cancelled attacker emits no `damage` and no zero-amount event, still blocks (the enemy's attack goes to the troop, not the base) and takes damage. In a second case it is defeated by that damage in the same clash.
- Uncancelled troops keep the simultaneous snapshot: a troop brought to zero still attacks.
- Two armed traps: the events equal the cowboy-only trigger followed by the wizard-only trigger, and neither trap cancels the other. Mirrored boards give mirrored choices and outcomes. Only one side armed: the other side's trap from this round stays.
- Round 9: a trap set in round 8 triggers in round 9, followed by `result`. In this fixture, without the trap the wizard wins on the round limit; with it the match is a 3 to 3 draw.
- Lethal base hit: a 3-attack dragon against a 2-orb unblocked cowboy base. Without a trap the base is destroyed. With an armed trap there is no damage, the base keeps 2 orbs and the match continues.
- Card conservation per side, fixture included, across a set and two triggers. Same input gives the same output, and the input state is not mutated.
- Flag `enabled: false` or no `traps` key: a trap-shaped zone is ignored. `CARDS` holds no `kind: "trap"` card.
- Seeds 0 and 60, default CPU on both sides: the events and results are identical with traps off and with traps on and no trap dealt. Seed 60 ends in a cowboy win (base-destroyed) in round 9 at revision 40.

## Commands run (actual results)

- `node --test tests/game/trap-clash.test.js`, first run: 15 pass, 2 fail. Both were test faults. In the N+1 fixture, a sheriff was defeated in round N, so round N+1 had no damage. The round 9 fixture expected a cowboy win, but its blocked lanes ended level. The fixtures were changed (mounted billy; unblocked lanes) and the round 9 test now also checks the no-trap result. No engine change was needed. Second run: 17 pass, 0 fail.
- `node --test` on trap-actions, trap-state, match, invariants and cpu, once: 56 tests, 56 pass.
- Seed parity against base: `node scripts/play-match.mjs --seed N` for seeds 0 and 60, default CPU and `--cowboy random --wizard random`, captured before the change and again after it. All 4 outputs are byte-identical. The SHA-256 values are `5978b623…4c942` (seed 0 default), `1a60048a…ae11e` (seed 60 default), `b37fe71a…06c94c` (seed 0 random) and `4dda1008…c646` (seed 60 random). The two default values match those recorded for T2.
- `npm test` (`scripts/verify-duel.mjs`), once: 260 tests, 260 pass, 0 fail, 0 skipped. The sourced animation structure check passed 2/2. The headless Chrome replay was not run (pending, outside this task).
- `node scripts/check-links.mjs`: 160 Markdown files, 573 relative links and images, 0 broken. `git diff --cached --check`: no output, exit 0.

## Not done (later tasks)

- T4: public view and redaction. `trap-set` still names the card to every viewer.
- T5 and T6: CPU and presenter. The presenter does not know `trap-trigger`, and no shipped deck deals a trap, so the default game cannot emit it.
- T7 properties, the trap card content (O1, O2) and the tie-break approval (O3, lowest slot assumed). The `[ ]` T3 box in tasks.md is left for the coordinator.
