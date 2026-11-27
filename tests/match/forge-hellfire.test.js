import assert from "node:assert/strict";
import {test} from "node:test";
import {applyAction, createShowdown, legalActions} from "../../src/game/showdown/rules.js";
import {dealHellfire, mountHellfire} from "../../src/ui/forge-hellfire.js";

test("CARD-WIZARD-HELLFIRE-06: Hellfire leaves the hand and reaches the graveyard before either enemy loses an orb", t => {
  const opening = createShowdown(0, {first: "cowboy", opening: {cowboy: [
    {type: "cowboy-sheriff", health: 1}, {type: "cowboy-covered-wagon"},
  ]}});
  const before = applyAction(opening, {type: "end"}).state;
  const card = "wizard-hellfire-1";
  const cast = legalActions(before).find(action => action.type === "spell" && action.cardId === card);
  assert.ok(cast);
  const hits = [];
  const clone = globalThis.structuredClone;
  // A cast with the discard moved to its very end has the same public result.
  // Inspect the Wizard's zones at each actual health write on the working board.
  t.mock.method(globalThis, "structuredClone", state => {
    const copy = clone(state);
    const wizard = copy.sides.wizard;
    for (const troop of copy.sides.cowboy.board.filter(Boolean)) {
      let orbs = troop.health;
      Object.defineProperty(troop, "health", {
        get() { return orbs; },
        set(value) {
          assert.equal(wizard.hand.includes(card), false, "Hellfire is still in hand when damage lands");
          assert.equal(wizard.discard.at(-1), card, "Hellfire has not reached its graveyard when damage lands");
          hits.push([troop.cardId, orbs, value]);
          orbs = value;
        },
      });
    }
    return copy;
  }, {times: 1});
  applyAction(before, cast);
  assert.deepEqual(hits, [["cowboy-sheriff-0", 1, 0], ["cowboy-covered-wagon-0", 4, 3]]);
});

test("CARD-WIZARD-HELLFIRE-07 and CARD-WIZARD-HELLFIRE-11: only the opposing Sheriff loses an orb on the Forge board", () => {
  const before = dealHellfire();
  const troops = (state, side) => state.sides[side].board.filter(Boolean).map(({cardId, health}) => [cardId, health]);
  assert.equal(before.turn, 2);
  assert.equal(before.active, "wizard");
  assert.deepEqual(troops(before, "cowboy"), [["cowboy-sheriff-3", 3]]);
  assert.deepEqual(troops(before, "wizard"), [["wizard-skeleton-4", 3]]);

  const {state, events} = applyAction(before, {type: "spell", cardId: "wizard-hellfire-1"});
  assert.deepEqual(troops(state, "cowboy"), [["cowboy-sheriff-3", 2]]);
  assert.deepEqual(troops(state, "wizard"), [["wizard-skeleton-4", 3]]);
  assert.deepEqual([state.sides.cowboy.base, state.sides.wizard.base], [5, 5]);
  assert.deepEqual(events, [{type: "spell", side: "wizard", cardId: "wizard-hellfire-1", target: "cowboy-sheriff-3", left: 2, stunned: false}]);
});

test("both Forge wordings cast from the same board; retry returns focus to the alternate wording", () => {
  let focused;
  const control = (value) => Object.assign(new EventTarget(), {
    value, focus() { focused = this; }, click() { this.dispatchEvent(new Event("click")); },
  });
  const all = control("all"), enemy = control("enemy"), retry = control(), verdict = control();
  const cowboy = {}, wizard = {};
  const readings = {hidden: false, querySelectorAll: () => [all, enemy]};
  const result = {hidden: true, querySelector: (selector) => ({"[data-retry]": retry, "[data-verdict]": verdict})[selector]};
  const nodes = {"[data-cowboy]": cowboy, "[data-wizard]": wizard, "[data-readings]": readings, "[data-result]": result};
  mountHellfire({querySelector: (selector) => nodes[selector]});
  for (const [choice, prediction, alternate] of [
    [all, /“Every troop” fails on this board\. It predicts 2 orbs for your Skeleton/, enemy],
    [enemy, /“Every enemy troop” matches this cast\. It predicts 3 orbs for your Skeleton/, all],
  ]) {
    assert.equal(cowboy.textContent, "Cowboys · Sheriff · 3 orbs");
    assert.equal(wizard.textContent, "Wizards · Skeleton · 3 orbs");
    choice.click();
    assert.equal(readings.hidden, true);
    assert.equal(result.hidden, false);
    assert.equal(focused, verdict);
    assert.match(verdict.textContent, prediction);
    assert.equal(cowboy.textContent, "Cowboys · Sheriff · 3 → 2 orbs");
    assert.equal(wizard.textContent, "Wizards · Skeleton · 3 → 3 orbs");
    retry.click();
    assert.equal(result.hidden, true);
    assert.equal(readings.hidden, false);
    assert.equal(focused, alternate);
  }
});
