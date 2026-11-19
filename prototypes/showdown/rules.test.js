import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DECKS, EFFECTS, KEYWORDS, TYPES, cardOf, deckIds} from "./cards.js";
import {cardsCsv} from "./export-cards.mjs";
import {HAND_CAP, OPENING_HAND, applyAction, attackOutcome, canAttack, createShowdown, legalActions, playTurn} from "./rules.js";

const troop = (type, health = TYPES[type].health, extra = {}) => ({cardId: `${type}-1`, health, attacked: false, stunned: false, arrived: 0, ...extra});
// Turn 4, Cowboy to act, nothing spent, boards as given, empty hands.
function position(cowboy, wizard, active = "cowboy") {
  const state = createShowdown(690);
  Object.assign(state, {turn: 4, active});
  for (const side of ["cowboy", "wizard"]) state.sides[side].hand = [];
  state.sides.cowboy.board = [...cowboy, null, null, null].slice(0, 3);
  state.sides.wizard.board = [...wizard, null, null, null].slice(0, 3);
  return state;
}
const attacks = (state) => legalActions(state).filter((a) => a.type === "attack").map((a) => `${a.slot}>${a.target}`);
const act = (state, action) => applyAction(state, action).state;
const types = (events) => events.map((event) => event.type);

test("the card table: every card has what its kind needs, and both decks hold sixteen", () => {
  for (const [type, card] of Object.entries(TYPES)) {
    if (card.kind === "troop") {
      assert.ok(card.tag, `${type} has no type tag`);
      for (const key of card.keys) assert.ok(KEYWORDS[key], `${type} has unknown keyword ${key}`);
    } else assert.ok(EFFECTS[card.effect], `${type} has no effect`);
  }
  for (const side of ["cowboy", "wizard"]) {
    assert.equal(deckIds(side).length, 16);
    for (const type of Object.keys(DECKS[side])) assert.equal(TYPES[type].side, side, `${type} is in the wrong deck`);
  }
  // Every keyword and every effect is on a card in one of the two decks.
  const played = [...deckIds("cowboy"), ...deckIds("wizard")].map(cardOf);
  for (const key of Object.keys(KEYWORDS)) {
    if (key !== "ghostly") assert.ok(played.some((card) => card.keys?.includes(key)), `no deck card has ${key}`);
  }
  for (const effect of Object.keys(EFFECTS)) assert.ok(played.some((card) => card.effect === effect), `no deck card has ${effect}`);
});

test("the deal: same seed, same game; the second player starts with one more card", () => {
  assert.deepEqual(createShowdown(7), createShowdown(7));
  const state = createShowdown(7);
  const second = state.first === "cowboy" ? "wizard" : "cowboy";
  assert.equal(state.sides[state.first].hand.length, OPENING_HAND);
  assert.equal(state.sides[second].hand.length, OPENING_HAND + 1);
});

test("a Base can be struck directly only when its side has no troops", () => {
  assert.deepEqual(attacks(position([troop("cowboy-billy")], [troop("wizard-skeleton")])), ["0>0"]);
  const open = position([troop("cowboy-billy")], []);
  assert.deepEqual(attacks(open), ["0>base"]);
  assert.equal(act(open, {type: "attack", slot: 0, target: "base"}).sides.wizard.base, 3);
});

test("damage beyond the target's last orb hits its Base, and a defeated target does not hit back", () => {
  const state = position([troop("cowboy-mounted-billy")], [troop("wizard-skeleton", 1)]);
  assert.deepEqual(attackOutcome(state, 0, 0), {baseDamage: 2, targetLeft: 0, attackerLeft: 5});
  const after = act(state, {type: "attack", slot: 0, target: 0});
  assert.equal(after.sides.wizard.board[0], null);
  assert.equal(after.sides.wizard.base, 3);
  assert.equal(after.sides.cowboy.board[0].health, 5);
});

test("a target that survives hits back, and neither Base is touched", () => {
  const after = act(position([troop("cowboy-sheriff")], [troop("wizard-wizard")]), {type: "attack", slot: 0, target: 0});
  assert.equal(after.sides.wizard.board[0].health, 3);
  assert.equal(after.sides.cowboy.board[0].health, 1);
  assert.deepEqual([after.sides.cowboy.base, after.sides.wizard.base], [5, 5]);
});

test("free troops rest on arrival, tribute troops strike at once, and nothing is played after an attack", () => {
  const state = position([troop("cowboy-sheriff")], [troop("wizard-skeleton")]);
  state.sides.cowboy.hand = ["cowboy-sheriff-2", "cowboy-billy-1", "cowboy-bear-trap-1"];
  const withSheriff = act(state, {type: "summon", cardId: "cowboy-sheriff-2", tributes: []});
  assert.equal(canAttack(withSheriff, withSheriff.sides.cowboy.board[1]), false);
  const withBilly = act(state, {type: "summon", cardId: "cowboy-billy-1", tributes: [0]});
  assert.equal(canAttack(withBilly, withBilly.sides.cowboy.board[0]), true);
  const attacked = act(state, {type: "attack", slot: 0, target: 0});
  assert.ok(legalActions(attacked).every((a) => a.type === "attack" || a.type === "end"));
  assert.throws(() => applyAction(attacked, {type: "set", cardId: "cowboy-bear-trap-1"}), /illegal/);
});

test("Guard: enemies must attack it first, and a rider cannot pass it", () => {
  const state = position([troop("cowboy-billy"), troop("cowboy-outrider")], [troop("wizard-skeleton"), troop("wizard-bone-wall")]);
  assert.deepEqual(attacks(state), ["0>1", "1>1"]);
});

test("Ride: a rider may pass standing troops to strike the Base for one orb", () => {
  const state = position([troop("cowboy-mounted-billy"), troop("cowboy-billy")], [troop("wizard-skeleton")]);
  assert.deepEqual(attacks(state), ["0>0", "0>base", "1>0"]);
  assert.equal(act(state, {type: "attack", slot: 0, target: "base"}).sides.wizard.base, 4);
});

test("Quickdraw: a free troop with it attacks on the turn it arrives", () => {
  const state = position([troop("cowboy-sheriff")], [], "wizard");
  state.sides.wizard.hand = ["wizard-imp-1", "wizard-skeleton-1"];
  const imp = act(state, {type: "summon", cardId: "wizard-imp-1", tributes: []});
  assert.deepEqual(attacks(imp), ["0>0"]);
  assert.deepEqual(attacks(act(state, {type: "summon", cardId: "wizard-skeleton-1", tributes: []})), []);
});

test("Scout draws a card on arrival", () => {
  const state = position([troop("cowboy-sheriff")], []);
  state.sides.cowboy.hand = ["cowboy-ranger-1"];
  const top = state.sides.cowboy.deck[0];
  const applied = applyAction(state, {type: "summon", cardId: "cowboy-ranger-1", tributes: [0]});
  assert.deepEqual(applied.state.sides.cowboy.hand, [top]);
  assert.deepEqual(types(applied.events), ["tribute", "summon", "draw"]);
});

test("Raise returns the last Undead troop from the graveyard with one orb, and only an Undead", () => {
  const state = position([], [troop("wizard-skeleton")], "wizard");
  state.sides.wizard.hand = ["wizard-wizard-1"];
  state.sides.wizard.discard = ["wizard-bone-wall-1", "wizard-imp-1"];
  const after = act(state, {type: "summon", cardId: "wizard-wizard-1", tributes: [0]});
  // The Skeleton paid as tribute is the last Undead in the graveyard, so it is the one that returns.
  assert.deepEqual(after.sides.wizard.board.map((t) => t && [t.cardId, t.health]), [["wizard-wizard-1", 4], ["wizard-skeleton-1", 1], null]);
  assert.deepEqual(after.sides.wizard.discard, ["wizard-bone-wall-1", "wizard-imp-1"]);
  state.sides.wizard.board[0] = troop("wizard-imp");
  state.sides.wizard.discard = ["wizard-imp-2", "wizard-hex-1"];
  assert.equal(act(state, {type: "summon", cardId: "wizard-wizard-1", tributes: [0]}).sides.wizard.board.filter(Boolean).length, 1);
});

test("Sweep: every other enemy troop loses an orb when it attacks a troop", () => {
  const state = position([troop("cowboy-sheriff"), troop("cowboy-billy"), troop("cowboy-sheriff", 1)], [troop("wizard-dragon")], "wizard");
  const after = act(state, {type: "attack", slot: 0, target: 0});
  assert.deepEqual(after.sides.cowboy.board.map((t) => t && t.health), [null, 3, null]);
  assert.equal(after.sides.cowboy.base, 5);
});

test("Last Stand: the defeated troop takes an orb off the troop that fought it, attacking or defending", () => {
  const defending = act(position([troop("cowboy-billy")], [troop("wizard-jack-o-lantern")]), {type: "attack", slot: 0, target: 0});
  assert.equal(defending.sides.cowboy.board[0].health, 3);
  // The Dynamiter leaves the Wizard on one orb, falls to the hit back, and its Last Stand finishes the Wizard.
  const attacking = act(position([troop("cowboy-dynamiter")], [troop("wizard-wizard")]), {type: "attack", slot: 0, target: 0});
  assert.deepEqual([attacking.sides.cowboy.board[0], attacking.sides.wizard.board[0]], [null, null]);
});

test("Ghostly troops cannot be targeted by spells, but Hellfire still burns them", () => {
  const state = position([], [troop("wizard-lantern-wraith"), troop("wizard-skeleton")]);
  state.sides.cowboy.hand = ["cowboy-deadeye-1", "cowboy-lasso-1"];
  assert.deepEqual(legalActions(state).filter((a) => a.type === "spell").map((a) => a.target), [1, 1]);
  const burn = position([troop("cowboy-captured-wraith"), troop("cowboy-sheriff", 1)], [], "wizard");
  burn.sides.wizard.hand = ["wizard-hellfire-1"];
  assert.deepEqual(act(burn, {type: "spell", cardId: "wizard-hellfire-1"}).sides.cowboy.board.map((t) => t && t.health), [1, null, null]);
});

test("Lasso stuns a troop for its next turn only", () => {
  let state = position([troop("cowboy-sheriff")], [troop("wizard-wizard")]);
  state.sides.cowboy.hand = ["cowboy-lasso-1"];
  state = act(act(state, {type: "spell", cardId: "cowboy-lasso-1", target: 0}), {type: "end"});
  assert.deepEqual(attacks(state), []);
  state = act(act(state, {type: "end"}), {type: "end"});
  assert.deepEqual(attacks(state), ["0>0"]);
});

test("a set trap springs on the next enemy attack: Hex cancels it, Bear Trap bites first", () => {
  let hexed = position([troop("cowboy-billy")], [troop("wizard-skeleton")]);
  hexed.sides.wizard.traps = ["wizard-hex-1"];
  const cancelled = applyAction(hexed, {type: "attack", slot: 0, target: 0});
  assert.deepEqual(types(cancelled.events), ["trap"]);
  hexed = cancelled.state;
  assert.equal(hexed.sides.wizard.board[0].health, 3);
  assert.deepEqual([hexed.sides.wizard.traps, hexed.sides.wizard.discard], [[], ["wizard-hex-1"]]);
  assert.deepEqual(attacks(hexed), [], "the cancelled attack is spent");

  const bitten = position([troop("cowboy-sheriff")], [troop("wizard-wizard"), troop("wizard-imp")], "wizard");
  bitten.sides.cowboy.traps = ["cowboy-bear-trap-1"];
  // The Imp has one orb: the trap defeats it and the Sheriff is never hit.
  const imp = act(bitten, {type: "attack", slot: 1, target: 0});
  assert.deepEqual([imp.sides.wizard.board[1], imp.sides.cowboy.board[0].health], [null, 3]);
  // The Wizard survives the trap on two orbs and its attack still lands.
  const wizard = act(bitten, {type: "attack", slot: 0, target: 0});
  assert.deepEqual([wizard.sides.wizard.board[0].health, wizard.sides.cowboy.board[0].health], [1, 1]);
});

test("setting a trap: one a turn, two face down at most, and the bot plans without seeing them", () => {
  const state = position([troop("cowboy-sheriff")], []);
  state.sides.cowboy.hand = ["cowboy-bear-trap-1", "cowboy-bear-trap-2"];
  const set = act(state, {type: "set", cardId: "cowboy-bear-trap-1"});
  assert.deepEqual(set.sides.cowboy.traps, ["cowboy-bear-trap-1"]);
  assert.ok(!legalActions(set).some((a) => a.type === "set"));
  state.sides.cowboy.traps = ["cowboy-bear-trap-3", "cowboy-bear-trap-4"];
  assert.ok(!legalActions(state).some((a) => a.type === "set"));
  // The Wizard bot's Imp walks into the Bear Trap it could have avoided by not attacking.
  const walk = position([troop("cowboy-sheriff", 1)], [troop("wizard-imp")], "wizard");
  walk.sides.cowboy.traps = ["cowboy-bear-trap-1"];
  assert.ok(types(playTurn(walk).events).includes("trap"));
});

test("an empty deck costs the Base an orb each turn, and a seventh card is discarded", () => {
  let state = position([], []);
  state.sides.wizard.deck = [];
  state = act(state, {type: "end"});
  assert.equal(state.sides.wizard.base, 4);
  state.sides.wizard.base = 1;
  state = act(act(state, {type: "end"}), {type: "end"});
  assert.deepEqual(state.result, {winner: "cowboy", reason: "base"});

  const full = position([], []);
  full.sides.wizard.hand = Array.from({length: HAND_CAP}, (_, i) => `wizard-skeleton-${i + 1}`);
  const top = full.sides.wizard.deck[0];
  const after = act(full, {type: "end"});
  assert.equal(after.sides.wizard.hand.length, HAND_CAP);
  assert.deepEqual(after.sides.wizard.discard, [top]);
});

test("bot games are legal and end with a fallen Base", () => {
  for (let seed = 0; seed < 60; seed++) {
    let state = createShowdown(seed);
    while (!state.result) state = playTurn(state).state; // applyAction throws on an illegal planned action
    assert.equal(state.result.reason, "base");
  }
});

test("cards.csv matches the card table", () => {
  assert.equal(readFileSync(new URL("cards.csv", import.meta.url), "utf8"), cardsCsv(), "run: node prototypes/showdown/export-cards.mjs");
});
