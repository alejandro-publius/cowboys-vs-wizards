// Bear Trap (snare) and Hex log lines, read from trap events that legal play actually produces.
// Each case replays a seeded deal with the level-2 bot (playTurn applies every step through
// applyAction, which rejects illegal actions) until the first trap event that matches.
// Titles cite the clauses of the native Kiro bugfix spec .kiro/specs/showdown-bear-trap-log/bugfix.md
// (as <spec>/<N.M>), which scripts/trace.mjs indexes; 3.5 compares against the pre-fix tree and is not
// cited here.
import test from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import {TYPES} from "../../src/game/showdown/cards.js";
import {EVENTS} from "../../src/game/showdown/contract.js";
import {presentEvent} from "../../src/game/showdown/presenter.js";
import {createShowdown, playTurn} from "../../src/game/showdown/rules.js";

function firstTrap(seed, match) {
  let state = createShowdown(seed);
  for (let turns = 0; !state.result && turns < 200; turns++) {
    const before = state;
    const played = playTurn(state, 2);
    state = played.state;
    const at = played.events.findIndex((event) => event.type === "trap" && match(event));
    if (at >= 0) return {before, after: state, events: played.events, at, event: played.events[at]};
  }
  throw new Error(`seed ${seed}: no matching trap event`);
}

const bearTrap = (event) => event.cardId.startsWith("cowboy-bear-trap");
const hex = (event) => event.cardId.startsWith("wizard-hex");

test("showdown-bear-trap-log/2.1 showdown-bear-trap-log/3.3 CARD-COWBOY-BEAR-TRAP-14: a Bear Trap that defeats the attacker reads 'defeated before it struck' (seed 18)", () => {
  const {before, after, events, at, event} = firstTrap(18, (e) => bearTrap(e) && e.left === 0);
  assert.equal(before.sides.cowboy.traps.includes(event.cardId), true, "the Bear Trap was set face down");
  assert.deepEqual({target: event.target, left: event.left, stopped: event.stopped}, {target: "wizard-imp-1", left: 0, stopped: true});
  assert.equal(after.sides.wizard.board.some((troop) => troop?.cardId === event.target), false, "the attacker left the board");
  assert.equal(after.sides.wizard.discard.includes(event.target), true, "the attacker went to the graveyard");
  assert.notEqual(events[at + 1]?.type, "attack", "no attack landed after the trap");
  assert.equal(presentEvent(event), "Trap! The Cowboys' Bear Trap caught Imp: defeated before it struck.");
});

test("showdown-bear-trap-log/3.2: a Bear Trap that leaves the attacker standing reads 'attacked anyway' (seed 15)", () => {
  const {events, at, event} = firstTrap(15, (e) => bearTrap(e) && e.left > 0);
  assert.equal(event.stopped, false);
  assert.equal(events[at + 1]?.type, "attack");
  assert.match(presentEvent(event), new RegExp(`it dropped to ${event.left} and attacked anyway\\.$`));
});

test("showdown-bear-trap-log/3.1: Hex still reads 'its attack was cancelled' (seed 14)", () => {
  const {event} = firstTrap(14, hex);
  assert.ok(event.left > 0 && event.stopped);
  assert.match(presentEvent(event), /: its attack was cancelled\.$/);
});

// The expected line, written from the card table and the clause text rather than the presenter's helpers.
const FACTION = {cowboy: "Cowboys", wizard: "Wizards"};
const ofKind = (side, kind) => Object.entries(TYPES).filter(([, t]) => t.side === side && t.kind === kind).map(([type]) => `${type}-1`);
const expectedLine = (e) => `Trap! The ${FACTION[e.side]}' ${TYPES[e.cardId.replace(/-\d+$/, "")].name} caught `
  + `${TYPES[e.target.replace(/-\d+$/, "")].name}: ${e.left === 0 ? "defeated before it struck" : e.stopped ? "its attack was cancelled" : `it dropped to ${e.left} and attacked anyway`}.`;
const trapEvent = fc.constantFrom("cowboy", "wizard").chain((side) => fc.record({
  type: fc.constant("trap"), side: fc.constant(side),
  cardId: fc.constantFrom(...ofKind(side, "trap")),
  target: fc.constantFrom(...ofKind(side === "cowboy" ? "wizard" : "cowboy", "troop")),
  left: fc.nat({max: 6}), stopped: fc.boolean(),
}));

test("showdown-bear-trap-log/2.2 showdown-bear-trap-log/3.6: a trap line with 0 orbs left reads 'defeated before it struck' whatever `stopped` says, inside the same 'Trap! <owner's card> caught <troop>: ….' frame (fast-check)", () => {
  fc.assert(fc.property(trapEvent, (e) => presentEvent(e) === expectedLine(e)), {seed: 0x1b3a, numRuns: 300});
  // The pre-fix presenter checked `stopped` first (bugfix.md 1.1, 1.2). The same property must catch it,
  // and its counterexample must be the bug condition: 0 orbs left on a stopped attack.
  const stoppedFirst = (e) => presentEvent(e).replace(/: [^:]+\.$/, `: ${e.stopped ? "its attack was cancelled" : e.left === 0 ? "defeated before it struck" : `it dropped to ${e.left} and attacked anyway`}.`);
  const caught = fc.check(fc.property(trapEvent, (e) => stoppedFirst(e) === expectedLine(e)), {seed: 0x1b3a, numRuns: 300});
  assert.equal(caught.failed, true, "the pre-fix ordering must fail the property");
  assert.deepEqual([caught.counterexample[0].left, caught.counterexample[0].stopped], [0, true]);
});

test("showdown-bear-trap-log/3.4: trap events from legal play keep side, cardId, target, left and stopped with the same meaning, and the contract still says `stopped` means the attack never lands (seeds 0-79)", () => {
  assert.deepEqual(EVENTS.trap.fields, ["side", "cardId", "target", "left", "stopped"]);
  assert.match(EVENTS.trap.shows, /`stopped` means the attack never lands\./);
  const events = [];
  for (let seed = 0; seed < 80; seed++) {
    let state = createShowdown(seed);
    for (let turns = 0; !state.result && turns < 200; turns++) {
      const played = playTurn(state, 2);
      state = played.state;
      events.push(...played.events.filter((event) => event.type === "trap"));
    }
  }
  assert.ok(events.some((e) => bearTrap(e) && e.left === 0) && events.some((e) => bearTrap(e) && e.left > 0) && events.some(hex),
    "the corpus holds a fatal Bear Trap, a survived Bear Trap and a Hex");
  for (const e of events) {
    assert.deepEqual(Object.keys(e).sort(), ["cardId", "left", "side", "stopped", "target", "type"]);
    assert.ok(Number.isInteger(e.left) && e.left >= 0 && typeof e.stopped === "boolean");
    // Bear Trap stops the attack exactly when it takes the last orb; Hex always stops it and takes none.
    if (bearTrap(e)) assert.equal(e.stopped, e.left === 0);
    else assert.ok(hex(e) && e.stopped && e.left > 0, `unexpected trap event ${JSON.stringify(e)}`);
  }
});
