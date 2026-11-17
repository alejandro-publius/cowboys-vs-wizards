// Generated properties for clashLog (src/match/clash-log.js), issue #29.
// Dependency-free: a seeded loop over legal matches, not a property-testing
// library. There is NO shrinking. A failure prints the seed, bot pairing,
// batch number and event so the case can be replayed with CLASH_LOG_SEED=<n>.
//
// Cases: seeds 0..199 x four bot pairings (cpu/random for each side) = 800
// complete matches, played through the real engine by scripts/play-match.mjs.
// Each batch is the raw engine events since the previous clash batch, up to
// and including the action whose events hold a "clash" event (the contract in
// src/match/clash-log.js). Draw, summon, phase and round events stay in.
import test from "node:test";
import assert from "node:assert/strict";
import { CARDS } from "../../src/game/cards.js";
import { clashLog } from "../../src/match/clash-log.js";
import { makeBot, playMatch } from "../../scripts/play-match.mjs";

const SEEDS = process.env.CLASH_LOG_SEED === undefined ? Array.from({ length: 200 }, (_, seed) => seed) : [Number(process.env.CLASH_LOG_SEED)];
const PAIRINGS = [["cpu", "cpu"], ["cpu", "random"], ["random", "cpu"], ["random", "random"]];
const DESCRIBED = new Set(["spell", "damage", "defeat"]);
const CARD_NAMES = [...new Set(Object.values(CARDS).map((card) => card.name))];

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

// [{ seed, pairing, batch, events }] for every clash batch of every generated match.
function* cases() {
  for (const seed of SEEDS) {
    for (const pairing of PAIRINGS) {
      const [cowboy, wizard] = pairing;
      const { log } = playMatch(seed, { cowboy: makeBot(cowboy, seed, "cowboy"), wizard: makeBot(wizard, seed, "wizard") });
      let pending = [];
      let batch = 0;
      for (const step of log) {
        pending.push(...step.events);
        if (step.events.some((event) => event.type === "clash")) {
          yield { seed, pairing: pairing.join("/"), batch: ++batch, events: pending };
          pending = [];
        }
      }
    }
  }
}
const ALL = [...cases()];

const where = (c, extra = "") => `replay: CLASH_LOG_SEED=${c.seed} pairing=${c.pairing} batch=${c.batch} ${extra}`;
const integers = (text) => (text.match(/\d+/g) ?? []).map(Number);
const named = (cardId) => CARDS[cardId].name;

// What one event is allowed to put on its line: card names and every integer.
function allowed(event) {
  if (event.type === "damage") {
    const names = [named(event.attacker.cardId)];
    if (event.target.kind === "troop") names.push(named(event.target.cardId));
    return { names, numbers: [event.lane + 1, event.before, event.after] };
  }
  if (event.type === "spell") {
    const numbers = [event.target.slot + 1, event.before, event.after];
    if (event.destination !== undefined) numbers.push(event.destination + 1);
    return { names: [event.spell, named(event.target.cardId)], numbers };
  }
  return { names: [named(event.cardId)], numbers: [event.slot + 1] };
}

test("generated clash batches cover each event kind and both simultaneous directions", () => {
  assert.ok(ALL.length >= 800, `only ${ALL.length} clash batches generated`);
  const seen = { baseHit: 0, troopHit: 0, spell: 0, move: 0, defeat: 0, simultaneous: 0 };
  for (const { events } of ALL) {
    for (const event of events) {
      if (event.type === "damage") seen[event.target.kind === "base" ? "baseHit" : "troopHit"]++;
      if (event.type === "spell") seen[event.destination === undefined ? "spell" : "move"]++;
      if (event.type === "defeat") seen.defeat++;
    }
    const damages = events.filter((event) => event.type === "damage");
    if (damages.some((a) => damages.some((b) => a.lane === b.lane && a.attacker.side !== b.attacker.side))) seen.simultaneous++;
  }
  for (const [kind, count] of Object.entries(seen)) assert.ok(count > 0, `no generated case exercises ${kind}`);
});

test("property: output is deterministic, and the input events are never mutated", () => {
  for (const c of ALL) {
    const before = structuredClone(c.events);
    const frozen = deepFreeze(structuredClone(c.events)); // a write would throw in strict module code
    const first = clashLog(frozen);
    assert.deepEqual(clashLog(structuredClone(c.events)), first, where(c, "(not deterministic)"));
    assert.deepEqual(c.events, before, where(c, "(events were mutated)"));
    assert.ok(first && typeof first.title === "string" && Array.isArray(first.lines) && first.lines.length > 0, where(c));
  }
});

test("property: one line per described event, in order, with only that event's lanes, orbs and names", () => {
  for (const c of ALL) {
    const { lines } = clashLog(c.events);
    const described = c.events.filter((event) => DESCRIBED.has(event.type));
    if (described.length === 0) {
      assert.deepEqual(lines, ["Nothing was hit"], where(c));
      continue;
    }
    assert.equal(lines.length, described.length, where(c, "(line count)"));
    described.forEach((event, at) => {
      const line = lines[at];
      const ctx = where(c, `event#${at}=${JSON.stringify(event)} line=${JSON.stringify(line)}`);
      const { names, numbers } = allowed(event);
      assert.deepEqual(integers(line), numbers, ctx); // lane, before, after (and destination), nothing else
      if (event.type === "defeat") assert.match(line, /was defeated$/, ctx);
      else assert.match(line, new RegExp(`${event.before} → ${event.after} orbs?`), ctx);
      // Every card name on the line belongs to this event: strip them, then no other card name may remain.
      let rest = line.replace(/the Wizard Base/g, "");
      for (const name of [...names].sort((a, b) => b.length - a.length)) rest = rest.split(name).join("");
      for (const other of CARD_NAMES) assert.ok(!rest.includes(other), `${ctx} names ${other}`);
    });
  }
});

test("property: a clash that damages both troops of a lane gives a line for each direction", () => {
  let checked = 0;
  for (const c of ALL) {
    const { lines } = clashLog(c.events);
    const described = c.events.filter((event) => DESCRIBED.has(event.type));
    const damages = described.filter((event) => event.type === "damage");
    for (const a of damages) {
      const b = damages.find((other) => other !== a && other.lane === a.lane && other.attacker.side !== a.attacker.side);
      if (!b) continue;
      checked++;
      for (const event of [a, b]) {
        const line = lines[described.indexOf(event)];
        assert.ok(line.includes(`in lane ${event.lane + 1} hit`), where(c, `missing direction ${event.attacker.side}: ${line}`));
        assert.match(line, new RegExp(`${event.before} → ${event.after} orbs?`), where(c));
      }
      assert.notEqual(lines[described.indexOf(a)], lines[described.indexOf(b)], where(c, "both directions gave the same line"));
    }
  }
  assert.ok(checked > 0, "no simultaneous clash was generated");
});

test("property: undisclosed hand, deck and draw data on events or in the batch never reaches the text", () => {
  const SECRET = "Dragon";
  for (const c of ALL) {
    const plain = clashLog(c.events);
    // Add fields a careless sentence builder might print. The engine does not emit them.
    const seeded = c.events.map((event) => ({ ...event, hand: [SECRET, "Singularity"], deck: [SECRET], drawn: SECRET }));
    const result = clashLog(seeded);
    assert.deepEqual(result, plain, where(c, "(output depends on hand/deck fields)"));
    // Draw events carry no card in the real engine; the text must not mention one.
    for (const event of c.events.filter((e) => e.type === "draw")) assert.equal(event.cardId, undefined, where(c, "draw event now carries a card"));
    const disclosed = c.events.some((e) => [e.cardId, e.attacker?.cardId, e.target?.cardId].some((id) => id && named(id) === SECRET));
    if (!disclosed) assert.ok(!JSON.stringify(plain).includes(SECRET), where(c, "names Dragon without a Dragon event"));
  }
});

test("property: no clash event means no log", () => {
  for (const c of ALL) assert.equal(clashLog(c.events.filter((event) => event.type !== "clash")), null, where(c));
});
