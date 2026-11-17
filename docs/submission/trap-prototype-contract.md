# Trap prototype contract: A + X (first experiment)

Author: Kiro CLI 3.4 V3. Issue: alejandro-publius/cowboys-vs-wizards#85. Base: main 769a4fc.
Status: text contract for a feature-flagged prototype. Spec and docs only. No runtime code, art, card name, copy count or deck change. Nothing here has been implemented or run.
Companion: [trap-rule-decision.md](trap-rule-decision.md) (PR #84 study), [requirements](../../.kiro/specs/trap-zone/requirements.md), [design](../../.kiro/specs/trap-zone/design.md), [tasks](../../.kiro/specs/trap-zone/tasks.md), [review note](../evidence/kiro-trap-ax-spec-review.md).

## 1. Which option, and why it differs from the study

The Kiro shadow study (PR #84) recommended **B + X** because B is additive and easier to integrate. The coordinator chose **A + X** as the first experimental prototype because it gives faster, strategically meaningful turns: a phase holds at most 3 actions, and "spell or trap" is a real choice. This is a different priority, not a correction of the study. The study's finding stands: the A against B balance gap is small, and A's cost is a rules trap that this contract must remove with text (section 3).

| Option | Allowance | Effect | Role in this plan |
|---|---|---|---|
| **A + X** | shared with cast | cancel highest-attack enemy attack | First prototype (chosen by coordinator) |
| B + X | separate `trapSet` | same | Retained alternative; study's recommendation |
| A + Y | shared with cast | prevent at most 1 damage | Retained alternative if X is too swingy |

Tradeoff: A costs implementation touches in `actions.js` and `legal.js` (the summon and cast checks must learn about a set) and costs the player a spell in the phase they set a trap. B costs one more decision per phase and a 4-action phase. Switching A to B later changes one allowance and the rejection set in section 3; it does not change X, view or events.

## 2. Fixed rules (flag `traps: true`; flag off changes nothing)

1. One dedicated trap slot per side. Card kind `trap`, unique ID. No spell is converted. No trap card exists in the shipped card table.
2. Phase order for the active side: summon (optional), then **at most one of** cast one spell **or** set one trap, then end phase. The cast and the set share one allowance, `castUsed`.
3. Setting a trap blocks a later summon in the same phase, exactly as casting does.
4. A trap set in round N is armed from round N+1 (`round > setRound`). It is hidden from the opponent until it triggers.
5. **X**: at the next eligible clash, an armed trap cancels the **attack** of the enemy troop with the highest attack (tie: lowest lane). The troop stays on the board, keeps its health and can be targeted normally. Only its damage for that clash is removed. The trap goes to discard. One use.
6. Eligible clash: an armed trap and at least one enemy troop on the pre-trigger board. With no enemy troop the trap stays set and is not spent.
7. Both sides' traps evaluate the same pre-trigger snapshot. Neither can cancel the other. `trap-trigger` events precede all damage of that clash.
8. Round 9 (`MAX_ROUNDS`): a set is useless (the match ends before round 10) and is rejected with `trap-too-late`. A trap set in an earlier round that is still armed in round 9 may still trigger.
9. Flag off: no new state key, no new action, no new event. Default 12-card decks, normal rules, seed 0 and seed 60 replays are unchanged. `?pace=fast` is a pacing option that touches only pause constants and is unaffected by traps.

## 3. `set-trap` semantics (clarifies R2, T2)

Action: `{ type: "set-trap", side, revision, cardId, actionId? }`.

Shared checks first, as for every action, in the existing order: `match-over`, `invalid-action`, `duplicate-action`, `stale`, `wrong-side`. Then, first failing wins:

| Order | Reason | When | Player-facing text |
|---|---|---|---|
| 1 | `traps-disabled` | flag off | "Traps are not in this match." |
| 2 | `card-not-in-hand` | `cardId` not in this side's hand | "That card is not in your hand." |
| 3 | `not-a-trap` | card kind is `troop` or `spell` | "Only a trap card can be set." |
| 4 | `trap-too-late` | `round === MAX_ROUNDS` | "Too late: a trap set in the last round can never spring." |
| 5 | `trap-zone-full` | zone occupied (armed or set this round) | "Your trap zone already holds a trap." |
| 6 | `trap-after-spell` | `castUsed` is true because a spell was cast | "You already cast a spell this round. A trap uses the same action." |

Notes:
- Zone check precedes the allowance check, so a second set in one round reports `trap-zone-full`, not an allowance reason.
- A set after a summon is legal. A set before a summon is legal, and then the summon is rejected (below).
- `trap-too-late` is checked before zone and allowance so the player learns the round is the problem. It applies to every set in round 9, including from an empty zone.
- A rejection returns the same input state object and emits no event, as existing rejections do.

Changed rejections for the existing actions, flag on only. Today a summon after a cast returns `summon-after-spell` and a second cast returns `cast-used`.

| Action | Condition | Reason | Player-facing text |
|---|---|---|---|
| `summon` | trap set earlier this round | `summon-after-trap` | "You set a trap this round. Summon before you set a trap." |
| `cast` (spell) | trap set earlier this round | `cast-after-trap` | "You set a trap this round. A spell uses the same action." |
| `set-trap` | spell cast earlier this round | `trap-after-spell` | see table above |

To tell a spell from a trap in a shared `castUsed`, flag-on state adds `allowances[side].tactical = null | "spell" | "trap"`, reset each round-start, in place of a separate `trapSet` boolean. `castUsed` keeps its current meaning for flag-off code and tests. This is a design choice for the prototype, and the alternative is a second boolean. Existing reason strings `summon-after-spell` and `cast-used` are unchanged for spells.

Apply: remove the card from hand, set `trap = { cardId, setRound: round }`, `allowances[side].castUsed = true`, `tactical = "trap"`. No RNG draw.

Event: `{ type: "trap-set", side, revision, actionId?, cardId }`. Public to the setter. For the opponent: `{ type, side, revision, actionId? }` with no `cardId` (matches how `draw` hides the card).

## 4. `trap-trigger` semantics (clarifies R4, R9, T3)

Emitted inside `resolveClash` before any `damage` event, once per triggering side, in `SIDES` order:

`{ type: "trap-trigger", side, cardId, target: { side, slot, cardId }, cancelled: <attack value> }`

- `side` is the trap owner. `target` is the enemy troop whose attack was cancelled. `cancelled` is its attack before cancellation.
- Public to both viewers. The card is revealed at this event. A later `discard` already public.
- The cancelled attacker emits no `damage` event, so X produces no zero-damage event. (Study note: Y would emit a zero or reduced `damage`.)
- The cancelled troop is not defeated by this, and is not exempt from damage taken in the same clash.
- Highest attack is computed on the pre-trigger board using `CARDS[id].attack`. Tie: lowest lane index. A troop whose health is 0 or less after earlier effects is not on the board.
- If the highest-attack enemy troop would deal 0 damage for another reason, the trap is still spent on it. This is deliberate: the choice is automatic and made on the snapshot.

## 5. Event order across turns

A trap set by the second actor in round N, with the opponent's clash following, then round N+1:

1. Round N, setter's phase: `trap-set`, then `phase-end`. Opponent sees `trap-set` without `cardId`.
2. Round N clash: `clash`, then no `trap-trigger` (not armed: `setRound === round`), then `damage*`, `defeat*`.
3. Round N+1: `round-start`, `draw` (per side), `phase-start`, actions, `phase-end`, and finally `clash`.
4. Round N+1 clash: `clash`, `trap-trigger*` (SIDES order), `damage*` (minus cancelled attacks), `defeat*`, then `result` if the match ends.
5. `discard` for the spent trap is emitted with or immediately after `trap-trigger`, before `damage`. The prototype task must pin one placement and test it.

The viewer sees no event at the moment a trap becomes armed. Armed is derived: `setRound < round`. The setter's own view shows "armed from next round" until then (section 7).

## 6. CPU and public view (clarifies R5, R11)

Public view (`publicState(state, viewer)`):
- Own side: `trap: { cardId, setRound }` or `null`.
- Opponent side: `trap: { faceDown: true, setRound }` or `null`. No `cardId`.
- `allowances` for the viewer's own side only expose `tactical`; the opponent's allowances are not needed.
- Flag off: no `trap` key and no `traps` key.

CPU (`chooseAction(publicState(state, "wizard"))`, no RNG, no hidden information):
1. Summon first if the existing CPU rule would summon.
2. Then choose between the one tactical action. Proposed deterministic rule: if the hand holds a trap card, the zone is empty, `round < MAX_ROUNDS`, and `set-trap` is in the legal list, set the trap. Otherwise cast as today. Otherwise end the phase.
3. Never request `set-trap` in round 9 (the legal list omits it with `trap-too-late`).
4. The CPU reads the opponent's face-down marker but cannot read the card. It may not condition on `setRound` beyond what a human sees.

The "set whenever possible" rule trades spells for traps, which may weaken the CPU. It is a proposal; the final rule is a later task (T5) with a seeded rerun on seeds 0 and 60.

## 7. Player-facing text mock (not implemented)

Text only. No art, no UI, no card name. Strings are placeholders for the user to approve.

Trap zone, own view:
- Empty: "Trap zone: empty"
- Set this round: "Trap set. It springs from next round."
- Armed: "Trap armed. It springs at the next clash if the enemy has a troop."

Trap zone, opponent view: "Enemy trap: set" (no name) and, if set this round, no extra hint.

Action row:
- "Set trap" (enabled only when legal). Disabled tooltip comes from the rejection text in section 3.
- After a spell: "Set trap (blocked: you already cast this round)".
- After a trap: "Cast spell (blocked: you set a trap this round)".

Round summary line, once per phase: "This phase: summon, then one spell or one trap."

Trigger log: "Your trap springs. Enemy [troop name] loses its attack this clash."  /  "An enemy trap springs. Your [troop name] loses its attack this clash." [troop name] is the existing card name.

## 8. Criteria for reversing A or X

These are proposed gates for the user to confirm or change. None has been measured. Study numbers are from a shadow model and are direction only.

Reverse **A to B** if any of:
- A human decision-load playtest (3 to 5 players) finds that "spell or trap" is not understood after the section 7 text, measured as at least half of testers setting a trap while believing they could still summon or cast, or at least 2 of 5 reporting the shared action as unclear.
- Real-engine runs show the shared allowance makes the setter lose more than the pre-agreed amount of win share against the same deck without traps. The shadow study estimated 1 to 1.5 points where the allowance binds, with intervals touching zero. A real-engine gap above the agreed band reverses A.
- `summon-after-trap` or `trap-after-spell` rejections are a large share of rejected actions in human playtests (agreed threshold, for example more than 1 in 10 phases with a trap held). That shows the text does not prevent the mistake.

Reverse **X to Y** if any of:
- Playtest games with traps are decided mainly by one cancelled big attack: for example, in recorded trap games the matches whose result flips if the cancelled attack is restored exceed a threshold the user sets.
- One-faction win share moves by more than the pre-agreed band with the user-approved copy count (the study found 8 to 22 points for a free trap in hand under either effect, far above any acceptable value).
- Presenter work shows a cancelled attacker (no `damage` event) cannot be shown clearly without a new cue. Y emits a reduced `damage` event and may fit the present presenter better.

Keep A and X if neither set of conditions is observed. Each reversal is a small spec change, and the retained alternatives stay documented here.

## 9. Named tests (all PENDING, none run)

Names are for the later implementation tasks. This job ran only `node scripts/check-links.mjs` and `git diff --check`.

`tests/game/traps.test.js` (new, later):
- `traps flag off: createMatch(0) and createMatch(60) equal the baseline state`
- `set-trap: each rejection returns the same state object, in the section 3 order`
- `set-trap after a summon is legal; summon after a set is rejected with summon-after-trap`
- `cast after a set is rejected with cast-after-trap; set after a cast is rejected with trap-after-spell`
- `set-trap in round 9 is rejected with trap-too-late and is absent from legalActions`
- `trap set in round N does not trigger in round N and triggers in round N+1`
- `X cancels the highest-attack enemy attack; ties go to the lowest lane; the troop stays on the board`
- `no enemy troop keeps the trap set and unspent`
- `two armed traps evaluate one snapshot and neither cancels the other`
- `trap-trigger precedes damage; the cancelled attacker emits no damage`
- `trap-set event for the opponent has no cardId; trap-trigger is public`
- `public view: opponent trap is { faceDown, setRound } and never carries cardId`
- `CPU never sets in round 9 and never reads the opponent trap card`
- `card conservation and deterministic replay with the flag on`

`tests/match/presenter.test.js` (later): `displayed state deep-equals to after a batch with trap-set and trap-trigger`; `reset() mid-trigger leaves no callback acting`.

Existing suites that must still pass with the flag off: `tests/game/match.test.js`, `tests/game/cpu.test.js`, `tests/game/invariants.test.js`, and the seed 0 and seed 60 replay in `scripts/verify-duel.mjs`.

## 10. Still blocked on the user

Trap card name, art, text, copy count, deck migration and which existing card leaves a 12-card deck (O1, O2). The tie-break for equal attack (O3, assumed lowest lane). The string texts in section 7. The faction-balance band and reversal thresholds in section 8. No work on any of these begins before approval.
