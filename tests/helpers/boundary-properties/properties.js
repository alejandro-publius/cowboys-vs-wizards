// The boundary properties. Each entry names the acceptance criteria it checks
// (R<requirement>.<criterion> in .kiro/specs/orb-duel/requirements.md), the
// boundary categories its generator must exercise, and a run(rng, index)
// that throws a Violation on failure and returns the categories it reached.
import { CARDS, DECKS, SIDES, opponent, tributeCost } from "../../../src/game/cards.js";
import { COWBOY_CATALOG, DECK_SIZE, deckIds, validateDeck, validateDeckIds } from "../../../src/game/deck-builder.js";
import { createMatch, MAX_ROUNDS } from "../../../src/game/state.js";
import { applyAction } from "../../../src/game/actions.js";
import { legalActions } from "../../../src/game/legal.js";
import { publicState } from "../../../src/game/view.js";
import { CPU_LEVELS, cpuFor } from "../../../src/game/cpu.js";
import { BOUNDARY_COMPOSITIONS, boundaryTags, buildFixtureWith, emptySlots, occupiedSlots, reachableState } from "./generate.js";
import { Violation, assertRejected, checkAccepted, checkState, expectedOf, need, zoneIds } from "./invariants.js";
import { invalidActionCases } from "./mutations.js";
import { caseRng } from "./rng.js";

const MAX_STEPS = MAX_ROUNDS * SIDES.length * 3 * 2; // generous: constructed starts may hold extra cards
const isTroop = (id) => CARDS[id].kind === "troop";
const isSpell = (id) => CARDS[id].kind === "spell";
const json = JSON.stringify;
const sameJson = (a, b) => json(a) === json(b);
const sortedIds = (ids) => [...ids].sort();
const stamp = (action, label) => ({ ...action, actionId: label });

function combinations(items, size) {
  if (size === 0) return [[]];
  return items.flatMap((item, i) => combinations(items.slice(i + 1), size - 1).map((rest) => [item, ...rest]));
}

function randomWalk(rng, state, expected, label, apply) {
  let steps = 0;
  while (!state.result) {
    need(steps < MAX_STEPS, "termination", () => `${label}: no result after ${MAX_STEPS} actions`);
    const side = state.activeSide;
    const legal = legalActions(state, side);
    need(legal.length > 0 && legalActions(state, opponent(side)).length === 0, "legal-actions", () => `${label}: step ${steps} legal list`);
    const action = stamp(rng.pick(legal), `w-${steps}`);
    const beforeJson = json(state);
    const result = apply(state, action);
    checkAccepted(state, beforeJson, action, result, `${label} step ${steps}`);
    checkState(result.state, expected, `${label} step ${steps}`);
    state = result.state;
    steps += 1;
  }
  return { state, steps };
}

// ---------------------------------------------------------------- BP-DECK
function runDeck(rng, index, { apply = applyAction } = {}) {
  const counts = BOUNDARY_COMPOSITIONS[index];
  const tags = new Set(boundaryTags(counts));
  if (tags.size === 2) tags.add("sheriff-minimum-and-copy-cap");
  const ids = deckIds(counts);
  need(validateDeck(counts).ok && validateDeckIds(ids).ok, "deck-valid", () => `${json(counts)} should be a valid deck`);

  const state = createMatch(rng.int(100000), { cowboyDeck: ids });
  need(state.sides.cowboy.hand.length === 4 && state.sides.cowboy.deck.length === 8, "setup", () => "opening deal");
  need(sameJson(sortedIds(zoneIds(state.sides.wizard)), sortedIds(DECKS.wizard)), "setup", () => "wizard deck changed");
  need(sameJson(sortedIds(zoneIds(state.sides.cowboy)), sortedIds(ids)), "conservation", () => "cowboy deck changed");
  const expected = expectedOf(state);
  checkState(state, expected, "custom deck setup");
  randomWalk(rng, state, expected, `deck ${COWBOY_CATALOG.map(({ type }) => counts[type]).join("/")}`, apply);
  tags.add("custom-deck-played-to-result");

  // One step outside each boundary must be refused by both validators and by createMatch.
  const refuse = (tag, list) => {
    const result = validateDeckIds(list);
    need(result.ok === false, "deck-boundary", () => `${tag}: ${json(list)} accepted`);
    let threw = false;
    try { createMatch(1, { cowboyDeck: list }); } catch (error) { threw = error instanceof TypeError; }
    need(threw, "deck-boundary", () => `${tag}: createMatch built a match`);
    tags.add(tag);
  };
  const types = COWBOY_CATALOG.map(({ type }) => type);
  refuse("outside:eleven-cards", ids.slice(1));
  const underCap = types.find((type) => counts[type] < 6);
  refuse("outside:thirteen-cards", [...ids, `${underCap}-${counts[underCap] + 1}`]);
  refuse("outside:duplicate-id", [...ids.slice(1), ids[0] === ids[1] ? ids[2] : ids[1]]);
  refuse("outside:foreign-card", [...ids.slice(1), DECKS.wizard[0]]);
  const capped = types.find((type) => counts[type] === 6);
  if (capped) refuse("outside:seventh-copy", [...ids.filter((id) => id !== ids.find((each) => !each.startsWith(capped))), `${capped}-7`]);
  if (counts["cowboy-sheriff"] === 1) {
    const swapTo = types.find((type) => type !== "cowboy-sheriff" && counts[type] < 6);
    refuse("outside:no-sheriff", [...ids.filter((id) => id !== "cowboy-sheriff-1"), `${swapTo}-${counts[swapTo] + 1}`]);
    const noSheriff = { ...counts, "cowboy-sheriff": 0, [swapTo]: counts[swapTo] + 1 };
    need(validateDeck(noSheriff).ok === false, "deck-boundary", () => "validateDeck accepted zero Sheriffs");
  }
  return [...tags];
}

// ---------------------------------------------------------------- BP-TRIBUTE
function runTribute(rng, index, { apply = applyAction } = {}) {
  const side = SIDES[index % 2];
  const mode = Math.floor(index / 2) % 3; // tribute cost 1, 2, or none held
  const test = (id) => isTroop(id) && (mode === 2 ? tributeCost(CARDS[id].stars) === 0 : tributeCost(CARDS[id].stars) === mode + 1);
  const { state } = buildFixtureWith(rng, { active: side, fresh: true, boardSize: (each) => (each === side ? 3 : rng.int(4)), mustHold: { side, test } });
  const expected = expectedOf(state);
  const tags = new Set([`full-board:${side}`]);
  const own = state.sides[side];
  need(own.board.every(Boolean), "fixture", () => "board should be full");

  // Independent enumeration of the summons a full board allows: every
  // tribute set of the card's size, landing only in a slot that set vacates.
  const wanted = new Set();
  for (const cardId of own.hand.filter(isTroop)) {
    const cost = tributeCost(CARDS[cardId].stars);
    for (const tributes of combinations([0, 1, 2], cost)) for (const slot of tributes) wanted.add(`${cardId}|${tributes}|${slot}`);
  }
  const listed = legalActions(state, side).filter((action) => action.type === "summon").map((a) => `${a.cardId}|${a.tributes}|${a.slot}`);
  need(sameJson([...wanted].sort(), listed.sort()), "legal-summons", () => `legal summons differ from the enumeration: ${[...wanted].length} vs ${listed.length}`);

  for (const cardId of own.hand.filter(isTroop)) {
    const cost = tributeCost(CARDS[cardId].stars);
    for (const tributes of combinations([0, 1, 2], cost)) {
      for (const slot of [0, 1, 2]) {
        const action = { type: "summon", side, revision: state.revision, actionId: "tr-1", cardId, slot, tributes };
        if (!tributes.includes(slot)) {
          assertRejected(apply, state, action, "slot-occupied", `${cardId} slot ${slot}`);
          tags.add(cost === 0 ? "zero-cost-blocked-on-full-board" : "non-vacated-slot-rejected");
          continue;
        }
        const beforeJson = json(state);
        const result = apply(state, action);
        checkAccepted(state, beforeJson, action, result, `${cardId} tributes ${tributes} slot ${slot}`);
        const after = result.state.sides[side];
        need(sameJson(after.board[slot], { cardId, health: CARDS[cardId].health }), "tribute-landing", () => "summoned troop is not at full health in the vacated slot");
        for (const other of [0, 1, 2]) {
          if (other !== slot) need(sameJson(after.board[other], tributes.includes(other) ? null : own.board[other]), "tribute-board", () => `slot ${other}`);
        }
        need(sameJson(after.discard, [...own.discard, ...tributes.map((t) => own.board[t].cardId)]), "tribute-discard", () => "each tribute must reach the discard exactly once");
        need(sameJson(after.hand, own.hand.filter((id) => id !== cardId)), "tribute-hand", () => "hand");
        need(sameJson(result.state.sides[opponent(side)], state.sides[opponent(side)]), "tribute-enemy", () => "enemy side changed");
        need(result.state.allowances[side].summonUsed === true && result.state.allowances[side].castUsed === state.allowances[side].castUsed, "tribute-allowance", () => "allowances");
        need(result.events.filter((e) => e.type === "summon").length === 1 && result.events.length === 1, "tribute-events", () => "events");
        checkState(result.state, expected, `${cardId} summon`);
        tags.add(`cost-${cost}-into-vacated-slot`);
      }
    }
  }
  if (state.sides[opponent(side)].board.every(Boolean)) tags.add("both-boards-full");
  return [...tags];
}

// ---------------------------------------------------------------- BP-REJECT
function runReject(rng, index, { apply = applyAction } = {}) {
  const made = index % 2 === 0 ? buildFixtureWith(rng, {}) : reachableState(rng);
  const { state, kind } = made;
  if (state.result) return [];
  const tags = new Set([`state:${kind}`]);
  const pristine = structuredClone(state);
  const cases = invalidActionCases(state, rng);
  for (const { category, reason, action, state: caseState } of cases) {
    assertRejected(apply, caseState, action, reason, category);
    tags.add(`reject:${category}`);
  }
  // Rejections left no trace: the next legal action behaves as it does on an untouched copy.
  const legal = stamp(rng.pick(legalActions(state, state.activeSide)), "after-rejections");
  need(sameJson(apply(state, legal), apply(pristine, legal)), "atomicity", () => "state differs after rejected actions");
  tags.add("rejections-leave-no-trace");
  return [...tags];
}

// ---------------------------------------------------------------- BP-SPELL
function spellOracle(state, side, cardId, target, destination) {
  const troop = state.sides[opponent(side)].board[target];
  if (!troop) return "invalid-target";
  if (destination == null) return null;
  const board = state.sides[opponent(side)].board;
  const ok = CARDS[cardId].relocates && troop.health > 1 && Math.abs(destination - target) === 1 && destination >= 0 && destination <= 2 && board[destination] === null;
  return ok ? null : "invalid-destination";
}

function runSpell(rng, index, { apply = applyAction } = {}) {
  const side = SIDES[index % 2];
  const { state } = buildFixtureWith(rng, { active: side, mustHold: { side, test: isSpell }, boardSize: (each) => (each === side ? rng.int(4) : 1 + rng.int(3)) });
  state.allowances[side].castUsed = false;
  const enemyBoard = state.sides[opponent(side)].board;
  const live = occupiedSlots(enemyBoard);
  if (live.length > 0 && rng.chance(0.7)) enemyBoard[rng.pick(live)].health = 1;
  const expected = expectedOf(state);
  checkState(state, expected, "spell fixture");
  const tags = new Set([occupiedSlots(state.sides[side].board).length === 0 ? "caster-board-empty" : "caster-board-occupied"]);
  const own = state.sides[side];
  const enemy = state.sides[opponent(side)];

  for (const cardId of own.hand.filter(isSpell)) {
    for (const target of [0, 1, 2]) {
      for (const destination of [undefined, -1, 0, 1, 2, 3]) {
        const action = { type: "spell", side, revision: state.revision, actionId: "sp-1", cardId, target, ...(destination === undefined ? {} : { destination }) };
        const label = `${cardId} target ${target} destination ${destination}`;
        const reason = spellOracle(state, side, cardId, target, destination);
        if (reason) {
          assertRejected(apply, state, action, reason, label);
          tags.add(reason === "invalid-target" ? "spell-without-target-rejected" : enemyBoard[target].health === 1 ? "one-orb-target-with-destination-rejected" : "bad-destination-rejected");
          continue;
        }
        const beforeJson = json(state);
        const result = apply(state, action);
        checkAccepted(state, beforeJson, action, result, label);
        const troop = enemyBoard[target];
        const after = result.state.sides[opponent(side)];
        const survives = troop.health > 1;
        need(sameJson(result.state.sides[side].hand, own.hand.filter((id) => id !== cardId)), "spell-hand", () => "spell must leave the hand");
        need(sameJson(result.state.sides[side].discard, [...own.discard, cardId]), "spell-discard", () => "spell must reach the discard once");
        need(sameJson(result.state.sides[side].board, own.board), "spell-caster-board", () => "caster board changed");
        need(result.state.allowances[side].castUsed === true && result.state.allowances[side].summonUsed === state.allowances[side].summonUsed, "spell-allowance", () => "allowances");
        const spellEvent = result.events.find((e) => e.type === "spell");
        need(spellEvent.before === troop.health && spellEvent.after === troop.health - 1, "spell-damage", () => "exactly one orb");
        if (!survives) {
          need(after.board[target] === null && sameJson(after.discard, [...enemy.discard, troop.cardId]), "spell-defeat", () => "defeated target must reach the discard once");
          need(result.events.filter((e) => e.type === "defeat").length === 1, "spell-defeat", () => "one defeat event");
          tags.add(CARDS[cardId].relocates ? "one-orb-target-singularity-kill" : "one-orb-target-deadeye-kill");
        } else {
          const landed = destination ?? target;
          need(sameJson(after.board[landed], { cardId: troop.cardId, health: troop.health - 1 }), "spell-survivor", () => "survivor health or place");
          need(sameJson(after.discard, enemy.discard) && result.events.every((e) => e.type !== "defeat"), "spell-survivor", () => "unexpected defeat");
          tags.add(destination === undefined ? "two-plus-orb-target-chipped" : "survivor-relocated-to-adjacent-empty-slot");
        }
        for (const slot of [0, 1, 2]) {
          if (slot !== target && slot !== destination) need(sameJson(after.board[slot], enemy.board[slot]), "spell-bystander", () => `slot ${slot} changed`);
        }
        checkState(result.state, expected, label);
        // R8.6 / R6.2: the second cast of the round is refused.
        const second = own.hand.find((id) => isSpell(id) && id !== cardId);
        if (second && live.length > 1) {
          const another = result.state.sides[opponent(side)].board.findIndex(Boolean);
          if (another >= 0) {
            assertRejected(apply, result.state, { type: "spell", side, revision: result.state.revision, cardId: second, target: another }, "cast-used", "second cast");
            tags.add("second-cast-rejected");
          }
        }
      }
    }
  }
  return [...tags];
}

// ---------------------------------------------------------------- BP-CLASH
// Order-independent oracle: sum what each target takes, then clamp once.
function clashOracle(state) {
  const incoming = Object.fromEntries(SIDES.map((side) => [side, { troop: [0, 0, 0], base: 0 }]));
  const attacks = [];
  for (let lane = 0; lane < 3; lane++) {
    for (const side of SIDES) {
      const troop = state.sides[side].board[lane];
      if (!troop) continue;
      const amount = CARDS[troop.cardId].attack;
      const target = opponent(side);
      attacks.push({ lane, side, cardId: troop.cardId, amount });
      if (state.sides[target].board[lane]) incoming[target].troop[lane] += amount;
      else incoming[target].base += amount;
    }
  }
  const out = { attacks, incoming, sides: {}, defeated: [] };
  for (const side of SIDES) {
    const zone = state.sides[side];
    const board = zone.board.map((troop, lane) => {
      if (!troop) return null;
      const health = Math.max(0, troop.health - incoming[side].troop[lane]);
      if (health === 0) out.defeated.push({ side, lane, cardId: troop.cardId });
      return health === 0 ? null : { cardId: troop.cardId, health };
    });
    out.sides[side] = { board, baseOrbs: Math.max(0, zone.baseOrbs - incoming[side].base) };
  }
  const [a, b] = SIDES;
  const orbs = { [a]: out.sides[a].baseOrbs, [b]: out.sides[b].baseOrbs };
  const down = orbs[a] === 0 || orbs[b] === 0;
  if (down || state.round === MAX_ROUNDS) {
    const reason = down ? "base-destroyed" : "round-limit";
    const winner = orbs[a] === orbs[b] ? null : orbs[a] > orbs[b] ? a : b;
    out.result = { winner, loser: winner && opponent(winner), reason, round: state.round };
  } else out.result = null;
  return out;
}

function lethalize(rng, state, mode) {
  const incoming = clashOracle(state).incoming;
  for (const side of SIDES) {
    const hit = incoming[side].base;
    if (hit === 0) continue;
    // exact: base equals the damage; clamp: base is lower than the damage (kept at one or more).
    state.sides[side].baseOrbs = mode === "exact" ? Math.min(5, hit) : Math.max(1, Math.min(5, hit - 1));
  }
}

function runClash(rng, index, { apply = applyAction } = {}) {
  const second = SIDES[index % 2];
  const dense = rng.chance(0.06) ? () => 0 : () => (rng.chance(0.6) ? 2 + rng.int(2) : rng.int(4));
  const { state } = buildFixtureWith(rng, { active: second, boardSize: dense, round: rng.chance(0.25) ? MAX_ROUNDS : undefined });
  state.startingSide = opponent(second);
  const variant = rng.pick(["plain", "exact", "clamp", "tie"]);
  if (variant === "exact" || variant === "clamp") lethalize(rng, state, variant);
  if (variant === "tie") {
    state.round = MAX_ROUNDS;
    const incoming = clashOracle(state).incoming;
    const k = 1 + rng.int(2);
    if (incoming.cowboy.base + k <= 5 && incoming.wizard.base + k <= 5) for (const side of SIDES) state.sides[side].baseOrbs = incoming[side].base + k;
  }
  const expected = expectedOf(state);
  checkState(state, expected, "clash fixture");
  const oracle = clashOracle(state);
  const tags = new Set();

  const action = { type: "end-phase", side: second, revision: state.revision, actionId: "clash-1" };
  const beforeJson = json(state);
  const result = apply(state, action);
  checkAccepted(state, beforeJson, action, result, "clash");
  const after = result.state;
  checkState(after, expected, "after clash");

  // R7.1-R7.4, R7.6: damage from one snapshot, whole attack, no spill, clamped.
  for (const side of SIDES) {
    need(sameJson(after.sides[side].board, oracle.sides[side].board), "clash-boards", () => `${side} board ${json(after.sides[side].board)} != ${json(oracle.sides[side].board)}`);
    need(after.sides[side].baseOrbs === oracle.sides[side].baseOrbs, "clash-base", () => `${side} base ${after.sides[side].baseOrbs} != ${oracle.sides[side].baseOrbs}`);
  }
  // R7.5: defeated troops reach their owner's discard exactly once, in lane then side order.
  for (const side of SIDES) {
    const defeated = oracle.defeated.filter((d) => d.side === side).map((d) => d.cardId);
    need(sameJson(sortedIds(after.sides[side].discard), sortedIds([...state.sides[side].discard, ...defeated])), "clash-discard", () => `${side} discard`);
  }
  const events = result.events;
  const damage = events.filter((e) => e.type === "damage");
  const defeats = events.filter((e) => e.type === "defeat");
  need(damage.length === oracle.attacks.length, "clash-events", () => "one damage event per attacker, including defeated ones");
  need(defeats.length === oracle.defeated.length, "clash-events", () => "one defeat event per defeated troop");
  const lastDamage = events.lastIndexOf(damage.at(-1));
  need(defeats.length === 0 || events.indexOf(defeats[0]) > lastDamage, "clash-events", () => "defeats must follow all damage");
  for (const event of damage) need(event.after === Math.max(0, event.before - event.amount) && event.after >= 0, "clash-clamp", () => "damage clamp");
  for (const lane of [0, 1, 2]) {
    for (const side of SIDES) {
      const troop = state.sides[side].board[lane];
      if (troop) need(damage.some((e) => e.attacker.side === side && e.lane === lane && e.attacker.cardId === troop.cardId), "clash-attacker", () => `${side} lane ${lane} did not attack`);
    }
  }

  // R10.1-R10.3 result.
  if (oracle.result) {
    need(sameJson(after.result, oracle.result), "result", () => `${json(after.result)} != ${json(oracle.result)}`);
    need(after.activeSide === null && after.round === state.round, "result", () => "terminal state fields");
    for (const side of SIDES) need(sameJson([after.sides[side].hand, after.sides[side].deck], [state.sides[side].hand, state.sides[side].deck]), "result", () => "no draw after a result");
    // R10.4: the finished match refuses everything and lists nothing.
    for (const side of SIDES) need(legalActions(after, side).length === 0, "terminal", () => "legal action after result");
    for (const candidate of [{ type: "end-phase" }, { type: "summon", cardId: "x", slot: 0, tributes: [] }, { type: "spell", cardId: "x", target: 0 }]) {
      for (const side of SIDES) assertRejected(apply, after, { ...candidate, side, revision: after.revision }, "match-over", "terminal");
    }
    tags.add(oracle.result.reason === "round-limit" ? (oracle.result.winner ? "round-limit-decided" : "round-limit-tie") : orbsBoth(oracle) ? "both-bases-zero-draw" : "one-base-zero-loss");
    if (oracle.result.reason === "base-destroyed" && !orbsBoth(oracle)) {
      tags.add("clash-completes-after-first-base-falls");
    }
  } else {
    need(after.result === null && after.round === state.round + 1 && after.startingSide === second && after.activeSide === second, "next-round", () => "next round fields");
    for (const side of SIDES) {
      const draws = state.sides[side].deck.length > 0 ? 1 : 0;
      need(after.sides[side].hand.length === state.sides[side].hand.length + draws, "next-round", () => `${side} draw`);
      need(sameJson(after.allowances[side], { summonUsed: false, castUsed: false }), "next-round", () => "allowances reset");
    }
    tags.add("match-continues");
  }

  // Lane order must not matter: the mirrored board resolves to the mirrored outcome.
  const mirrored = structuredClone(state);
  for (const side of SIDES) mirrored.sides[side].board.reverse();
  const mirrorResult = apply(mirrored, { ...action });
  need(mirrorResult.ok, "mirror", () => "mirrored clash rejected");
  for (const side of SIDES) {
    need(sameJson([...mirrorResult.state.sides[side].board].reverse(), after.sides[side].board), "mirror", () => `${side} board`);
    need(mirrorResult.state.sides[side].baseOrbs === after.sides[side].baseOrbs, "mirror", () => `${side} base`);
    need(sameJson(sortedIds(mirrorResult.state.sides[side].discard), sortedIds(after.sides[side].discard)), "mirror", () => `${side} discard`);
  }
  need(sameJson(mirrorResult.state.result, after.result), "mirror", () => "result");
  tags.add("lane-mirror-equal");

  // Which boundary the case reached, from the independent oracle's numbers.
  for (const lane of [0, 1, 2]) {
    const c = state.sides.cowboy.board[lane];
    const w = state.sides.wizard.board[lane];
    if (c && w) {
      const cDies = c.health <= CARDS[w.cardId].attack;
      const wDies = w.health <= CARDS[c.cardId].attack;
      if (cDies && wDies) tags.add("mutual-lane-defeat");
      if (cDies || wDies) tags.add("defeated-attacker-still-attacks");
      if (CARDS[c.cardId].attack > w.health || CARDS[w.cardId].attack > c.health) tags.add("overkill-absorbed-no-base-spill");
    } else if (c || w) tags.add("unopposed-attack-hits-base");
  }
  for (const side of SIDES) {
    const hit = oracle.incoming[side].base;
    if (hit > 0 && hit === state.sides[side].baseOrbs) tags.add("base-exactly-zero");
    if (hit > state.sides[side].baseOrbs) tags.add("base-clamped-at-zero");
  }
  if (oracle.attacks.length === 0) tags.add("no-troops-clash");
  return [...tags];
}
const orbsBoth = (oracle) => SIDES.every((side) => oracle.sides[side].baseOrbs === 0);

// ---------------------------------------------------------------- BP-REPLAY
function runReplay(rng, index, { apply = applyAction } = {}) {
  const made = index % 2 === 0 ? reachableState(rng, { steps: rng.int(6) }) : buildFixtureWith(rng, { fresh: rng.chance(0.5) });
  const tags = new Set([`start:${made.kind}`]);
  if (made.state.result) return [...tags];
  const start = structuredClone(made.state);
  const expected = expectedOf(start);
  checkState(start, expected, "replay start");

  const log = [];
  let state = structuredClone(start);
  let steps = 0;
  while (!state.result) {
    need(steps < MAX_STEPS, "termination", () => `no result after ${MAX_STEPS} actions`);
    // Interleave a rejected action now and then: it must not enter the log or change anything.
    if (rng.chance(0.35)) {
      const cases = invalidActionCases(state, rng);
      const pick = rng.pick(cases);
      assertRejected(apply, pick.state, pick.action, pick.reason, pick.category);
      tags.add("rejected-action-interleaved");
    }
    const action = stamp(rng.pick(legalActions(state, state.activeSide)), `r-${steps}`);
    const beforeJson = json(state);
    const result = apply(state, action);
    checkAccepted(state, beforeJson, action, result, `replay step ${steps}`);
    checkState(result.state, expected, `replay step ${steps}`);
    log.push({ action, events: result.events, after: json(result.state) });
    // R6.7 / R11: an action commits once. Resubmitting it is refused whatever the state.
    const again = apply(result.state, action);
    need(again.ok === false && ["duplicate-action", "match-over"].includes(again.reason), "applied-once", () => `resubmitted action gave ${again.reason}`);
    const noId = { ...action };
    delete noId.actionId;
    const stale = apply(result.state, noId);
    need(stale.ok === false && ["stale", "match-over"].includes(stale.reason), "applied-once", () => `resubmitted at old revision gave ${stale.reason}`);
    state = result.state;
    steps += 1;
  }
  tags.add("played-to-result");

  // R11.3: the accepted log alone, from the same start, gives identical states and events.
  let replayed = structuredClone(start);
  for (const [i, entry] of log.entries()) {
    const result = apply(replayed, entry.action);
    need(result.ok && sameJson(result.events, entry.events) && json(result.state) === entry.after, "replay", () => `diverged at action ${i}`);
    replayed = result.state;
  }
  need(sameJson(replayed, state), "replay", () => "final state differs");
  tags.add("log-replayed-identically");
  return [...tags];
}

// ---------------------------------------------------------------- BP-CPU
// The same position as seen by `side`, with everything `side` may not know
// replaced: the opponent's hand and deck (a random permutation of the same
// pool, hand size kept), the side's own deck order, seed and rng.
export function hiddenTwin(rng, state, side) {
  const twin = structuredClone(state);
  const enemy = twin.sides[opponent(side)];
  const pool = rng.shuffle([...enemy.hand, ...enemy.deck]);
  enemy.hand = pool.slice(0, enemy.hand.length);
  enemy.deck = pool.slice(enemy.hand.length);
  twin.sides[side].deck = rng.shuffle(twin.sides[side].deck);
  twin.seed = state.seed + 1 + rng.int(1000);
  twin.rng = rng.int(2 ** 32);
  return twin;
}

export const realDecider = (level) => (state, side) => cpuFor(level)(publicState(state, side));

function runCpu(rng, index, { decider = realDecider } = {}) {
  const made = index % 2 === 0 ? reachableState(rng, { steps: rng.int(20) }) : buildFixtureWith(rng, {});
  const { state } = made;
  if (state.result) return [];
  const side = state.activeSide;
  const tags = new Set([`state:${made.kind}`, `cpu-side:${side}`]);
  if (boundaryTags(made.counts).length > 0) tags.add("boundary-custom-deck");
  if (state.sides[side].board.every(Boolean)) tags.add("cpu-board-full");
  if (state.sides[opponent(side)].hand.some(isSpell)) tags.add("enemy-holds-spell");

  for (const level of CPU_LEVELS) {
    const choose = decider(level);
    const view = publicState(state, side);
    const viewJson = json(view);
    const decision = choose(state, side);
    need(json(publicState(state, side)) === viewJson, "view-mutated", () => `${level} changed state`);
    const legal = legalActions(view, side);
    need(legal.some((a) => sameJson(a, decision)), "cpu-legal", () => `${level} chose an illegal action`);
    for (let k = 0; k < 2; k++) {
      const twin = hiddenTwin(rng, state, side);
      need(sameJson(publicState(twin, side), view), "view-leak", () => "public view depends on hidden data");
      const names = (ids) => ids.map((id) => CARDS[id].name).sort();
      if (!sameJson(names(twin.sides[opponent(side)].hand), names(state.sides[opponent(side)].hand))) tags.add("enemy-hand-differs-by-card-name");
      if (!sameJson(twin.sides[opponent(side)].deck, state.sides[opponent(side)].deck)) tags.add("enemy-deck-order-differs");
      if (!sameJson(twin.sides[side].deck, state.sides[side].deck)) tags.add("own-deck-order-differs");
      const other = choose(twin, side);
      need(sameJson(other, decision), "cpu-information-leak", () => `${level}: ${json(other)} != ${json(decision)} when only hidden cards differ`);
      tags.add(`level:${level}`);
    }
  }
  return [...tags];
}

// ---------------------------------------------------------------- registry
export const PROPERTIES = [
  { id: "BP-DECK", title: "boundary custom decks are legal, conserved and playable; one step outside is refused", reqs: ["R1.1", "R1.6", "R1.7", "R1.8", "R11.1", "deck-rules"], cases: BOUNDARY_COMPOSITIONS.length, run: runDeck,
    categories: ["one-sheriff-minimum", "six-copy-cap", "sheriff-minimum-and-copy-cap", "custom-deck-played-to-result", "outside:eleven-cards", "outside:thirteen-cards", "outside:duplicate-id", "outside:foreign-card", "outside:seventh-copy", "outside:no-sheriff"] },
  { id: "BP-TRIBUTE", title: "full-board tribute lands only in a vacated slot, atomically", reqs: ["R3.1", "R3.2", "R3.3", "R3.4", "R3.5", "R3.6", "R1.6"], cases: 120, run: runTribute,
    categories: ["full-board:cowboy", "full-board:wizard", "cost-1-into-vacated-slot", "cost-2-into-vacated-slot", "zero-cost-blocked-on-full-board", "non-vacated-slot-rejected", "both-boards-full"] },
  { id: "BP-REJECT", title: "invalid, duplicate, foreign and stale actions are rejected without any change", reqs: ["R3.2", "R3.4", "R3.7", "R3.8", "R6.2", "R6.4", "R6.7", "R8.3", "R8.4", "R8.6", "R10.4"], cases: 150, run: runReject,
    categories: ["state:constructed", "state:reachable", "rejections-leave-no-trace", ...[
      "stale-revision-behind", "stale-revision-ahead", "duplicate-action-id", "wrong-side", "unknown-action-type", "empty-action-id", "terminal-match", "stale-after-intervening-action",
      "second-summon", "summon-after-spell", "summon-card-unknown", "summon-card-in-deck", "summon-foreign-card", "summon-a-spell",
      "tribute-duplicate-slot", "tribute-empty-slot", "tribute-foreign-troop-slot", "tribute-out-of-range", "tribute-not-a-slot-number", "tribute-not-a-list",
      "tribute-underpaid", "tribute-overpaid", "summon-slot-out-of-range", "summon-slot-not-integer", "summon-into-unvacated-slot",
      "second-cast", "cast-a-troop", "spell-card-unknown", "spell-target-out-of-range", "spell-target-not-a-slot-number", "spell-target-empty-slot",
      "destination-on-non-relocating-spell", "destination-is-the-target-slot", "destination-past-the-end", "destination-two-slots-away", "destination-occupied", "destination-for-a-defeated-target",
    ].map((c) => `reject:${c}`)] },
  { id: "BP-SPELL", title: "one-orb and multi-orb spell targets, destinations and the one-cast limit", reqs: ["R8.1", "R8.2", "R8.3", "R8.4", "R8.5", "R8.6", "R6.2", "R1.6"], cases: 200, run: runSpell,
    categories: ["caster-board-empty", "caster-board-occupied", "one-orb-target-deadeye-kill", "one-orb-target-singularity-kill", "one-orb-target-with-destination-rejected", "two-plus-orb-target-chipped", "survivor-relocated-to-adjacent-empty-slot", "spell-without-target-rejected", "bad-destination-rejected", "second-cast-rejected"] },
  { id: "BP-CLASH", title: "simultaneous clash matches an order-independent oracle; results follow the base orbs", reqs: ["R7.1", "R7.2", "R7.3", "R7.4", "R7.5", "R7.6", "R10.1", "R10.2", "R10.3", "R10.4", "R5.8"], cases: 400, run: runClash,
    categories: ["mutual-lane-defeat", "defeated-attacker-still-attacks", "overkill-absorbed-no-base-spill", "unopposed-attack-hits-base", "base-exactly-zero", "base-clamped-at-zero", "both-bases-zero-draw", "one-base-zero-loss", "clash-completes-after-first-base-falls", "round-limit-decided", "round-limit-tie", "match-continues", "lane-mirror-equal", "no-troops-clash"] },
  { id: "BP-REPLAY", title: "an accepted-action log replays identically; rejected and repeated actions change nothing", reqs: ["R11.3", "R6.7", "R3.7", "R1.6", "R1.7"], cases: 80, run: runReplay,
    categories: ["start:reachable", "start:constructed", "rejected-action-interleaved", "played-to-result", "log-replayed-identically"] },
  { id: "BP-CPU", title: "CPU decisions at every difficulty ignore hidden hand, deck order, seed and rng", reqs: ["R9.1", "R9.2", "R9.4", "R9.5"], cases: 150, run: runCpu,
    categories: ["state:reachable", "state:constructed", "cpu-side:cowboy", "cpu-side:wizard", "boundary-custom-deck", "cpu-board-full", "enemy-holds-spell", "enemy-hand-differs-by-card-name", "enemy-deck-order-differs", "own-deck-order-differs", ...CPU_LEVELS.map((l) => `level:${l}`)] },
];

export function runProperty(property, { index, ...options }) {
  return property.run(caseRng(property.id, index), index, options);
}

export function runAll(property, options = {}) {
  const counts = new Map();
  for (let index = 0; index < property.cases; index++) {
    try {
      for (const tag of runProperty(property, { index, ...options })) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    } catch (error) {
      if (error instanceof Violation) error.message = `[${property.id} case ${index}] ${error.message}`;
      throw error;
    }
  }
  return counts;
}
