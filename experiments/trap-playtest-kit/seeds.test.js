// Issue #120: checks of the T1 trap playtest seed picker and its CLI.
// Run: node --test experiments/trap-playtest-kit/seeds.test.js
// Not part of npm test. Nothing here plays a full match or says anything about balance.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CARDS, DECKS, SIDES } from "../../src/game/cards.js";
import { MAX_ROUNDS, createMatch } from "../../src/game/state.js";
import { applyAction } from "../../src/game/actions.js";
import { DECK_TRAP_CATALOG, openingFor } from "../trap-placeholder/scenarios.js";
import { openingFor as simOpeningFor } from "../trap-deck-sim/sim.js";
import {
  CATEGORIES,
  SCAN_LIMIT,
  T1_SPELL_ID,
  T1_TRAP_ID,
  categoriesOf,
  layoutOf,
  orderOf,
  pickSeeds,
  renderPlan,
  roundForPosition,
} from "./seeds.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const runner = path.join(here, "run.mjs");
const snapshot = () => JSON.stringify({ CARDS, DECKS });
const before = snapshot();
const result = pickSeeds();
const picked = result.picks.map((p) => p.seed);

test("bounded, deterministic and leaves CARDS and DECKS untouched", () => {
  assert.equal(SCAN_LIMIT, 10000);
  assert.equal(result.limit, 10000);
  assert.deepEqual(pickSeeds(), result);
  assert.equal(snapshot(), before);
  assert.throws(() => pickSeeds({ limit: SCAN_LIMIT + 1 }), RangeError);
  assert.throws(() => pickSeeds({ limit: 0 }), RangeError);
});

test("six distinct seeds, A..F in order, three per starting side", () => {
  assert.deepEqual(result.picks.map((p) => p.category), ["A", "B", "C", "D", "E", "F"]);
  assert.ok(picked.every((s) => Number.isInteger(s) && s >= 0 && s < SCAN_LIMIT));
  assert.equal(new Set(picked).size, 6);
  for (const p of result.picks) assert.equal(p.startingSide, p.starter);
  for (const side of SIDES) assert.equal(result.picks.filter((p) => p.startingSide === side).length, 3);
});

test("roundForPosition: opener is round 1, position p is round p - 2", () => {
  assert.deepEqual([0, 1, 2, 3].map(roundForPosition), [1, 1, 1, 1]);
  assert.deepEqual([4, 5, 6, 7, 10, 11].map(roundForPosition), [2, 3, 4, 5, 8, 9]);
});

// Independent recomputation from BASE createMatch only: the T1 trap is spell
// copy 2's BASE position, the T1 spell is spell copy 1's.
function baseLayout(seed) {
  const order = orderOf(createMatch(seed), "cowboy");
  return { seed, startingSide: createMatch(seed).startingSide, trap: order.indexOf("cowboy-deadeye-2"), spell: order.indexOf("cowboy-deadeye-1") };
}
const RULES = {
  A: ({ trap, spell }) => trap < 4 && spell < 4,
  B: ({ trap, spell }) => trap < 4 && spell >= 4,
  C: ({ trap, spell }) => spell < 4 && (trap === 5 || trap === 6),
  D: ({ trap }) => trap === 6 || trap === 7,
  E: ({ trap }) => trap === 10,
  F: ({ trap }) => trap === 11,
};

test("each pick satisfies its category and is the lowest eligible seed", () => {
  const all = Array.from({ length: SCAN_LIMIT }, (_, s) => baseLayout(s));
  const used = new Set();
  for (const p of result.picks) {
    const c = CATEGORIES.find((x) => x.id === p.category);
    const expected = all.find((l) => !used.has(l.seed) && l.startingSide === c.starter && RULES[c.id](l));
    assert.ok(expected, `category ${c.id}`);
    assert.equal(p.seed, expected.seed, `category ${c.id}`);
    assert.equal(p.trap, expected.trap);
    assert.equal(p.spell, expected.spell);
    assert.deepEqual(p.matches, Object.keys(RULES).filter((id) => RULES[id](expected)));
    assert.deepEqual(categoriesOf(layoutOf(p.seed)), p.matches);
    used.add(p.seed);
  }
});

test("picked T1 openings: 12 cards, same setup as BASE, only spell copy 2 relabelled", () => {
  for (const seed of picked) {
    const t1 = openingFor(seed, "T1");
    const base = createMatch(seed);
    assert.equal(t1.startingSide, base.startingSide);
    assert.equal(t1.activeSide, base.activeSide);
    assert.equal(t1.rng, base.rng);
    assert.deepEqual(simOpeningFor(seed, "T1"), t1);
    for (const side of SIDES) {
      const a = orderOf(t1, side);
      const b = orderOf(base, side);
      assert.equal(a.length, 12);
      assert.equal(b.length, 12);
      const kinds = a.map((id) => DECK_TRAP_CATALOG[id].kind);
      assert.equal(kinds.filter((k) => k === "spell").length, 1);
      assert.equal(kinds.filter((k) => k === "trap").length, 1);
      for (let i = 0; i < 12; i++) {
        if (b[i] === `${side === "cowboy" ? "cowboy-deadeye" : "wizard-singularity"}-2`) assert.equal(a[i], `test-fixture-deck-trap-${side}-2`);
        else assert.equal(a[i], b[i]);
      }
    }
  }
});

test("optional T2 example: both Cowboy traps in the opener, same setup as BASE", () => {
  const { seed, traps, startingSide } = result.t2;
  const t2 = openingFor(seed, "T2");
  assert.equal(startingSide, createMatch(seed).startingSide);
  assert.ok(traps.every((p) => p < 4));
  for (const id of ["test-fixture-deck-trap-cowboy-1", "test-fixture-deck-trap-cowboy-2"]) assert.ok(t2.sides.cowboy.hand.includes(id));
  for (let s = 0; s < seed; s++) {
    const order = orderOf(createMatch(s), "cowboy");
    assert.ok(!(order.indexOf("cowboy-deadeye-1") < 4 && order.indexOf("cowboy-deadeye-2") < 4), `seed ${s}`);
  }
});

// Mechanical draw-timing check: both sides only end their phase, so no troop
// is summoned and the match runs to the target round. Not a playtest.
function advanceTo(state, round) {
  while (state.round < round) {
    const r = applyAction(state, { type: "end-phase", side: state.activeSide, revision: state.revision });
    assert.ok(r.ok);
    state = r.state;
  }
  return state;
}

test("the trap enters the Cowboy hand at the start of its listed round, not before", () => {
  for (const p of result.picks) {
    let state = openingFor(p.seed, "T1");
    if (p.trapRound > 1) {
      state = advanceTo(state, p.trapRound - 1);
      assert.ok(!state.sides.cowboy.hand.includes(T1_TRAP_ID), `seed ${p.seed}`);
    }
    state = advanceTo(state, p.trapRound);
    assert.ok(state.sides.cowboy.hand.includes(T1_TRAP_ID), `seed ${p.seed}`);
    assert.equal(state.sides.cowboy.hand.includes(T1_SPELL_ID), p.spellRound <= p.trapRound);
  }
});

test("E can set its trap in round 8; F's round 9 trap is rejected as trap-too-late", () => {
  const opt = { cards: DECK_TRAP_CATALOG };
  for (const id of ["E", "F"]) {
    const p = result.picks.find((x) => x.category === id);
    let state = advanceTo(openingFor(p.seed, "T1"), p.trapRound);
    if (state.activeSide !== "cowboy") {
      state = applyAction(state, { type: "end-phase", side: state.activeSide, revision: state.revision }).state;
    }
    assert.equal(state.round, p.trapRound);
    const r = applyAction(state, { type: "set-trap", side: "cowboy", cardId: T1_TRAP_ID, revision: state.revision }, opt);
    if (id === "E") {
      assert.ok(r.ok);
      assert.deepEqual(r.state.sides.cowboy.trap, { cardId: T1_TRAP_ID, setRound: 8 });
    } else {
      assert.equal(p.trapRound, MAX_ROUNDS);
      assert.equal(r.reason, "trap-too-late");
    }
  }
});

test("seeds.js is pure: no clock, random source, storage, network or node: import", () => {
  const src = readFileSync(path.join(here, "seeds.js"), "utf8")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n");
  assert.deepEqual(src.match(/from "[^"]+"/g), [
    'from "../../src/game/cards.js"',
    'from "../../src/game/state.js"',
    'from "../trap-placeholder/scenarios.js"',
  ]);
  for (const banned of ["Math.random", "Date", "performance", "localStorage", "sessionStorage", "fetch(", "XMLHttpRequest", "node:", "document", "window"]) {
    assert.ok(!src.includes(banned), banned);
  }
});

test("plan text: no Wizard card IDs, no win rates, no timestamps", () => {
  const text = renderPlan(result);
  assert.ok(!/wizard-[a-z]+-\d|test-fixture-deck-trap-wizard/.test(text));
  assert.ok(!/win ?%|win rate|winrate/i.test(text));
  assert.ok(!/\d{4}-\d{2}-\d{2}|\d{1,2}:\d{2}/.test(text));
});

test("CLI: stdout equals committed seed-plan.md and writes nothing without --out", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "trap-kit-"));
  try {
    const plain = spawnSync(process.execPath, [runner], { cwd: dir, encoding: "utf8" });
    assert.equal(plain.status, 0, plain.stderr);
    assert.equal(plain.stdout, renderPlan(result));
    assert.equal(plain.stdout, readFileSync(path.join(here, "seed-plan.md"), "utf8"));
    assert.deepEqual(readdirSync(dir), []);
    const out = path.join(dir, "plan.md");
    const written = spawnSync(process.execPath, [runner, "--out", out], { cwd: dir, encoding: "utf8" });
    assert.equal(written.status, 0, written.stderr);
    assert.equal(readFileSync(out, "utf8"), plain.stdout);
    assert.equal(written.stdout, plain.stdout);
    for (const bad of [["--out"], ["--bogus"], ["--out", out, "x"]]) {
      const r = spawnSync(process.execPath, [runner, ...bad], { cwd: dir, encoding: "utf8" });
      assert.equal(r.status, 2);
      assert.equal(r.stdout, "");
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
