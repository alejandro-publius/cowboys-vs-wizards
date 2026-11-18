// The cover-swap comparison board and the graybox flow that plays a swap.
import test from "node:test";
import assert from "node:assert/strict";
import {applyAction} from "../../src/game/actions.js";
import {CARDS} from "../../src/game/cards.js";
import {legalActions} from "../../src/game/legal.js";
import {publicState} from "../../src/game/view.js";
import {clashForecast, rideForecasts} from "../../src/match/clash-forecast.js";
import {clashLog} from "../../src/match/clash-log.js";
import {createController, FABLE_ENGINE} from "../../src/match/controller.js";
import {COVER_LESSON_SEED, createCoverLesson} from "../../src/match/cover-swap-lesson.js";
import {DEFAULT_PAUSES} from "../../src/match/presenter.js";
import {createScheduler} from "../../src/match/scheduler.js";

const names = (board) => board.map((troop) => troop && `${CARDS[troop.cardId].name} ${troop.health}`);
const rides = (state) => legalActions(publicState(state, "cowboy"), "cowboy").filter((a) => a.type === "ride-out").map((a) => `${a.slot}>${a.destination}`);

function controllerFor(swap) {
  const scheduler = createScheduler();
  const moves = [];
  const instant = () => ({impact: 0, end: 0});
  const renderer = {
    reset() {}, clear() {}, setTroopOrbs() {}, setBaseOrbs() {},
    summon: instant, spell: instant, attack: instant, remove: instant,
    move(move) { moves.push(move); return {end: 50}; },
  };
  const pauses = Object.fromEntries(Object.keys(DEFAULT_PAUSES).map((kind) => [kind, 0]));
  const controller = createController({
    engine: {...FABLE_ENGINE, createMatch: () => createCoverLesson({swap})},
    renderer, scheduler, pauses, cpuDelay: 0,
  });
  controller.start(COVER_LESSON_SEED);
  return {controller, scheduler, moves, slot: (side, lane) => controller.input({type: "slot", side, slot: lane})};
}

test("both variants open on the same board and hand; only the swap is added", () => {
  const current = createCoverLesson();
  const swap = createCoverLesson({swap: true});
  assert.deepEqual({...swap, rideOut: current.rideOut}, current);
  assert.equal(current.round, 6);
  assert.equal(current.activeSide, "cowboy");
  assert.equal(current.startingSide, "wizard"); // End turn resolves the clash
  assert.deepEqual(current.allowances.cowboy, {summonUsed: false, castUsed: false});
  assert.deepEqual(names(current.sides.cowboy.board), ["Sheriff 2", "Billy 3", null]);
  assert.deepEqual(names(current.sides.wizard.board), ["Wizard 4", "Skeleton 1", null]);
  assert.deepEqual([current.sides.cowboy.baseOrbs, current.sides.wizard.baseOrbs], [4, 3]);
  assert.deepEqual(rides(current), ["1>2"]);
  assert.deepEqual(rides(swap), ["0>1", "1>0", "1>2"]);
});

test("current Ride Out offers only the open lane, and previews the troop it leaves to fall", () => {
  const {controller, slot} = controllerFor(false);
  const before = controller.displayed();
  assert.equal(clashForecast(before, controller.options()).losses, "Troops that fall: Your Sheriff (lane 1), Enemy Skeleton (lane 2).");
  controller.input({type: "ride-out"});
  assert.equal(controller.options().rideFrom, 1); // Billy is the only troop with a move
  assert.deepEqual(controller.options().ownSlots, [2]);
  assert.equal(controller.options().prompt, "Choose an adjacent empty lane. This spends your summon.");
  assert.equal(rideForecasts(before, controller.options())[2], "Your Base 4 → 3 · Enemy Base 3 → 1. Troops that fall: Your Sheriff (lane 1).");
  slot("cowboy", 0);
  assert.equal(controller.options().canConfirm, false);
  assert.equal(controller.message(), "Choose an adjacent empty lane.");
});

test("the swap variant previews, cancels and plays the swap through the controller and Presenter", () => {
  const {controller, scheduler, moves, slot} = controllerFor(true);
  const before = controller.displayed();
  controller.input({type: "ride-out"});
  assert.equal(controller.options().step, "ride-source");
  assert.deepEqual(controller.options().ownSlots, [0, 1]);
  slot("cowboy", 0);
  assert.deepEqual(controller.options().ownSlots, [1]);
  assert.equal(controller.options().prompt, "Choose an adjacent lane. A lane holding your troop swaps the two. This spends your summon.");
  assert.equal(rideForecasts(before, controller.options())[1], "Your Base 4 → 4 · Enemy Base 3 → 3. Troops that fall: Enemy Skeleton (lane 2).");
  slot("cowboy", 1);
  assert.equal(controller.options().canConfirm, true);
  assert.equal(controller.options().prompt, "Swap the troops in lanes 1 and 2, or cancel.");
  controller.input({type: "cancel"});
  assert.deepEqual(controller.displayed(), before);

  controller.input({type: "ride-out"});
  slot("cowboy", 0);
  slot("cowboy", 1);
  assert.equal(controller.input({type: "confirm"}).ok, true);
  scheduler.tick(50);
  const after = controller.displayed();
  assert.deepEqual(moves, [{side: "cowboy", from: 0, to: 1}]);
  assert.deepEqual(names(after.sides.cowboy.board), ["Billy 3", "Sheriff 2", null]);
  assert.deepEqual(after.sides.cowboy.hand, before.sides.cowboy.hand);
  assert.equal(after.allowances.cowboy.summonUsed, true);
  assert.equal(controller.options().canRideOut, false);

  controller.endPhase();
  scheduler.tick(50);
  const clashed = controller.displayed();
  assert.equal(clashed.round, 7);
  assert.deepEqual(names(clashed.sides.cowboy.board).slice(0, 2), ["Billy 1", "Sheriff 1"]); // nobody fell
  assert.equal(names(clashed.sides.wizard.board)[0], "Wizard 2");
  assert.deepEqual([clashed.sides.cowboy.baseOrbs, clashed.sides.wizard.baseOrbs], [4, 3]);
});

test("the clash log says which two troops swapped", () => {
  let state = createCoverLesson({swap: true});
  const events = [];
  for (const action of [{type: "ride-out", slot: 1, destination: 0}, {type: "end-phase"}]) {
    const result = applyAction(state, {...action, side: "cowboy", revision: state.revision});
    assert.equal(result.ok, true);
    events.push(...result.events);
    state = result.state;
  }
  assert.equal(clashLog(events).lines[0], "Your Billy in lane 2 and your Sheriff in lane 1 swapped lanes");
});
