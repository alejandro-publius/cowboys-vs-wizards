// Focused checks for the shadow model. Run: node --test experiments/trap-balance/
import test from "node:test";
import assert from "node:assert/strict";
import { CARDS, SIDES } from "../../src/game/cards.js";
import { createMatch } from "../../src/game/state.js";
import { playMatch, makeBot } from "../../scripts/play-match.mjs";
import { fixtureId, isArmed, pickTarget, playShadow, shadowClash, trapView } from "./shadow.js";

const SEEDS = Array.from({ length: 200 }, (_, seed) => seed);
const troop = (cardId) => ({ cardId, health: CARDS[cardId].health });
const sheriff = "cowboy-sheriff-1"; // attack 1
const billy = "cowboy-billy-1"; // attack 2
const mounted = "cowboy-mounted-billy-1"; // attack 3
const skeleton = "wizard-skeleton-1"; // attack 1
const wizard = "wizard-wizard-1"; // attack 2
const dragon = "wizard-dragon-1"; // attack 3

function clashState(cowboyBoard, wizardBoard, round = 4) {
  const state = createMatch(0);
  state.round = round;
  state.sides.cowboy.board = cowboyBoard.map((id) => (id ? troop(id) : null));
  state.sides.wizard.board = wizardBoard.map((id) => (id ? troop(id) : null));
  return state;
}
const damageTo = (events, side) => events.filter((e) => e.type === "damage" && e.target.side === side).map((e) => [e.lane, e.target.kind, e.amount]);

test("flag-off parity: a no-trap shadow run equals real play, state by state (seeds 0-199)", () => {
  for (const seed of SEEDS) {
    const bots = Object.fromEntries(SIDES.map((side) => [side, makeBot("cpu", seed, side)]));
    const real = playMatch(seed, bots);
    const plain = playShadow(seed, null, { record: true });
    assert.deepEqual(plain.states, real.log.map((entry) => entry.state), `seed ${seed} (real end-phase)`);
    // Shadow end-phase with no trap in play must also reproduce the real clash and round advance.
    const shadowEnd = playShadow(seed, { action: "B", effect: "X" }, { holders: [], record: true });
    assert.deepEqual(shadowEnd.states, real.log.map((entry) => entry.state), `seed ${seed} (shadow end-phase)`);
  }
});

test("deterministic: same seed and options give the same match", () => {
  for (const variant of [{ action: "A", effect: "X" }, { action: "B", effect: "Y" }]) {
    const a = playShadow(14, variant, { policy: "T" });
    const b = playShadow(14, variant, { policy: "T" });
    assert.deepEqual({ ...a, states: 0 }, { ...b, states: 0 });
  }
});

test("one-round delay: set in round N is not armed in N, armed in N+1", () => {
  assert.equal(isArmed({ cardId: "t", setRound: 4 }, 4), false);
  assert.equal(isArmed({ cardId: "t", setRound: 4 }, 5), true);
  assert.equal(isArmed(null, 5), false);
  const state = clashState([sheriff, null, null], [skeleton, null, null], 4);
  const zones = { cowboy: null, wizard: { cardId: fixtureId("wizard"), setRound: 4 } };
  assert.equal(shadowClash(state, zones, "X").triggers.length, 0);
  assert.notEqual(zones.wizard, null, "unarmed trap stays");
  state.round = 5;
  assert.equal(shadowClash(state, zones, "X").triggers.length, 1);
});

test("round 9: a trap set in round 9 never fires; one set in round 8 can", () => {
  const set9 = { cowboy: null, wizard: { cardId: "t", setRound: 9 } };
  assert.equal(shadowClash(clashState([sheriff, null, null], [null, null, null], 9), set9, "X").triggers.length, 0);
  const set8 = { cowboy: null, wizard: { cardId: "t", setRound: 8 } };
  assert.equal(shadowClash(clashState([sheriff, null, null], [null, null, null], 9), set8, "X").triggers.length, 1);
  for (let seed = 0; seed < 100; seed++) {
    const m = playShadow(seed, { action: "B", effect: "X" });
    assert.ok(m.setRounds.every((round) => round <= 8), "the CPU rule never sets in round 9");
  }
});

test("target: highest attack, ties to the lowest lane", () => {
  assert.deepEqual(pickTarget([sheriff, billy, mounted].map(troop)), { lane: 2, attack: 3, cardId: mounted });
  assert.equal(pickTarget([sheriff, billy, billy].map(troop)).lane, 1, "tie goes to the lowest lane");
  assert.equal(pickTarget([sheriff, sheriff, sheriff].map(troop)).lane, 0);
  assert.equal(pickTarget([null, null, null]), null);
});

test("empty enemy board: the armed trap stays set (no waste)", () => {
  const zones = { cowboy: { cardId: "t", setRound: 1 }, wizard: null };
  const state = clashState([sheriff, null, null], [null, null, null], 3); // the Cowboy trap faces an empty Wizard board
  const out = shadowClash(state, zones, "X");
  assert.equal(out.triggers.length, 0);
  assert.notEqual(zones.cowboy, null);
});

test("single use: a fired trap is spent and the zone is empty", () => {
  const zones = { cowboy: { cardId: "t", setRound: 1 }, wizard: null };
  const out = shadowClash(clashState([null, null, null], [skeleton, null, null], 3), zones, "X");
  assert.equal(out.triggers.length, 1);
  assert.equal(zones.cowboy, null);
  assert.deepEqual(out.spent, [{ side: "cowboy", cardId: "t" }]);
  for (const variant of [{ action: "A", effect: "X" }, { action: "B", effect: "Y" }]) {
    for (let seed = 0; seed < 100; seed++) {
      const m = playShadow(seed, variant);
      for (const side of SIDES) {
        assert.ok(m.sets[side] <= 1, "one fixture, one zone: at most one set per side");
        assert.ok(m.triggers.filter((t) => t.side === side).length <= m.sets[side]);
      }
      assert.equal(m.spent.length, m.triggers.length);
    }
  }
});

test("X cancels the highest-attack attack; Y prevents only 1 of it (low, mid, high)", () => {
  const cases = [[skeleton, 1, 0, 0], [wizard, 2, 0, 1], [dragon, 3, 0, 2]]; // [attacker, attack, X damage, Y damage]
  for (const [attacker, attack, xDamage, yDamage] of cases) {
    for (const [effect, expected] of [["X", xDamage], ["Y", yDamage], ["inert", attack]]) {
      const zones = { cowboy: { cardId: "t", setRound: 1 }, wizard: null };
      const out = shadowClash(clashState([null, null, null], [attacker, null, null], 3), zones, effect);
      assert.equal(out.triggers[0].attack, attack);
      const dealt = damageTo(out.events, "cowboy").reduce((sum, [, , amount]) => sum + amount, 0);
      assert.equal(dealt, expected, `${effect} vs attack ${attack}`);
    }
  }
});

test("a cancelled attacker still blocks (X removes only its damage)", () => {
  const zones = { cowboy: { cardId: "t", setRound: 1 }, wizard: null };
  const state = clashState([sheriff, null, null], [dragon, null, null], 3);
  const out = shadowClash(state, zones, "X");
  assert.ok(out.events.every((e) => e.type !== "damage" || e.attacker.cardId !== dragon));
  assert.equal(state.sides.wizard.board[0].health, 4, "sheriff still hit the dragon (5 -> 4)");
  assert.equal(state.sides.cowboy.board[0].health, 3, "sheriff untouched");
});

test("simultaneous traps: both fire from the pre-trigger snapshot, order cannot matter", () => {
  const board = (state) => JSON.stringify([state.sides.cowboy, state.sides.wizard]);
  const run = (effect) => {
    const state = clashState([billy, mounted, null], [wizard, skeleton, dragon], 5);
    const zones = { cowboy: { cardId: "tc", setRound: 2 }, wizard: { cardId: "tw", setRound: 4 } };
    const out = shadowClash(state, zones, effect);
    return { out, state };
  };
  for (const effect of ["X", "Y"]) {
    const { out, state } = run(effect);
    assert.deepEqual(out.triggers.map((t) => [t.side, t.target.slot]), [["cowboy", 2], ["wizard", 1]], "SIDES order, targets from the snapshot");
    // Re-run with the sides' zones swapped in insertion order: same boards.
    const state2 = clashState([billy, mounted, null], [wizard, skeleton, dragon], 5);
    shadowClash(state2, { wizard: { cardId: "tw", setRound: 4 }, cowboy: { cardId: "tc", setRound: 2 } }, effect);
    assert.equal(board(state), board(state2));
  }
  // Neither trap cancels the other: both attackers named by a trap are the ones that lose damage.
  const x = run("X");
  assert.equal(x.out.events.filter((e) => e.type === "damage").length, 3, "5 attacks, 2 cancelled");
});

test("hidden information: the opponent's view never carries the trap card", () => {
  const zones = { cowboy: { cardId: fixtureId("cowboy"), setRound: 3 }, wizard: null };
  const theirs = trapView(zones, "wizard");
  assert.deepEqual(theirs.cowboy, { faceDown: true, setRound: 3 });
  assert.equal(JSON.stringify(theirs).includes(fixtureId("cowboy")), false);
  assert.equal(trapView(zones, "cowboy").cowboy.cardId, fixtureId("cowboy"));
});

test("allowance: A never sets and casts in one phase, B can; A set blocks later casts", () => {
  let bTrapAndCast = 0;
  for (let seed = 0; seed < 300; seed++) {
    assert.equal(playShadow(seed, { action: "A", effect: "X" }, { policy: "T", arrival: 4 }).trapAndCastPhases, 0);
    assert.equal(playShadow(seed, { action: "A", effect: "X" }, { policy: "S" }).trapAndCastPhases, 0);
    bTrapAndCast += playShadow(seed, { action: "B", effect: "X" }, { policy: "T", arrival: 4 }).trapAndCastPhases;
  }
  assert.ok(bTrapAndCast > 0, "B should allow trap + cast in the same phase for some seed");
});

test("deck conservation: the study never changes the 12-card decks or the real card table", () => {
  assert.equal(Object.keys(CARDS).some((id) => id.startsWith("trap-")), false);
  const state = createMatch(0);
  for (const side of SIDES) assert.equal(state.sides[side].deck.length + state.sides[side].hand.length, 12);
});
