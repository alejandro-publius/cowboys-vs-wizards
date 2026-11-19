// Card overlay model (src/ui/card-model.js). Seeds 0-99 each play a
// CPU-vs-CPU match (chooseAction on each side's own public view). At every
// step the model is built from publicState(state, "cowboy") and checked
// against that view and against the full state's Wizard hand, which the
// model must never reveal.
import test from "node:test";
import assert from "node:assert/strict";
import { CARDS, SIDES, tributeCost } from "../../src/game/cards.js";
import { createMatch } from "../../src/game/state.js";
import { applyAction } from "../../src/game/actions.js";
import { publicState } from "../../src/game/view.js";
import { legalActions } from "../../src/game/legal.js";
import { chooseAction } from "../../src/game/cpu.js";
import { blockedReasons, emptySelection, selectionOptions, selectionStep } from "../../src/match/selection.js";
import { RESULT_LABELS, cardModel } from "../../src/ui/card-model.js";

const SEEDS = Array.from({ length: 100 }, (_, seed) => seed);
const MAX_STEPS = 500;
const ridersSeen = new Set(); // rider cards that reached a model's hand

function forEachSeed(run) {
  for (const seed of SEEDS) {
    try {
      run(seed);
    } catch (error) {
      throw new Error(`seed ${seed}: ${error.message}`, { cause: error });
    }
  }
}

const summary = (troop) => troop && { name: CARDS[troop.cardId].name, health: troop.health, max: CARDS[troop.cardId].health };

function checkModel(model, { view, state, options, status, seed }) {
  const own = view.sides.cowboy;
  assert.equal(model.status, status);
  assert.equal(model.round, view.round);
  assert.deepEqual(model.seed, { value: seed, pinned: true, text: String(seed) }, "the seed is shown");

  assert.equal(model.cowboy.deckCount, own.deckCount);
  assert.equal(model.cowboy.handCount, own.handCount);
  assert.equal(model.cowboy.baseOrbs, own.baseOrbs);
  assert.deepEqual(model.cowboy.hand.map((card) => card.cardId), own.hand, "one entry per held card, in hand order");
  const selected = options?.cardId ?? null;
  const playable = status === "accepting_input" && options ? legalActions(view, "cowboy") : [];
  for (const card of model.cowboy.hand) {
    const data = CARDS[card.cardId];
    assert.deepEqual(card, {
      cardId: data.id,
      name: data.name,
      kind: data.kind,
      stars: data.kind === "troop" ? data.stars : "Spell",
      health: data.health ?? null,
      attack: data.attack ?? null,
      selected: data.id === selected,
      playable: playable.some((action) => action.cardId === data.id),
      ...(data.kind === "troop" && data.rides === true && { rides: true }),
    });
    // `rides` is present, and true, only on rider troop cards.
    assert.equal(Object.hasOwn(card, "rides"), data.kind === "troop" && data.rides === true, `${card.cardId}: rides flag`);
    if (Object.hasOwn(card, "rides")) {
      assert.equal(card.rides, true);
      ridersSeen.add(card.cardId);
    }
  }

  // The Wizard side is counts only, and no card of the hidden Wizard hand
  // appears anywhere in the model.
  const enemy = view.sides.wizard;
  assert.deepEqual(model.wizard, { deckCount: enemy.deckCount, handCount: enemy.handCount, baseOrbs: enemy.baseOrbs });
  const wizardPart = JSON.stringify(model.wizard);
  const whole = JSON.stringify(model);
  for (const cardId of state.sides.wizard.hand) {
    assert.ok(!wizardPart.includes(cardId) && !wizardPart.includes(CARDS[cardId].name), `the Wizard part reveals ${cardId}`);
    assert.ok(!whole.includes(cardId), `the model reveals ${cardId}`);
  }

  model.lanes.forEach((lane, slot) => {
    assert.deepEqual(lane, { lane: slot, cowboy: summary(own.board[slot]), wizard: summary(enemy.board[slot]) });
  });

  const accepting = status === "accepting_input";
  // The ride block appears in a standard duel only while a ride is legal or being chosen.
  const rideShown = Boolean(view.rideOut?.enabled || (accepting && (options?.canRideOut || options?.step?.startsWith("ride-"))));
  assert.equal(Object.hasOwn(model, "ride"), rideShown, "ride block presence");
  if (rideShown) {
    assert.deepEqual(model.ride, {
      available: accepting && Boolean(options?.canRideOut),
      choosing: accepting && Boolean(options?.step?.startsWith("ride-")),
      from: options?.rideFrom ?? null,
      destination: options?.rideDestination ?? null,
    });
  }
  assert.deepEqual(model.buttons, {
    hand: accepting,
    confirm: accepting && Boolean(options?.canConfirm),
    cancel: accepting && Boolean(options?.canCancel),
    skip: accepting && Boolean(options?.canSkip),
    endPhase: accepting,
    restart: true,
  });
  assert.deepEqual(model.slots, {
    cowboy: accepting ? options?.ownSlots ?? [] : [],
    wizard: accepting ? options?.enemySlots ?? [] : [],
  });
  if (accepting) assert.equal(model.prompt, options?.prompt ?? "");
}

test("card model: counts, one front per held card, no Wizard card identity, outcomes and seed (seeds 0-99)", (t) => {
  const outcomes = { win: 0, loss: 0, draw: 0 };
  forEachSeed((seed) => {
    let state = createMatch(seed);
    for (let step = 0; ; step++) {
      assert.ok(step < MAX_STEPS, `no result after ${MAX_STEPS} steps`);
      const view = publicState(state, "cowboy");
      const status = state.result ? "terminal" : state.activeSide === "cowboy" ? "accepting_input" : "cpu_turn";
      const action = state.result ? null : chooseAction(publicState(state, state.activeSide));

      // While the Cowboy acts, the card it is about to play is selected, so
      // the selected flag is checked; every third step has no options at all.
      let selection = emptySelection;
      if (status === "accepting_input" && action.type === "ride-out") {
        selection = selectionStep(emptySelection, { type: "ride-out" }, view, { accepting: true }).selection;
      } else if (status === "accepting_input" && action.type !== "end-phase") {
        selection = selectionStep(emptySelection, { type: "card", cardId: action.cardId }, view, { accepting: true }).selection;
      }
      const options = step % 3 === 2 ? null : selectionOptions(selection, view);
      const model = cardModel({ displayed: view, options, status, seed, seedPinned: true, message: null });
      checkModel(model, { view, state, options, status, seed });

      if (state.result) {
        const { outcome } = view.result;
        assert.deepEqual(model.result, { outcome, label: RESULT_LABELS[outcome], reason: view.result.reason, round: view.result.round });
        outcomes[outcome] += 1;
        break;
      }
      assert.equal(model.result, null);
      const applied = applyAction(state, action);
      assert.equal(applied.ok, true, applied.reason);
      state = applied.state;
    }
  });
  for (const [outcome, count] of Object.entries(outcomes)) assert.ok(count > 0, `no ${outcome} in seeds 0-99`);
  assert.ok(ridersSeen.size > 0, "no rider card reached a hand in seeds 0-99");
  t.diagnostic(`Cowboy outcomes: ${JSON.stringify(outcomes)}`);
});

test("card model: no match yet, the result labels and the message", () => {
  const empty = cardModel({ displayed: null, options: null, status: "idle", seed: null, seedPinned: false, message: null });
  assert.equal(empty.round, null);
  assert.equal(empty.phase, "No match");
  assert.deepEqual(empty.seed, { value: null, pinned: false, text: "–" });
  assert.deepEqual(empty.cowboy, { deckCount: null, handCount: null, baseOrbs: null, hand: [] });
  assert.deepEqual(empty.wizard, { deckCount: null, handCount: null, baseOrbs: null });
  assert.deepEqual(empty.lanes, [0, 1, 2].map((lane) => ({ lane, cowboy: null, wizard: null })));
  assert.equal(Object.values(empty.buttons).some(Boolean), false, "no button is enabled before a match");
  assert.equal(empty.result, null);
  assert.deepEqual(cardModel(), empty);

  assert.deepEqual(RESULT_LABELS, { win: "Victory", loss: "Defeat", draw: "Draw" });
  const view = publicState(createMatch(3), "cowboy");
  for (const [winner, outcome] of [["cowboy", "win"], ["wizard", "loss"], [null, "draw"]]) {
    const loser = winner && SIDES.find((side) => side !== winner);
    const displayed = { ...view, activeSide: null, result: { winner, loser, reason: "round-limit", round: 9, outcome } };
    const model = cardModel({ displayed, options: null, status: "terminal", seed: 3, seedPinned: false, message: "Saved." });
    assert.equal(model.result.label, RESULT_LABELS[outcome]);
    assert.equal(model.phase, "Match over");
    assert.equal(model.message, "Saved.");
    assert.equal(model.buttons.restart, true);
    assert.equal(model.buttons.endPhase, false);
    assert.deepEqual(model.seed, { value: 3, pinned: false, text: "3" });
  }
});

test("card model: opt-in blocked reasons appear on unplayable cards only while accepting input (seed 14)", (t) => {
  const view = publicState(createMatch(14), "cowboy");
  const options = selectionOptions(emptySelection, view);
  const reasons = blockedReasons(view);
  const input = { displayed: view, options, seed: 14, seedPinned: true, message: null };
  assert.deepEqual(options.playableCardIds, [], "seed 14 opens with zero legal plays");

  const shown = cardModel({ ...input, status: "accepting_input", blockedReasons: reasons });
  assert.deepEqual(shown.cowboy.hand.map((card) => card.blockedReason), view.sides.cowboy.hand.map((cardId) => reasons[cardId]));
  assert.ok(shown.cowboy.hand.every((card) => !card.playable && typeof card.blockedReason === "string"), "every seed-14 card has a reason");
  for (const card of shown.cowboy.hand) {
    const cost = tributeCost(card.stars);
    t.diagnostic(`seed 14 ${card.cardId}: ${card.name} | ${card.attack} attack · ${card.health} life | ${cost} tribute${cost === 1 ? "" : "s"} | ${card.blockedReason}`);
  }

  // Opting in adds only blockedReason; without it the shared hand cards keep their shape.
  const shared = cardModel({ ...input, status: "accepting_input" });
  assert.ok(shared.cowboy.hand.every((card) => !("blockedReason" in card)));
  const stripped = shown.cowboy.hand.map(({ blockedReason, ...card }) => card);
  assert.deepEqual({ ...shown, cowboy: { ...shown.cowboy, hand: stripped } }, shared);

  // No reason outside player input, nor on a card the options call playable.
  for (const status of ["submitting", "playing", "cpu_turn", "terminal"]) {
    const waiting = cardModel({ ...input, status, blockedReasons: reasons });
    assert.ok(waiting.cowboy.hand.every((card) => card.blockedReason === null), status);
  }
  const [first, ...rest] = view.sides.cowboy.hand;
  const mixed = cardModel({ ...input, options: { ...options, playableCardIds: [first] }, status: "accepting_input", blockedReasons: reasons });
  assert.deepEqual(
    mixed.cowboy.hand.map((card) => [card.playable, card.blockedReason]),
    [[true, null], ...rest.map((cardId) => [false, reasons[cardId]])],
  );
});
