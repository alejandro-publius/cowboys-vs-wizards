import assert from "node:assert/strict";
import {test} from "node:test";
import {CARDS} from "../../src/game/cards.js";
import {createMatch} from "../../src/game/state.js";
import {publicState} from "../../src/game/view.js";
import {clashForecast} from "../../src/match/clash-forecast.js";
import {spellForecasts} from "../../src/match/spell-forecast.js";
import {summonForecasts} from "../../src/match/summon-forecast.js";

const sheriff = "cowboy-sheriff-1";
const skeleton = "wizard-skeleton-1";
const dragon = Object.values(CARDS).find((card) => card.side === "cowboy" && card.kind === "troop" && /dragon/i.test(card.name)).id;
const idle = {step: "idle", playableCardIds: [sheriff]};

// The same winning Dragon combo: the lane 2 Skeleton is wounded to 1 orb and
// the Dragon burns 3 through to a Wizard Base of 3. Only who moves first differs.
function dragonCombo(startingSide) {
  const view = publicState(createMatch(0), "cowboy");
  view.startingSide = startingSide;
  view.dragonFire = {enabled: true};
  view.sides.cowboy.baseOrbs = 2;
  view.sides.wizard.baseOrbs = 3;
  view.sides.cowboy.board = [null, {cardId: dragon, health: CARDS[dragon].health}, null];
  view.sides.wizard.board = [null, {cardId: skeleton, health: 1}, null];
  return view;
}

test("Position A: unmarked Dragon combo is lethal", () => {
  const forecast = clashForecast(dragonCombo("wizard"), idle, {mark: null, stage: "position-a"});
  assert.match(forecast.bases, /^Your Base 2 → 2 · Enemy Base 3 → 0 \(falls\)$/);
  assert.match(forecast.timing, /End turn resolves this clash\. You win the match\.$/);
  assert.equal(forecast.rebuild, undefined);
});

test("Position B: the marked lane makes the same combo conditional", () => {
  const forecast = clashForecast(dragonCombo("cowboy"), idle, {mark: 1, stage: "position-b"});
  assert.equal(forecast.bases, "If no rebuild: Your Base 2 → 2 · Enemy Base 3 → 0 (falls)");
  assert.match(forecast.fire, /^If no rebuild: Dragon Fire burns through/);
  assert.match(forecast.rebuild, /lane 2 can be replaced by a fresh Wizard/);
  assert.doesNotMatch(forecast.timing, /win the match/);
});

test("forecasts without a usable mark equal the normal forecasts", () => {
  const plain = clashForecast(dragonCombo("cowboy"), idle);
  assert.deepEqual(clashForecast(dragonCombo("cowboy"), idle, {mark: null, stage: "x"}), plain);
  assert.deepEqual(clashForecast(dragonCombo("cowboy"), idle, {mark: 0, stage: "x"}), plain);
  assert.deepEqual(clashForecast(dragonCombo("wizard"), idle, {mark: 1, stage: "x"}), clashForecast(dragonCombo("wizard"), idle));
});

test("a summon into the marked lane is conditional and says the troop can be replaced", () => {
  const view = dragonCombo("cowboy");
  view.sides.cowboy.board = [null, null, null];
  const options = {cardId: dragon, step: "slot", ownSlots: [1, 2], tributes: []};
  const plain = summonForecasts(view, options);
  const marked = summonForecasts(view, options, {mark: 1, stage: "position-b"});
  assert.match(marked[1], /^If no rebuild: .*enemy Base 3 → 0/i);
  assert.match(marked[1], /can be replaced by a fresh Wizard/);
  assert.equal(marked[2], plain[2]);
});

test("a spell that removes the marked blocker does not promise the same lane rebuilds", () => {
  const view = dragonCombo("cowboy");
  const spell = Object.values(CARDS).find((card) => card.kind === "spell" && card.side === "cowboy" && !card.relocates);
  const options = {cardId: spell.id, step: "target", enemySlots: [1]};
  const plain = spellForecasts(view, options);
  const marked = spellForecasts(view, options, {mark: 1, stage: "position-b"});
  assert.match(marked[1], /\(removed\)/);
  assert.match(marked[1], /If no rebuild: /);
  assert.match(marked[1], /removes the marked troop/);
  assert.doesNotMatch(marked[1], /same lane/);
  assert.ok(plain[1].length > 0);
});
