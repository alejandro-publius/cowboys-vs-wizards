// Counterfactual single-round audit of player-facing tribute decisions on the
// shipped engine and starter decks. Usage:
//   node scripts/audit-tribute-choices.mjs [--from 0] [--count 1000] [--wizard normal|hard] [--cowboy normal|hard] [--example-seed 60] [--out <file>]
// Each seed is played twice via openingMatch(seed, "shipped", firstSeat) so
// both first seats are balanced. Bots receive only publicState(state, side).
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { CARDS, DECKS, SIDES, opponent } from "../src/game/cards.js";
import { applyAction } from "../src/game/actions.js";
import { CPU_LEVELS, cpuFor } from "../src/game/cpu.js";
import { legalActions } from "../src/game/legal.js";
import { openingMatch } from "../src/game/opening-policy.js";
import { createMatch, RULES_VERSION } from "../src/game/state.js";
import { publicState } from "../src/game/view.js";
import { MAX_STEPS, playMatch, wholeNumber } from "./play-match.mjs";

export const MAX_COUNT = 5000;
export const PLAYER_SIDE = "cowboy";
const AUDIT_LEVELS = CPU_LEVELS;

const SORTED_DECKS = Object.fromEntries(SIDES.map((side) => [side, [...DECKS[side]].sort()]));

export function assertConserved(state, label) {
  for (const side of SIDES) {
    const { deck, hand, board, discard } = state.sides[side];
    const all = [...deck, ...hand, ...board.filter(Boolean).map((troop) => troop.cardId), ...discard].sort();
    assert.deepEqual(all, SORTED_DECKS[side], `${label}: ${side} cards not conserved`);
  }
}

const slotText = (troop) => (troop ? `${CARDS[troop.cardId].name}:${troop.health}` : "-");
const boardKey = (board) => board.map(slotText).join("|");
const pct = (part, whole) => (whole === 0 ? 0 : Number(((100 * part) / whole).toFixed(2)));
const sign = (diff) => (diff > 0 ? 1 : diff < 0 ? -1 : 0);

export function actionCategory(action) {
  if (action.type === "end-phase") return "hold";
  if (action.type === "spell") return "spell";
  if (action.type === "set-trap") return "set-trap";
  if (action.tributes.length === 0) return "free-summon";
  return action.tributes.length === 1 ? "tribute-1" : "tribute-2";
}

export const isTributeAction = (action) => action.type === "summon" && action.tributes.length > 0;

// Meaning of a legal action from the acting player's public view alone.
// Collapses duplicate card copies in hand, tribute-slot permutations, and
// identical in-place replacements on the player's board.
export function actionMeaningKey(view, action) {
  const side = view.viewer;
  if (action.type === "end-phase") return "end-phase";
  if (action.type === "spell") {
    const move = action.destination == null ? "stay" : `L${action.destination}`;
    return `spell:${CARDS[action.cardId].name}:L${action.target}->${move}`;
  }
  if (action.type === "set-trap") return `set-trap:${CARDS[action.cardId]?.name ?? action.cardId}`;
  const card = CARDS[action.cardId];
  const afterBoard = view.sides[side].board.map((troop, lane) => {
    if (lane === action.slot) return `${card.name}:${card.health}`;
    if (action.tributes.includes(lane)) return "-";
    return slotText(troop);
  });
  return `summon:${card.name}:trib${action.tributes.length}:[${afterBoard.join("|")}]`;
}

// Canonical public decision position up to duplicate card copy IDs.
export function publicPositionKey(view) {
  const side = view.viewer;
  const enemy = opponent(side);
  const own = view.sides[side];
  const theirs = view.sides[enemy];
  const handNames = own.hand.map((id) => CARDS[id].name).sort().join(",");
  const ownDiscard = own.discard.map((id) => CARDS[id].name).sort().join(",");
  const enemyDiscard = theirs.discard.map((id) => CARDS[id].name).sort().join(",");
  return [
    `R${view.round}`,
    `start:${view.startingSide}`,
    `act:${view.activeSide}`,
    `base:${own.baseOrbs}-${theirs.baseOrbs}`,
    `own:[${boardKey(own.board)}]`,
    `enemy:[${boardKey(theirs.board)}]`,
    `hand:[${handNames}]`,
    `ehand:${theirs.handCount}`,
    `decks:${own.deckCount}-${theirs.deckCount}`,
    `disc:[${ownDiscard}|${enemyDiscard}]`,
  ].join(";");
}

// Groups legalActions(view, view.viewer) by meaning while keeping deterministic
// legalActions order for each group's representative action.
export function groupLegalActions(view) {
  const raw = legalActions(view, view.viewer);
  const byKey = new Map();
  for (const action of raw) {
    const key = actionMeaningKey(view, action);
    let group = byKey.get(key);
    if (!group) {
      group = {
        key,
        category: actionCategory(action),
        isTribute: isTributeAction(action),
        tributeCost: action.type === "summon" ? action.tributes.length : 0,
        cardName: action.cardId ? CARDS[action.cardId].name : null,
        representative: structuredClone(action),
        rawCount: 0,
        actions: [],
      };
      byKey.set(key, group);
    }
    group.rawCount += 1;
    group.actions.push(action);
  }
  const groups = [...byKey.values()];
  const hasTribute = groups.some((g) => g.isTribute);
  const hasNonTribute = groups.some((g) => !g.isTribute);
  return { rawCount: raw.length, groups, eligible: hasTribute && hasNonTribute };
}

// Clones `frozenState`, applies `action`, finishes the same round using only
// each bot's public view, and extracts the round-end public outcome prior to
// any next-round draw.
export function finishRound(frozenState, action, bots) {
  let cur = structuredClone(frozenState);
  const side = cur.activeSide;
  const enemy = opponent(side);
  const targetRound = cur.round;

  const first = applyAction(cur, structuredClone(action));
  if (!first.ok) throw new Error(`candidate action rejected: ${first.reason}`);
  cur = first.state;
  const events = [...first.events];

  let steps = 1;
  while (!cur.result && cur.round === targetRound) {
    if (steps >= MAX_STEPS) throw new Error(`round ${targetRound} exceeded ${MAX_STEPS} steps`);
    const actor = cur.activeSide;
    const nextAction = bots[actor](publicState(cur, actor));
    const applied = applyAction(cur, nextAction);
    if (!applied.ok) throw new Error(`${actor} bot action rejected: ${applied.reason}`);
    cur = applied.state;
    events.push(...applied.events);
    steps += 1;
  }

  // If the match continues past targetRound, applyEndPhase already ran round-start
  // and drew up to one card per side for targetRound + 1. Strip that draw count so
  // remainingHand measures only targetRound's post-clash public hand.
  const nextRoundDraws = { cowboy: 0, wizard: 0 };
  for (const event of events) {
    if (event.type === "draw") nextRoundDraws[event.side] += 1;
  }

  const endView = publicState(cur, side);
  const ownEnd = endView.sides[side];
  const enemyEnd = endView.sides[enemy];
  const ownHandAfterRound = ownEnd.hand.slice(0, ownEnd.hand.length - nextRoundDraws[side]);
  const ownRemainingHand = ownHandAfterRound.length;
  const enemyRemainingHand = enemyEnd.handCount - nextRoundDraws[enemy];

  const ownLivingTroops = ownEnd.board.filter(Boolean).length;
  const enemyLivingTroops = enemyEnd.board.filter(Boolean).length;
  const ownTroopHealth = ownEnd.board.reduce((sum, troop) => sum + (troop ? troop.health : 0), 0);
  const enemyTroopHealth = enemyEnd.board.reduce((sum, troop) => sum + (troop ? troop.health : 0), 0);
  const ownTroopsDefeated = events.filter((e) => e.type === "defeat" && e.side === side).length;
  const enemyTroopsDefeated = events.filter((e) => e.type === "defeat" && e.side === enemy).length;

  const matchOutcome = endView.result ? endView.result.outcome : "ongoing";
  const ownMatchDefeat = matchOutcome === "loss";
  const enemyMatchDefeat = matchOutcome === "win";
  const matchDefeatScore = enemyMatchDefeat ? 1 : ownMatchDefeat ? -1 : 0;
  const troopDefeatNet = enemyTroopsDefeated - ownTroopsDefeated;

  return {
    ownBaseOrbs: ownEnd.baseOrbs,
    enemyBaseOrbs: enemyEnd.baseOrbs,
    netBaseOrbs: ownEnd.baseOrbs - enemyEnd.baseOrbs,
    ownLivingTroops,
    enemyLivingTroops,
    netLivingTroops: ownLivingTroops - enemyLivingTroops,
    ownTroopHealth,
    enemyTroopHealth,
    netTroopHealth: ownTroopHealth - enemyTroopHealth,
    ownRemainingHand,
    enemyRemainingHand,
    ownRemainingHandNames: ownHandAfterRound.map((id) => CARDS[id].name).sort(),
    ownBoardAfter: boardKey(ownEnd.board),
    enemyBoardAfter: boardKey(enemyEnd.board),
    matchOutcome,
    ownMatchDefeat,
    enemyMatchDefeat,
    ownTroopsDefeated,
    enemyTroopsDefeated,
    anyDefeatOccurred: ownMatchDefeat || enemyMatchDefeat || ownTroopsDefeated > 0 || enemyTroopsDefeated > 0,
    matchDefeatScore,
    troopDefeatNet,
    // Prioritizes match victory/defeat in this round, then net troop defeats.
    defeatScore: 10 * matchDefeatScore + troopDefeatNet,
  };
}

// Compares candidate `a` (typically a tribute summon) against baseline `b`
// (typically a non-tribute action) across the four public axes:
// Base orbs, living troops, remaining hand, and defeat.
export function compareOutcomes(a, b) {
  const axes = {
    baseOrbs: sign(a.netBaseOrbs - b.netBaseOrbs),
    livingTroops: sign(a.netLivingTroops - b.netLivingTroops),
    remainingHand: sign(a.ownRemainingHand - b.ownRemainingHand),
    defeat: sign(a.defeatScore - b.defeatScore),
  };
  const values = Object.values(axes);
  const wins = values.filter((v) => v > 0).length;
  const losses = values.filter((v) => v < 0).length;
  const relation =
    wins > 0 && losses > 0
      ? "tradeoff"
      : wins > 0
        ? "tributeDominates"
        : losses > 0
          ? "nonTributeDominates"
          : "exactTie";

  // Combat/board-only check (excluding remainingHand, since holding always saves 1 card over summoning).
  const combatValues = [axes.baseOrbs, axes.livingTroops, axes.defeat];
  const combatWins = combatValues.filter((v) => v > 0).length;
  const combatLosses = combatValues.filter((v) => v < 0).length;
  const combatRelation =
    combatWins > 0 && combatLosses > 0
      ? "tradeoff"
      : combatWins > 0
        ? "tributeDominates"
        : combatLosses > 0
          ? "nonTributeDominates"
          : "exactTie";

  // Base-race split: takes more own Base damage while dealing more enemy Base damage (or vice versa).
  const ownBaseSign = sign(a.ownBaseOrbs - b.ownBaseOrbs);
  const enemyDamageSign = sign(b.enemyBaseOrbs - a.enemyBaseOrbs);
  const baseRaceTradeoff = (ownBaseSign > 0 && enemyDamageSign < 0) || (ownBaseSign < 0 && enemyDamageSign > 0);

  return {
    axes,
    wins,
    losses,
    relation,
    combatRelation,
    cardForTempoOnly: combatWins > 0 && combatLosses === 0 && axes.remainingHand < 0,
    baseRaceTradeoff,
    preventedOwnMatchDefeat: !a.ownMatchDefeat && b.ownMatchDefeat,
    dealtEnemyMatchDefeat: a.enemyMatchDefeat && !b.enemyMatchDefeat,
    causedOwnMatchDefeat: a.ownMatchDefeat && !b.ownMatchDefeat,
  };
}

// Evaluates all distinct legal action groups from one frozen public decision state.
export function evaluateDecision(frozenState, bots, side = PLAYER_SIDE) {
  const snapshot = structuredClone(frozenState);
  const view = publicState(frozenState, side);
  const grouped = groupLegalActions(view);
  if (!grouped.eligible) {
    assert.deepEqual(frozenState, snapshot, "ineligible check mutated state");
    return null;
  }

  const chosenRaw = bots[side](publicState(frozenState, side));
  const chosenKey = actionMeaningKey(view, chosenRaw);

  const branches = grouped.groups.map((group) => {
    const rep = group.representative;
    const sacrificedTroops =
      rep.type === "summon" ? rep.tributes.map((slot) => view.sides[side].board[slot]) : [];
    const sacrificesDamaged = sacrificedTroops.some((t) => t.health < CARDS[t.cardId].health);
    const sacrificesOneHp = sacrificedTroops.some((t) => t.health === 1);
    return {
      key: group.key,
      category: group.category,
      isTribute: group.isTribute,
      tributeCost: group.tributeCost,
      cardName: group.cardName,
      rawCount: group.rawCount,
      sacrificesDamaged,
      sacrificesOneHp,
      chosenByBot: group.key === chosenKey,
      outcome: finishRound(frozenState, rep, bots),
    };
  });

  assert.deepEqual(frozenState, snapshot, "evaluateDecision mutated frozenState");

  const tributes = branches.filter((b) => b.isTribute);
  const nonTributes = branches.filter((b) => !b.isTribute);
  const holdBranch = nonTributes.find((b) => b.category === "hold");

  const anyTributeUndominated4Axis = tributes.some(
    (t) => !nonTributes.some((n) => compareOutcomes(t.outcome, n.outcome).relation === "nonTributeDominates"),
  );
  const allTributesDominated4Axis = tributes.every((t) =>
    nonTributes.some((n) => compareOutcomes(t.outcome, n.outcome).relation === "nonTributeDominates"),
  );
  const anyTributeBeatsAllNonTributesOnCombat = tributes.some((t) =>
    nonTributes.every((n) => compareOutcomes(t.outcome, n.outcome).combatRelation === "tributeDominates"),
  );
  const allTributesDominatedOnCombat = tributes.every((t) =>
    nonTributes.some((n) => compareOutcomes(t.outcome, n.outcome).combatRelation === "nonTributeDominates"),
  );
  const anyTributeBeatsHoldOnBase = tributes.some((t) => t.outcome.netBaseOrbs > holdBranch.outcome.netBaseOrbs);
  const anyTributeSavesLethalVsHold = tributes.some((t) => !t.outcome.ownMatchDefeat && holdBranch.outcome.ownMatchDefeat);
  const anyTributeDealsLethalVsHold = tributes.some((t) => t.outcome.enemyMatchDefeat && !holdBranch.outcome.enemyMatchDefeat);

  const chosenBranch = branches.find((b) => b.chosenByBot);
  const bestNonTributeBase = Math.max(...nonTributes.map((n) => n.outcome.netBaseOrbs));
  const bestAnyBase = Math.max(...branches.map((b) => b.outcome.netBaseOrbs));
  const bestTributeBase = Math.max(...tributes.map((t) => t.outcome.netBaseOrbs));

  return {
    round: view.round,
    startingSide: view.startingSide,
    actingFirstInRound: view.startingSide === side,
    positionKey: publicPositionKey(view),
    ownBaseBefore: view.sides[side].baseOrbs,
    enemyBaseBefore: view.sides[opponent(side)].baseOrbs,
    ownBoardBefore: boardKey(view.sides[side].board),
    enemyBoardBefore: boardKey(view.sides[opponent(side)].board),
    ownHandBefore: view.sides[side].hand.map((id) => CARDS[id].name),
    enemyHandCountBefore: view.sides[opponent(side)].handCount,
    rawLegalActions: grouped.rawCount,
    distinctActionGroups: branches.length,
    duplicateActionsCollapsed: grouped.rawCount - branches.length,
    hasFreeSummonOption: nonTributes.some((n) => n.category === "free-summon"),
    hasSpellOption: nonTributes.some((n) => n.category === "spell"),
    has1TributeOption: tributes.some((t) => t.tributeCost === 1),
    has2TributeOption: tributes.some((t) => t.tributeCost === 2),
    chosenCategory: chosenBranch.category,
    chosenKey,
    chosenIsTribute: chosenBranch.isTribute,
    chosenTributeRegretVsNonTributeOnBase: chosenBranch.isTribute ? chosenBranch.outcome.netBaseOrbs < bestNonTributeBase : false,
    chosenTributeRegretVsAnyOnBase: chosenBranch.isTribute ? chosenBranch.outcome.netBaseOrbs < bestAnyBase : false,
    missedTributeGainOnBase: !chosenBranch.isTribute ? bestTributeBase > chosenBranch.outcome.netBaseOrbs : false,
    anyTributeUndominated4Axis,
    allTributesDominated4Axis,
    anyTributeBeatsAllNonTributesOnCombat,
    allTributesDominatedOnCombat,
    anyTributeBeatsHoldOnBase,
    anyTributeSavesLethalVsHold,
    anyTributeDealsLethalVsHold,
    branches,
  };
}

function makePairBucket() {
  return {
    pairs: 0,
    fourAxis: { tributeDominates: 0, tradeoff: 0, nonTributeDominates: 0, exactTie: 0 },
    combatThreeAxis: { tributeDominates: 0, tradeoff: 0, nonTributeDominates: 0, exactTie: 0 },
    cardForTempoOnly: 0,
    baseRaceTradeoff: 0,
    preventedOwnMatchDefeat: 0,
    dealtEnemyMatchDefeat: 0,
    causedOwnMatchDefeat: 0,
    axisBreakdown: {
      baseOrbs: { win: 0, tie: 0, loss: 0 },
      livingTroops: { win: 0, tie: 0, loss: 0 },
      remainingHand: { win: 0, tie: 0, loss: 0 },
      defeat: { win: 0, tie: 0, loss: 0 },
    },
  };
}

function recordPair(bucket, cmp) {
  bucket.pairs += 1;
  bucket.fourAxis[cmp.relation] += 1;
  bucket.combatThreeAxis[cmp.combatRelation] += 1;
  if (cmp.cardForTempoOnly) bucket.cardForTempoOnly += 1;
  if (cmp.baseRaceTradeoff) bucket.baseRaceTradeoff += 1;
  if (cmp.preventedOwnMatchDefeat) bucket.preventedOwnMatchDefeat += 1;
  if (cmp.dealtEnemyMatchDefeat) bucket.dealtEnemyMatchDefeat += 1;
  if (cmp.causedOwnMatchDefeat) bucket.causedOwnMatchDefeat += 1;
  for (const [axis, val] of Object.entries(cmp.axes)) {
    bucket.axisBreakdown[axis][val > 0 ? "win" : val < 0 ? "loss" : "tie"] += 1;
  }
}

function finalizePairBucket(bucket) {
  return {
    ...bucket,
    ratesPct: {
      fourAxisTradeoff: pct(bucket.fourAxis.tradeoff, bucket.pairs),
      fourAxisTributeDominates: pct(bucket.fourAxis.tributeDominates, bucket.pairs),
      fourAxisNonTributeDominates: pct(bucket.fourAxis.nonTributeDominates, bucket.pairs),
      combatTradeoff: pct(bucket.combatThreeAxis.tradeoff, bucket.pairs),
      combatTributeDominates: pct(bucket.combatThreeAxis.tributeDominates, bucket.pairs),
      combatNonTributeDominates: pct(bucket.combatThreeAxis.nonTributeDominates, bucket.pairs),
      cardForTempoOnly: pct(bucket.cardForTempoOnly, bucket.pairs),
    },
  };
}

function makeStratum() {
  return {
    decisionStates: 0,
    uniquePositions: new Set(),
    rawLegalActions: 0,
    distinctActionGroups: 0,
    duplicateActionsCollapsed: 0,
    statesWithFreeSummon: 0,
    statesWith1Tribute: 0,
    statesWith2Tribute: 0,
    botChoseTribute: 0,
    botChoseTribute1: 0,
    botChoseTribute2: 0,
    chosenTributeRegretVsNonTributeOnBase: 0,
    chosenTributeRegretVsAnyOnBase: 0,
    chosenTribute1RegretVsAnyOnBase: 0,
    chosenTribute2RegretVsAnyOnBase: 0,
    missedTributeGainOnBase: 0,
    anyTributeUndominated4Axis: 0,
    allTributesDominated4Axis: 0,
    anyTributeBeatsAllNonTributesOnCombat: 0,
    allTributesDominatedOnCombat: 0,
    anyTributeBeatsHoldOnBase: 0,
    anyTributeSavesLethalVsHold: 0,
    anyTributeDealsLethalVsHold: 0,
    allPairs: makePairBucket(),
    vsHold: makePairBucket(),
    vsFreeSummon: makePairBucket(),
    vsSpell: makePairBucket(),
    byTributeCost: { 1: makePairBucket(), 2: makePairBucket() },
    byTributeCostVsHold: { 1: makePairBucket(), 2: makePairBucket() },
    bySacrificeConditionVsHold: {
      damagedTroop: makePairBucket(),
      oneHpTroop: makePairBucket(),
      fullHealthOnly: makePairBucket(),
    },
    twoTributeVsOneTribute: makePairBucket(),
  };
}

function recordDecision(stratum, decision) {
  stratum.decisionStates += 1;
  stratum.uniquePositions.add(decision.positionKey);
  stratum.rawLegalActions += decision.rawLegalActions;
  stratum.distinctActionGroups += decision.distinctActionGroups;
  stratum.duplicateActionsCollapsed += decision.duplicateActionsCollapsed;
  if (decision.hasFreeSummonOption) stratum.statesWithFreeSummon += 1;
  if (decision.has1TributeOption) stratum.statesWith1Tribute += 1;
  if (decision.has2TributeOption) stratum.statesWith2Tribute += 1;
  if (decision.chosenIsTribute) stratum.botChoseTribute += 1;
  if (decision.chosenCategory === "tribute-1") stratum.botChoseTribute1 += 1;
  if (decision.chosenCategory === "tribute-2") stratum.botChoseTribute2 += 1;
  if (decision.chosenTributeRegretVsNonTributeOnBase) stratum.chosenTributeRegretVsNonTributeOnBase += 1;
  if (decision.chosenTributeRegretVsAnyOnBase) {
    stratum.chosenTributeRegretVsAnyOnBase += 1;
    if (decision.chosenCategory === "tribute-1") stratum.chosenTribute1RegretVsAnyOnBase += 1;
    if (decision.chosenCategory === "tribute-2") stratum.chosenTribute2RegretVsAnyOnBase += 1;
  }
  if (decision.missedTributeGainOnBase) stratum.missedTributeGainOnBase += 1;
  if (decision.anyTributeUndominated4Axis) stratum.anyTributeUndominated4Axis += 1;
  if (decision.allTributesDominated4Axis) stratum.allTributesDominated4Axis += 1;
  if (decision.anyTributeBeatsAllNonTributesOnCombat) stratum.anyTributeBeatsAllNonTributesOnCombat += 1;
  if (decision.allTributesDominatedOnCombat) stratum.allTributesDominatedOnCombat += 1;
  if (decision.anyTributeBeatsHoldOnBase) stratum.anyTributeBeatsHoldOnBase += 1;
  if (decision.anyTributeSavesLethalVsHold) stratum.anyTributeSavesLethalVsHold += 1;
  if (decision.anyTributeDealsLethalVsHold) stratum.anyTributeDealsLethalVsHold += 1;

  const tributes = decision.branches.filter((b) => b.isTribute);
  const nonTributes = decision.branches.filter((b) => !b.isTribute);
  for (const trib of tributes) {
    for (const nonTrib of nonTributes) {
      const cmp = compareOutcomes(trib.outcome, nonTrib.outcome);
      recordPair(stratum.allPairs, cmp);
      recordPair(stratum.byTributeCost[trib.tributeCost], cmp);
      if (nonTrib.category === "hold") {
        recordPair(stratum.vsHold, cmp);
        recordPair(stratum.byTributeCostVsHold[trib.tributeCost], cmp);
        if (trib.sacrificesDamaged) recordPair(stratum.bySacrificeConditionVsHold.damagedTroop, cmp);
        else recordPair(stratum.bySacrificeConditionVsHold.fullHealthOnly, cmp);
        if (trib.sacrificesOneHp) recordPair(stratum.bySacrificeConditionVsHold.oneHpTroop, cmp);
      } else if (nonTrib.category === "free-summon") {
        recordPair(stratum.vsFreeSummon, cmp);
      } else if (nonTrib.category === "spell") {
        recordPair(stratum.vsSpell, cmp);
      }
    }
  }
  const trib1 = tributes.filter((b) => b.tributeCost === 1);
  const trib2 = tributes.filter((b) => b.tributeCost === 2);
  for (const t2 of trib2) {
    for (const t1 of trib1) {
      recordPair(stratum.twoTributeVsOneTribute, compareOutcomes(t2.outcome, t1.outcome));
    }
  }
}

function finalizeStratum(stratum) {
  const { uniquePositions, ...rest } = stratum;
  const n = stratum.decisionStates;
  return {
    ...rest,
    uniquePublicPositions: uniquePositions.size,
    stateRatesPct: {
      duplicateActionReduction: pct(stratum.duplicateActionsCollapsed, stratum.rawLegalActions),
      botChoseTribute: pct(stratum.botChoseTribute, n),
      chosenTributeRegretVsNonTributeAmongChosen: pct(stratum.chosenTributeRegretVsNonTributeOnBase, stratum.botChoseTribute),
      chosenTributeRegretVsAnyAmongChosen: pct(stratum.chosenTributeRegretVsAnyOnBase, stratum.botChoseTribute),
      anyTributeBeatsHoldOnBase: pct(stratum.anyTributeBeatsHoldOnBase, n),
      anyTributeBeatsAllNonTributesOnCombat: pct(stratum.anyTributeBeatsAllNonTributesOnCombat, n),
      allTributesDominatedOnCombat: pct(stratum.allTributesDominatedOnCombat, n),
      anyTributeSavesLethalVsHold: pct(stratum.anyTributeSavesLethalVsHold, n),
      anyTributeDealsLethalVsHold: pct(stratum.anyTributeDealsLethalVsHold, n),
    },
    allPairs: finalizePairBucket(stratum.allPairs),
    vsHold: finalizePairBucket(stratum.vsHold),
    vsFreeSummon: finalizePairBucket(stratum.vsFreeSummon),
    vsSpell: finalizePairBucket(stratum.vsSpell),
    byTributeCost: {
      1: finalizePairBucket(stratum.byTributeCost[1]),
      2: finalizePairBucket(stratum.byTributeCost[2]),
    },
    byTributeCostVsHold: {
      1: finalizePairBucket(stratum.byTributeCostVsHold[1]),
      2: finalizePairBucket(stratum.byTributeCostVsHold[2]),
    },
    bySacrificeConditionVsHold: {
      damagedTroop: finalizePairBucket(stratum.bySacrificeConditionVsHold.damagedTroop),
      oneHpTroop: finalizePairBucket(stratum.bySacrificeConditionVsHold.oneHpTroop),
      fullHealthOnly: finalizePairBucket(stratum.bySacrificeConditionVsHold.fullHealthOnly),
    },
    twoTributeVsOneTribute: finalizePairBucket(stratum.twoTributeVsOneTribute),
  };
}

function compactDecision(decision) {
  return {
    round: decision.round,
    actingFirstInRound: decision.actingFirstInRound,
    baseBefore: `${decision.ownBaseBefore}-${decision.enemyBaseBefore}`,
    ownBoardBefore: decision.ownBoardBefore,
    enemyBoardBefore: decision.enemyBoardBefore,
    ownHandBefore: decision.ownHandBefore,
    rawLegalActions: decision.rawLegalActions,
    distinctActionGroups: decision.distinctActionGroups,
    chosenKey: decision.chosenKey,
    branches: decision.branches.map((b) => ({
      key: b.key,
      category: b.category,
      rawCount: b.rawCount,
      chosenByBot: b.chosenByBot,
      baseAfter: `${b.outcome.ownBaseOrbs}-${b.outcome.enemyBaseOrbs}`,
      netBaseOrbs: b.outcome.netBaseOrbs,
      livingTroops: `${b.outcome.ownLivingTroops}-${b.outcome.enemyLivingTroops}`,
      ownBoardAfter: b.outcome.ownBoardAfter,
      enemyBoardAfter: b.outcome.enemyBoardAfter,
      ownRemainingHand: b.outcome.ownRemainingHand,
      troopDefeats: `${b.outcome.ownTroopsDefeated}-${b.outcome.enemyTroopsDefeated}`,
      matchOutcome: b.outcome.matchOutcome,
    })),
  };
}

// Runs one single-seed trace for reproducible examples (such as seed 60).
export function inspectSeed(seed, { cowboy = "normal", wizard = "normal", firstSeat, compact = false } = {}) {
  const bots = { cowboy: cpuFor(cowboy), wizard: cpuFor(wizard) };
  const seats = firstSeat ? [firstSeat] : SIDES;
  const natural = createMatch(seed).startingSide;
  const runs = [];
  for (const starter of seats) {
    let state = openingMatch(seed, "shipped", starter);
    const decisions = [];
    let steps = 0;
    while (!state.result) {
      if (steps >= MAX_STEPS) throw new Error(`seed ${seed}: exceeded ${MAX_STEPS} steps`);
      if (state.activeSide === PLAYER_SIDE) {
        const evaluated = evaluateDecision(state, bots, PLAYER_SIDE);
        if (evaluated) decisions.push(compact ? compactDecision(evaluated) : evaluated);
      }
      const actor = state.activeSide;
      const applied = applyAction(state, bots[actor](publicState(state, actor)));
      if (!applied.ok) throw new Error(`seed ${seed}: ${actor} action rejected (${applied.reason})`);
      state = applied.state;
      steps += 1;
    }
    runs.push({
      seed,
      firstSeat: starter,
      naturalFirstSeat: starter === natural,
      result: state.result,
      totalActions: steps,
      decisions,
    });
  }
  return runs;
}

export function auditTributeChoices({ from, count, cowboy = "normal", wizard = "normal", exampleSeed = 60 }) {
  const bots = { cowboy: cpuFor(cowboy), wizard: cpuFor(wizard) };
  const overall = makeStratum();
  const byFirstSeat = { cowboy: makeStratum(), wizard: makeStratum() };
  const byRoundOrder = { actingFirstInRound: makeStratum(), actingSecondInRound: makeStratum() };
  const matchResults = {
    matches: 0,
    cowboyWins: 0,
    wizardWins: 0,
    draws: 0,
    matchesWithTributeDecision: 0,
    byFirstSeat: {
      cowboy: { matches: 0, cowboyWins: 0, wizardWins: 0, draws: 0, matchesWithTributeDecision: 0 },
      wizard: { matches: 0, cowboyWins: 0, wizardWins: 0, draws: 0, matchesWithTributeDecision: 0 },
    },
  };
  let naturalReplayChecked = 0;

  for (let seed = from; seed < from + count; seed++) {
    const natural = createMatch(seed).startingSide;
    for (const firstSeat of SIDES) {
      let state = openingMatch(seed, "shipped", firstSeat);
      assertConserved(state, `seed ${seed} ${firstSeat} opening`);
      let steps = 0;
      let sawDecision = false;

      while (!state.result) {
        if (steps >= MAX_STEPS) throw new Error(`seed ${seed} (${firstSeat} first): exceeded ${MAX_STEPS} steps`);
        if (state.activeSide === PLAYER_SIDE) {
          const decision = evaluateDecision(state, bots, PLAYER_SIDE);
          if (decision) {
            sawDecision = true;
            recordDecision(overall, decision);
            recordDecision(byFirstSeat[firstSeat], decision);
            recordDecision(
              byRoundOrder[decision.actingFirstInRound ? "actingFirstInRound" : "actingSecondInRound"],
              decision,
            );
          }
        }
        const actor = state.activeSide;
        const action = bots[actor](publicState(state, actor));
        const applied = applyAction(state, action);
        if (!applied.ok) throw new Error(`seed ${seed}: ${actor} bot rejected (${applied.reason})`);
        state = applied.state;
        assertConserved(state, `seed ${seed} ${firstSeat} step ${steps}`);
        steps += 1;
      }

      if (firstSeat === natural) {
        assert.deepEqual(state, playMatch(seed, bots).state, `seed ${seed}: natural run differs from playMatch`);
        naturalReplayChecked += 1;
      }

      const winner = state.result.winner;
      const seatStats = matchResults.byFirstSeat[firstSeat];
      matchResults.matches += 1;
      seatStats.matches += 1;
      if (sawDecision) {
        matchResults.matchesWithTributeDecision += 1;
        seatStats.matchesWithTributeDecision += 1;
      }
      if (winner === "cowboy") {
        matchResults.cowboyWins += 1;
        seatStats.cowboyWins += 1;
      } else if (winner === "wizard") {
        matchResults.wizardWins += 1;
        seatStats.wizardWins += 1;
      } else {
        matchResults.draws += 1;
        seatStats.draws += 1;
      }
    }
  }

  return {
    rulesVersion: RULES_VERSION,
    playerSide: PLAYER_SIDE,
    bots: { cowboy, wizard },
    sample: {
      from,
      to: from + count - 1,
      seedCount: count,
      startsPerSeed: SIDES,
      matches: matchResults.matches,
      stepBound: MAX_STEPS,
    },
    checks: {
      cardConservationAfterEveryStep: "passed",
      frozenStateImmutability: "passed",
      publicViewOnlyBots: "passed",
      naturalSeatMatchesEqualPlayMatch: naturalReplayChecked,
    },
    matchResults,
    overall: finalizeStratum(overall),
    byFirstSeat: {
      cowboy: finalizeStratum(byFirstSeat.cowboy),
      wizard: finalizeStratum(byFirstSeat.wizard),
    },
    byRoundOrder: {
      actingFirstInRound: finalizeStratum(byRoundOrder.actingFirstInRound),
      actingSecondInRound: finalizeStratum(byRoundOrder.actingSecondInRound),
    },
    exampleSeed: inspectSeed(exampleSeed, { cowboy, wizard, compact: true }),
  };
}

function summaryLines(report) {
  const { sample, bots, matchResults, overall, byFirstSeat, byRoundOrder } = report;
  const line = (label, s) =>
    `${label.padEnd(20)} states=${s.decisionStates} (uniq=${s.uniquePublicPositions})  ` +
    `actions=${s.distinctActionGroups}/${s.rawLegalActions} (-${s.stateRatesPct.duplicateActionReduction}%)  ` +
    `botTrib=${s.botChoseTribute} (regretAny=${s.chosenTributeRegretVsAnyOnBase})  ` +
    `vsHold[4axTrade=${s.vsHold.ratesPct.fourAxisTradeoff}% cbtWin=${s.vsHold.ratesPct.combatTributeDominates}% cbtTrade=${s.vsHold.ratesPct.combatTradeoff}% cbtLose=${s.vsHold.ratesPct.combatNonTributeDominates}%]  ` +
    `vsFree[cbtWin=${s.vsFreeSummon.ratesPct.combatTributeDominates}% cbtTrade=${s.vsFreeSummon.ratesPct.combatTradeoff}% cbtLose=${s.vsFreeSummon.ratesPct.combatNonTributeDominates}%]`;
  return [
    `seeds ${sample.from}-${sample.to} (${sample.seedCount} seeds x 2 first seats = ${sample.matches} matches)  rules ${report.rulesVersion}  cowboy=${bots.cowboy} wizard=${bots.wizard}`,
    `matches: cowboy ${matchResults.cowboyWins}, wizard ${matchResults.wizardWins}, draws ${matchResults.draws}; with >=1 tribute decision: ${matchResults.matchesWithTributeDecision}/${matchResults.matches}`,
    line("overall", overall),
    line("firstSeat=cowboy", byFirstSeat.cowboy),
    line("firstSeat=wizard", byFirstSeat.wizard),
    line("firstInRound", byRoundOrder.actingFirstInRound),
    line("secondInRound", byRoundOrder.actingSecondInRound),
    `byCost vsHold: 1-trib pairs=${overall.byTributeCostVsHold[1].pairs} [cbtWin=${overall.byTributeCostVsHold[1].ratesPct.combatTributeDominates}% cbtTrade=${overall.byTributeCostVsHold[1].ratesPct.combatTradeoff}% cbtLose=${overall.byTributeCostVsHold[1].ratesPct.combatNonTributeDominates}%] | ` +
      `2-trib pairs=${overall.byTributeCostVsHold[2].pairs} [cbtWin=${overall.byTributeCostVsHold[2].ratesPct.combatTributeDominates}% cbtTrade=${overall.byTributeCostVsHold[2].ratesPct.combatTradeoff}% cbtLose=${overall.byTributeCostVsHold[2].ratesPct.combatNonTributeDominates}%]`,
  ];
}

if (import.meta.main) {
  const usage =
    `usage: node scripts/audit-tribute-choices.mjs [--from <integer >= 0>] [--count <1-${MAX_COUNT}>] ` +
    `[--wizard ${AUDIT_LEVELS.join("|")}] [--cowboy ${AUDIT_LEVELS.join("|")}] [--example-seed <integer >= 0>] [--out <file>]`;
  let values;
  try {
    ({ values } = parseArgs({
      options: {
        from: { type: "string", default: "0" },
        count: { type: "string", default: "1000" },
        wizard: { type: "string", default: "normal" },
        cowboy: { type: "string", default: "normal" },
        "example-seed": { type: "string", default: "60" },
        out: { type: "string" },
      },
    }));
  } catch (error) {
    console.error(`${error.message}\n${usage}`);
    process.exit(2);
  }

  const from = wholeNumber(values.from);
  const count = wholeNumber(values.count);
  const exampleSeed = wholeNumber(values["example-seed"]);
  if (
    from === null ||
    count === null ||
    exampleSeed === null ||
    count < 1 ||
    count > MAX_COUNT ||
    !Number.isSafeInteger(from + count) ||
    !AUDIT_LEVELS.includes(values.wizard) ||
    !AUDIT_LEVELS.includes(values.cowboy)
  ) {
    console.error(usage);
    process.exit(2);
  }

  const report = auditTributeChoices({
    from,
    count,
    cowboy: values.cowboy,
    wizard: values.wizard,
    exampleSeed,
  });
  console.log(summaryLines(report).join("\n"));
  if (values.out) {
    mkdirSync(path.dirname(values.out), { recursive: true });
    writeFileSync(values.out, JSON.stringify(report, null, 2) + "\n");
    console.log(`report written to ${values.out}`);
  }
}
