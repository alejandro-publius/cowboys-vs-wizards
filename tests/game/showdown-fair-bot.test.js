// The Showdown bot plans only from what it may know: its own hand and the public board.
// It must not read the order of its own deck through Scout, nor the other side's hand,
// deck or face-down traps. After a Scout draws, it plans again from the card it drew.
import test from "node:test";
import assert from "node:assert/strict";
import {cardOf, has} from "../../prototypes/showdown/cards.js";
import {applyAction, createShowdown, opponent, planTurn, playTurn} from "../../prototypes/showdown/rules.js";

const troop = (type, health, extra = {}) => ({cardId: `${type}-1`, health: health ?? cardOf(`${type}-1`).health, attacked: false, stunned: false, cover: false, gear: [], arrived: 0, ...extra});

// Wizard to act on turn 4: a ready Skeleton and a Raven Familiar (Scout) in hand, facing two
// one-orb Cowboy troops. The top card decides whether the second Cowboy troop can be finished.
function scoutFixture(top) {
  const state = createShowdown(690, {first: "cowboy"});
  Object.assign(state, {turn: 4, active: "wizard"});
  const wizard = state.sides.wizard;
  wizard.hand = ["wizard-raven-familiar-1"];
  wizard.board = [troop("wizard-skeleton"), null, null];
  wizard.deck = [top, "wizard-skeleton-2", "wizard-bone-wall-1", "wizard-imp-1"];
  state.sides.cowboy.hand = [];
  state.sides.cowboy.board = [troop("cowboy-billy", 1), troop("cowboy-sheriff", 1), null];
  return state;
}

test("fair bot: the Scout plan is the same whatever card is on top, and stops at the draw", () => {
  const withSpell = planTurn(scoutFixture("wizard-singularity-1"));
  const withTroop = planTurn(scoutFixture("wizard-skeleton-3"));
  assert.deepEqual(withSpell, withTroop);
  assert.deepEqual(withSpell, [{type: "summon", cardId: "wizard-raven-familiar-1", tributes: []}]);
});

test("fair bot: after the Scout draws, the turn is planned again from the card actually drawn", () => {
  const spell = playTurn(scoutFixture("wizard-singularity-1"));
  const kinds = spell.events.map((event) => event.type);
  assert.ok(kinds.indexOf("draw") < kinds.indexOf("spell"), `drawn Singularity was not cast after the draw: ${kinds}`);
  assert.equal(spell.state.sides.cowboy.board.filter(Boolean).length, 0);

  const plain = playTurn(scoutFixture("wizard-skeleton-3"));
  assert.ok(!plain.events.some((event) => event.type === "spell"));
  assert.equal(plain.state.sides.cowboy.board.filter(Boolean).length, 1);
  assert.deepEqual(playTurn(scoutFixture("wizard-singularity-1")), spell, "replay is deterministic");
});

// Real positions from bot games, at the start of each turn.
function positions(seeds) {
  const found = [];
  for (const seed of seeds) {
    for (const first of ["cowboy", "wizard"]) {
      let state = createShowdown(seed, {first});
      while (!state.result) {
        found.push(state);
        state = playTurn(state).state;
      }
    }
  }
  return found;
}
const seeds = Array.from({length: 24}, (_, i) => i);
const all = positions(seeds);

test("fair bot invariant: reordering its own deck or swapping the unseen top card never changes a Scout turn's plan", () => {
  let checked = 0;
  for (const state of all) {
    const own = state.sides[state.active];
    if (own.deck.length < 2 || !own.hand.some((id) => has(id, "scout"))) continue;
    const base = planTurn(state);
    const reversed = structuredClone(state);
    reversed.sides[state.active].deck.reverse();
    assert.deepEqual(planTurn(reversed), base, `seed ${state.seed} turn ${state.turn}: deck order changed the plan`);
    // Substitute the top card with a card of a different type from the same deck.
    const swapped = structuredClone(state);
    const deck = swapped.sides[state.active].deck;
    const other = deck.findIndex((id) => cardOf(id) !== cardOf(deck[0]));
    if (other > 0) [deck[0], deck[other]] = [deck[other], deck[0]];
    assert.deepEqual(planTurn(swapped), base, `seed ${state.seed} turn ${state.turn}: the top card changed the plan`);
    checked += 1;
  }
  assert.ok(checked >= 10, `only ${checked} Scout turns found`);
});

test("fair bot invariant: the other side's hand, deck and face-down traps never change the plan", () => {
  for (const state of all.filter((_, i) => i % 3 === 0)) {
    const base = planTurn(state);
    const other = structuredClone(state);
    const enemy = other.sides[opponent(state.active)];
    // Same counts, different private contents: the hand and deck trade cards, the traps change.
    const pool = [...enemy.hand, ...enemy.deck].reverse();
    enemy.hand = pool.slice(0, enemy.hand.length);
    enemy.deck = pool.slice(enemy.hand.length);
    enemy.traps = enemy.traps.map(() => (state.active === "cowboy" ? "wizard-hex-9" : "cowboy-bear-trap-9"));
    assert.deepEqual(planTurn(other), base, `seed ${state.seed} turn ${state.turn}: enemy private data changed the plan`);
  }
});

test("fair bot: every planned step is legal when played, and a plan cut at a Scout ends on that Scout", () => {
  for (const state of all.filter((_, i) => i % 2 === 0)) {
    const plan = planTurn(state);
    const last = plan.at(-1);
    let current = structuredClone(state);
    current.sides[opponent(state.active)].traps = [];
    for (const action of plan) {
      if (current.result) break;
      current = applyAction(current, action).state; // throws on an illegal action
    }
    // A plan ends the turn, wins the game, or stops on a Scout that drew.
    if (last.type !== "end" && !current.result) {
      assert.equal(last.type, "summon");
      assert.ok(has(last.cardId, "scout"), `plan ends on ${JSON.stringify(last)}`);
    }
  }
});
