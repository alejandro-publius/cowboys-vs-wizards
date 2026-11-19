import test from "node:test";
import assert from "node:assert/strict";
import {CARDS} from "../../src/game/cards.js";
import {legalActions} from "../../src/game/legal.js";
import {publicState} from "../../src/game/view.js";
import {clashForecast, rideForecasts} from "../../src/match/clash-forecast.js";
import {createController, FABLE_ENGINE} from "../../src/match/controller.js";
import {DEFAULT_PAUSES} from "../../src/match/presenter.js";
import {createRideOutLesson, RIDE_OUT_LESSON_SEED} from "../../src/match/ride-out-lesson.js";
import {createScheduler} from "../../src/match/scheduler.js";
import {cardModel} from "../../src/ui/card-model.js";

test("the Ride Out lesson offers holding, moving and replacing the wounded Sheriff", () => {
  const state = createRideOutLesson();
  const {cowboy, wizard} = state.sides;
  assert.equal(state.round, 2);
  assert.equal(state.activeSide, "cowboy");
  assert.equal(CARDS[cowboy.board[1].cardId].name, "Sheriff");
  assert.equal(cowboy.board[1].health, 1);
  assert.equal(CARDS[wizard.board[1].cardId].name, "Skeleton");
  assert.equal(wizard.board[2], null);
  const moves = legalActions(publicState(state, "cowboy"), "cowboy");
  assert.ok(moves.some((a) => a.type === "end-phase"));
  assert.ok(moves.some((a) => a.type === "ride-out" && a.slot === 1 && a.destination === 2));
  assert.ok(moves.some((a) => a.type === "summon" && CARDS[a.cardId].name === "Billy" && a.tributes.includes(1)));
});

test("the graybox previews, cancels, and plays Ride Out through the controller and Presenter", () => {
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
    engine: {...FABLE_ENGINE, createMatch: createRideOutLesson},
    renderer, scheduler, pauses, cpuDelay: 0,
  });
  const slot = (side, lane) => controller.input({type: "slot", side, slot: lane});
  controller.start(RIDE_OUT_LESSON_SEED);
  const before = controller.displayed();
  assert.equal(cardModel({displayed: before, options: controller.options(), status: controller.status()}).ride.available, true);
  assert.equal(clashForecast(before, controller.options()).bases, "Your Base 5 → 4 · Enemy Base 5 → 5");

  controller.input({type: "ride-out"});
  assert.equal(controller.options().rideFrom, 1);
  assert.deepEqual(controller.options().ownSlots, [0, 2]);
  assert.equal(rideForecasts(before, controller.options())[2], "Your Base 5 → 3 · Enemy Base 5 → 4");
  slot("wizard", 2);
  assert.equal(controller.options().canConfirm, false);
  slot("cowboy", 2);
  assert.equal(controller.options().canConfirm, true);
  controller.input({type: "cancel"});
  assert.deepEqual(controller.displayed(), before);

  controller.input({type: "ride-out"});
  slot("cowboy", 2);
  assert.equal(controller.input({type: "confirm"}).ok, true);
  assert.equal(controller.status(), "playing");
  assert.equal(controller.displayed().sides.cowboy.board[2], null);
  scheduler.tick(50);
  const after = controller.displayed();
  assert.equal(controller.status(), "accepting_input");
  assert.deepEqual(moves, [{side: "cowboy", from: 1, to: 2}]);
  assert.deepEqual(after.sides.cowboy.board[2], before.sides.cowboy.board[1]);
  assert.equal(after.sides.cowboy.board[1], null);
  assert.deepEqual(after.sides.cowboy.hand, before.sides.cowboy.hand);
  assert.equal(after.allowances.cowboy.summonUsed, true);
  assert.equal(controller.options().canRideOut, false);
  assert.ok(controller.options().playableCardIds.every((id) => CARDS[id].kind === "spell"));
  assert.ok(controller.options().playableCardIds.some((id) => CARDS[id].name === "Deadeye"));

  controller.endPhase();
  scheduler.tick(50);
  assert.equal(controller.displayed().sides.cowboy.baseOrbs, 3);
  assert.equal(controller.displayed().sides.wizard.baseOrbs, 4);
});
