// Experimental round-1 Base shield (.kiro/specs/round-one-tempo, RT-1 to RT-5).
// Tests set the flag by hand on a match state; nothing in the game sets it.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { CARDS, DECKS, SIDES, opponent } from "../../src/game/cards.js";
import { createMatch } from "../../src/game/state.js";
import { applyAction } from "../../src/game/actions.js";
import { legalActions } from "../../src/game/legal.js";
import { publicState } from "../../src/game/view.js";
import { chooseAction } from "../../src/game/cpu.js";
import { openingMatch } from "../../src/game/opening-policy.js";
import { playMatch } from "../../scripts/play-match.mjs";

const FLAG = "experimentalRoundOneBaseShield";
const shielded = (state) => Object.assign(structuredClone(state), { [FLAG]: true });
const withoutFlag = ({ [FLAG]: _flag, ...state }) => state;

// SHA-256 of JSON.stringify(playMatch(seed, CPU on both sides)), recorded at
// 9603fe4 before the shield existed (docs/evidence/kiro-round-one-tempo.md).
const DEFAULT_ROUTES = {
  0: "46c6588aa0d97f5e7a8b1f52f814db376d4c08a196c3b52e31828e05736089a7",
  60: "40435b91de5319a90c79d0f130c7c969215d4b99af01c61abe1118893a3424a5",
};

// A round-`round` position where the Wizard's end-phase runs the clash.
// Board entries are a card ID or [card ID, health]; every other card of a
// side is in its deck, so cards stay conserved.
function beforeClash({ round = 1, cowboy = [null, null, null], wizard = [null, null, null], hands = {} } = {}) {
  const state = createMatch(1);
  Object.assign(state, { round, startingSide: "cowboy", activeSide: "wizard" });
  for (const [side, board] of Object.entries({ cowboy, wizard })) {
    const own = state.sides[side];
    own.board = board.map((entry) => {
      if (entry === null) return null;
      const [cardId, health = CARDS[cardId].health] = [].concat(entry);
      return { cardId, health };
    });
    own.hand = [...(hands[side] ?? [])];
    const used = new Set([...own.hand, ...own.board.filter(Boolean).map((troop) => troop.cardId)]);
    own.deck = DECKS[side].filter((id) => !used.has(id));
  }
  return state;
}
const act = (state, type, fields = {}) => ({ type, side: state.activeSide, revision: state.revision, ...fields });
function accept(state, action) {
  const result = applyAction(state, action);
  assert.equal(result.ok, true, `rejected: ${result.reason}`);
  return result;
}
const endPhase = (state) => accept(state, act(state, "end-phase"));
// Damage events without the revision stamp, for exact comparisons.
const damage = (events) => events.filter((event) => event.type === "damage").map(({ revision, ...event }) => event);
const bases = (state) => SIDES.map((side) => state.sides[side].baseOrbs);

test("RT-1: default seeds 0 and 60 play the same CPU-vs-CPU route as at 9603fe4", () => {
  for (const [seed, sha256] of Object.entries(DEFAULT_ROUTES)) {
    const text = JSON.stringify(playMatch(Number(seed), { cowboy: chooseAction, wizard: chooseAction }));
    assert.equal(createHash("sha256").update(text).digest("hex"), sha256, `seed ${seed}`);
    assert.equal(text.includes("shielded"), false);
  }
});

test("RT-2: no game path sets the flag, and the public view never shows it", () => {
  for (let seed = 0; seed < 100; seed++) {
    const states = [createMatch(seed), createMatch(seed, { traps: true }), openingMatch(seed, "both"), openingMatch(seed, "shipped", "wizard")];
    for (const state of states) {
      assert.equal(Object.hasOwn(state, FLAG), false, `seed ${seed}`);
      for (const side of SIDES) assert.deepEqual(publicState(shielded(state), side), publicState(state, side));
    }
  }
});

test("RT-3: in round 1 an unblocked troop of either faction leaves the opposing Base whole", () => {
  // Each faction alone, with the free troops that can stand in round 1.
  for (const [spec, attacker] of [
    [{ cowboy: [null, "cowboy-sheriff-1", null] }, "cowboy"],
    [{ wizard: [null, null, "wizard-skeleton-1"] }, "wizard"],
  ]) {
    const state = shielded(beforeClash(spec));
    const { state: after, events } = endPhase(state);
    const [hit, ...rest] = damage(events);
    assert.deepEqual(rest, []);
    assert.deepEqual(
      [hit.attacker.side, hit.target, hit.amount, hit.before, hit.after, hit.shielded],
      [attacker, { kind: "base", side: opponent(attacker) }, 0, 5, 5, true],
    );
    assert.deepEqual(bases(after), [5, 5]);
    assert.deepEqual(after.sides[attacker].board, state.sides[attacker].board);
  }

  // Both ways in one clash: the position of the default test in
  // tests/game/match.test.js, where the Bases end at 2 and 3.
  const state = shielded(beforeClash({ cowboy: ["cowboy-billy-1", null, null], wizard: [null, "wizard-dragon-1", null] }));
  const { state: after, events } = endPhase(state);
  assert.deepEqual(damage(events), [
    {
      type: "damage",
      lane: 0,
      attacker: { side: "cowboy", slot: 0, cardId: "cowboy-billy-1" },
      target: { kind: "base", side: "wizard" },
      amount: 0,
      before: 5,
      after: 5,
      shielded: true,
    },
    {
      type: "damage",
      lane: 1,
      attacker: { side: "wizard", slot: 1, cardId: "wizard-dragon-1" },
      target: { kind: "base", side: "cowboy" },
      amount: 0,
      before: 5,
      after: 5,
      shielded: true,
    },
  ]);
  assert.deepEqual(bases(after), [5, 5]);
  assert.deepEqual(after.sides.cowboy.board, state.sides.cowboy.board);
  assert.deepEqual(after.sides.wizard.board, state.sides.wizard.board);
  assert.equal(after.round, 2);
  assert.equal(after.result, null);
  assert.equal(after[FLAG], true);
});

test("RT-4: in round 1 blocked attacks, defeats and spells resolve as without the flag", () => {
  // Every lane blocked, with defeats on both sides.
  const blocked = beforeClash({
    cowboy: ["cowboy-mounted-billy-1", null, ["cowboy-sheriff-1", 1]],
    wizard: [["wizard-skeleton-1", 1], null, "wizard-dragon-1"],
  });
  const plain = endPhase(blocked);
  const flagged = endPhase(shielded(blocked));
  assert.deepEqual(flagged.events, plain.events);
  assert.deepEqual(withoutFlag(flagged.state), plain.state);
  assert.ok(plain.events.some((event) => event.type === "defeat"));

  // Lane 0 blocked, lane 2 open for the Wizard: only the open lane changes.
  const mixed = beforeClash({ cowboy: ["cowboy-sheriff-1", null, null], wizard: ["wizard-skeleton-1", null, "wizard-skeleton-2"] });
  const mixedPlain = endPhase(mixed);
  const mixedFlagged = endPhase(shielded(mixed));
  const troopHits = (events) => damage(events).filter((event) => event.target.kind === "troop");
  assert.deepEqual(troopHits(mixedFlagged.events), troopHits(mixedPlain.events));
  assert.equal(troopHits(mixedPlain.events).length, 2);
  for (const side of SIDES) assert.deepEqual(mixedFlagged.state.sides[side].board, mixedPlain.state.sides[side].board);
  assert.deepEqual(bases(mixedPlain.state), [4, 5]);
  assert.deepEqual(bases(mixedFlagged.state), [5, 5]);

  // Spells: a Singularity hit and move by the Wizard, a Deadeye kill by the Cowboy.
  const singularity = beforeClash({ cowboy: ["cowboy-sheriff-1", null, null], hands: { wizard: ["wizard-singularity-1"] } });
  const deadeye = Object.assign(beforeClash({ wizard: [["wizard-skeleton-1", 1], null, null], hands: { cowboy: ["cowboy-deadeye-1"] } }), {
    activeSide: "cowboy",
  });
  for (const [state, fields] of [
    [singularity, { cardId: "wizard-singularity-1", target: 0, destination: 1 }],
    [deadeye, { cardId: "cowboy-deadeye-1", target: 0 }],
  ]) {
    const cast = accept(state, act(state, "spell", fields));
    const castFlagged = accept(shielded(state), act(state, "spell", fields));
    assert.deepEqual(castFlagged.events, cast.events);
    assert.deepEqual(withoutFlag(castFlagged.state), cast.state);
  }
});

test("RT-5: from round 2 the flag changes nothing, and open lanes damage the Base", () => {
  for (const round of [2, 5, 9]) {
    const state = beforeClash({ round, cowboy: ["cowboy-billy-1", null, null], wizard: [null, "wizard-dragon-1", null] });
    const plain = endPhase(state);
    const flagged = endPhase(shielded(state));
    assert.deepEqual(flagged.events, plain.events);
    assert.deepEqual(withoutFlag(flagged.state), plain.state);
    assert.deepEqual(damage(flagged.events).map(({ amount, before, after }) => [amount, before, after]), [[2, 5, 3], [3, 5, 2]]);
    assert.equal(damage(flagged.events).some((event) => "shielded" in event), false);
  }
});

// Seeded play through applyAction: the first seat summons a free troop into
// lane 0, the second seat one into lane 2, so both lanes stay open; then both
// sides pass round 2.
function openLanes(start) {
  let state = start;
  const summon = (slot) => {
    const action = legalActions(state, state.activeSide).find((each) => each.type === "summon" && each.slot === slot && each.tributes.length === 0);
    state = accept(state, action).state;
  };
  const end = () => {
    const { state: next, events } = endPhase(state);
    state = next;
    return events;
  };
  summon(0);
  end();
  summon(2);
  const round1 = end();
  const afterRound1 = bases(state);
  end();
  const round2 = end();
  return { round1, round2, afterRound1, afterRound2: bases(state), state };
}

test("RT-3 and RT-5: seeded matches with each faction first keep both Bases whole in round 1, then take damage in round 2", () => {
  for (const seed of [0, 60]) {
    const first = createMatch(seed).startingSide;
    const plain = openLanes(createMatch(seed));
    const flagged = openLanes(shielded(createMatch(seed)));
    assert.deepEqual(plain.afterRound1, [4, 4], `seed ${seed}`);
    assert.deepEqual(plain.afterRound2, [3, 3]);
    assert.deepEqual(flagged.afterRound1, [5, 5]);
    assert.deepEqual(flagged.afterRound2, [4, 4]);

    const round1 = damage(flagged.round1);
    assert.deepEqual(round1.map((hit) => hit.attacker.side).sort(), [...SIDES].sort());
    for (const hit of round1) assert.deepEqual([hit.target.kind, hit.amount, hit.before, hit.after, hit.shielded], ["base", 0, 5, 5, true]);

    const round2 = damage(flagged.round2);
    assert.equal(round2.length, 2);
    for (const hit of round2) {
      assert.deepEqual([hit.target.kind, hit.amount, hit.before, hit.after], ["base", CARDS[hit.attacker.cardId].attack, 5, 4]);
      assert.equal("shielded" in hit, false);
    }
    assert.deepEqual(damage(plain.round2).map(({ before, after }) => [before, after]), [[4, 3], [4, 3]]);
    assert.equal(flagged.state[FLAG], true);
    assert.equal(flagged.state.round, 3);
    assert.equal(flagged.state.startingSide, first, "round 3 is the first seat's again");
  }
});
