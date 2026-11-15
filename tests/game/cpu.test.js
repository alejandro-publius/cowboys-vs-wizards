// CPU heuristic checks: legality, termination, replay, tribute play and
// independence from hidden information. Matches are played by the same runner
// the scripts use (scripts/play-match.mjs).
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { CARDS, SIDES, opponent, tributeCost } from "../../src/game/cards.js";
import { createMatch } from "../../src/game/state.js";
import { applyAction } from "../../src/game/actions.js";
import { legalActions } from "../../src/game/legal.js";
import { publicState } from "../../src/game/view.js";
import { chooseAction } from "../../src/game/cpu.js";
import { MAX_STEPS, makeBot, playMatch } from "../../scripts/play-match.mjs";
import { simulate } from "../../scripts/simulate-matches.mjs";

const SEEDS = Array.from({ length: 50 }, (_, seed) => seed); // 0-49, so 14, 27 and 47 are included
const cpuBots = { cowboy: chooseAction, wizard: chooseAction };

// The only way these tests hand a position to the CPU.
const decide = (state, side) => chooseAction(publicState(state, side));

// createMatch(0) with `side` to act and the given hand and boards (fixture, trusted by the engine).
function position(side, { hand, board, enemyBoard = [null, null, null] }) {
  const state = createMatch(0);
  state.startingSide = state.activeSide = side;
  state.sides[side].hand = hand;
  state.sides[side].board = board;
  state.sides[opponent(side)].board = enemyBoard;
  return state;
}
const troop = (cardId, health = CARDS[cardId].health) => ({ cardId, health });

test("the CPU's choice is always a legal action and leaves its view untouched", () => {
  for (const kinds of [["cpu", "cpu"], ["random", "cpu"], ["cpu", "random"]]) {
    for (const seed of SEEDS) {
      const checked = (side, bot) => (view) => {
        const before = structuredClone(view);
        const action = bot(view);
        assert.deepEqual(view, before, `seed ${seed}: view changed`);
        if (bot === chooseAction) {
          const legal = legalActions(view, side).map((each) => JSON.stringify(each));
          assert.ok(legal.includes(JSON.stringify(action)), `seed ${seed}: ${JSON.stringify(action)} is not legal`);
        }
        return action;
      };
      playMatch(seed, Object.fromEntries(SIDES.map((side, i) => [side, checked(side, makeBot(kinds[i], seed, side))])));
    }
  }
});

test("CPU against CPU finishes within the step bound and replays identically", () => {
  for (const seed of SEEDS) {
    const first = playMatch(seed, cpuBots);
    assert.ok(first.state.result, `seed ${seed}`);
    assert.ok(first.log.length <= MAX_STEPS, `seed ${seed}: ${first.log.length} actions`);
    // At most one summon, one cast and one end-phase per side per round.
    const phases = {};
    for (const { round, side, action } of first.log) {
      const phase = (phases[`${round}:${side}`] ??= []);
      assert.equal(phase.includes(action.type), false, `seed ${seed} round ${round}: second ${action.type}`);
      phase.push(action.type);
    }
    assert.deepEqual(playMatch(seed, cpuBots), first, `seed ${seed} replay`);
  }
});

test("with no summon or spell legal the CPU ends the phase", () => {
  // Seeds 14, 27 and 47: the starting side opens with no free troop and no spell target.
  for (const seed of [14, 27, 47]) {
    const state = createMatch(seed);
    const side = state.activeSide;
    const legal = legalActions(state, side);
    assert.deepEqual(legal.map((action) => action.type), ["end-phase"], `seed ${seed}`);
    assert.deepEqual(decide(state, side), legal[0], `seed ${seed}`);
  }
  // Not its phase, or match over: nothing to choose.
  const state = createMatch(14);
  assert.equal(decide(state, opponent(state.activeSide)), null);
});

test("the CPU pays tribute for higher-tier troops and declines a bad trade", () => {
  // Full board of Skeletons, nothing opposite: the Dragon replaces two of them.
  const skeletons = ["wizard-skeleton-1", "wizard-skeleton-2", "wizard-skeleton-3"].map((id) => troop(id));
  const dragon = decide(position("wizard", { hand: ["wizard-dragon-1"], board: skeletons }), "wizard");
  assert.equal(dragon.type, "summon");
  assert.equal(dragon.cardId, "wizard-dragon-1");
  assert.equal(dragon.tributes.length, 2);

  // One Sheriff on board: Billy takes its place.
  const billy = decide(position("cowboy", { hand: ["cowboy-billy-1"], board: [troop("cowboy-sheriff-1"), null, null] }), "cowboy");
  assert.deepEqual({ type: billy.type, cardId: billy.cardId, tributes: billy.tributes }, { type: "summon", cardId: "cowboy-billy-1", tributes: [0] });

  // Sacrificing two healthy Billys for Mounted Billy loses more than it gains.
  const board = [troop("cowboy-billy-1"), troop("cowboy-billy-2"), null];
  assert.equal(decide(position("cowboy", { hand: ["cowboy-mounted-billy-1"], board }), "cowboy").type, "end-phase");

  // Across real matches every troop tier enters play.
  const summoned = new Set();
  for (const seed of SEEDS) {
    for (const { action } of playMatch(seed, cpuBots).log) if (action.type === "summon") summoned.add(CARDS[action.cardId].name);
  }
  assert.deepEqual([...summoned].sort(), ["Billy", "Dragon", "Mounted Billy", "Sheriff", "Skeleton", "Wizard"]);
});

test("the CPU holds a spell that only chips and casts one that kills", () => {
  const hand = ["cowboy-deadeye-1"];
  const chip = position("cowboy", { hand, board: [troop("cowboy-sheriff-1"), null, null], enemyBoard: [troop("wizard-dragon-1"), null, null] });
  assert.equal(decide(chip, "cowboy").type, "end-phase");
  const kill = position("cowboy", { hand, board: [null, null, null], enemyBoard: [null, troop("wizard-skeleton-1", 1), null] });
  assert.deepEqual({ type: decide(kill, "cowboy").type, target: decide(kill, "cowboy").target }, { type: "spell", target: 1 });
});

// A full state equal to `state` in everything `side` may know, with the
// opponent's hand refilled from the opponent's deck (same counts) and both
// deck orders reversed.
function hiddenTwin(state, side) {
  const twin = structuredClone(state);
  const own = twin.sides[side];
  const enemy = twin.sides[opponent(side)];
  const pool = [...enemy.hand, ...enemy.deck].reverse();
  enemy.hand = pool.slice(0, enemy.hand.length);
  enemy.deck = pool.slice(enemy.hand.length);
  own.deck.reverse();
  return twin;
}

test("hidden information does not change the CPU's decision", () => {
  let points = 0;
  let handsDiffer = 0;
  for (const seed of SEEDS) {
    let state = createMatch(seed);
    while (!state.result) {
      const side = state.activeSide;
      const twin = hiddenTwin(state, side);
      const enemy = opponent(side);
      // The twin really differs where the CPU must not look.
      if (state.sides[side].deck.length > 1) assert.notDeepEqual(twin.sides[side].deck, state.sides[side].deck);
      if (state.sides[enemy].deck.length > 1) assert.notDeepEqual(twin.sides[enemy].deck, state.sides[enemy].deck);
      const names = (ids) => ids.map((id) => CARDS[id].name).sort();
      if (names(twin.sides[enemy].hand).join() !== names(state.sides[enemy].hand).join()) handsDiffer += 1;
      assert.equal(twin.sides[enemy].hand.length, state.sides[enemy].hand.length);

      const action = decide(state, side);
      assert.deepEqual(decide(twin, side), action, `seed ${seed} revision ${state.revision}`);
      points += 1;
      state = applyAction(state, action).state;
    }
  }
  // Most decision points have an opponent hand that differs by card name, not only by ID.
  assert.ok(points > 1000 && handsDiffer > points / 2, `${handsDiffer} of ${points} points differ by name`);
});

test("the runner hands bots their own public view and nothing else", () => {
  const state = createMatch(14);
  const viewKeys = Object.keys(publicState(state, "cowboy")).sort();
  let calls = 0;
  const spy = (side) => (view) => {
    calls += 1;
    assert.equal(view.viewer, side);
    assert.deepEqual(Object.keys(view).sort(), viewKeys);
    for (const hidden of ["seed", "rng", "actionIds"]) assert.equal(hidden in view, false, hidden);
    assert.deepEqual(Object.keys(view.sides[side]).sort(), ["baseOrbs", "board", "deckCount", "discard", "hand", "handCount"]);
    assert.deepEqual(Object.keys(view.sides[opponent(side)]).sort(), ["baseOrbs", "board", "deckCount", "discard", "handCount"]);
    return chooseAction(view);
  };
  for (const seed of [14, 27, 47]) playMatch(seed, { cowboy: spy("cowboy"), wizard: spy("wizard") });
  assert.ok(calls > 0);
});

test("simulation report adds up and the scripts reject bad arguments", () => {
  const report = simulate({ from: 0, count: 30, cowboy: "random", wizard: "cpu" });
  const { cowboy } = report.results;
  assert.equal(cowboy.wins + cowboy.losses + cowboy.draws, 30);
  assert.equal(report.byStartingSide.cowboy.matches + report.byStartingSide.wizard.matches, 30);
  assert.equal(report.endings["base-destroyed"] + report.endings["round-limit"], 30);
  for (const counts of [report.finalRound, report.actionsPerMatch.distribution]) {
    assert.equal(Object.values(counts).reduce((a, b) => a + b, 0), 30);
  }
  // Opening hands counted independently of the script.
  const noFree = (seed, side) => !createMatch(seed).sides[side].hand.some((id) => CARDS[id].kind === "troop" && tributeCost(CARDS[id].stars) === 0);
  const seeds = Array.from({ length: 30 }, (_, seed) => seed);
  assert.equal(report.openingHandsWithoutFreeSummon.wizard, seeds.filter((seed) => noFree(seed, "wizard")).length);
  assert.equal(report.openingHandsWithoutFreeSummon.startingSide, seeds.filter((seed) => noFree(seed, createMatch(seed).startingSide)).length);
  const { wins, losses, draws } = report.outcomesWithoutFreeSummon.startingSide;
  assert.equal(wins + losses + draws, report.openingHandsWithoutFreeSummon.startingSide);
  assert.equal(report.winnerActedInFinalRound.first + report.winnerActedInFinalRound.second, cowboy.wins + cowboy.losses);
  assert.deepEqual(simulate({ from: 0, count: 30, cowboy: "random", wizard: "cpu" }), report);

  const run = (script, ...args) => spawnSync(process.execPath, [fileURLToPath(new URL(`../../scripts/${script}`, import.meta.url)), ...args], { encoding: "utf8" });
  assert.equal(run("play-match.mjs", "--seed", "14").status, 0);
  for (const args of [[], ["--seed", "x"], ["--seed", "1", "--wizard", "human"], ["--seed", "1", "--bogus"]]) {
    assert.equal(run("play-match.mjs", ...args).status, 2, args.join(" "));
  }
  for (const args of [["--count", "0"], ["--count", "10001"], ["--from", "-1"], ["--cowboy", "human"]]) {
    assert.equal(run("simulate-matches.mjs", ...args).status, 2, args.join(" "));
  }
});
