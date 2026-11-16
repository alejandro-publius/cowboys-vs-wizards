// Presenter (src/match/presenter.js). Properties 2 to 4 run as seeded loops
// over seeds 0-99, because no PBT library is installed. Each seed is a
// CPU-vs-CPU match (chooseAction on the active side's public view). Every
// accepted action is enqueued as one batch of Player_Views and events, and a
// fake clock ticks until the batch drains. The recording fake renderer logs
// every call with the clock time and tracks the orbs it was told to show.
import test from "node:test";
import assert from "node:assert/strict";
import { CARDS, SIDES } from "../../src/game/cards.js";
import { createMatch } from "../../src/game/state.js";
import { applyAction } from "../../src/game/actions.js";
import { publicState } from "../../src/game/view.js";
import { chooseAction } from "../../src/game/cpu.js";
import { createScheduler } from "../../src/match/scheduler.js";
import { createPresenter } from "../../src/match/presenter.js";

const SEEDS = Array.from({ length: 100 }, (_, seed) => seed);
// Every fake cue time and default pause is a multiple of STEP, so ticking the
// clock in STEP increments runs each callback exactly when it is due.
const STEP = 10;
const MAX_TICKS_PER_BATCH = 1000;
const SUMMON = { impact: 100, end: 200 };
const SPELL = { impact: 120, end: 240 };
const REMOVE = { end: 80 };
const MOVE = { end: 90 };

// Attack times differ by attacker card, so an attack listed later can reach
// a shared Base target first and the presenter must hold its impact back.
function attackCue(cardId) {
  const { name } = CARDS[cardId];
  if (name === "Billy") return { impact: 400, end: 700 };
  if (name === "Wizard") return { impact: 500, end: 800 };
  return { impact: 250, end: 450 };
}

const slotKey = (side, slot) => `${side}:${slot}`;
const isOrbCall = (call) => call.op === "setTroopOrbs" || call.op === "setBaseOrbs";
const orbKey = (call) => (call.op === "setBaseOrbs" ? call.args.side : slotKey(call.args.side, call.args.slot));
const targetKey = (target) => (target.kind === "base" ? target.side : slotKey(target.side, target.slot));

// Records every call as { op, args, at }; orb setters also record `shown`,
// the count shown before the call. Like a real board, a removed model takes
// its orbs away and a moved model carries them.
function recordingRenderer(scheduler) {
  const calls = [];
  const troops = new Map(); // "side:slot" -> orbs shown
  const bases = new Map(); // side -> orbs shown
  const record = (op, args, extra) => calls.push({ op, args: structuredClone(args), at: scheduler.now(), ...extra });
  return {
    calls,
    troops,
    bases,
    reset(view) {
      record("reset", { view });
      troops.clear();
      bases.clear();
      for (const side of SIDES) {
        bases.set(side, view.sides[side].baseOrbs);
        view.sides[side].board.forEach((troop, slot) => troop && troops.set(slotKey(side, slot), troop.health));
      }
    },
    clear() {
      record("clear", {});
      troops.clear();
      bases.clear();
    },
    setTroopOrbs(side, slot, n) {
      record("setTroopOrbs", { side, slot, n }, { shown: troops.get(slotKey(side, slot)) ?? null });
      troops.set(slotKey(side, slot), n);
    },
    setBaseOrbs(side, n) {
      record("setBaseOrbs", { side, n }, { shown: bases.get(side) ?? null });
      bases.set(side, n);
    },
    summon(args) {
      record("summon", args);
      return { ...SUMMON };
    },
    attack(args) {
      record("attack", args);
      return attackCue(args.attacker.cardId);
    },
    spell(args) {
      record("spell", args);
      return { ...SPELL };
    },
    remove(args) {
      record("remove", args);
      troops.delete(slotKey(args.side, args.slot));
      return { ...REMOVE };
    },
    move(args) {
      record("move", args);
      const from = slotKey(args.side, args.from);
      troops.set(slotKey(args.side, args.to), troops.get(from));
      troops.delete(from);
      return { ...MOVE };
    },
  };
}

// One CPU-vs-CPU match played through a presenter, one batch per accepted
// action. checks.change(copy, context) sees every onChange copy and
// checks.batch(context) every drained batch. context.calls() lists the
// renderer calls made since the current batch was enqueued.
function playMatch(seed, checks = {}) {
  const scheduler = createScheduler();
  const renderer = recordingRenderer(scheduler);
  const errors = [];
  let drains = 0;
  let lastChange = null;
  const context = {
    step: -1,
    batch: null,
    first: 0,
    renderer,
    now: () => scheduler.now(),
    calls: () => renderer.calls.slice(context.first),
  };
  const presenter = createPresenter({
    scheduler,
    renderer,
    onChange: (copy) => {
      lastChange = copy;
      checks.change?.(copy, context);
    },
    onDrain: () => {
      drains += 1;
    },
    onError: (error) => errors.push(error),
  });
  let state = createMatch(seed);
  presenter.reset(publicState(state, "cowboy"));
  for (let step = 0; !state.result; step++) {
    const action = chooseAction(publicState(state, state.activeSide));
    const applied = applyAction(state, { ...action, actionId: `presenter-${seed}-${step}` });
    assert.equal(applied.ok, true, `step ${step}: ${applied.reason}`);
    const batch = { from: publicState(state, "cowboy"), to: publicState(applied.state, "cowboy"), events: applied.events };
    Object.assign(context, { step, batch, first: renderer.calls.length });
    presenter.enqueue(batch);
    for (let ticks = 0; presenter.busy() && errors.length === 0; ticks++) {
      assert.ok(ticks < MAX_TICKS_PER_BATCH, `step ${step}: playback did not drain`);
      scheduler.tick(scheduler.now() + STEP);
    }
    // A failed check inside onChange reaches onError too.
    if (errors.length > 0) throw new Error(`step ${step}: ${errors[0].message}`, { cause: errors[0] });
    assert.equal(drains, step + 1, `step ${step}: one onDrain per batch`);
    checks.batch?.({ ...context, displayed: presenter.displayed(), lastChange });
    state = applied.state;
  }
}

function forEachSeed(run) {
  for (const seed of SEEDS) {
    try {
      run(seed);
    } catch (error) {
      throw new Error(`seed ${seed}: ${error.message}`, { cause: error });
    }
  }
}

// ---- Property 2 ----

// The displayed state is a Cowboy Player_View: no Wizard hand, no deck order.
function assertPublicOnly(view) {
  assert.equal(view.viewer, "cowboy");
  assert.equal(Object.hasOwn(view.sides.wizard, "hand"), false, "the displayed state holds the Wizard hand");
  for (const side of SIDES) assert.equal(Object.hasOwn(view.sides[side], "deck"), false, `displayed ${side} deck order`);
}

// Each displayed troop health and Base value equals the orbs the renderer was
// told to show, so displayed health moves only together with an orb setter.
function assertOrbsShown(view, renderer) {
  for (const side of SIDES) {
    assert.equal(renderer.bases.get(side), view.sides[side].baseOrbs, `${side} Base orbs`);
    view.sides[side].board.forEach((troop, slot) => {
      assert.equal(renderer.troops.get(slotKey(side, slot)) ?? null, troop?.health ?? null, `${side} slot ${slot} orbs`);
    });
  }
}

// One summon, spell and move cue per event, carrying the event's data.
function assertCues({ events, to }, calls) {
  const expected = [];
  for (const event of events) {
    if (event.type === "summon") {
      const health = to.sides[event.side].board[event.slot].health;
      expected.push({ op: "summon", args: { side: event.side, slot: event.slot, cardId: event.cardId, health } });
    } else if (event.type === "spell") {
      const { spell, cardId, caster, target, destination } = event;
      expected.push({ op: "spell", args: { spell, cardId, caster, target } });
      if (destination !== undefined) {
        expected.push({ op: "move", args: { side: target.side, from: target.slot, to: destination } });
      }
    }
  }
  const made = calls.filter((call) => ["summon", "spell", "move"].includes(call.op)).map(({ op, args }) => ({ op, args }));
  assert.deepEqual(made, expected, "summon, spell and move cues");
}

// The orb setter calls a batch must make: one per summon, spell and damage
// event, at its scheduled impact (its cue's call time plus the fake impact
// time, held back behind an earlier impact on the same target), moving the
// count from the event's before to its after. Sorted into firing order: by
// time, ties in event order.
function expectedOrbCalls({ events, to }, calls) {
  const cues = {
    summon: calls.filter((call) => call.op === "summon"),
    spell: calls.filter((call) => call.op === "spell"),
    damage: calls.filter((call) => call.op === "attack"),
  };
  const used = { summon: 0, spell: 0, damage: 0 };
  const latest = new Map();
  const expected = [];
  for (const event of events) {
    if (!Object.hasOwn(cues, event.type)) continue;
    const cue = cues[event.type][used[event.type]++];
    assert.ok(cue, `no cue for a ${event.type} event`);
    if (event.type === "summon") {
      const n = to.sides[event.side].board[event.slot].health;
      expected.push({ op: "setTroopOrbs", args: { side: event.side, slot: event.slot, n }, at: cue.at + SUMMON.impact, shown: null });
    } else if (event.type === "spell") {
      const { side, slot } = event.target;
      const args = { side, slot, n: event.after };
      expected.push({ op: "setTroopOrbs", args, at: cue.at + SPELL.impact, shown: event.before });
    } else {
      const { target } = event;
      const key = targetKey(target);
      const at = Math.max(cue.at + attackCue(event.attacker.cardId).impact, latest.get(key) ?? -Infinity);
      latest.set(key, at);
      const base = target.kind === "base";
      const args = base ? { side: target.side, n: event.after } : { side: target.side, slot: target.slot, n: event.after };
      expected.push({ op: base ? "setBaseOrbs" : "setTroopOrbs", args, at, shown: event.before });
    }
  }
  return expected.sort((a, b) => a.at - b.at);
}

test("Feature: orb-duel, Property 2: Presenter fidelity", () => {
  forEachSeed((seed) =>
    playMatch(seed, {
      change(copy, { renderer }) {
        assertPublicOnly(copy);
        assertOrbsShown(copy, renderer);
      },
      batch({ batch, calls, displayed, lastChange }) {
        assert.deepEqual(displayed, batch.to, "displayed state at drain");
        assert.deepEqual(lastChange, batch.to, "last onChange copy at drain");
        assertPublicOnly(displayed);
        const made = calls();
        assertCues(batch, made);
        assert.deepEqual(made.filter(isOrbCall), expectedOrbCalls(batch, made), "orb setter calls");
      },
    }),
  );
});

// ---- Property 3 ----

function checkCompleteness({ events }, calls, coverage) {
  const made = (op) => calls.filter((call) => call.op === op);
  const damage = events.filter((event) => event.type === "damage");
  const defeats = events.filter((event) => event.type === "defeat").map(({ side, slot }) => ({ side, slot }));
  const attacks = made("attack");
  const removes = made("remove");
  assert.equal(attacks.length, damage.length, "one attack per damage event");

  const [spell] = made("spell");
  if (spell) {
    assert.deepEqual(
      removes.map((call) => call.args),
      defeats,
      "one removal per spell defeat",
    );
    for (const remove of removes) {
      assert.ok(remove.at >= spell.at + SPELL.end, "a spell-defeat removal started before the spell ended");
      coverage.spellDefeats += 1;
    }
    for (const move of made("move")) {
      assert.ok(move.at >= spell.at + SPELL.impact, "a Singularity move started before its impact");
      coverage.moves += 1;
    }
  }

  if (!events.some((event) => event.type === "clash")) return;
  coverage.clashes += 1;
  const start = attacks[0]?.at;
  let groupEnd = start ?? -Infinity;
  damage.forEach((event, k) => {
    assert.equal(attacks[k].at, start, `attack ${k} did not start with the others`);
    assert.deepEqual(attacks[k].args, { attacker: event.attacker, target: event.target }, `attack ${k}`);
    groupEnd = Math.max(groupEnd, attacks[k].at + attackCue(event.attacker.cardId).end);
  });
  coverage.attacks += attacks.length;

  // Exactly one impact per damage event: on each target the orb calls follow
  // its events in event order, each from `before` to `after`.
  const orbCalls = calls.filter(isOrbCall);
  assert.equal(orbCalls.length, damage.length, "one impact per damage event");
  const impactOf = new Map(); // damage event -> its orb call
  for (const key of new Set(damage.map((event) => targetKey(event.target)))) {
    const hits = damage.filter((event) => targetKey(event.target) === key);
    const onTarget = orbCalls.filter((call) => orbKey(call) === key);
    assert.deepEqual(
      onTarget.map((call) => [call.shown, call.args.n]),
      hits.map((event) => [event.before, event.after]),
      `impacts on ${key}, in event order`,
    );
    hits.forEach((event, k) => impactOf.set(event, onTarget[k]));
    if (hits[0].target.kind === "base" && hits.length > 1) {
      coverage.chainedBaseHits += 1;
      onTarget.forEach((call, k) => k > 0 && assert.ok(call.args.n <= onTarget[k - 1].args.n, `${key} Base rose`));
    }
  }
  for (const call of orbCalls) groupEnd = Math.max(groupEnd, call.at);

  // An attacker brought to 0 in this clash still attacked (checked above) and
  // its own impact still applied, even when it was zeroed first.
  for (const event of damage) {
    const { side, slot } = event.attacker;
    const fatal = orbCalls.find((call) => orbKey(call) === slotKey(side, slot) && call.args.n === 0);
    if (!fatal) continue;
    coverage.zeroedAttackers += 1;
    if (fatal.at < impactOf.get(event).at) coverage.zeroedBeforeOwnImpact += 1;
  }

  // Defeated models leave together, only after the whole group has finished.
  assert.deepEqual(
    removes.map((call) => call.args),
    defeats,
    "one removal per clash defeat",
  );
  for (const remove of removes) {
    assert.ok(remove.at >= groupEnd, `a defeat removal started at ${remove.at}, before the group ended at ${groupEnd}`);
    assert.equal(remove.at, removes[0].at, "defeat removals did not start together");
  }
  coverage.clashDefeats += removes.length;
}

test("Feature: orb-duel, Property 3: Clash completeness", (t) => {
  const coverage = {
    clashes: 0,
    attacks: 0,
    zeroedAttackers: 0,
    zeroedBeforeOwnImpact: 0,
    chainedBaseHits: 0,
    clashDefeats: 0,
    spellDefeats: 0,
    moves: 0,
  };
  forEachSeed((seed) => playMatch(seed, { batch: ({ batch, calls }) => checkCompleteness(batch, calls(), coverage) }));
  for (const [what, count] of Object.entries(coverage)) assert.ok(count > 0, `the walks never produced ${what}`);
  t.diagnostic(`coverage: ${JSON.stringify(coverage)}`);
});

// ---- Property 4 ----

// A troop shows 1 to its max health, or 0 only from its fatal impact until
// its removal ends; a Base shows 0 to 5.
function checkBounds(view, { now, calls }) {
  const made = calls();
  for (const side of SIDES) {
    const { baseOrbs, board } = view.sides[side];
    assert.ok(Number.isInteger(baseOrbs) && baseOrbs >= 0 && baseOrbs <= 5, `${side} Base shows ${baseOrbs}`);
    board.forEach((troop, slot) => {
      if (troop === null) return;
      const where = `${side} slot ${slot} (${troop.cardId}) shows ${troop.health} at ${now()}`;
      assert.ok(Number.isInteger(troop.health) && troop.health >= 0, where);
      if (troop.health > 0) {
        assert.ok(troop.health <= CARDS[troop.cardId].health, `${where}, above its max`);
        return;
      }
      const onSlot = (call) => call.args.side === side && call.args.slot === slot;
      const fatal = made.findLast((call) => call.op === "setTroopOrbs" && onSlot(call));
      assert.ok(fatal?.args.n === 0 && fatal.at <= now(), `${where}, before its fatal impact`);
      const removal = made.find((call) => call.op === "remove" && onSlot(call) && call.at >= fatal.at);
      assert.ok(removal === undefined || now() < removal.at + REMOVE.end, `${where}, after its removal`);
    });
  }
}

test("Feature: orb-duel, Property 4: Displayed health bounds", () => {
  forEachSeed((seed) =>
    playMatch(seed, {
      change: checkBounds,
      batch({ displayed }) {
        for (const side of SIDES) {
          for (const troop of displayed.sides[side].board) assert.ok(troop === null || troop.health >= 1, "0 health at drain");
        }
      },
    }),
  );
});

// ---- Examples ----

// A presenter on a fresh clock with the recording renderer.
function setup({ onChange } = {}) {
  const scheduler = createScheduler();
  const renderer = recordingRenderer(scheduler);
  const log = { changes: [], drains: 0, errors: [] };
  const presenter = createPresenter({
    scheduler,
    renderer,
    onChange: (copy) => {
      log.changes.push(copy);
      onChange?.(copy);
    },
    onDrain: () => {
      log.drains += 1;
    },
    onError: (error) => log.errors.push(error),
  });
  const run = (ms) => {
    for (const end = scheduler.now() + ms; scheduler.now() < end; ) scheduler.tick(scheduler.now() + STEP);
  };
  return { scheduler, renderer, presenter, log, run };
}

// The first accepted action of the seeded CPU-vs-CPU walks whose events satisfy `wanted`, as a batch.
function findBatch(wanted) {
  for (const seed of SEEDS) {
    let state = createMatch(seed);
    for (let step = 0; !state.result; step++) {
      const action = chooseAction(publicState(state, state.activeSide));
      const applied = applyAction(state, { ...action, actionId: `find-${step}` });
      const batch = { from: publicState(state, "cowboy"), to: publicState(applied.state, "cowboy"), events: applied.events };
      if (wanted(batch.events)) return batch;
      state = applied.state;
    }
  }
  return assert.fail("no batch matched");
}

test("an unsupported event type throws a development error naming it, before anything is queued", () => {
  const { presenter, renderer, log } = setup();
  const view = publicState(createMatch(0), "cowboy");
  presenter.reset(view);
  const events = [{ type: "phase-end", side: view.activeSide, round: 1 }, { type: "teleport" }];
  assert.throws(() => presenter.enqueue({ from: view, to: view, events }), {
    name: "Error",
    message: /unsupported event type "teleport"/,
  });
  assert.equal(presenter.busy(), false);
  assert.deepEqual(
    renderer.calls.map((call) => call.op),
    ["reset"],
  );
  assert.equal(log.changes.length, 1);
});

test("clear() mid-clash stops every later renderer call, orb setter and callback", () => {
  // Two attacks share the earliest impact time, so a clear() inside the first
  // impact's onChange still has a second impact due on that same tick, and a
  // slower attack is still running when a clear() comes between ticks.
  const batch = findBatch((events) => {
    const impacts = events.filter((event) => event.type === "damage").map((event) => attackCue(event.attacker.cardId).impact);
    return impacts.filter((impact) => impact === 250).length >= 2 && impacts.some((impact) => impact > 250);
  });
  const damageCount = batch.events.filter((event) => event.type === "damage").length;
  for (const where of ["between ticks", "inside the first impact"]) {
    let clearOnImpact = where !== "between ticks";
    let changesAtClear = -1;
    const harness = setup({
      onChange: () => {
        if (!clearOnImpact || !harness.renderer.calls.some(isOrbCall)) return;
        clearOnImpact = false;
        harness.presenter.clear();
        changesAtClear = harness.log.changes.length;
      },
    });
    const { scheduler, renderer, presenter, log, run } = harness;
    presenter.reset(batch.from);
    presenter.enqueue(batch);
    for (let ticks = 0; !renderer.calls.some(isOrbCall); ticks++) {
      assert.ok(ticks < MAX_TICKS_PER_BATCH, `${where}: no impact was applied`);
      scheduler.tick(scheduler.now() + STEP);
    }
    if (where === "between ticks") {
      presenter.clear();
      changesAtClear = log.changes.length;
    }
    run(10000);

    const cut = renderer.calls.findIndex((call) => call.op === "clear");
    assert.deepEqual(
      renderer.calls.slice(cut).map((call) => call.op),
      ["clear"],
      where,
    );
    const orbCalls = renderer.calls.filter(isOrbCall).length;
    assert.ok(orbCalls < damageCount, `${where}: the clash was not cut short`);
    if (where !== "between ticks") assert.equal(orbCalls, 1, `${where}: the same-tick impact still ran`);
    assert.equal(log.changes.length, changesAtClear, where);
    assert.equal(log.drains, 0, where);
    assert.equal(presenter.busy(), false, where);
    assert.equal(scheduler.epoch(), 0, `${where}: the scheduler epoch never advanced`);
    assert.equal(scheduler.pending(), 0, where);

    // The presenter is usable again after reset().
    presenter.reset(batch.from);
    presenter.enqueue(batch);
    run(5000);
    assert.deepEqual(log.errors, [], where);
    assert.equal(log.drains, 1, where);
    assert.deepEqual(presenter.displayed(), batch.to, where);
  }
});

test("a displayed state that differs from `to` at drain, or from `from` at start, calls onError naming the path", () => {
  const state = createMatch(0);
  const applied = applyAction(state, { type: "end-phase", side: state.activeSide, revision: 0, actionId: "end-1" });
  const from = publicState(state, "cowboy");
  const to = publicState(applied.state, "cowboy");
  to.sides.wizard.baseOrbs = 4; // no event explains this change
  const { presenter, renderer, log, run } = setup();
  presenter.reset(from);
  presenter.enqueue({ from, to, events: applied.events });
  run(2000);
  assert.equal(log.errors.length, 1);
  assert.equal(log.errors[0].path, "sides.wizard.baseOrbs");
  assert.match(log.errors[0].message, /differs from "to" at sides\.wizard\.baseOrbs: displayed 5, "to" 4/);
  assert.equal(log.drains, 0);
  // Playback halts: busy() stays true and a later batch never plays.
  assert.equal(presenter.busy(), true);
  const calls = renderer.calls.length;
  presenter.enqueue({ from, to, events: applied.events });
  run(2000);
  assert.equal(renderer.calls.length, calls);
  assert.equal(log.errors.length, 1);

  // After reset(), a batch whose `from` is not the displayed state fails at once.
  presenter.reset(from);
  const stale = { ...structuredClone(from), round: 2 };
  presenter.enqueue({ from: stale, to: publicState(applied.state, "cowboy"), events: applied.events });
  assert.equal(log.errors.length, 2);
  assert.equal(log.errors[1].path, "round");
  assert.match(log.errors[1].message, /differs from "from" at round/);
  assert.deepEqual(
    renderer.calls.slice(calls).map((call) => call.op),
    ["reset"],
  );
  assert.equal(log.drains, 0);
});

test("a draw identifies the new hand position when another copy is held", () => {
  const scheduler = createScheduler();
  const presenter = createPresenter({ scheduler, renderer: recordingRenderer(scheduler) });
  const from = publicState(createMatch(0), "cowboy");
  const to = structuredClone(from);
  const { cowboy } = to.sides;
  const cardId = cowboy.hand[0];
  const handIndex = cowboy.hand.length;
  cowboy.hand.push(cardId);
  cowboy.handCount += 1;
  cowboy.deckCount -= 1;

  presenter.reset(from);
  presenter.enqueue({ from, to, events: [{ type: "draw", side: "cowboy" }] });
  assert.equal(presenter.drawing()?.cardId, cardId);
  assert.equal(presenter.drawing()?.handIndex, handIndex);
  scheduler.tick(scheduler.now() + presenter.drawing().ms);
  assert.equal(presenter.drawing(), null);
  assert.equal(presenter.busy(), false);
});
