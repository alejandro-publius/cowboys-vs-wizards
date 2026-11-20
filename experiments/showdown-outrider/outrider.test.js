// Run: node --test experiments/showdown-outrider/outrider.test.js
import test from "node:test";
import assert from "node:assert/strict";
import {deckIds, tributes} from "../../src/game/showdown/cards.js";
import {applyAction, createShowdown} from "../../src/game/showdown/rules.js";
import {deckAfter} from "../../src/game/showdown/trail.js";
import {viewFor} from "../../src/game/showdown/contract.js";
import {RELABEL, TO_CONTROL, VIEW_KEYS, cardDiff, cowboyAct, cowboyView, deals, paired, play, rename, replay, setup, summarize} from "./compare.js";

const ctx = setup();
const small = {from: 0, to: 99};
const sorted = (ids) => [...ids].sort();

test("setup is a real two-win career on The Bone Fence with two legal 16-card decks", () => {
  assert.deepEqual(ctx.treatment, deckAfter(2));
  assert.deepEqual(ctx.control, deckAfter(1));
  for (const deck of [ctx.treatment, ctx.control]) assert.equal(Object.values(deck).reduce((a, b) => a + b, 0), 16);
  assert.equal(ctx.duel.name, "The Bone Fence");
  assert.deepEqual(ctx.duel.options.baseOrbs, {cowboy: 5, wizard: 4});
  assert.equal(ctx.duel.options.first, "cowboy");
});

test("Outrider and Sheriff differ only in name, stars, rarity and Ride; both are free", () => {
  assert.deepEqual(cardDiff().filter((f) => !f.same).map((f) => f.field).sort(), ["keys", "name", "rarity", "stars"]);
  assert.equal(tributes("cowboy-outrider-1"), 0);
  assert.equal(tributes("cowboy-sheriff-1"), 0);
});

test("the control deal is the treatment deal with Outriders renamed in place", () => {
  for (let seed = 0; seed < 50; seed++) {
    const {treatment, control} = deals(seed, ctx);
    assert.deepEqual(control.sides.wizard, treatment.sides.wizard);
    const ids = [...control.sides.cowboy.hand, ...control.sides.cowboy.deck];
    assert.deepEqual(sorted(ids), sorted(deckIds("cowboy", ctx.control)));
    const at = [...treatment.sides.cowboy.hand, ...treatment.sides.cowboy.deck];
    at.forEach((id, i) => assert.equal(ids[i], TO_CONTROL[id] ?? id));
  }
});

// The Cowboy decision points of the first `games` treatment deals, under the primary Wizard.
function cowboyPoints(games = 30) {
  const points = [];
  for (let seed = 0; seed < games; seed++) play(deals(seed, ctx).treatment, {stopAt: (_, state) => { points.push(state); return false; }});
  return points;
}

test("the policy input has no seed and no hidden card: exactly viewFor plus empty hidden lists", () => {
  const view = cowboyView(deals(7, ctx).treatment);
  assert.equal("seed" in view, false);
  assert.equal(view.seed, undefined);
  assert.deepEqual(Object.keys(view).sort(), VIEW_KEYS.table);
  assert.deepEqual(Object.keys(view.sides.cowboy).sort(), VIEW_KEYS.cowboy);
  assert.deepEqual(Object.keys(view.sides.wizard).sort(), VIEW_KEYS.wizard);
  for (const state of cowboyPoints()) {
    const v = cowboyView(state);
    const canonical = viewFor(state, "cowboy");
    assert.equal("seed" in v, false);
    assert.deepEqual(v.sides.cowboy.deck, []);
    assert.deepEqual([v.sides.wizard.hand, v.sides.wizard.deck, v.sides.wizard.traps], [[], [], []]);
    // Apart from the four empty lists, the input is the engine's canonical view, field for field.
    const {deck: _d, ...cowboy} = v.sides.cowboy;
    const {hand: _h, deck: _e, traps: _t, ...wizard} = v.sides.wizard;
    assert.deepEqual({...v, sides: {cowboy, wizard}}, canonical);
    // No hidden Wizard card id appears anywhere in the input.
    const text = JSON.stringify(v);
    for (const id of [...state.sides.wizard.hand, ...state.sides.wizard.deck, ...state.sides.wizard.traps]) {
      if (!state.sides.wizard.discard.includes(id) && !state.sides.wizard.board.some((t) => t?.cardId === id)) assert.equal(text.includes(`"${id}"`), false, id);
    }
  }
});

test("the Cowboy choice does not change when the seed or any hidden identity changes", () => {
  const points = cowboyPoints();
  assert.ok(points.length > 300);
  for (const [i, state] of points.entries()) {
    const choice = cowboyAct(cowboyView(state));
    const varied = structuredClone(state);
    varied.seed = state.seed + 1000 + i;
    const pool = ["wizard-dragon-9", "wizard-imp-9", "wizard-hex-9", "wizard-hellfire-9"];
    varied.sides.wizard.hand = varied.sides.wizard.hand.map((_, k) => pool[(i + k) % pool.length]);
    varied.sides.wizard.deck = [...varied.sides.wizard.deck].reverse().map((_, k) => pool[(i + 2 * k) % pool.length]);
    varied.sides.wizard.traps = varied.sides.wizard.traps.map(() => "wizard-hex-8");
    varied.sides.cowboy.deck = [...varied.sides.cowboy.deck].reverse();
    assert.deepEqual(cowboyAct(cowboyView(varied)), choice, `point ${i}, seed ${state.seed}`);
    // The real deal's seed is never what the policy decides on.
    const reseeded = {...structuredClone(state), seed: -1};
    assert.deepEqual(cowboyAct(cowboyView(reseeded)), choice);
  }
});

test("negative controls compare exact renamed histories, not card types", () => {
  const relabel = (seed) => { const {control} = deals(seed, ctx); return [control, rename(control, RELABEL)]; };
  // With the right map every game matches id for id; with no map the renamed copies show up as differences.
  assert.equal(summarize(paired(relabel, {seeds: small, map: RELABEL})).identical, 100);
  assert.ok(summarize(paired(relabel, {seeds: small})).identical < 100);
});

test("a Sheriff never gets a Base attack past troops; the paired run is deterministic", () => {
  const both = (seed) => { const d = deals(seed, ctx); return [d.treatment, d.control]; };
  const first = summarize(paired(both, {seeds: small}));
  assert.equal(first.controlPastTroops, 0);
  assert.equal(first.stepCap, 0);
  assert.deepEqual(summarize(paired(both, {seeds: small})), first);
  assert.equal(first.points.riderReady, first.points.offered + first.points.guardBlocked);
});

test("negative controls play identical games", () => {
  const same = (seed) => { const {control} = deals(seed, ctx); return [control, structuredClone(control)]; };
  const relabel = (seed) => { const {control} = deals(seed, ctx); return [control, rename(control, RELABEL)]; };
  assert.equal(summarize(paired(same, {seeds: small})).identical, 100);
  assert.equal(summarize(paired(relabel, {seeds: small, map: RELABEL})).identical, 100);
});

test("the replay reaches a legal visible ride position", () => {
  const found = replay();
  assert.ok(found, "some seed offers a ride");
  assert.equal(found.legal, true);
  assert.equal(found.ride.target, "base");
  assert.ok(found.view.sides.wizard.board.some(Boolean));
  assert.deepEqual(found.view.sides.wizard.hand, []);
  // Replaying the logged prefix from the deal reaches the same position.
  const again = play(deals(found.seed, ctx).treatment, {stopAt: (point) => point.offered});
  assert.deepEqual(again.log, found.prefix);
  assert.deepEqual(createShowdown(found.seed, ctx.duel.options), deals(found.seed, ctx).treatment);
});

test("with rides never taken, the Outrider deck plays exactly like the Sheriff deck", () => {
  const both = (seed) => { const d = deals(seed, ctx); return [d.treatment, d.control]; };
  const probe = summarize(paired(both, {seeds: small, noRide: true, map: TO_CONTROL}));
  assert.equal(probe.identical, 100);
  assert.equal(probe.points.taken, 0);
});
