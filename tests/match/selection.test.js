// Selection state machine (src/match/selection.js). Property 1 runs as a
// seeded loop over seeds 0-99, because no PBT library is installed: matches
// are walked with chooseAction for both sides, and at every position random
// click sequences run on the acting side's own view (so Singularity is
// exercised on Wizard views). The examples cover one acceptance case each.
import test from "node:test";
import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { CARDS, DECKS, SIDES, opponent, tributeCost } from "../../src/game/cards.js";
import { createMatch } from "../../src/game/state.js";
import { applyAction } from "../../src/game/actions.js";
import { legalActions } from "../../src/game/legal.js";
import { publicState } from "../../src/game/view.js";
import { chooseAction } from "../../src/game/cpu.js";
import { blockedReasons, emptySelection, selectionOptions, selectionStep } from "../../src/match/selection.js";

const SEEDS = Array.from({ length: 100 }, (_, seed) => seed); // includes 14, 27 and 47
const ACTING_SEQUENCES = 3;
const ACTING_CLICKS = 10;
const WAITING_CLICKS = 5;

// mulberry32, local to this file.
function picker(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (random, items) => items[Math.floor(random() * items.length)];

// Every position of a CPU-vs-CPU match, from setup to the terminal state.
function* positions(seed) {
  let state = createMatch(seed);
  for (let step = 0; ; step++) {
    yield state;
    if (state.result) return;
    const action = chooseAction(publicState(state, state.activeSide));
    const applied = applyAction(state, { ...action, actionId: `walk-${step}` });
    assert.equal(applied.ok, true, `walk step ${step}: ${applied.reason}`);
    state = applied.state;
  }
}

// Half the clicks follow the offered options, so deep steps are reached; the
// rest are drawn from every input, including a card the viewer cannot hold.
function randomInput(random, view, current) {
  const enemy = opponent(view.viewer);
  const handClicks = view.sides[view.viewer].hand.map((cardId) => ({ type: "card", cardId }));
  if (random() < 0.5) {
    const options = selectionOptions(current, view);
    const guided = [
      ...(current.step === "idle" ? handClicks : []),
      ...options.ownSlots.map((slot) => ({ type: "slot", side: view.viewer, slot })),
      ...options.enemySlots.map((slot) => ({ type: "slot", side: enemy, slot })),
      ...(options.canSkip ? [{ type: "skip" }] : []),
      ...(options.canConfirm ? [{ type: "confirm" }] : []),
    ];
    if (guided.length > 0) return pick(random, guided);
  }
  return pick(random, [
    ...handClicks,
    { type: "card", cardId: pick(random, DECKS[enemy]) },
    ...[view.viewer, enemy].flatMap((side) => [0, 1, 2].map((slot) => ({ type: "slot", side, slot }))),
    { type: "skip" },
    { type: "cancel" },
    { type: "confirm" },
  ]);
}

function actionKey(action) {
  if (action.type === "summon") return `${action.side} summon, ${action.tributes.length} tribute(s)`;
  return `${action.side} spell, ${action.destination === undefined ? "no move" : "moved"}`;
}

function checkSeed(seed, coverage) {
  const random = picker(seed ^ 0x5e1ec7);
  const issued = [];
  const newActionId = () => {
    issued.push(`select-${seed}-${issued.length}`);
    return issued.at(-1);
  };
  const open = { accepting: true, newActionId };
  const locked = { accepting: false, newActionId };
  let returned = 0;

  for (const state of positions(seed)) {
    const committed = structuredClone(state);
    for (const viewer of SIDES) {
      const view = publicState(state, viewer);
      const snapshot = structuredClone(view);
      const acting = !state.result && state.activeSide === viewer;
      const legal = legalActions(view, viewer);

      for (let sequence = 0; sequence < (acting ? ACTING_SEQUENCES : 1); sequence++) {
        let current = emptySelection;
        for (let click = 0; click < (acting ? ACTING_CLICKS : WAITING_CLICKS); click++) {
          const input = randomInput(random, view, current);
          const kept = structuredClone(current);
          const where = `${viewer} view, revision ${view.revision}, step ${current.step}, input ${JSON.stringify(input)}`;

          // Outside accepting_input nothing changes and nothing is submitted.
          const off = selectionStep(current, input, view, locked);
          assert.equal(off.selection, current, where);
          assert.equal(off.action, undefined, where);

          const result = selectionStep(current, input, view, open);
          assert.deepEqual(view, snapshot, where);
          assert.deepEqual(current, kept, where);

          if (!acting) {
            // Outside the viewer's phase, or after the result: ignored.
            assert.equal(result.selection, current, where);
            assert.equal(result.action, undefined, where);
            continue;
          }

          const cancelled = selectionStep(current, { type: "cancel" }, view, open);
          assert.equal(cancelled.selection, emptySelection, where);
          assert.equal(cancelled.action, undefined, where);
          coverage.cancelled.add(current.step);

          if (result.action) {
            returned += 1;
            assert.equal(input.type, "confirm", where);
            const { actionId, ...entry } = result.action;
            assert.ok(legal.some((each) => isDeepStrictEqual(each, entry)), `${where}: not a legal entry ${JSON.stringify(entry)}`);
            assert.equal(issued.length, returned, `${where}: one new actionId per submitted action`);
            assert.equal(actionId, issued.at(-1), where);
            assert.deepEqual(result.selection, { step: "idle" }, where);
            // A duplicate confirmation submits nothing.
            const again = selectionStep(result.selection, { type: "confirm" }, view, open);
            assert.equal(again.action, undefined, where);
            assert.equal(applyAction(state, result.action).ok, true, where);
            const key = actionKey(entry);
            coverage.actions.set(key, (coverage.actions.get(key) ?? 0) + 1);
            if (entry.type === "summon" && entry.tributes.includes(entry.slot)) coverage.vacated += 1;
          }
          assert.equal(issued.length, returned, `${where}: actionId issued without an action`);
          current = result.selection;
        }
      }
    }
    // The committed state never reaches the selection module.
    assert.deepEqual(state, committed);
  }
}

test("Feature: orb-duel, Property 1: Selection never touches the Engine", (t) => {
  const coverage = { cancelled: new Set(), actions: new Map(), vacated: 0 };
  for (const seed of SEEDS) {
    try {
      checkSeed(seed, coverage);
    } catch (error) {
      throw new Error(`seed ${seed}: ${error.message}`, { cause: error });
    }
  }
  // The walks must reach every step and every kind of action.
  assert.deepEqual([...coverage.cancelled].sort(), ["confirm", "destination", "idle", "slot", "target", "tribute"]);
  for (const key of [
    "cowboy summon, 0 tribute(s)",
    "cowboy summon, 1 tribute(s)",
    "cowboy summon, 2 tribute(s)",
    "wizard summon, 0 tribute(s)",
    "wizard summon, 1 tribute(s)",
    "wizard summon, 2 tribute(s)",
    "cowboy spell, no move",
    "wizard spell, no move",
    "wizard spell, moved",
  ]) {
    assert.ok(coverage.actions.has(key), `no ${key} was submitted`);
  }
  t.diagnostic(`submitted: ${JSON.stringify(Object.fromEntries(coverage.actions))}`);
  t.diagnostic(`summons onto a slot vacated by tribute: ${coverage.vacated}`);
});

// ---- Examples ----

let count = 0;
const open = { accepting: true, newActionId: () => `example-${++count}` };
const card = (cardId) => ({ type: "card", cardId });
const slot = (side, index) => ({ type: "slot", side, slot: index });

// Valid position built by moving card instances between the zones of a
// createMatch result: the named cards go to each listed side's board (null is
// an empty slot) and hand, every other card of that side to its deck.
function position(active, sides) {
  const state = createMatch(1);
  state.startingSide = active;
  state.activeSide = active;
  for (const [side, { board = [null, null, null], hand = [] }] of Object.entries(sides)) {
    const placed = new Set([...board.filter(Boolean), ...hand]);
    state.sides[side] = {
      baseOrbs: 5,
      deck: DECKS[side].filter((id) => !placed.has(id)),
      hand: [...hand],
      board: board.map((id) => (id ? { cardId: id, health: CARDS[id].health } : null)),
      discard: [],
    };
  }
  return state;
}

// Feed inputs in order, checking that the view never changes.
function run(view, inputs, from = emptySelection) {
  const before = structuredClone(view);
  let current = from;
  const results = [];
  for (const input of inputs) {
    const result = selectionStep(current, input, view, open);
    results.push(result);
    current = result.selection;
  }
  assert.deepEqual(view, before);
  return results;
}

test("seed 14: Billy shows the tribute shortfall and selection stays idle", () => {
  const state = createMatch(14);
  const view = publicState(state, "cowboy");
  assert.equal(view.activeSide, "cowboy");
  const hand = view.sides.cowboy.hand;
  assert.ok(hand.includes("cowboy-billy-1") && hand.includes("cowboy-mounted-billy-1"));
  assert.ok(!hand.some((id) => CARDS[id].kind === "troop" && tributeCost(CARDS[id].stars) === 0), "no free troop");

  const [billy, mounted] = run(view, [card("cowboy-billy-1"), card("cowboy-mounted-billy-1")]);
  assert.equal(billy.selection, emptySelection);
  assert.equal(billy.action, undefined);
  assert.equal(billy.message, "Billy needs 1 tribute troop; you have 0 on the board.");
  assert.equal(mounted.selection, emptySelection);
  assert.equal(mounted.message, "Mounted Billy needs 2 tribute troops; you have 0 on the board.");
  assert.equal(selectionOptions(billy.selection, view).step, "idle");
});

test("hand clicks select, replace and deselect; an occupied or enemy slot is invalid", () => {
  const state = position("cowboy", {
    cowboy: { board: ["cowboy-sheriff-3", null, null], hand: ["cowboy-sheriff-1", "cowboy-sheriff-2"] },
  });
  const view = publicState(state, "cowboy");
  const [first, replaced, deselected] = run(view, [card("cowboy-sheriff-1"), card("cowboy-sheriff-2"), card("cowboy-sheriff-2")]);
  assert.deepEqual(first.selection, { step: "slot", cardId: "cowboy-sheriff-1", tributes: [] });
  assert.equal(replaced.selection.cardId, "cowboy-sheriff-2");
  assert.equal(deselected.selection, emptySelection);

  const [chosen, occupied, enemy, valid, confirmed] = run(view, [
    card("cowboy-sheriff-1"),
    slot("cowboy", 0),
    slot("wizard", 1),
    slot("cowboy", 2),
    { type: "confirm" },
  ]);
  assert.deepEqual(selectionOptions(chosen.selection, view).ownSlots, [1, 2]);
  assert.equal(selectionOptions(chosen.selection, view).prompt, "Choose a tile for Sheriff.");
  for (const invalid of [occupied, enemy]) {
    assert.equal(invalid.message, "Slot is invalid.");
    assert.equal(invalid.selection, chosen.selection);
  }
  assert.equal(valid.selection.step, "confirm");
  assert.deepEqual(confirmed.action, {
    type: "summon",
    side: "cowboy",
    revision: 0,
    cardId: "cowboy-sheriff-1",
    slot: 2,
    tributes: [],
    actionId: confirmed.action.actionId,
  });
  assert.match(confirmed.action.actionId, /^example-\d+$/);
  assert.equal(applyAction(state, confirmed.action).ok, true);
});

test("full board: a tribute's vacated slot is offered and confirms a legal summon", () => {
  const state = position("cowboy", {
    cowboy: {
      board: ["cowboy-sheriff-1", "cowboy-sheriff-2", "cowboy-sheriff-3"],
      hand: ["cowboy-billy-1", "cowboy-mounted-billy-1"],
    },
  });
  const view = publicState(state, "cowboy");

  const [picked, tributed, occupied, chosen, confirmed, twice] = run(view, [
    card("cowboy-billy-1"),
    slot("cowboy", 1),
    slot("cowboy", 0),
    slot("cowboy", 1),
    { type: "confirm" },
    { type: "confirm" },
  ]);
  const tributeOptions = selectionOptions(picked.selection, view);
  assert.equal(tributeOptions.step, "tribute");
  assert.deepEqual(tributeOptions.ownSlots, [0, 1, 2]);
  assert.equal(tributeOptions.prompt, "Choose 1 troop to sacrifice (0 chosen).");
  assert.deepEqual(selectionOptions(tributed.selection, view).ownSlots, [1], "only the vacated slot");
  assert.deepEqual(selectionOptions(tributed.selection, view).tributes, [1]);
  assert.equal(occupied.message, "Slot is invalid.");
  assert.equal(chosen.selection.step, "confirm");
  assert.equal(selectionOptions(chosen.selection, view).canConfirm, true);
  const { actionId, ...action } = confirmed.action;
  assert.deepEqual(action, { type: "summon", side: "cowboy", revision: 0, cardId: "cowboy-billy-1", slot: 1, tributes: [1] });
  assert.equal(typeof actionId, "string");
  assert.equal(twice.action, undefined, "a second confirm submits nothing");
  const applied = applyAction(state, confirmed.action);
  assert.equal(applied.ok, true);
  assert.equal(applied.state.sides.cowboy.board[1].cardId, "cowboy-billy-1");

  // Two tributes, picked out of order and with a toggle; cancel discards the picks.
  const steps = run(view, [
    card("cowboy-mounted-billy-1"),
    slot("cowboy", 2),
    slot("cowboy", 2),
    slot("cowboy", 2),
    slot("cowboy", 0),
    slot("cowboy", 2),
    { type: "confirm" },
  ]);
  assert.equal(selectionOptions(steps[1].selection, view).prompt, "Choose 2 troops to sacrifice (1 chosen).");
  assert.deepEqual(steps[2].selection.tributes, [], "a second click on a pick removes it");
  assert.deepEqual(selectionOptions(steps[4].selection, view).ownSlots, [0, 2]);
  assert.deepEqual(steps[6].action.tributes, [0, 2]);
  assert.equal(steps[6].action.slot, 2);
  assert.equal(applyAction(state, steps[6].action).ok, true);

  const [, halfway, cancelled] = run(view, [card("cowboy-mounted-billy-1"), slot("cowboy", 0), { type: "cancel" }]);
  assert.equal(halfway.selection.step, "tribute");
  assert.equal(cancelled.selection, emptySelection);
  assert.equal(cancelled.action, undefined);
});

test("Deadeye takes an enemy target and never asks for a destination", () => {
  const state = position("cowboy", {
    cowboy: { hand: ["cowboy-deadeye-1", "cowboy-sheriff-1"] },
    wizard: { board: ["wizard-skeleton-1", null, "wizard-wizard-1"] },
  });
  const view = publicState(state, "cowboy");
  const [targeting, own, empty, skipped, chosen, confirmed] = run(view, [
    card("cowboy-deadeye-1"),
    slot("cowboy", 0),
    slot("wizard", 1),
    { type: "skip" },
    slot("wizard", 2),
    { type: "confirm" },
  ]);
  assert.equal(targeting.selection.step, "target");
  assert.deepEqual(selectionOptions(targeting.selection, view).enemySlots, [0, 2]);
  for (const invalid of [own, empty]) {
    assert.equal(invalid.selection, targeting.selection);
    assert.equal(invalid.message, "Choose an enemy troop to target.");
  }
  assert.equal(skipped.selection, targeting.selection);
  assert.equal(chosen.selection.step, "confirm");
  const { actionId, ...action } = confirmed.action;
  assert.deepEqual(action, { type: "spell", side: "cowboy", revision: 0, cardId: "cowboy-deadeye-1", target: 2 });
  assert.equal(typeof actionId, "string");
  assert.equal(applyAction(state, confirmed.action).ok, true);

  const noTarget = publicState(position("cowboy", { cowboy: { hand: ["cowboy-deadeye-1"] }, wizard: {} }), "cowboy");
  const [blocked] = run(noTarget, [card("cowboy-deadeye-1")]);
  assert.equal(blocked.selection, emptySelection);
  assert.equal(blocked.message, "Deadeye has no target: the enemy has no troops on the board.");
});

test("Singularity on a Wizard view takes a target, then a destination or skip", () => {
  const state = position("wizard", {
    wizard: { hand: ["wizard-singularity-1", "wizard-skeleton-1"] },
    cowboy: { board: [null, "cowboy-billy-1", null] },
  });
  const view = publicState(state, "wizard");
  const [targeting, moving, onTarget, own, moved, confirmed] = run(view, [
    card("wizard-singularity-1"),
    slot("cowboy", 1),
    slot("cowboy", 1),
    slot("wizard", 0),
    slot("cowboy", 2),
    { type: "confirm" },
  ]);
  assert.deepEqual(selectionOptions(targeting.selection, view).enemySlots, [1]);
  assert.equal(moving.selection.step, "destination");
  const options = selectionOptions(moving.selection, view);
  assert.deepEqual(options.enemySlots, [0, 2]);
  assert.equal(options.canSkip, true);
  for (const invalid of [onTarget, own]) {
    assert.equal(invalid.selection, moving.selection);
    assert.match(invalid.message, /or skip/);
  }
  assert.equal(moved.selection.step, "confirm");
  const { actionId, ...action } = confirmed.action;
  assert.deepEqual(action, { type: "spell", side: "wizard", revision: 0, cardId: "wizard-singularity-1", target: 1, destination: 2 });
  assert.equal(typeof actionId, "string");
  assert.equal(applyAction(state, confirmed.action).ok, true);

  const [, , skipped, plain] = run(view, [card("wizard-singularity-1"), slot("cowboy", 1), { type: "skip" }, { type: "confirm" }]);
  assert.equal(skipped.selection.step, "confirm");
  assert.equal("destination" in plain.action, false);
  assert.equal(applyAction(state, plain.action).ok, true);

  // A target the spell defeats cannot move, so there is no destination step.
  const weak = structuredClone(state);
  weak.sides.cowboy.board[1].health = 1;
  const [, finishing] = run(publicState(weak, "wizard"), [card("wizard-singularity-1"), slot("cowboy", 1)]);
  assert.equal(finishing.selection.step, "confirm");
});

test("a used allowance blocks the card with its reason", () => {
  const state = position("cowboy", {
    cowboy: { hand: ["cowboy-sheriff-1", "cowboy-sheriff-2", "cowboy-deadeye-1", "cowboy-deadeye-2"] },
    wizard: { board: ["wizard-skeleton-1", "wizard-wizard-1", null] },
  });
  const summoned = applyAction(state, { type: "summon", side: "cowboy", revision: 0, cardId: "cowboy-sheriff-1", slot: 0, tributes: [] });
  const [again] = run(publicState(summoned.state, "cowboy"), [card("cowboy-sheriff-2")]);
  assert.equal(again.message, "You have already summoned this round.");

  const cast = applyAction(state, { type: "spell", side: "cowboy", revision: 0, cardId: "cowboy-deadeye-1", target: 1 });
  const [late, second] = run(publicState(cast.state, "cowboy"), [card("cowboy-sheriff-1"), card("cowboy-deadeye-2")]);
  assert.equal(late.message, "A spell was cast this round, and summons must come first.");
  assert.equal(second.message, "You have already cast a spell this round.");
  assert.equal(second.selection, emptySelection);
});

// The message a click gives for each hand card without a legal entry.
function clickMessages(view) {
  const playable = selectionOptions(emptySelection, view).playableCardIds;
  const blocked = view.sides[view.viewer].hand.filter((cardId) => !playable.includes(cardId));
  return Object.fromEntries(blocked.map((cardId) => [cardId, run(view, [card(cardId)])[0].message]));
}

test("blocked reasons: every unplayable hand card has its click message before a click, playable cards none", () => {
  // Seed 14, starter deck: three Billy cards and Mounted Billy, and zero legal plays.
  const opening = publicState(createMatch(14), "cowboy");
  const hand = opening.sides.cowboy.hand;
  assert.deepEqual(hand.map((cardId) => CARDS[cardId].name).sort(), ["Billy", "Billy", "Billy", "Mounted Billy"]);
  assert.deepEqual(selectionOptions(emptySelection, opening).playableCardIds, []);
  assert.deepEqual(blockedReasons(opening), Object.fromEntries(hand.map((cardId) => [cardId, CARDS[cardId].name === "Billy"
    ? "Billy needs 1 tribute troop; you have 0 on the board."
    : "Mounted Billy needs 2 tribute troops; you have 0 on the board."])));

  // Full board: the free Sheriff has no open tile; Billy tributes into a vacated slot.
  const full = publicState(position("cowboy", {
    cowboy: { board: ["cowboy-sheriff-1", "cowboy-sheriff-2", "cowboy-mounted-billy-1"], hand: ["cowboy-sheriff-3", "cowboy-billy-1"] },
  }), "cowboy");
  assert.deepEqual(blockedReasons(full), { "cowboy-sheriff-3": "No open tile for Sheriff." });

  // Used actions: a second summon, a summon after a spell and a second spell.
  const state = position("cowboy", {
    cowboy: { hand: ["cowboy-sheriff-1", "cowboy-sheriff-2", "cowboy-deadeye-1", "cowboy-deadeye-2"] },
    wizard: { board: ["wizard-skeleton-1", "wizard-wizard-1", null] },
  });
  const summon = { type: "summon", side: "cowboy", revision: 0, cardId: "cowboy-sheriff-1", slot: 0, tributes: [] };
  const summoned = publicState(applyAction(state, summon).state, "cowboy");
  assert.equal(blockedReasons(summoned)["cowboy-sheriff-2"], "You have already summoned this round.");
  const spell = { type: "spell", side: "cowboy", revision: 0, cardId: "cowboy-deadeye-1", target: 1 };
  const cast = publicState(applyAction(state, spell).state, "cowboy");
  assert.deepEqual(blockedReasons(cast), {
    "cowboy-sheriff-1": "A spell was cast this round, and summons must come first.",
    "cowboy-sheriff-2": "A spell was cast this round, and summons must come first.",
    "cowboy-deadeye-2": "You have already cast a spell this round.",
  });

  // A spell with no enemy troop to target, next to a playable free troop.
  const noTarget = publicState(position("cowboy", { cowboy: { hand: ["cowboy-deadeye-1", "cowboy-sheriff-1"] }, wizard: {} }), "cowboy");
  assert.deepEqual(blockedReasons(noTarget), { "cowboy-deadeye-1": "Deadeye has no target: the enemy has no troops on the board." });

  // The reason is the existing click message, never on a playable card, and the view is untouched.
  for (const view of [opening, full, summoned, cast, noTarget]) {
    const before = structuredClone(view);
    const reasons = blockedReasons(view);
    assert.deepEqual(reasons, clickMessages(view));
    for (const cardId of selectionOptions(emptySelection, view).playableCardIds) assert.equal(cardId in reasons, false, cardId);
    assert.deepEqual(view, before);
  }

  // Nothing to explain outside the viewer's phase (seed 27 opens with the Wizards) or after the result.
  assert.deepEqual(blockedReasons(publicState(createMatch(27), "cowboy")), {});
  const over = { ...opening, result: { winner: "wizard", loser: "cowboy", reason: "round-limit", round: 9, outcome: "loss" } };
  assert.deepEqual(blockedReasons(over), {});
});

test("input is ignored outside the viewer's phase, after the result, or while not accepting", () => {
  const inputs = [card("cowboy-sheriff-3"), slot("cowboy", 0), { type: "skip" }, { type: "confirm" }, { type: "cancel" }];

  // Seed 27 starts with the Wizards, so the Cowboy view is not in its phase.
  const waiting = publicState(createMatch(27), "cowboy");
  assert.equal(waiting.activeSide, "wizard");
  const held = Object.freeze({ step: "slot", cardId: "cowboy-sheriff-3", tributes: Object.freeze([]) });
  for (const input of inputs) {
    const result = selectionStep(held, input, waiting, open);
    assert.equal(result.selection, held);
    assert.equal(result.action, undefined);
    assert.equal(result.message, undefined);
  }

  // The Cowboy phase, but the controller is not accepting input.
  const ownPhase = publicState(position("cowboy", { cowboy: { hand: ["cowboy-sheriff-3"] } }), "cowboy");
  for (const input of inputs) {
    const result = selectionStep(held, input, ownPhase, { accepting: false, newActionId: open.newActionId });
    assert.equal(result.selection, held);
    assert.equal(result.action, undefined);
  }

  let final = null;
  for (const state of positions(0)) final = state;
  const over = publicState(final, "cowboy");
  assert.ok(over.result);
  const ended = selectionStep(emptySelection, card(over.sides.cowboy.hand[0] ?? "cowboy-sheriff-1"), over, open);
  assert.equal(ended.selection, emptySelection);
  assert.equal(ended.action, undefined);
  assert.equal(selectionOptions(emptySelection, over).prompt, "The match is over.");
});
