import test from "node:test";
import assert from "node:assert/strict";
import { CARDS, SIDES, opponent } from "../../src/game/cards.js";
import { createMatch } from "../../src/game/state.js";
import { applyAction } from "../../src/game/actions.js";
import { legalActions } from "../../src/game/legal.js";
import { chooseAction } from "../../src/game/cpu.js";
import { publicEvents, publicState } from "../../src/game/view.js";

// Issue #94, trap T4: the public view and event projection hide a face-down
// trap's identity from the opponent (contract sections 5 and 6). The shipped
// catalog has no trap card, so these tests add fixture IDs that exist only in
// this file, through applyAction's and legalActions' `cards` option, to a
// cloned createMatch(0, { traps: true }) state. CARDS and DECKS stay as shipped.
const TRAP_OF = { cowboy: "test-fixture-view-trap-c", wizard: "test-fixture-view-trap-w" };
const TEST_CARDS = Object.freeze({
  ...CARDS,
  ...Object.fromEntries(
    SIDES.map((side) => [TRAP_OF[side], Object.freeze({ id: TRAP_OF[side], side, kind: "trap", name: "Test fixture trap" })]),
  ),
});
const OPT = { cards: TEST_CARDS };

// Seed 0 trap match. Each side gets its fixture trap added to its hand and the
// first troop of its deck moved to slot 1, so each trap has a target.
function fixture() {
  const state = structuredClone(createMatch(0, { traps: true }));
  for (const side of SIDES) {
    const own = state.sides[side];
    own.hand.push(TRAP_OF[side]);
    const troop = own.deck.find((id) => CARDS[id].kind === "troop");
    own.deck.splice(own.deck.indexOf(troop), 1);
    own.board[1] = { cardId: troop, health: CARDS[troop].health };
  }
  return state;
}

function act(state, action) {
  const applied = applyAction(state, { side: state.activeSide, revision: state.revision, ...action }, OPT);
  assert.equal(applied.ok, true, applied.reason);
  return applied;
}

// Round 1: each side, in its own phase, sets its trap and ends the phase.
// Round 2: both end, and the clash triggers both traps.
function setThenTrigger() {
  const log = [];
  let state = fixture();
  for (let i = 0; i < 2; i++) {
    const setter = state.activeSide;
    for (const action of [{ type: "set-trap", cardId: TRAP_OF[setter] }, { type: "end-phase" }]) {
      const applied = act(state, action);
      log.push(...applied.events);
      state = applied.state;
    }
  }
  const afterSet = state;
  for (let i = 0; i < 2; i++) {
    const applied = act(state, { type: "end-phase" });
    log.push(...applied.events);
    state = applied.state;
  }
  return { afterSet, afterTrigger: state, log };
}

function keysDeep(value, out = new Set()) {
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      out.add(key);
      keysDeep(child, out);
    }
  }
  return out;
}

test("own trap shows cardId and setRound; the opponent's shows only faceDown and setRound; empty is null", () => {
  const { afterSet } = setThenTrigger();
  assert.equal(afterSet.round, 2);
  for (const viewer of SIDES) {
    const view = publicState(afterSet, viewer);
    const enemy = opponent(viewer);
    assert.deepEqual(view.sides[viewer].trap, { cardId: TRAP_OF[viewer], setRound: 1 });
    assert.deepEqual(view.sides[enemy].trap, { faceDown: true, setRound: 1 });
    assert.equal(JSON.stringify(view).includes(TRAP_OF[enemy]), false, `${viewer} sees ${enemy}'s trap ID`);
    assert.equal(JSON.stringify(view).includes(TRAP_OF[viewer]), true);
  }
  const empty = fixture();
  for (const viewer of SIDES) {
    for (const side of SIDES) assert.equal(publicState(empty, viewer).sides[side].trap, null);
  }
});

test("only the viewer's own tactical marker is visible; the trap flag marker is kept", () => {
  let state = fixture();
  const setter = state.activeSide;
  state = act(state, { type: "set-trap", cardId: TRAP_OF[setter] }).state;
  const own = publicState(state, setter);
  const other = publicState(state, opponent(setter));
  assert.deepEqual(own.allowances[setter], { summonUsed: false, castUsed: true, tactical: "trap" });
  assert.deepEqual(own.allowances[opponent(setter)], { summonUsed: false, castUsed: false });
  assert.deepEqual(other.allowances[setter], { summonUsed: false, castUsed: true });
  assert.deepEqual(other.allowances[opponent(setter)], { summonUsed: false, castUsed: false, tactical: null });
  for (const view of [own, other]) assert.deepEqual(view.traps, { enabled: true, rulesVersion: state.traps.rulesVersion });
});

test("no deck order, opponent hand, seed or rng in either view; round and revision match the state", () => {
  const { afterSet, afterTrigger } = setThenTrigger();
  for (const state of [fixture(), afterSet, afterTrigger]) {
    for (const viewer of SIDES) {
      const view = publicState(state, viewer);
      const enemy = opponent(viewer);
      const keys = keysDeep(view);
      for (const key of ["seed", "rng", "deck", "actionIds"]) assert.equal(keys.has(key), false, key);
      assert.equal("hand" in view.sides[enemy], false);
      assert.deepEqual(view.sides[viewer].hand, state.sides[viewer].hand);
      const json = JSON.stringify(view);
      for (const id of [...state.sides[enemy].hand, ...state.sides[enemy].deck, ...state.sides[viewer].deck]) {
        assert.equal(json.includes(`"${id}"`), false, `${viewer} sees ${id}`);
      }
      assert.equal(view.round, state.round);
      assert.equal(view.revision, state.revision);
      assert.equal(view.sides[enemy].handCount, state.sides[enemy].hand.length);
      assert.equal(view.sides[enemy].deckCount, state.sides[enemy].deck.length);
    }
  }
});

test("legalActions on the owner's view equals legalActions on the full state, with the fixture catalog", () => {
  let state = fixture();
  for (let i = 0; i < 2; i++) {
    const side = state.activeSide;
    const before = legalActions(publicState(state, side), side, OPT);
    assert.deepEqual(before, legalActions(state, side, OPT));
    assert.deepEqual(before.filter((a) => a.type === "set-trap"), [{ type: "set-trap", side, revision: state.revision, cardId: TRAP_OF[side] }]);
    for (const action of before) assert.equal(applyAction(state, action, OPT).ok, true, action.type);
    state = act(state, { type: "set-trap", cardId: TRAP_OF[side] }).state;
    const after = legalActions(publicState(state, side), side, OPT);
    assert.deepEqual(after, legalActions(state, side, OPT));
    assert.equal(after.some((a) => a.type === "set-trap" || a.type === "spell"), false);
    state = act(state, { type: "end-phase" }).state;
  }
});

test("publicEvents hides an opponent's trap-set cardId, keeps the owner's, and reveals trap-trigger", () => {
  const { log, afterTrigger } = setThenTrigger();
  const raw = structuredClone(log);
  assert.equal(log.filter((e) => e.type === "trap-set").length, 2);
  assert.equal(log.filter((e) => e.type === "trap-trigger").length, 2);
  for (const viewer of SIDES) {
    const seen = publicEvents(log, viewer);
    assert.equal(seen.length, log.length);
    seen.forEach((event, i) => {
      if (log[i].type === "trap-set" && log[i].side !== viewer) {
        const { cardId, ...rest } = log[i];
        assert.equal(cardId, TRAP_OF[log[i].side]);
        assert.deepEqual(event, rest);
      } else {
        assert.deepEqual(event, log[i]);
      }
    });
    // Before the trigger nothing names the opponent's trap; the trigger does.
    const enemy = opponent(viewer);
    const firstTrigger = seen.findIndex((e) => e.type === "trap-trigger");
    assert.equal(JSON.stringify(seen.slice(0, firstTrigger)).includes(TRAP_OF[enemy]), false);
    assert.equal(seen.find((e) => e.type === "trap-trigger" && e.side === enemy).cardId, TRAP_OF[enemy]);
  }
  assert.deepEqual(log, raw);
  // After the trigger the spent trap is public in discard, and the zone is empty.
  for (const viewer of SIDES) {
    const view = publicState(afterTrigger, viewer);
    for (const side of SIDES) {
      assert.equal(view.sides[side].trap, null);
      assert.equal(view.sides[side].discard.includes(TRAP_OF[side]), true);
    }
  }
});

test("views and projected events are independent deep copies", () => {
  const { afterSet, log } = setThenTrigger();
  const before = structuredClone(afterSet);
  for (const viewer of SIDES) {
    const view = publicState(afterSet, viewer);
    view.sides[viewer].trap.cardId = "x";
    view.sides[viewer].hand.push("x");
    view.sides[viewer].board[1].health = 99;
    view.allowances[viewer].tactical = "x";
    view.traps.enabled = false;
  }
  assert.deepEqual(afterSet, before);
  const rawLog = structuredClone(log);
  const seen = publicEvents(log, "cowboy");
  seen.forEach((event, i) => assert.notEqual(event, log[i]));
  for (const event of seen) {
    for (const value of Object.values(event)) if (value && typeof value === "object") value.mutated = true;
    event.type = "x";
  }
  assert.deepEqual(log, rawLog);
  assert.throws(() => publicEvents(log, "sheriff"), TypeError);
  assert.throws(() => publicState(afterSet, "sheriff"), TypeError);
});

// publicState as it was at 3b99990, before T4, for the flag-off comparison.
function legacyPublicState(state, side) {
  const sides = {};
  for (const each of SIDES) {
    const { baseOrbs, deck, hand, board, discard } = state.sides[each];
    sides[each] = { baseOrbs, deckCount: deck.length, handCount: hand.length, board, discard };
    if (each === side) sides[each].hand = hand;
  }
  const { revision, round, startingSide, activeSide, allowances, result } = state;
  const outcome = result && (result.winner === null ? "draw" : result.winner === side ? "win" : "loss");
  return structuredClone({ viewer: side, revision, round, startingSide, activeSide, allowances, result: result && { ...result, outcome }, sides });
}

test("flag off, seeds 0 and 60: every view of a default CPU match equals the pre-T4 view, keys and order included", () => {
  for (const seed of [0, 60]) {
    let state = createMatch(seed);
    let checked = 0;
    for (;;) {
      for (const viewer of SIDES) {
        const view = publicState(state, viewer);
        assert.equal(JSON.stringify(view), JSON.stringify(legacyPublicState(state, viewer)), `seed ${seed} rev ${state.revision}`);
        assert.equal("traps" in view, false);
        assert.equal("trap" in view.sides[viewer], false);
        checked += 1;
      }
      if (state.result) break;
      const applied = applyAction(state, chooseAction(publicState(state, state.activeSide)));
      assert.equal(applied.ok, true, applied.reason);
      assert.deepEqual(publicEvents(applied.events, "cowboy"), applied.events);
      assert.deepEqual(publicEvents(applied.events, "wizard"), applied.events);
      state = applied.state;
    }
    assert.ok(checked > 2);
  }
  // A state with traps.enabled false is treated as off.
  const disabled = structuredClone(createMatch(0, { traps: true }));
  disabled.traps.enabled = false;
  for (const viewer of SIDES) assert.equal(JSON.stringify(publicState(disabled, viewer)), JSON.stringify(legacyPublicState(disabled, viewer)));
});
