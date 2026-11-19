// Ride Out experiment (.kiro/specs/ride-out): one friendly troop moves one
// lane with the summon allowance, on matches created with rideOut: true.
// Every rules case runs for both factions. Default output is pinned to hashes
// recorded on 55a395e before the experiment existed.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { CARDS, DECKS, SIDES, opponent } from "../../src/game/cards.js";
import { RIDE_OUT_RULES_VERSION, RULES_VERSION, createMatch } from "../../src/game/state.js";
import { applyAction } from "../../src/game/actions.js";
import { legalActions } from "../../src/game/legal.js";
import { publicState } from "../../src/game/view.js";
import { cpuFor } from "../../src/game/cpu.js";
import { MAX_STEPS, playMatch } from "../../scripts/play-match.mjs";
import { LANES, historicalBot, run } from "../../scripts/compare-ride-out.mjs";

// Matching cards per faction: the troop stats are the same on both sides.
const CARD = {
  cowboy: { small: ["cowboy-sheriff-1", "cowboy-sheriff-2"], mid: ["cowboy-billy-1", "cowboy-billy-2"], spell: "cowboy-deadeye-1" },
  wizard: { small: ["wizard-skeleton-1", "wizard-skeleton-2"], mid: ["wizard-wizard-1", "wizard-wizard-2"], spell: "wizard-singularity-1" },
};

// Seed 0 with `side` to act. Board troops ([cardId, health?]) come from their
// side's hand or deck, and `hand` becomes that side's whole hand with the rest
// put back on the deck, so every card stays in exactly one zone.
function position(side, sides = {}, { rideOut = true } = {}) {
  const state = createMatch(0, { rideOut });
  state.startingSide = state.activeSide = side;
  for (const [each, spec] of Object.entries(sides)) {
    const own = state.sides[each];
    const take = (cardId) => {
      for (const zone of [own.hand, own.deck]) {
        const at = zone.indexOf(cardId);
        if (at !== -1) return zone.splice(at, 1)[0];
      }
      throw new Error(`${cardId} is not in the ${each} hand or deck`);
    };
    (spec.board ?? []).forEach((troop, lane) => {
      if (troop) own.board[lane] = { cardId: take(troop[0]), health: troop[1] ?? CARDS[troop[0]].health };
    });
    if (spec.hand) {
      const hand = spec.hand.map(take);
      own.deck.unshift(...own.hand);
      own.hand = hand;
    }
    if (spec.baseOrbs !== undefined) own.baseOrbs = spec.baseOrbs;
  }
  return state;
}

const act = (state, fields) => ({ side: state.activeSide, revision: state.revision, ...fields });
const ride = (state, slot, destination, extra = {}) => act(state, { type: "ride-out", slot, destination, ...extra });

function accept(state, action) {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, `${JSON.stringify(action)}: ${result.reason}`);
  return result;
}

// A rejection returns the very input object, emits nothing and changes nothing, RNG included.
function assertRejected(state, action, reason) {
  const before = structuredClone(state);
  const result = applyAction(state, action);
  assert.equal(result.ok, false, JSON.stringify(action));
  assert.equal(result.reason, reason, JSON.stringify(action));
  assert.equal(result.state, state);
  assert.equal("events" in result, false);
  assert.equal(state.rng, before.rng);
  assert.equal(state.revision, before.revision);
  assert.deepEqual(state, before);
}

function assertConserved(state) {
  for (const side of SIDES) {
    const { deck, hand, board, discard } = state.sides[side];
    const all = [...deck, ...hand, ...board.filter(Boolean).map((troop) => troop.cardId), ...discard].sort();
    assert.deepEqual(all, [...DECKS[side]].sort(), `${side} cards`);
  }
}

test("flag off: the move is an unknown action, nothing lists it and the match is unchanged", () => {
  for (const seed of [0, 60]) assert.equal("rideOut" in createMatch(seed), false);
  for (const side of SIDES) {
    const state = position(side, { [side]: { board: [[CARD[side].mid[0]], null, null] } }, { rideOut: false });
    assert.equal(legalActions(state, side).some((action) => action.type === "ride-out"), false);
    const move = ride(state, 0, 1);
    // Same reason and precedence as any unknown type: before stale, wrong-side and actionId checks.
    for (const extra of [{}, { revision: 99 }, { side: opponent(side) }, { actionId: "" }]) {
      assertRejected(state, { ...move, ...extra }, "invalid-action");
      assertRejected(state, { ...move, ...extra, type: "teleport" }, "invalid-action");
    }
    const over = structuredClone(state);
    over.result = { winner: side, loser: opponent(side), reason: "test", round: 1 };
    over.activeSide = null;
    assertRejected(over, move, "match-over");
  }
});

test("the flag adds only rideOut: decks, hands, first seat and RNG are the flag-off match", () => {
  assert.equal(RIDE_OUT_RULES_VERSION, `${RULES_VERSION}+ride-out`);
  for (const seed of [0, 60, ...Array.from({ length: 40 }, (_, i) => 1 + i)]) {
    const { rideOut, ...rest } = createMatch(seed, { rideOut: true });
    assert.deepEqual(rideOut, { enabled: true, rulesVersion: RIDE_OUT_RULES_VERSION });
    assert.deepEqual(rest, createMatch(seed), `seed ${seed}`);
    for (const side of SIDES) {
      const { rideOut: flag, ...view } = publicState(createMatch(seed, { rideOut: true }), side);
      assert.deepEqual(flag, rideOut);
      assert.deepEqual(view, publicState(createMatch(seed), side), `seed ${seed} ${side} view`);
    }
  }
  for (const bad of ["yes", 1, null]) assert.throws(() => createMatch(0, { rideOut: bad }), TypeError);
  assert.throws(() => createMatch(0, { rideOut: true, traps: true }), /cannot be combined/);
  assert.equal(createMatch(0, { rideOut: false, traps: true }).traps.enabled, true);
});

test("left and right boundaries: only an adjacent lane on the board is a destination", () => {
  const reach = { 0: [1], 1: [0, 2], 2: [1] };
  for (const side of SIDES) {
    for (const slot of [0, 1, 2]) {
      const board = [null, null, null];
      board[slot] = [CARD[side].mid[0]];
      const state = position(side, { [side]: { board } });
      for (const destination of [-1, 0, 1, 2, 3]) {
        if (reach[slot].includes(destination)) accept(state, ride(state, slot, destination));
        else assertRejected(state, ride(state, slot, destination), "invalid-destination");
      }
      for (const destination of [slot + 0.5, String(slot + 1), null, undefined, NaN]) {
        assertRejected(state, ride(state, slot, destination), "invalid-destination");
      }
    }
  }
});

test("the source must hold one of the side's own troops", () => {
  for (const side of SIDES) {
    const enemy = opponent(side);
    const state = position(side, { [side]: { board: [[CARD[side].mid[0]], null, null] }, [enemy]: { board: [null, [CARD[enemy].mid[0]], null] } });
    for (const slot of [-1, 3, 0.5, "0", null, undefined]) assertRejected(state, ride(state, slot, 1), "invalid-slot");
    // Own lane 1 is empty although an enemy troop stands opposite it.
    assertRejected(state, ride(state, 1, 2), "invalid-slot");
    assertRejected(state, ride(state, 2, 1), "invalid-slot");
    assertRejected(state, ride(state, 1, 9), "invalid-slot"); // the source is checked before the destination
  }
});

test("the destination must be empty on the side's own board; an enemy opposite it does not matter", () => {
  for (const side of SIDES) {
    const enemy = opponent(side);
    const [smallA, smallB] = CARD[side].small;
    const state = position(side, { [side]: { board: [[CARD[side].mid[0]], [smallA], null] }, [enemy]: { board: [null, null, [CARD[enemy].mid[0]]] } });
    assertRejected(state, ride(state, 0, 1), "destination-occupied");
    assertRejected(state, ride(state, 1, 0), "destination-occupied");
    assert.deepEqual(accept(state, ride(state, 1, 2)).state.sides[side].board.map((troop) => troop?.cardId ?? null), [CARD[side].mid[0], null, smallA]);

    const full = position(side, { [side]: { board: [[CARD[side].mid[0]], [smallA], [smallB]] } });
    assertRejected(full, ride(full, 0, 2), "invalid-destination"); // two lanes away is checked before occupancy
    assertRejected(full, ride(full, 0, 1), "destination-occupied");
    assert.equal(legalActions(full, side).some((action) => action.type === "ride-out"), false);
  }
});

test("an accepted ride-out moves the same troop with its health, conserves every card and draws nothing", () => {
  for (const side of SIDES) {
    const enemy = opponent(side);
    const mid = CARD[side].mid[0];
    const state = position(side, { [side]: { board: [null, [mid, 2], null] }, [enemy]: { board: [[CARD[enemy].small[0], 1], null, null] } });
    assertConserved(state);
    const before = structuredClone(state);
    const { state: next, events } = accept(state, ride(state, 1, 2, { actionId: "r-1" }));

    assert.deepEqual(state, before, "input not mutated");
    assert.deepEqual(events, [{ type: "ride-out", side, cardId: mid, slot: 1, destination: 2, health: 2, revision: 0, actionId: "r-1" }]);
    // Only the board lanes, the summon allowance, revision and actionIds change.
    const expected = structuredClone(before);
    expected.sides[side].board = [null, null, { cardId: mid, health: 2 }];
    expected.allowances[side] = { summonUsed: true, castUsed: false };
    expected.revision = 1;
    expected.actionIds = ["r-1"];
    assert.deepEqual(next, expected);
    assert.equal(next.rng, state.rng);
    assert.equal(next.activeSide, side);
    assertConserved(next);
  }
});

test("the summon allowance is shared: summon after a move rejected, spell after a move accepted", () => {
  for (const side of SIDES) {
    const enemy = opponent(side);
    const [mid] = CARD[side].mid;
    const [smallA, smallB] = CARD[side].small;
    const { spell } = CARD[side];
    const sides = {
      [side]: { board: [[mid], null, [smallA]], hand: [smallB, spell] },
      [enemy]: { board: [[CARD[enemy].small[0]], null, null] },
    };
    const summon = (state, slot) => act(state, { type: "summon", cardId: smallB, slot, tributes: [] });
    const cast = (state) => act(state, { type: "spell", cardId: spell, target: 0 });

    // Ride out first: the summon and a second ride-out are refused, the spell is not.
    const start = position(side, sides);
    const moved = accept(start, ride(start, 0, 1)).state;
    assertRejected(moved, summon(moved, 0), "summon-used");
    assertRejected(moved, ride(moved, 1, 0), "summon-used");
    assert.deepEqual([...new Set(legalActions(moved, side).map((action) => action.type))], ["spell", "end-phase"]);
    const both = accept(moved, cast(moved)).state;
    assert.deepEqual(both.allowances[side], { summonUsed: true, castUsed: true });
    assert.equal(both.sides[side].board[1].cardId, mid, "the move stands after the spell");
    assert.equal(both.sides[enemy].board[0].health, CARDS[CARD[enemy].small[0]].health - 1);
    assertConserved(both);

    // Summon first: the move is refused on the same allowance, though lane 1 is still open.
    const open = position(side, { ...sides, [side]: { board: [[mid], null, null], hand: [smallB, spell] } });
    const spread = accept(open, summon(open, 2)).state;
    assertRejected(spread, ride(spread, 0, 1), "summon-used");
    assert.equal(legalActions(spread, side).some((action) => action.type === "ride-out"), false);

    // Spell first: neither the move nor the summon may follow.
    const spelled = accept(start, cast(start)).state;
    assertRejected(spelled, ride(spelled, 0, 1), "ride-out-after-spell");
    assertRejected(spelled, summon(spelled, 1), "summon-after-spell");
    assert.equal(legalActions(spelled, side).some((action) => action.type === "ride-out"), false);

    // The next round restores the allowance, with no extra key.
    let state = accept(both, act(both, { type: "end-phase" })).state;
    state = accept(state, act(state, { type: "end-phase" })).state;
    assert.equal(state.round, 2);
    for (const each of SIDES) assert.deepEqual(state.allowances[each], { summonUsed: false, castUsed: false });
  }
});

test("shared checks keep their precedence over ride-out reasons", () => {
  for (const side of SIDES) {
    const state = position(side, { [side]: { board: [[CARD[side].mid[0]], null, null] } });
    assertRejected(state, null, "invalid-action");
    assertRejected(state, ride(state, 0, 1, { actionId: "" }), "invalid-action");
    assertRejected(state, ride(state, 0, 1, { revision: state.revision + 1 }), "stale");
    assertRejected(state, ride(state, 0, 1, { side: opponent(side) }), "wrong-side");
    const { state: next } = accept(state, ride(state, 0, 1, { actionId: "dup" }));
    const ended = accept(next, act(next, { type: "end-phase" })).state;
    assertRejected(ended, ride(ended, 0, 1, { actionId: "dup" }), "duplicate-action");
  }
});

test("legalActions lists exactly the accepted ride-outs, after spells, and the view lists the same", () => {
  const moveKey = (action) => `${action.slot}>${action.destination}`;
  for (const side of SIDES) {
    const enemy = opponent(side);
    const troops = [CARD[side].mid[0], CARD[side].small[0], CARD[side].mid[1]];
    for (let mask = 0; mask < 8; mask++) {
      const board = troops.map((cardId, lane) => (mask & (1 << lane) ? [cardId] : null));
      const state = position(side, { [side]: { board, hand: [CARD[side].small[1], CARD[side].spell] }, [enemy]: { board: [[CARD[enemy].small[0]], null, null] } });
      const legal = legalActions(state, side);
      const accepted = [];
      for (const slot of [-1, 0, 1, 2, 3]) {
        for (const destination of [-1, 0, 1, 2, 3]) if (applyAction(state, ride(state, slot, destination)).ok) accepted.push(`${slot}>${destination}`);
      }
      const listed = legal.filter((action) => action.type === "ride-out");
      assert.deepEqual(listed.map(moveKey), accepted, `${side} mask ${mask}`);
      const types = legal.map((action) => action.type);
      if (listed.length) {
        assert.ok(types.lastIndexOf("spell") < types.indexOf("ride-out") && types.lastIndexOf("summon") < types.indexOf("ride-out"));
        assert.equal(types.lastIndexOf("ride-out"), types.length - 2);
      }
      assert.equal(types.at(-1), "end-phase");
      assert.deepEqual(legalActions(publicState(state, side), side), legal);
      for (const action of legal) assert.equal(applyAction(state, action).ok, true, JSON.stringify(action));
    }
  }
});

test("the moved troop attacks and blocks from its new lane in the next clash", () => {
  for (const side of SIDES) {
    const enemy = opponent(side);
    const state = position(side, { [side]: { board: [[CARD[side].small[0]], null, null] }, [enemy]: { board: [[CARD[enemy].small[0]], null, null] } });
    let next = accept(state, ride(state, 0, 1)).state;
    next = accept(next, act(next, { type: "end-phase" })).state;
    const { state: after, events } = accept(next, act(next, { type: "end-phase" }));
    const hits = events.filter((event) => event.type === "damage").map(({ lane, attacker, target }) => `${lane}:${attacker.side}>${target.kind}`).sort();
    assert.deepEqual(hits, [`0:${enemy}>base`, `1:${side}>base`].sort());
    assert.equal(after.sides[side].baseOrbs, 4);
    assert.equal(after.sides[enemy].baseOrbs, 4);
    assert.deepEqual(after.sides[side].board[1], { cardId: CARD[side].small[0], health: 3 });
  }
});

// A full state equal to `state` in everything `side` may know: the opponent's
// hand refilled from its deck (same count) and both deck orders reversed.
function hiddenTwin(state, side) {
  const twin = structuredClone(state);
  const enemy = twin.sides[opponent(side)];
  const pool = [...enemy.hand, ...enemy.deck].reverse();
  enemy.hand = pool.slice(0, enemy.hand.length);
  enemy.deck = pool.slice(enemy.hand.length);
  twin.sides[side].deck.reverse();
  return twin;
}

test("Normal and Hard see the move only through their public view, choose legal actions and replay", () => {
  for (const level of ["normal", "hard"]) {
    const choose = cpuFor(level);
    let rides = 0;
    for (let seed = 0; seed < 40; seed++) {
      let state = createMatch(seed, { rideOut: true });
      const phases = {};
      let steps = 0;
      while (!state.result) {
        assert.ok(steps++ < MAX_STEPS, `${level} seed ${seed}: unbounded`);
        const side = state.activeSide;
        const view = publicState(state, side);
        assert.deepEqual(view.rideOut, state.rideOut);
        const action = choose(view);
        assert.deepEqual(choose(publicState(hiddenTwin(state, side), side)), action, `${level} seed ${seed} revision ${state.revision}`);
        assert.ok(legalActions(state, side).some((each) => JSON.stringify(each) === JSON.stringify(action)), `${level} seed ${seed}: not legal`);
        const phase = (phases[`${state.round}:${side}`] ??= []);
        const slot = action.type === "summon" || action.type === "ride-out" ? "summon" : action.type;
        assert.equal(phase.includes(slot), false, `${level} seed ${seed}: second ${slot}`);
        phase.push(slot);
        if (action.type === "ride-out") rides += 1;
        state = accept(state, action).state;
      }
      const bots = { cowboy: choose, wizard: choose };
      const opening = () => createMatch(seed, { rideOut: true });
      assert.deepEqual(playMatch(seed, bots, opening()).log, playMatch(seed, bots, opening()).log, `${level} seed ${seed} replay`);
    }
    assert.ok(rides > 0, `${level}: no ride-out in 40 matches`);
  }
});

test("a ride-out is chosen only when it scores strictly higher; a summon wins an exact tie", () => {
  for (const level of ["normal", "hard"]) {
    const choose = cpuFor(level);
    const decide = (state) => choose(publicState(state, state.activeSide));
    for (const side of SIDES) {
      const enemy = opponent(side);
      const [mid, spare] = CARD[side].mid;
      // Own Base at 2 and an enemy troop in front of an open lane 1: blocking it is the only safe play.
      // The tribute summon of a second copy into lane 1 leaves exactly the board the ride-out leaves.
      const block = (hand) => position(side, { [side]: { board: [[mid], null, null], hand, baseOrbs: 2 }, [enemy]: { board: [null, [CARD[enemy].mid[0]], null] } });
      assert.deepEqual(decide(block([spare])), { type: "summon", side, revision: 0, cardId: spare, slot: 1, tributes: [0] }, `${level} ${side} tie`);
      assert.deepEqual(decide(block([])), { type: "ride-out", side, revision: 0, slot: 0, destination: 1 }, `${level} ${side} block`);
      assert.equal(decide(position(side, { [side]: { board: [[mid], null, null], hand: [], baseOrbs: 2 }, [enemy]: { board: [null, [CARD[enemy].mid[0]], null] } }, { rideOut: false })).type, "end-phase");

      // Enemy Base at 2 behind a lone Skeleton or Sheriff: breaking out wins the Base this clash and
      // beats spreading a free troop, which is what the same level does without the move.
      const sides = { [side]: { board: [[mid], null, null], hand: [CARD[side].small[0]] }, [enemy]: { board: [[CARD[enemy].small[0]], null, null], baseOrbs: 2 } };
      assert.deepEqual(decide(position(side, sides)), { type: "ride-out", side, revision: 0, slot: 0, destination: 1 }, `${level} ${side} break-out`);
      const shipped = decide(position(side, sides, { rideOut: false }));
      assert.equal(shipped.type, "summon", `${level} ${side} shipped`);
      assert.equal(shipped.cardId, CARD[side].small[0]);
    }
  }
});

test("Hard values a ride-out with the spell that may follow it, as it does a summon", () => {
  // Hard mirror with the flag, seed 63116, Wizard first, revision 16: round 4, Wizard to act second.
  // Found outside the development and holdout lanes. Summons keep their Singularity follow-up here,
  // and the Singularity is the last card in hand, so a projection of the move that dropped a hand
  // card would lose exactly that follow-up and prefer the tribute summon.
  const state = position("wizard", {
    wizard: { board: [["wizard-dragon-1", 2], null, null], hand: ["wizard-wizard-2", "wizard-wizard-1", "wizard-singularity-2"], baseOrbs: 2 },
    cowboy: { board: [["cowboy-billy-3", 1], ["cowboy-sheriff-6"], ["cowboy-sheriff-2"]], baseOrbs: 3 },
  });
  Object.assign(state, { round: 4, startingSide: "cowboy", revision: 16 });
  const hard = cpuFor("hard");
  const view = publicState(state, "wizard");
  assert.deepEqual(hard(view), { type: "ride-out", side: "wizard", revision: 16, slot: 0, destination: 1 });
  // The same view without the move gives the tribute summon the paired shipped match plays.
  const { rideOut, ...shipped } = view;
  assert.deepEqual(hard(shipped), { type: "summon", side: "wizard", revision: 16, cardId: "wizard-wizard-2", slot: 1, tributes: [0] });
});

test("with the flag on, a match nobody rides out in replays the shipped match", () => {
  const actions = (log) => log.map(({ action }) => action);
  // A chooser that cannot see the flag lists no ride-out at all.
  const unaware = (choose) => (view) => {
    const { rideOut, ...rest } = view;
    return choose(rest);
  };
  for (const level of ["normal", "hard"]) {
    const choose = cpuFor(level);
    const bots = { cowboy: choose, wizard: choose };
    let quiet = 0;
    let moved = 0;
    for (let seed = 0; seed < 60; seed++) {
      const off = playMatch(seed, bots);
      const on = playMatch(seed, bots, createMatch(seed, { rideOut: true }));
      const blind = playMatch(seed, { cowboy: unaware(choose), wizard: unaware(choose) }, createMatch(seed, { rideOut: true }));
      assert.deepEqual(actions(blind.log), actions(off.log), `${level} seed ${seed} unaware`);
      assert.deepEqual(blind.state.result, off.state.result);
      if (on.log.some(({ action }) => action.type === "ride-out")) {
        moved += 1;
        continue;
      }
      quiet += 1;
      assert.deepEqual(actions(on.log), actions(off.log), `${level} seed ${seed}`);
      assert.deepEqual(on.state.result, off.state.result, `${level} seed ${seed}`);
    }
    assert.ok(quiet > 0 && moved > 0, `${level}: ${quiet} quiet, ${moved} moved`);
  }
});

test("the paired runner's counts add up, every changed winner follows a ride-out, and reruns match", () => {
  const sum = (values) => values.reduce((a, b) => a + b, 0);
  // Seeds 0-19 sit outside both lanes; the lanes themselves do not overlap.
  assert.ok(LANES.development.from + LANES.development.count <= LANES.holdout.from);
  for (const cpu of ["normal", "hard"]) {
    const report = run({ from: 0, count: 20, cpu });
    assert.deepEqual(run({ from: 0, count: 20, cpu }), report, `${cpu}: rerun`);
    assert.equal(report.matchesPerArm, 40);
    for (const arm of Object.values(report.summary)) {
      assert.equal(arm.firstSeatWins + arm.secondSeatWins + arm.draws, 40);
      assert.equal(sum(Object.values(arm.endings)), 40);
      assert.equal(sum(Object.values(arm.roundHistogram)), 40);
    }
    const { phases, opportunities, uses, shippedPlanAtOpportunity, atUse, usesPerMatch } = report.usage;
    assert.ok(uses.total > 0, `${cpu}: no ride-out in the sample`);
    assert.ok(uses.total <= opportunities.total && opportunities.total <= phases.total);
    assert.equal(uses.first + uses.second, uses.total);
    assert.equal(uses.cowboy + uses.wizard, uses.total);
    assert.equal(sum(Object.values(shippedPlanAtOpportunity).map((plan) => plan.opportunities)), opportunities.total);
    assert.equal(sum(Object.values(shippedPlanAtOpportunity).map((plan) => plan.uses)), uses.total);
    assert.equal(sum(Object.values(atUse.kinds)), uses.total);
    assert.equal(atUse.stalled + atUse.racing, uses.total);
    assert.equal(sum(Object.values(usesPerMatch)), 40);
    assert.equal(sum(Object.entries(usesPerMatch).map(([n, matches]) => n * matches)), uses.total);
    assert.equal(report.firstDivergence.matches, report.paired.matchesWithRideOut);
    assert.equal(sum(Object.values(report.firstDivergence.ridingSide)), report.paired.matchesWithRideOut);
    assert.equal(sum(Object.values(report.paired.outcomeFlow)), 40);
    const changed = report.matches.filter((row) => row.shipped !== row.rideOut);
    assert.equal(changed.length, report.paired.matchesWithChangedWinner);
    for (const row of changed) assert.ok(row.rideOuts > 0, `${cpu} seed ${row.seed}: changed without a ride-out`);
  }
  const script = fileURLToPath(new URL("../../scripts/compare-ride-out.mjs", import.meta.url));
  for (const args of [[], ["--lane", "development"], ["--lane", "nope", "--cpu", "hard"], ["--lane", "holdout", "--cpu", "easy"], ["--bogus"]]) {
    assert.equal(spawnSync(process.execPath, [script, ...args], { encoding: "utf8" }).status, 2, args.join(" "));
  }
});

test("seed 0 and seed 60 default output equals 55a395e", () => {
  // SHA-256 of JSON values, recorded on 55a395e before any Ride Out change.
  const BASE = {
    0: {
      opening: "cb0160cbbbde7e62cc939fb680d405562091024676ef2c407e284d21ee8d3f32",
      normal: "a5d304bfc7cbdbd4a6309360a8c239214f2685bd7b7a80d15a51b78d344ed040",
      hard: "c9ab16c73b7ebe62e5c18986615c22edb57839e7d61035c23a76f2690a1ab180",
      firstLegal: "abdde7271dcf68a82c4cfa707f2788a53cc788128e1de48362f38a90f8447502",
    },
    60: {
      opening: "00e3627a13d27871a567c9fd072a26572a0853c17107ab8b59e27418da25fb0b",
      normal: "b3d2e4610abaccc9dfc0d56078484ec40932105dd8f9b635a3708985be041db5",
      hard: "88ec9232ffe4f25211acd8f7ce8a12271799b10a8f530884cc95d39a48c88163",
      firstLegal: "dbe2b327d4e396db56867a0ee8950b411b6ca3be9e034d3083b1a8dd7c2fcd51",
    },
  };
  const sha = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
  for (const seed of [0, 60]) {
    const got = { opening: sha(createMatch(seed)) };
    for (const level of ["normal", "hard"]) got[level] = sha(playMatch(seed, { cowboy: historicalBot(cpuFor(level)), wizard: historicalBot(cpuFor(level)) }).log);
    let state = createMatch(seed);
    const firstLegal = [];
    while (!state.result) {
      const action = legalActions(state, state.activeSide)[0];
      const result = applyAction(state, action);
      firstLegal.push(action, ...result.events);
      state = result.state;
    }
    got.firstLegal = sha(firstLegal);
    assert.deepEqual(got, BASE[seed], `seed ${seed}`);
  }
  // Hard against Hard on the historical baseline (card-level rides ignored), every action on seeds 0-199 (Normal is pinned in cpu.test.js).
  const hash = createHash("sha256");
  const historicalHard = historicalBot(cpuFor("hard"));
  for (let seed = 0; seed < 200; seed++) {
    hash.update(JSON.stringify(playMatch(seed, { cowboy: historicalHard, wizard: historicalHard }).log.map(({ action }) => action)));
  }
  assert.equal(hash.digest("hex"), "4c2159ab1f77d1b46f7963962316f546667a6a81636122498e767de7fa61aeed");
});
