import test from "node:test";
import assert from "node:assert/strict";
import { CARDS, SIDES } from "../../src/game/cards.js";
import { createMatch, MAX_ROUNDS } from "../../src/game/state.js";
import { applyAction } from "../../src/game/actions.js";
import { resolveClash } from "../../src/game/clash.js";
import { publicState } from "../../src/game/view.js";
import { chooseAction } from "../../src/game/cpu.js";

// Issue #92, trap T3: trap trigger at the clash (contract sections 2, 4, 5;
// effect X). The shipped catalog has no trap card and no approved trap name
// or ID, so these tests use fixture IDs that exist only in this file. They are
// placed in a trap zone (or, for set-trap, in a hand) of a cloned
// createMatch(0, { traps: true }) state. CARDS and DECKS stay as shipped; the
// fixture is in no 12-card deck. These states are built by hand and say
// nothing about real-match balance.
const COWBOY_TRAP = "test-fixture-trap-1";
const WIZARD_TRAP = "test-fixture-trap-w1";
const TEST_CARDS = Object.freeze({
  ...CARDS,
  [COWBOY_TRAP]: Object.freeze({ id: COWBOY_TRAP, side: "cowboy", kind: "trap", name: "Test fixture trap" }),
  [WIZARD_TRAP]: Object.freeze({ id: WIZARD_TRAP, side: "wizard", kind: "trap", name: "Test fixture trap" }),
});
const TRAP_OF = { cowboy: COWBOY_TRAP, wizard: WIZARD_TRAP };

// Seed 0 trap match (both boards start empty).
// `boards` maps side to an array of up to 3 card IDs (or null); each card is
// moved out of that side's deck or hand onto the board at full health, so the
// side still holds its 12 cards. `traps` maps side to a setRound.
function fixture({ round = 2, boards = {}, traps = {}, baseOrbs = {} } = {}) {
  const state = structuredClone(createMatch(0, { traps: true }));
  state.round = round;
  for (const side of SIDES) {
    const own = state.sides[side];
    (boards[side] ?? []).forEach((cardId, slot) => {
      if (cardId === null) return;
      const from = own.hand.includes(cardId) ? own.hand : own.deck;
      assert.ok(from.includes(cardId), `${cardId} not held by ${side}`);
      from.splice(from.indexOf(cardId), 1);
      own.board[slot] = { cardId, health: CARDS[cardId].health };
    });
    if (traps[side] !== undefined) own.trap = { cardId: TRAP_OF[side], setRound: traps[side] };
    if (baseOrbs[side] !== undefined) own.baseOrbs = baseOrbs[side];
  }
  return state;
}

// resolveClash on a copy; returns the new state and its events.
function clash(state) {
  const next = structuredClone(state);
  const events = [];
  resolveClash(next, (event) => events.push(event));
  return { state: next, events };
}

// Both end-phase actions of the current round through applyAction.
function endRound(state, options) {
  const events = [];
  for (let i = 0; i < 2; i++) {
    const result = applyAction(state, { type: "end-phase", side: state.activeSide, revision: state.revision }, options);
    assert.equal(result.ok, true, result.reason);
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}

const triggers = (events) => events.filter((e) => e.type === "trap-trigger");
const damageFrom = (events, side, slot) =>
  events.filter((e) => e.type === "damage" && e.attacker.side === side && e.attacker.slot === slot);
const cardCount = (state, side) => {
  const own = state.sides[side];
  return own.deck.length + own.hand.length + own.board.filter(Boolean).length + (own.trap ? 1 : 0) + own.discard.length;
};
const allIds = (state, side) => {
  const own = state.sides[side];
  return [...own.deck, ...own.hand, ...own.board.filter(Boolean).map((t) => t.cardId), ...(own.trap ? [own.trap.cardId] : []), ...own.discard].sort();
};

test("a trap set this round is not armed: no trigger, trap stays, clash equals the no-trap clash", () => {
  const boards = { cowboy: ["cowboy-sheriff-1"], wizard: ["wizard-dragon-1"] };
  const armedLater = fixture({ round: 3, boards, traps: { cowboy: 3 } });
  const plain = fixture({ round: 3, boards });
  const withTrap = clash(armedLater);
  const without = clash(plain);
  assert.deepEqual(triggers(withTrap.events), []);
  assert.deepEqual(withTrap.events, without.events);
  assert.deepEqual(withTrap.state.sides.cowboy.trap, { cardId: COWBOY_TRAP, setRound: 3 });
  assert.equal(withTrap.state.sides.cowboy.discard.includes(COWBOY_TRAP), false);
});

test("a trap set in round N triggers in round N+1 through applyAction, after the clash event and before damage", () => {
  const state = fixture({ round: 4, boards: { cowboy: ["cowboy-mounted-billy-1"], wizard: ["wizard-dragon-1"] } });
  state.startingSide = state.activeSide = "cowboy";
  const set = applyAction(state, { type: "set-trap", side: "cowboy", revision: state.revision, cardId: pushHand(state) }, { cards: TEST_CARDS });
  assert.equal(set.ok, true, set.reason);
  const roundN = endRound(set.state);
  assert.deepEqual(triggers(roundN.events), []);
  assert.deepEqual(roundN.state.sides.cowboy.trap, { cardId: COWBOY_TRAP, setRound: 4 });
  assert.equal(roundN.state.round, 5);

  const roundN1 = endRound(roundN.state);
  const types = roundN1.events.map((e) => e.type);
  const clashAt = types.indexOf("clash");
  assert.equal(types[clashAt + 1], "trap-trigger");
  assert.ok(types.slice(clashAt + 2).every((t) => t !== "trap-trigger"));
  assert.ok(types.indexOf("damage") > clashAt + 1);
  assert.deepEqual(triggers(roundN1.events), [
    {
      type: "trap-trigger",
      side: "cowboy",
      cardId: COWBOY_TRAP,
      target: { side: "wizard", slot: 0, cardId: "wizard-dragon-1" },
      cancelled: 3,
      revision: roundN.state.revision + 1,
    },
  ]);
  assert.equal(roundN1.state.sides.cowboy.trap, null);
  assert.deepEqual(roundN1.state.sides.cowboy.discard, [COWBOY_TRAP]);
  assert.equal(roundN1.events.some((e) => e.type === "discard"), false);
  assert.equal(roundN1.state.revision, roundN.state.revision + 2);
});

// Moves the fixture trap into the cowboy hand of `state` (mutates the fixture) and returns its ID.
function pushHand(state) {
  state.sides.cowboy.hand.push(COWBOY_TRAP);
  return COWBOY_TRAP;
}

test("the trap targets the highest printed attack among attacks 1, 2 and 3 in every lane order", () => {
  const ids = { 1: "wizard-skeleton-1", 2: "wizard-wizard-1", 3: "wizard-dragon-1" };
  for (const order of [[1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 1, 2], [3, 2, 1]]) {
    const { events } = clash(fixture({ boards: { wizard: order.map((a) => ids[a]) }, traps: { cowboy: 1 } }));
    const [trigger] = triggers(events);
    assert.equal(trigger.target.slot, order.indexOf(3), `order ${order}`);
    assert.equal(trigger.target.cardId, "wizard-dragon-1");
    assert.equal(trigger.cancelled, 3);
  }
  const { events } = clash(fixture({ boards: { wizard: [null, "wizard-skeleton-1", null] }, traps: { cowboy: 1 } }));
  assert.deepEqual(triggers(events)[0].target, { side: "wizard", slot: 1, cardId: "wizard-skeleton-1" });
  assert.equal(triggers(events)[0].cancelled, 1);
});

test("equal attack goes to the lowest slot", () => {
  const cases = [
    [["wizard-skeleton-1", "wizard-wizard-1", "wizard-wizard-2"], 1],
    [["wizard-skeleton-1", null, "wizard-skeleton-2"], 0],
    [[null, "wizard-skeleton-1", "wizard-skeleton-2"], 1],
    [["wizard-wizard-1", "wizard-wizard-2", "wizard-wizard-3"], 0],
  ];
  for (const [board, slot] of cases) {
    const { events } = clash(fixture({ boards: { wizard: board }, traps: { cowboy: 1 } }));
    assert.equal(triggers(events)[0].target.slot, slot, `board ${board}`);
  }
  // Wizard trap against the Cowboy board, same rule.
  const { events } = clash(fixture({ boards: { cowboy: ["cowboy-sheriff-1", "cowboy-billy-1", "cowboy-billy-2"] }, traps: { wizard: 1 } }));
  assert.deepEqual(triggers(events)[0].target, { side: "cowboy", slot: 1, cardId: "cowboy-billy-1" });
});

test("no enemy troop: the armed trap stays set and unspent, then triggers once a troop arrives", () => {
  const empty = fixture({ round: 3, boards: { cowboy: ["cowboy-sheriff-1"] }, traps: { cowboy: 1 } });
  const first = clash(empty);
  assert.deepEqual(triggers(first.events), []);
  assert.deepEqual(first.state.sides.cowboy.trap, { cardId: COWBOY_TRAP, setRound: 1 });
  assert.equal(first.state.sides.cowboy.discard.includes(COWBOY_TRAP), false);
  // The cowboy's own troop still hits the wizard base.
  assert.deepEqual(first.events.map((e) => e.type), ["damage"]);

  const later = structuredClone(first.state);
  later.round = 4;
  const wizard = later.sides.wizard;
  wizard.hand.splice(wizard.hand.indexOf("wizard-skeleton-1"), 1);
  wizard.board[2] = { cardId: "wizard-skeleton-1", health: 3 };
  assert.equal(triggers(clash(later).events).length, 1);
});

test("the cancelled troop emits no damage, stays on the board, still blocks and takes damage", () => {
  const state = fixture({ boards: { cowboy: ["cowboy-mounted-billy-1"], wizard: ["wizard-dragon-1"] }, traps: { cowboy: 1 } });
  const { state: next, events } = clash(state);
  assert.deepEqual(damageFrom(events, "wizard", 0), []);
  assert.equal(events.some((e) => e.type === "damage" && e.amount === 0), false);
  assert.deepEqual(events.map((e) => e.type), ["trap-trigger", "damage"]);
  assert.deepEqual(damageFrom(events, "cowboy", 0), [
    {
      type: "damage",
      lane: 0,
      attacker: { side: "cowboy", slot: 0, cardId: "cowboy-mounted-billy-1" },
      target: { kind: "troop", side: "wizard", slot: 0, cardId: "wizard-dragon-1" },
      amount: 3,
      before: 5,
      after: 2,
    },
  ]);
  assert.deepEqual(next.sides.wizard.board[0], { cardId: "wizard-dragon-1", health: 2 });
  assert.deepEqual(next.sides.cowboy.board[0], { cardId: "cowboy-mounted-billy-1", health: 5 });
  assert.equal(next.sides.wizard.baseOrbs, 5);
  assert.equal(next.sides.cowboy.baseOrbs, 5);
});

test("the cancelled troop is still defeated normally by damage in the same clash", () => {
  const state = fixture({ boards: { cowboy: ["cowboy-mounted-billy-1"], wizard: ["wizard-dragon-1"] }, traps: { cowboy: 1 } });
  state.sides.wizard.board[0].health = 2;
  const { state: next, events } = clash(state);
  assert.deepEqual(events.map((e) => e.type), ["trap-trigger", "damage", "defeat"]);
  assert.deepEqual(events[2], { type: "defeat", side: "wizard", slot: 0, cardId: "wizard-dragon-1" });
  assert.equal(next.sides.wizard.board[0], null);
  assert.deepEqual(next.sides.wizard.discard, ["wizard-dragon-1"]);
  assert.deepEqual(next.sides.cowboy.discard, [COWBOY_TRAP]);
});

test("uncancelled attacks keep the simultaneous snapshot: a troop at zero still attacks", () => {
  // The wizard trap cancels the Cowboy billy (attack 2) in lane 1. In lane 0
  // a sheriff and a skeleton at 1 health each still defeat each other.
  const state = fixture({
    boards: { cowboy: ["cowboy-sheriff-1", "cowboy-billy-1"], wizard: ["wizard-skeleton-1", "wizard-wizard-1"] },
    traps: { wizard: 1 },
  });
  state.sides.cowboy.board[0].health = 1;
  state.sides.wizard.board[0].health = 1;
  const { state: next, events } = clash(state);
  assert.deepEqual(triggers(events)[0].target, { side: "cowboy", slot: 1, cardId: "cowboy-billy-1" });
  assert.equal(damageFrom(events, "cowboy", 0).length, 1);
  assert.equal(damageFrom(events, "wizard", 0).length, 1);
  assert.equal(damageFrom(events, "cowboy", 1).length, 0);
  assert.deepEqual(damageFrom(events, "wizard", 1)[0].target, { kind: "troop", side: "cowboy", slot: 1, cardId: "cowboy-billy-1" });
  assert.deepEqual(events.filter((e) => e.type === "defeat").map((e) => `${e.side}:${e.slot}`), ["cowboy:0", "wizard:0"]);
  assert.deepEqual(next.sides.cowboy.board[1], { cardId: "cowboy-billy-1", health: 2 });
  assert.deepEqual(next.sides.wizard.board[1], { cardId: "wizard-wizard-1", health: 4 });
});

test("two armed traps read one snapshot: cowboy then wizard, same as each trap alone, neither cancels the other", () => {
  const boards = {
    cowboy: ["cowboy-sheriff-1", "cowboy-mounted-billy-1", "cowboy-billy-1"],
    wizard: ["wizard-wizard-1", "wizard-skeleton-1", "wizard-dragon-1"],
  };
  const both = clash(fixture({ boards, traps: { cowboy: 1, wizard: 1 } }));
  const cowboyOnly = clash(fixture({ boards, traps: { cowboy: 1 } }));
  const wizardOnly = clash(fixture({ boards, traps: { wizard: 1 } }));
  assert.deepEqual(triggers(both.events), [...triggers(cowboyOnly.events), ...triggers(wizardOnly.events)]);
  assert.deepEqual(triggers(both.events).map((e) => [e.side, e.target.side, e.target.slot, e.cancelled]), [
    ["cowboy", "wizard", 2, 3],
    ["wizard", "cowboy", 1, 3],
  ]);
  const types = both.events.map((e) => e.type);
  assert.deepEqual(types.slice(0, 2), ["trap-trigger", "trap-trigger"]);
  assert.equal(damageFrom(both.events, "wizard", 2).length, 0);
  assert.equal(damageFrom(both.events, "cowboy", 1).length, 0);
  assert.equal(both.events.filter((e) => e.type === "damage").length, 4);
  assert.equal(both.state.sides.cowboy.trap, null);
  assert.equal(both.state.sides.wizard.trap, null);
  assert.deepEqual(both.state.sides.cowboy.discard, [COWBOY_TRAP]);
  assert.deepEqual(both.state.sides.wizard.discard, [WIZARD_TRAP]);

});

test("mirrored boards with both traps armed give mirrored choices and outcomes", () => {
  const { state, events } = clash(fixture({
    boards: {
      cowboy: ["cowboy-sheriff-1", "cowboy-mounted-billy-1", "cowboy-billy-1"],
      wizard: ["wizard-skeleton-1", "wizard-dragon-1", "wizard-wizard-1"],
    },
    traps: { cowboy: 1, wizard: 1 },
  }));
  const [cowboyTrigger, wizardTrigger] = triggers(events);
  assert.deepEqual([cowboyTrigger.side, cowboyTrigger.target.slot, cowboyTrigger.cancelled], ["cowboy", 1, 3]);
  assert.deepEqual([wizardTrigger.side, wizardTrigger.target.slot, wizardTrigger.cancelled], ["wizard", 1, 3]);
  const health = (side) => state.sides[side].board.map((t) => t?.health ?? null);
  assert.deepEqual(health("cowboy"), health("wizard"));
  assert.deepEqual(health("cowboy"), [2, 5, 2]);
  assert.equal(state.sides.cowboy.baseOrbs, state.sides.wizard.baseOrbs);
});

test("only one side armed: the other side's trap set this round stays, the armed one triggers", () => {
  const boards = { cowboy: ["cowboy-billy-1"], wizard: ["wizard-wizard-1"] };
  const { state, events } = clash(fixture({ round: 5, boards, traps: { cowboy: 4, wizard: 5 } }));
  assert.deepEqual(triggers(events).map((e) => e.side), ["cowboy"]);
  assert.deepEqual(state.sides.wizard.trap, { cardId: WIZARD_TRAP, setRound: 5 });
  assert.equal(damageFrom(events, "cowboy", 0).length, 1);
});

test("a trap set in round 8 triggers in round 9, then the round-limit result follows", () => {
  // Unblocked lanes: wizard-wizard (2) hits the Cowboy base, sheriff (1) the Wizard base.
  const boards = { cowboy: [null, "cowboy-sheriff-1"], wizard: ["wizard-wizard-1"] };
  const plain = fixture({ round: 8, boards });
  plain.startingSide = plain.activeSide = "cowboy";
  const noTrap = endRound(endRound(plain).state).state;
  assert.deepEqual(noTrap.result, { winner: "wizard", loser: "cowboy", reason: "round-limit", round: 9 });

  const state = fixture({ round: 8, boards });
  state.startingSide = state.activeSide = "cowboy";
  const set = applyAction(state, { type: "set-trap", side: "cowboy", revision: state.revision, cardId: pushHand(state) }, { cards: TEST_CARDS });
  assert.equal(set.ok, true, set.reason);
  const r8 = endRound(set.state);
  assert.deepEqual(triggers(r8.events), []);
  assert.equal(r8.state.round, MAX_ROUNDS);
  const r9 = endRound(r8.state);
  const types = r9.events.map((e) => e.type);
  assert.deepEqual(types.slice(types.indexOf("clash")), ["clash", "trap-trigger", "damage", "result"]);
  assert.equal(triggers(r9.events)[0].target.cardId, "wizard-wizard-1");
  assert.deepEqual([r9.state.sides.cowboy.baseOrbs, r9.state.sides.wizard.baseOrbs], [3, 3]);
  assert.deepEqual(r9.state.result, { winner: null, loser: null, reason: "round-limit", round: 9 });
});

test("a cancelled attack prevents a lethal base hit", () => {
  const boards = { wizard: ["wizard-dragon-1"] };
  const lethal = endRound(fixture({ boards, baseOrbs: { cowboy: 2 } }));
  assert.equal(lethal.state.sides.cowboy.baseOrbs, 0);
  assert.equal(lethal.state.result.reason, "base-destroyed");
  assert.equal(lethal.state.result.winner, "wizard");

  const saved = endRound(fixture({ boards, baseOrbs: { cowboy: 2 }, traps: { cowboy: 1 } }));
  assert.equal(saved.state.sides.cowboy.baseOrbs, 2);
  assert.equal(saved.state.result, null);
  assert.equal(saved.events.some((e) => e.type === "damage"), false);
  assert.equal(saved.state.round, 3);
});

test("card conservation per side, fixture trap included, across set and trigger", () => {
  let state = fixture({ round: 4, boards: { cowboy: ["cowboy-billy-1"], wizard: ["wizard-dragon-1", "wizard-wizard-1"] }, traps: { wizard: 2 } });
  state.startingSide = state.activeSide = "cowboy";
  pushHand(state);
  const ids = { cowboy: allIds(state, "cowboy"), wizard: allIds(state, "wizard") };
  assert.equal(cardCount(state, "cowboy"), 13);
  assert.equal(cardCount(state, "wizard"), 13);
  const set = applyAction(state, { type: "set-trap", side: "cowboy", revision: state.revision, cardId: COWBOY_TRAP }, { cards: TEST_CARDS });
  state = set.state;
  for (let i = 0; i < 2; i++) {
    state = endRound(state).state;
    for (const side of SIDES) assert.deepEqual(allIds(state, side), ids[side]);
  }
  assert.ok(state.sides.cowboy.discard.includes(COWBOY_TRAP));
  assert.ok(state.sides.wizard.discard.includes(WIZARD_TRAP));
});

test("the trigger never mutates the input state of applyAction", () => {
  const state = fixture({ boards: { cowboy: ["cowboy-billy-1"], wizard: ["wizard-dragon-1"] }, traps: { cowboy: 1, wizard: 1 } });
  const before = structuredClone(state);
  const first = endRound(state);
  assert.deepEqual(state, before);
  const again = endRound(state);
  assert.deepEqual(again, first);
  first.state.sides.cowboy.discard.push("x");
  assert.deepEqual(state, before);
});

test("flag off or absent: a trap-shaped zone is ignored and the clash is unchanged", () => {
  const boards = { cowboy: ["cowboy-billy-1"], wizard: ["wizard-dragon-1"] };
  const expected = clash(fixture({ boards })).events;
  const disabled = fixture({ boards, traps: { cowboy: 1 } });
  disabled.traps.enabled = false;
  assert.deepEqual(clash(disabled).events, expected);
  const absent = fixture({ boards, traps: { cowboy: 1 } });
  delete absent.traps;
  assert.deepEqual(clash(absent).events, expected);
  assert.equal(Object.values(CARDS).some((card) => card.kind === "trap"), false);
});

// Default CPU on both sides through the public view, as scripts/play-match.mjs does.
function cpuMatch(state) {
  const events = [];
  while (!state.result) {
    const applied = applyAction(state, chooseAction(publicState(state, state.activeSide)));
    assert.equal(applied.ok, true, applied.reason);
    state = applied.state;
    events.push(...applied.events);
    assert.ok(events.length < 2000);
  }
  return { state, events };
}

test("seeds 0 and 60: default CPU matches are identical with traps off and with traps on and no trap dealt", () => {
  for (const seed of [0, 60]) {
    const off = cpuMatch(createMatch(seed));
    const on = cpuMatch(createMatch(seed, { traps: true }));
    assert.deepEqual(on.events, off.events, `seed ${seed}`);
    assert.deepEqual(on.state.result, off.state.result);
    assert.equal(off.events.some((e) => e.type === "trap-trigger"), false);
    assert.equal("trap" in off.state.sides.cowboy, false);
  }
  // Recorded by scripts/play-match.mjs --seed 60 on base a327b1b.
  const seed60 = cpuMatch(createMatch(60)).state;
  assert.deepEqual(seed60.result, { winner: "cowboy", loser: "wizard", reason: "base-destroyed", round: 9 });
  assert.equal(seed60.revision, 40);
});
