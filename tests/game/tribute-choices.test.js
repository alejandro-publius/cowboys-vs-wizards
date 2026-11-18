import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { CARDS, DECKS, SIDES, opponent } from "../../src/game/cards.js";
import { applyAction } from "../../src/game/actions.js";
import { cpuFor } from "../../src/game/cpu.js";
import { openingMatch } from "../../src/game/opening-policy.js";
import { createMatch } from "../../src/game/state.js";
import { publicState } from "../../src/game/view.js";
import {
  auditTributeChoices,
  evaluateDecision,
  finishRound,
  groupLegalActions,
  inspectSeed,
} from "../../scripts/audit-tribute-choices.mjs";

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function cowboyPosition({ board, hand, enemyBoard = [null, null, null] }) {
  const state = createMatch(0);
  state.startingSide = state.activeSide = "cowboy";
  const used = new Set([...board.filter(Boolean).map((t) => t.cardId), ...hand]);
  state.sides.cowboy = {
    baseOrbs: 5,
    deck: DECKS.cowboy.filter((id) => !used.has(id)),
    hand: [...hand],
    board,
    discard: [],
  };
  const enemyUsed = new Set(enemyBoard.filter(Boolean).map((t) => t.cardId));
  state.sides.wizard = {
    baseOrbs: 5,
    deck: DECKS.wizard.filter((id) => !enemyUsed.has(id)),
    hand: DECKS.wizard.filter((id) => !enemyUsed.has(id)).slice(0, 4),
    board: enemyBoard,
    discard: [],
  };
  state.sides.wizard.deck = state.sides.wizard.deck.slice(4);
  return state;
}

const troop = (cardId, health = CARDS[cardId].health) => ({ cardId, health });

test("groupLegalActions collapses duplicate card copies and equivalent actions while keeping legal moves", () => {
  const singleState = cowboyPosition({
    board: [troop("cowboy-sheriff-1", 1), troop("cowboy-sheriff-2", 3), null],
    hand: ["cowboy-sheriff-3", "cowboy-billy-1", "cowboy-deadeye-1"],
    enemyBoard: [troop("wizard-skeleton-1", 2), null, null],
  });
  const dupState = cowboyPosition({
    board: [troop("cowboy-sheriff-1", 1), troop("cowboy-sheriff-2", 3), null],
    hand: [
      "cowboy-sheriff-3",
      "cowboy-sheriff-4",
      "cowboy-billy-1",
      "cowboy-billy-2",
      "cowboy-deadeye-1",
      "cowboy-deadeye-2",
    ],
    enemyBoard: [troop("wizard-skeleton-1", 2), null, null],
  });

  const singleGrouped = groupLegalActions(publicState(singleState, "cowboy"));
  const dupGrouped = groupLegalActions(publicState(dupState, "cowboy"));

  assert.equal(singleGrouped.eligible, true);
  assert.equal(dupGrouped.eligible, true);
  assert.ok(dupGrouped.rawCount > singleGrouped.rawCount);
  assert.deepEqual(
    dupGrouped.groups.map((g) => g.key),
    singleGrouped.groups.map((g) => g.key),
    "duplicated hand copies must not add action meaning groups",
  );
  // Sacrificing the 1-HP Sheriff vs the 3-HP Sheriff stays distinct.
  assert.equal(singleGrouped.groups.filter((g) => g.category === "tribute-1").length, 4);

  for (const group of dupGrouped.groups) {
    for (const action of group.actions) {
      assert.equal(applyAction(dupState, action).ok, true, group.key);
    }
  }

  // In-place replacement of two undamaged Billys leaves the exact same board and collapses.
  const twinBillys = cowboyPosition({
    board: [troop("cowboy-billy-1", 4), troop("cowboy-billy-2", 4), null],
    hand: ["cowboy-billy-3"],
  });
  const twinGrouped = groupLegalActions(publicState(twinBillys, "cowboy"));
  const billyGroups = twinGrouped.groups.filter((g) => g.category === "tribute-1");
  // Replacing L0 in place and replacing L1 in place share [Billy:4|Billy:4|-]; moving to L2 differs by vacated lane.
  assert.equal(billyGroups.length, 3);
  assert.equal(twinGrouped.rawCount, 5);
});

test("every raw action in a meaning group produces identical round-end outcomes, and frozen state stays immutable", () => {
  for (const wizardLevel of ["normal", "hard"]) {
    const bots = { cowboy: cpuFor("normal"), wizard: cpuFor(wizardLevel) };
    let checkedGroups = 0;
    for (let seed = 0; seed < 20; seed++) {
      let state = openingMatch(seed, "shipped", SIDES[seed % 2]);
      while (!state.result) {
        if (state.activeSide === "cowboy") {
          const snapshot = structuredClone(state);
          deepFreeze(state);
          const view = publicState(state, "cowboy");
          const grouped = groupLegalActions(view);
          if (grouped.eligible) {
            const decision = evaluateDecision(state, bots, "cowboy");
            assert.ok(decision);
            assert.deepEqual(state, snapshot);
            for (const group of grouped.groups) {
              if (group.actions.length < 2) continue;
              checkedGroups += 1;
              const baseline = finishRound(state, group.representative, bots);
              for (const duplicate of group.actions.slice(1)) {
                assert.deepEqual(finishRound(state, duplicate, bots), baseline, `${wizardLevel} seed ${seed} ${group.key}`);
              }
            }
          }
        }
        const actor = state.activeSide;
        state = applyAction(state, bots[actor](publicState(state, actor))).state;
      }
    }
    assert.ok(checkedGroups > 20, `${wizardLevel}: exercised duplicate groups`);
  }
});

test("bots receive only public views and permuting future draws never changes round-end audit results", () => {
  const viewKeys = Object.keys(publicState(createMatch(0), "cowboy")).sort();
  let botCalls = 0;
  const checkedBot = (side, level) => {
    const inner = cpuFor(level);
    return (view) => {
      botCalls += 1;
      assert.equal(view.viewer, side);
      assert.deepEqual(Object.keys(view).sort(), viewKeys);
      for (const hidden of ["seed", "rng", "actionIds"]) assert.equal(hidden in view, false, hidden);
      assert.equal("deck" in view.sides[side], false);
      assert.equal("hand" in view.sides[opponent(side)], false);
      return inner(view);
    };
  };

  const bots = { cowboy: checkedBot("cowboy", "normal"), wizard: checkedBot("wizard", "hard") };
  let checkedDecisions = 0;
  for (const seed of [0, 3, 14, 60]) {
    let state = createMatch(seed);
    while (!state.result) {
      if (state.activeSide === "cowboy") {
        const reversedDecks = structuredClone(state);
        reversedDecks.sides.cowboy.deck.reverse();
        reversedDecks.sides.wizard.deck.reverse();
        const a = evaluateDecision(state, bots, "cowboy");
        const b = evaluateDecision(reversedDecks, bots, "cowboy");
        assert.deepEqual(b, a, `seed ${seed} r${state.round}: future draws leaked`);
        if (a) checkedDecisions += 1;
      }
      const actor = state.activeSide;
      state = applyAction(state, bots[actor](publicState(state, actor))).state;
    }
  }
  assert.ok(botCalls > 50 && checkedDecisions >= 8);
});

test("auditTributeChoices replays deterministically, balances seats, includes seed 60, and guards CLI bounds", () => {
  for (const wizard of ["normal", "hard"]) {
    const first = auditTributeChoices({ from: 58, count: 5, cowboy: "normal", wizard, exampleSeed: 60 });
    const second = auditTributeChoices({ from: 58, count: 5, cowboy: "normal", wizard, exampleSeed: 60 });
    assert.deepEqual(second, first, `${wizard} deterministic replay`);
    assert.equal(first.sample.matches, 10);
    assert.equal(first.matchResults.byFirstSeat.cowboy.matches, 5);
    assert.equal(first.matchResults.byFirstSeat.wizard.matches, 5);
    assert.equal(
      first.overall.decisionStates,
      first.byFirstSeat.cowboy.decisionStates + first.byFirstSeat.wizard.decisionStates,
    );
    assert.equal(
      first.overall.decisionStates,
      first.byRoundOrder.actingFirstInRound.decisionStates + first.byRoundOrder.actingSecondInRound.decisionStates,
    );
    assert.equal(first.exampleSeed.length, 2);
    assert.ok(first.exampleSeed.every((run) => run.seed === 60 && run.decisions.length > 0));
  }

  // Seed 60 natural showcase line (wizard starts): R3 1-tribute Billy and R4 2-tribute Mounted Billy.
  const [, natural60] = inspectSeed(60, { cowboy: "normal", wizard: "normal" });
  assert.equal(natural60.naturalFirstSeat, true);
  const r3 = natural60.decisions.find((d) => d.round === 3);
  const r4 = natural60.decisions.find((d) => d.round === 4);
  assert.equal(r3.chosenCategory, "tribute-1");
  assert.equal(r4.chosenCategory, "tribute-2");
  assert.equal(r4.chosenTributeRegretVsAnyOnBase, true);

  const scriptPath = fileURLToPath(new URL("../../scripts/audit-tribute-choices.mjs", import.meta.url));
  const runCli = (...args) => spawnSync(process.execPath, [scriptPath, ...args], { encoding: "utf8", timeout: 4000 });
  assert.equal(runCli("--from", "60", "--count", "1").status, 0);
  for (const bad of [
    ["--count", "0"],
    ["--count", "5001"],
    ["--from", "-1"],
    ["--from", "9007199254740991", "--count", "2"],
    ["--wizard", "human"],
    ["--cowboy", "random"],
    ["--unknown"],
  ]) {
    assert.equal(runCli(...bad).status, 2, bad.join(" "));
  }
});
