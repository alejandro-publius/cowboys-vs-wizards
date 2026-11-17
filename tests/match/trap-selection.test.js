// Issue #106: the developer-only trap selection seam. selection.js and the
// controller take an optional `cards` catalog (default CARDS); only this test
// passes one, CARDS plus a fixture trap per side. The fixture IDs exist only
// in this file; CARDS, DECKS, main.js and the default engine stay as shipped.
// Results under this synthetic fixture say nothing about real balance.
import test from "node:test";
import assert from "node:assert/strict";
import { CARDS, SIDES, tributeCost } from "../../src/game/cards.js";
import { MAX_ROUNDS, createMatch } from "../../src/game/state.js";
import { applyAction } from "../../src/game/actions.js";
import { legalActions } from "../../src/game/legal.js";
import { publicState } from "../../src/game/view.js";
import { chooseAction } from "../../src/game/cpu.js";
import { createScheduler } from "../../src/match/scheduler.js";
import { FABLE_ENGINE, createController } from "../../src/match/controller.js";
import { emptySelection, selectionOptions, selectionStep } from "../../src/match/selection.js";

const TRAP_OF = { cowboy: "test-fixture-selection-trap-c", wizard: "test-fixture-selection-trap-w" };
const OWN_TRAP = TRAP_OF.cowboy;
const ENEMY_TRAP = TRAP_OF.wizard;
const TEST_CARDS = Object.freeze({
  ...CARDS,
  ...Object.fromEntries(
    SIDES.map((side) => [TRAP_OF[side], Object.freeze({ id: TRAP_OF[side], side, kind: "trap", name: "Test fixture trap" })]),
  ),
});
const OPT = { cards: TEST_CARDS };
const SEEDS = [0, 60];
const STEP = 50;
const MAX_TICKS = 20000;

function fakeRenderer() {
  const calls = [];
  const log = (op, args) => calls.push({ op, args: structuredClone(args) });
  return {
    calls,
    reset: (view) => log("reset", { view }),
    clear: () => log("clear", {}),
    setTroopOrbs: (side, slot, n) => log("setTroopOrbs", { side, slot, n }),
    setBaseOrbs: (side, n) => log("setBaseOrbs", { side, n }),
    summon: (args) => (log("summon", args), { impact: 100, end: 200 }),
    attack: (args) => (log("attack", args), { impact: 250, end: 450 }),
    spell: (args) => (log("spell", args), { impact: 150, end: 250 }),
    remove: (args) => (log("remove", args), { end: 100 }),
    move: (args) => (log("move", args), { end: 100 }),
  };
}

// Real rules. `traps`: flag on and each side's fixture trap in its opening hand.
function testEngine({ traps }) {
  const log = { applied: [], rejected: [] };
  const opt = traps ? OPT : undefined;
  const engine = {
    createMatch(seed) {
      if (!traps) return createMatch(seed);
      const state = createMatch(seed, { traps: true });
      for (const side of SIDES) state.sides[side].hand.push(TRAP_OF[side]);
      return state;
    },
    applyAction(state, action) {
      const result = applyAction(state, action, opt);
      if (result.ok) log.applied.push({ action: structuredClone(action), round: state.round, events: result.events });
      else log.rejected.push(result.reason);
      return result;
    },
    legalActions: (state, side) => legalActions(state, side, opt),
    publicState,
  };
  return { engine, log };
}

// `cards` undefined leaves the controller on its default catalog. `engine`
// replaces the test engine (and its log) with the given one.
function harness({ traps, cards, engine: given }) {
  const scheduler = createScheduler();
  scheduler.tick(0);
  const renderer = fakeRenderer();
  const { engine, log } = given ? { engine: given, log: null } : testEngine({ traps });
  const h = { scheduler, renderer, log, snapshots: [], clickedSets: 0 };
  h.controller = createController({
    engine,
    chooseCpuAction: (view) => chooseAction(view, traps ? OPT : undefined),
    scheduler,
    renderer,
    ...(cards ? { cards } : {}),
    onChange() {
      const c = h.controller;
      h.snapshots.push(
        JSON.stringify({
          status: c.status(),
          view: c.view(),
          displayed: c.displayed(),
          message: c.message(),
          selection: c.selection(),
          options: c.options(),
        }),
      );
    },
  });
  return h;
}

// The Cowboy plays the CPU rule. A set-trap goes through the click path
// (card, then confirm); everything else through submit() or endPhase().
function actCowboy(h, opt) {
  const { controller } = h;
  const action = chooseAction(controller.view(), opt);
  if (action.type === "set-trap") {
    controller.input({ type: "card", cardId: action.cardId });
    assert.equal(controller.selection().step, "confirm");
    const outcome = controller.input({ type: "confirm" });
    assert.equal(outcome?.ok, true, outcome?.reason);
    h.clickedSets += 1;
    return;
  }
  const outcome = action.type === "end-phase" ? controller.endPhase() : controller.submit(action);
  assert.equal(outcome.ok, true, outcome.reason);
}

function play(h, opt, stop = () => false) {
  for (let ticks = 0; ; ) {
    const status = h.controller.status();
    assert.notEqual(status, "error", `controller error: ${h.controller.message()}`);
    if (status === "terminal" || stop(h)) return;
    if (status === "accepting_input") {
      actCowboy(h, opt);
      continue;
    }
    assert.ok(++ticks <= MAX_TICKS, "no result");
    h.scheduler.tick(h.scheduler.now() + STEP);
  }
}

// Every position of a CPU-vs-CPU default match.
function* positions(seed) {
  let state = createMatch(seed);
  for (let step = 0; ; step++) {
    yield state;
    if (state.result) return;
    const applied = applyAction(state, { ...chooseAction(publicState(state, state.activeSide)), actionId: `walk-${step}` });
    assert.equal(applied.ok, true);
    state = applied.state;
  }
}

// A flag-on state with each fixture trap in hand, walked with the CPU rule
// until the Cowboy's first phase (no action of the Cowboy is applied).
function trapState(seed) {
  let state = createMatch(seed, { traps: true });
  for (const side of SIDES) state.sides[side].hand.push(TRAP_OF[side]);
  for (let step = 0; state.activeSide !== "cowboy"; step++) {
    const applied = applyAction(state, { ...chooseAction(publicState(state, state.activeSide), OPT), actionId: `pre-${step}` }, OPT);
    assert.equal(applied.ok, true);
    state = applied.state;
  }
  return state;
}

const step = (current, input, view) =>
  selectionStep(current, input, view, { accepting: true, newActionId: () => "a-1", cards: TEST_CARDS });
const apply = (state, action) => {
  const result = applyAction(state, action, OPT);
  assert.equal(result.ok, true, result.reason);
  return result.state;
};
const firstOfKind = (view, kind) => view.sides.cowboy.hand.find((id) => TEST_CARDS[id].kind === kind);
const withoutIds = ({ actionId, revision, ...rest }) => rest;

test("flag off: the default catalog and an injected one give identical selections and options at every position (seeds 0, 60)", () => {
  for (const seed of SEEDS) {
    for (const state of positions(seed)) {
      const view = publicState(state, state.activeSide ?? "cowboy");
      const where = `seed ${seed} rev ${state.revision}`;
      assert.deepEqual(selectionOptions(emptySelection, view, OPT), selectionOptions(emptySelection, view), where);
      for (const cardId of view.sides[view.viewer].hand) {
        const args = { accepting: true, newActionId: () => "a" };
        const a = selectionStep(emptySelection, { type: "card", cardId }, view, args);
        const b = selectionStep(emptySelection, { type: "card", cardId }, view, { ...args, cards: TEST_CARDS });
        assert.deepEqual(b, a, where);
        assert.deepEqual(selectionOptions(b.selection, view, OPT), selectionOptions(a.selection, view), where);
      }
    }
  }
});

test("flag off: a controller with the injected catalog replays seeds 0 and 60 exactly like the default controller", () => {
  for (const seed of SEEDS) {
    const plain = harness({ traps: false, engine: FABLE_ENGINE });
    const injected = harness({ traps: false, engine: FABLE_ENGINE, cards: TEST_CARDS });
    for (const h of [plain, injected]) {
      assert.equal(h.controller.start(seed), true);
      play(h, undefined);
      assert.equal(h.controller.status(), "terminal");
    }
    assert.ok(plain.snapshots.length > 0);
    assert.deepEqual(injected.snapshots, plain.snapshots, `seed ${seed}`);
    assert.deepEqual(injected.renderer.calls, plain.renderer.calls, `seed ${seed}`);
    assert.equal(Object.hasOwn(plain.controller.view(), "traps"), false);
  }
});

test("trap match: options() works with the fixture in hand; card -> confirm, cancel, then one set-trap with an actionId (seeds 0, 60)", () => {
  for (const seed of SEEDS) {
    const where = `seed ${seed}`;
    const h = harness({ traps: true, cards: TEST_CARDS });
    h.controller.start(seed);
    play(h, OPT, () => h.controller.status() === "accepting_input");
    const c = h.controller;
    assert.equal(c.status(), "accepting_input", where);
    assert.equal(h.log.applied.filter((entry) => entry.action.side === "cowboy").length, 0, where);
    assert.ok(c.view().sides.cowboy.hand.includes(OWN_TRAP), where);
    assert.ok(c.options().playableCardIds.includes(OWN_TRAP), where);

    c.input({ type: "card", cardId: OWN_TRAP });
    assert.deepEqual({ ...c.selection() }, { step: "confirm", cardId: OWN_TRAP, trap: true }, where);
    const options = c.options();
    assert.equal(options.canConfirm, true, where);
    assert.equal(options.canCancel, true, where);
    assert.deepEqual([options.ownSlots, options.enemySlots, options.canSkip], [[], [], false], where);
    assert.match(options.prompt, /^Set Test fixture trap face-down, or cancel/, where);
    c.input({ type: "slot", side: "cowboy", slot: 0 });
    assert.equal(c.message(), "Confirm or cancel.", where);

    const applied = h.log.applied.length;
    c.input({ type: "cancel" });
    assert.equal(c.selection(), emptySelection, where);
    assert.equal(h.log.applied.length, applied, `${where}: cancel applied an action`);

    // Clicking the card twice toggles back to idle; nothing is applied.
    c.input({ type: "card", cardId: OWN_TRAP });
    c.input({ type: "card", cardId: OWN_TRAP });
    assert.equal(c.selection(), emptySelection, where);
    assert.equal(h.log.applied.length, applied, where);

    c.input({ type: "card", cardId: OWN_TRAP });
    const round = c.view().round;
    const outcome = c.input({ type: "confirm" });
    assert.deepEqual(outcome, { ok: true }, where);
    assert.equal(h.log.applied.length, applied + 1, `${where}: exactly one action`);
    const { action } = h.log.applied.at(-1);
    assert.match(action.actionId, /^action-\d+$/, where);
    // The applied action is the single legal set-trap entry for that position.
    const legal = legalActions(trapState(seed), "cowboy", OPT).filter((entry) => entry.type === "set-trap");
    assert.deepEqual(legal.map(withoutIds), [withoutIds(action)], where);
    assert.deepEqual(c.view().sides.cowboy.trap, { cardId: OWN_TRAP, setRound: round }, where);
    assert.equal(c.view().allowances.cowboy.tactical, "trap", where);
    assert.deepEqual(h.log.rejected, [], where);
  }
});

test("trap match: the click path plays seeds 0 and 60 to a result; the own trap arms next round; the enemy trap ID never leaks before it springs", () => {
  for (const seed of SEEDS) {
    const where = `seed ${seed}`;
    const h = harness({ traps: true, cards: TEST_CARDS });
    h.controller.start(seed);
    play(h, OPT);
    assert.equal(h.controller.status(), "terminal", where);
    assert.equal(h.clickedSets, 1, `${where}: the Cowboy set its trap through clicks`);
    assert.deepEqual(h.log.rejected, [], where);

    const setEntry = h.log.applied.find((entry) => entry.action.type === "set-trap" && entry.action.side === "cowboy");
    const own = h.log.applied.find((entry) => entry.events.some((e) => e.type === "trap-trigger" && e.side === "cowboy"));
    assert.ok(own, `${where}: own trap sprang`);
    assert.ok(own.round > setEntry.round, `${where}: own trap sprang in its set round`);

    assert.ok(h.log.applied.some((entry) => entry.action.type === "set-trap" && entry.action.side === "wizard"), `${where}: the Wizard set its trap`);
    const reveal = h.log.applied.some((entry) => entry.events.some((e) => e.type === "trap-trigger" && e.side === "wizard"));
    // Snapshots (status, view, displayed, message, selection and options with
    // prompts) never name the Wizard trap while it is still set.
    for (const snap of h.snapshots) {
      if (!snap.includes(ENEMY_TRAP)) continue;
      const { view } = JSON.parse(snap);
      assert.equal(view.sides.wizard.trap, null, `${where}: named while still set`);
      assert.ok(view.sides.wizard.discard.includes(ENEMY_TRAP), where);
    }
    assert.ok(h.snapshots.some((snap) => snap.includes('"faceDown":true')), `${where}: face-down marker`);
    assert.equal(reveal, true, `${where}: the Wizard trap sprang`);
    assert.equal(h.snapshots.some((snap) => snap.includes(ENEMY_TRAP)), true, `${where}: revealed after it sprang`);
  }
});

test("trap selection: shared spell-or-trap allowance, summon-first and one zone (seeds 0, 60)", () => {
  for (const seed of SEEDS) {
    const where = `seed ${seed}`;
    const state = trapState(seed);
    const view = publicState(state, "cowboy");

    // Set before summoning: the summon is then blocked with the trap text.
    const set = step(emptySelection, { type: "card", cardId: OWN_TRAP }, view);
    assert.equal(set.selection.step, "confirm", where);
    const done = step(set.selection, { type: "confirm" }, view);
    assert.equal(done.action.type, "set-trap", where);
    assert.equal(done.action.actionId, "a-1", where);
    const setState = apply(state, done.action);
    const afterSet = publicState(setState, "cowboy");
    // An affordable troop, because the tribute shortfall is reported first.
    const troops = afterSet.sides.cowboy.board.filter((each) => each !== null).length;
    const troop = afterSet.sides.cowboy.hand.find((id) => TEST_CARDS[id].kind === "troop" && tributeCost(TEST_CARDS[id].stars) <= troops);
    assert.ok(troop, where);
    assert.equal(
      step(emptySelection, { type: "card", cardId: troop }, afterSet).message,
      "You set a trap this round, so you cannot summon. Summon first next time.",
      where,
    );
    const spell = firstOfKind(afterSet, "spell");
    if (spell) {
      assert.equal(
        step(emptySelection, { type: "card", cardId: spell }, afterSet).message,
        "You set a trap this round. A spell uses the same action.",
        where,
      );
    }
    // A stale confirm of the same trap is refused, not re-applied.
    const stale = step(set.selection, { type: "confirm" }, afterSet);
    assert.equal(stale.action, undefined, where);
    assert.equal(stale.message, "That move is no longer legal. Choose again.", where);
    assert.equal(selectionOptions(set.selection, afterSet, OPT).canConfirm, false, where);

    // Summon first, then the set is still legal.
    const summon = legalActions(state, "cowboy", OPT).find((entry) => entry.type === "summon");
    assert.ok(summon, where);
    const afterSummon = publicState(apply(state, { ...summon, actionId: "s" }), "cowboy");
    assert.equal(step(emptySelection, { type: "card", cardId: OWN_TRAP }, afterSummon).selection.step, "confirm", where);

    // Spell first: the trap is blocked with the shared-action text.
    const cast = legalActions(state, "cowboy", OPT).find((entry) => entry.type === "spell");
    if (cast) {
      const afterCast = publicState(apply(state, { ...cast, actionId: "c" }), "cowboy");
      assert.equal(
        step(emptySelection, { type: "card", cardId: OWN_TRAP }, afterCast).message,
        "You already cast a spell this round. A trap uses the same action.",
        where,
      );
    }

    // One zone: in a later round a second fixture trap is blocked while the zone holds one.
    const second = `${OWN_TRAP}-2`;
    const full = structuredClone(setState);
    full.sides.cowboy.hand.push(second);
    full.allowances.cowboy = { ...full.allowances.cowboy, castUsed: false, summonUsed: false, tactical: null };
    full.round += 1;
    const cards2 = Object.freeze({ ...TEST_CARDS, [second]: Object.freeze({ ...TEST_CARDS[OWN_TRAP], id: second }) });
    const blocked = selectionStep(emptySelection, { type: "card", cardId: second }, publicState(full, "cowboy"), { accepting: true, cards: cards2 });
    assert.equal(blocked.selection, emptySelection, where);
    assert.equal(blocked.message, "Your trap zone already holds a trap.", where);
  }
});

test("trap selection: round 9 refuses a set; a flag-off match refuses the fixture; enemy hand IDs are never looked up", () => {
  for (const seed of SEEDS) {
    const late = structuredClone(trapState(seed));
    late.round = MAX_ROUNDS;
    const lateView = publicState(late, "cowboy");
    assert.equal(legalActions(lateView, "cowboy", OPT).some((entry) => entry.type === "set-trap"), false);
    assert.equal(selectionOptions(emptySelection, lateView, OPT).playableCardIds.includes(OWN_TRAP), false);
    const tooLate = step(emptySelection, { type: "card", cardId: OWN_TRAP }, lateView);
    assert.equal(tooLate.selection, emptySelection);
    assert.equal(tooLate.message, "Too late: a trap set in the last round can never spring.");

    // Flag off with the fixture in hand: no entry, a readable refusal, no throw.
    const off = createMatch(seed);
    off.sides.cowboy.hand.push(OWN_TRAP);
    off.activeSide = "cowboy";
    const offView = publicState(off, "cowboy");
    assert.equal(step(emptySelection, { type: "card", cardId: OWN_TRAP }, offView).message, "Traps are not in this match.");

    // An enemy-only ID unknown to the catalog is never looked up: options
    // read only the viewer's hand, and name neither enemy card.
    const enemyOnly = structuredClone(trapState(seed));
    enemyOnly.sides.wizard.hand.push("unknown-enemy-card");
    const text = JSON.stringify(selectionOptions(emptySelection, publicState(enemyOnly, "cowboy"), OPT));
    assert.equal(text.includes("unknown-enemy-card"), false);
    assert.equal(text.includes(ENEMY_TRAP), false);
  }
});

test("trap match without the injected catalog: options() fails with the missing card ID; a changed catalog is refused", () => {
  const scheduler = createScheduler();
  const renderer = fakeRenderer();
  const controller = createController({ engine: testEngine({ traps: true }).engine, scheduler, renderer });
  assert.equal(controller.start(0), true);
  assert.throws(() => controller.options(), {
    name: "TypeError",
    message: `Card ${OWN_TRAP} is in the hand but not in the card catalog`,
  });

  const firstId = Object.keys(CARDS)[0];
  const changed = { ...TEST_CARDS, [firstId]: { ...CARDS[firstId], attack: 99 } };
  assert.throws(() => createController({ scheduler, renderer, cards: changed }), { name: "TypeError" });
  assert.throws(() => createController({ scheduler, renderer, cards: {} }), { name: "TypeError" });
  assert.throws(() => createController({ scheduler, renderer, cards: null }), { name: "TypeError" });
  assert.doesNotThrow(() => createController({ scheduler, renderer, cards: TEST_CARDS }));
});
