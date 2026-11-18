// Cover-swap variant of Ride Out (createMatch rideSwap: true): a ride-out may
// enter an adjacent lane held by a friendly troop, and the two trade places.
import test from "node:test";
import assert from "node:assert/strict";
import {applyAction} from "../../src/game/actions.js";
import {CARDS, SIDES, opponent} from "../../src/game/cards.js";
import {chooseAction, cpuFor} from "../../src/game/cpu.js";
import {legalActions} from "../../src/game/legal.js";
import {RIDE_OUT_RULES_VERSION, RIDE_SWAP_RULES_VERSION, createMatch} from "../../src/game/state.js";
import {publicState} from "../../src/game/view.js";

const SEED = 7;
// `side` to act with nothing spent. Board troops come out of that side's own deck, so cards are conserved.
function setUp(side, options, troops) {
  const state = createMatch(SEED, options);
  state.startingSide = state.activeSide = side;
  for (const [owner, slot, name, health] of troops) {
    const own = state.sides[owner];
    const at = own.deck.findIndex((id) => CARDS[id].name === name);
    assert.notEqual(at, -1, `${name} not in the ${owner} deck`);
    own.board[slot] = {cardId: own.deck.splice(at, 1)[0], health};
  }
  return state;
}
const WEAK = {cowboy: "Sheriff", wizard: "Skeleton"};
const STRONG = {cowboy: "Billy", wizard: "Wizard"};
const pair = (side, options) => setUp(side, options, [[side, 0, WEAK[side], 2], [side, 1, STRONG[side], 3], [opponent(side), 1, WEAK[opponent(side)], 3]]);
const ride = (state, side, slot, destination) => applyAction(state, {type: "ride-out", side, revision: state.revision, slot, destination});
const rides = (state, side) => legalActions(state, side).filter((action) => action.type === "ride-out").map(({slot, destination}) => `${slot}>${destination}`);
const cardsOf = ({hand, deck, discard, board}) => [...hand, ...deck, ...discard, ...board.filter(Boolean).map((troop) => troop.cardId)].sort();
const SWAP = {rideOut: true, rideSwap: true};

test("rideSwap needs rideOut, is a boolean, and leaves default and Ride Out matches as they were", () => {
  assert.throws(() => createMatch(SEED, {rideSwap: true}), /rideSwap needs rideOut/);
  assert.throws(() => createMatch(SEED, {rideOut: true, rideSwap: "yes"}), /rideSwap must be a boolean/);
  assert.deepEqual(createMatch(SEED, {rideSwap: false}), createMatch(SEED));
  assert.equal("rideOut" in createMatch(SEED), false);
  const plain = createMatch(SEED, {rideOut: true});
  assert.deepEqual(plain.rideOut, {enabled: true, rulesVersion: RIDE_OUT_RULES_VERSION});
  const swap = createMatch(SEED, SWAP);
  assert.deepEqual(swap.rideOut, {enabled: true, rulesVersion: RIDE_SWAP_RULES_VERSION, swap: true});
  assert.deepEqual({...swap, rideOut: plain.rideOut}, plain); // same deal, same RNG, nothing else added
});

for (const side of SIDES) {
  test(`${side}: without the swap rule an occupied destination is refused and not listed`, () => {
    const plain = pair(side, {rideOut: true});
    assert.deepEqual(rides(plain, side), ["1>2"]);
    assert.equal(ride(plain, side, 0, 1).reason, "destination-occupied");
    assert.equal(ride(plain, side, 1, 0).reason, "destination-occupied");
    assert.equal(ride(pair(side, {}), side, 0, 1).reason, "invalid-action");
  });

  test(`${side}: a swap trades two adjacent troops, keeps their orbs and spends the summon`, () => {
    const state = pair(side, SWAP);
    assert.deepEqual(rides(state, side), ["0>1", "1>0", "1>2"]);
    const [weak, strong] = state.sides[side].board;
    const result = ride(state, side, 0, 1);
    assert.equal(result.ok, true);
    const own = result.state.sides[side];
    assert.deepEqual(own.board, [strong, weak, null]);
    assert.deepEqual(result.state.allowances[side], {summonUsed: true, castUsed: false});
    assert.deepEqual(cardsOf(own), cardsOf(state.sides[side]));
    assert.deepEqual(own.hand, state.sides[side].hand);
    assert.deepEqual(result.state.sides[opponent(side)], state.sides[opponent(side)]);
    assert.equal(result.state.rng, state.rng);
    assert.deepEqual(result.events, [{
      type: "ride-out", side, cardId: weak.cardId, slot: 0, destination: 1, health: 2,
      swapped: {cardId: strong.cardId, health: 3}, revision: state.revision,
    }]);
    // Named from either troop, the swap leaves the same board.
    assert.deepEqual(ride(state, side, 1, 0).state.sides, result.state.sides);
    // The move into an empty lane is still there and reports no swap.
    const moved = ride(state, side, 1, 2);
    assert.deepEqual(moved.state.sides[side].board, [weak, null, strong]);
    assert.equal("swapped" in moved.events[0], false);
  });

  test(`${side}: a swap shares the summon allowance and its order with spells`, () => {
    const state = pair(side, SWAP);
    const own = state.sides[side];
    const spell = own.deck.splice(own.deck.findIndex((id) => CARDS[id].kind === "spell"), 1)[0];
    const troop = [...own.hand, ...own.deck].find((id) => CARDS[id].name === WEAK[side]);
    own.deck = own.deck.filter((id) => id !== troop);
    own.hand = [spell, troop];
    const cast = {type: "spell", side, cardId: spell, target: 1};
    const summon = {type: "summon", side, cardId: troop, slot: 2, tributes: []};

    const swapped = ride(state, side, 0, 1).state;
    assert.equal(applyAction(swapped, {...summon, revision: swapped.revision}).reason, "summon-used");
    assert.equal(ride(swapped, side, 0, 1).reason, "summon-used");
    assert.deepEqual(rides(swapped, side), []);
    assert.equal(applyAction(swapped, {...cast, revision: swapped.revision}).ok, true);

    const afterCast = applyAction(state, {...cast, revision: state.revision}).state;
    assert.equal(ride(afterCast, side, 0, 1).reason, "ride-out-after-spell");
    const afterSummon = applyAction(state, {...summon, revision: state.revision}).state;
    assert.equal(ride(afterSummon, side, 0, 1).reason, "summon-used");
  });

  test(`${side}: only adjacent lanes swap, and a refused swap changes nothing`, () => {
    const state = setUp(side, SWAP, [[side, 0, WEAK[side], 2], [side, 2, STRONG[side], 3]]);
    const before = structuredClone(state);
    assert.equal(ride(state, side, 0, 2).reason, "invalid-destination");
    assert.equal(ride(state, side, 1, 0).reason, "invalid-slot");
    assert.equal(ride(state, opponent(side), 0, 1).reason, "wrong-side");
    assert.deepEqual(state, before);
    assert.deepEqual(rides(state, side), ["0>1", "2>1"]);
  });

  test(`${side}: every action listed on a swap match is accepted, from the state and from the public view`, () => {
    const state = pair(side, SWAP);
    const view = publicState(state, side);
    assert.deepEqual(view.rideOut, {enabled: true, rulesVersion: RIDE_SWAP_RULES_VERSION, swap: true});
    assert.deepEqual(publicState(state, opponent(side)).rideOut, view.rideOut);
    assert.equal("swap" in publicState(pair(side, {rideOut: true}), side).rideOut, false);
    assert.deepEqual(legalActions(view, side), legalActions(state, side));
    for (const action of legalActions(view, side)) assert.equal(applyAction(state, action).ok, true, JSON.stringify(action));
  });

  test(`${side}: both CPU levels return a listed action, and Normal swaps a doomed troop out of a bad matchup`, () => {
    // Weak 2 faces an attack-2 troop and would fall; strong 3 faces a 1-orb troop. Swapping saves both.
    const enemy = opponent(side);
    const state = setUp(side, SWAP, [[side, 0, WEAK[side], 2], [side, 1, STRONG[side], 3], [enemy, 0, STRONG[enemy], 4], [enemy, 1, WEAK[enemy], 1]]);
    state.sides[side].deck.push(...state.sides[side].hand.splice(0)); // nothing to summon or cast
    const view = publicState(state, side);
    const listed = legalActions(view, side);
    for (const level of ["normal", "hard"]) assert.ok(listed.some((action) => JSON.stringify(action) === JSON.stringify(cpuFor(level)(view))), level);
    assert.deepEqual(chooseAction(view), {type: "ride-out", side, revision: state.revision, slot: 0, destination: 1});
    // Under current Ride Out the same CPU has no such move to pick.
    const plain = publicState({...state, rideOut: createMatch(SEED, {rideOut: true}).rideOut}, side);
    assert.ok(!(chooseAction(plain).type === "ride-out" && chooseAction(plain).destination !== 2));
  });
}
