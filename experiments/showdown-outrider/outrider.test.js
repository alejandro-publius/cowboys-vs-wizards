// Run: node --test experiments/showdown-outrider/outrider.test.js
import test from "node:test";
import assert from "node:assert/strict";
import {deckIds, tributes} from "../../src/game/showdown/cards.js";
import {applyAction, createShowdown} from "../../src/game/showdown/rules.js";
import {deckAfter} from "../../src/game/showdown/trail.js";
import {RELABEL, TO_CONTROL, cardDiff, cowboyAct, cowboyView, deals, paired, play, rename, replay, setup, summarize} from "./compare.js";

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

test("the Cowboy policy reads public information only", () => {
  for (let seed = 0; seed < 30; seed++) {
    let state = deals(seed, ctx).treatment;
    for (let i = 0; i < 40 && !state.result; i++) {
      if (state.active === "cowboy") {
        const scrambled = structuredClone(state);
        scrambled.sides.wizard.hand = [...scrambled.sides.wizard.hand].reverse().map(() => "wizard-skeleton-9");
        scrambled.sides.wizard.deck.reverse();
        scrambled.sides.cowboy.deck.reverse();
        assert.deepEqual(cowboyAct(cowboyView(scrambled)), cowboyAct(cowboyView(state)));
        state = applyAction(state, cowboyAct(cowboyView(state))).state;
      } else state = applyAction(state, {type: "end"}).state;
    }
  }
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
  assert.equal(summarize(paired(relabel, {seeds: small})).identical, 100);
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
  const probe = summarize(paired(both, {seeds: small, noRide: true}));
  assert.equal(probe.identical, 100);
  assert.equal(probe.points.taken, 0);
});
