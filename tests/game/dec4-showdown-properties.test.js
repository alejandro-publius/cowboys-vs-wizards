// Tests for scripts/showdown-dec4-properties.mjs (Dec 4 Step 6). Written by Kiro CLI
// (native-handoff-properties agent) for Claude Code's draft script. They run every property for
// its quick 25 cases, check the clauses each property cites against the sources, plant real
// faults in the engine to show the properties catch and shrink them, and check the receipt
// against docs/SCORECARD.md. The 10000-run CI pass is not run here:
//   node scripts/showdown-dec4-properties.mjs --ci --report
// Run: node --test tests/game/dec4-showdown-properties.test.js
import test from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual as same } from "node:util";
import { opponent } from "../../src/game/showdown/rules.js";
import {
  BASE_SEED, CI_RUNS, DEFAULT_REPORT, ENGINE, POLICIES, PROPERTIES, QUICK_RUNS, SCHEMA, TEST_FILE, TURN_GOAL,
  buildReport, gameOf, parseArgs, pick, propertyById, readCommit, receiptProblems, redeal, runProperty, seedFor, stableDigest,
} from "../../scripts/showdown-dec4-properties.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const read = (path) => readFileSync(`${ROOT}${path}`, "utf8");
const flat = (text) => text.replace(/\s+/g, " ");
// A code comment wrapped over lines reads as one sentence once the "//" markers go.
const comments = (text) => text.replace(/^\s*\/\/ ?/gm, "");
const SIDES = ["cowboy", "wizard"];

// ---------------------------------------------------------------- the property list
test("20 properties with unique ids, report names and at least one cited clause or stable statement", () => {
  assert.ok(PROPERTIES.length >= 12 && PROPERTIES.length <= 20, `${PROPERTIES.length} properties`);
  assert.equal(new Set(PROPERTIES.map((property) => property.id)).size, PROPERTIES.length);
  assert.equal(new Set(PROPERTIES.map((property) => property.check)).size, PROPERTIES.length, "two properties share one check");
  for (const property of PROPERTIES) {
    assert.match(property.id, /^(rb\d+|rules|contract|stable)-[a-z-]+$/, property.id);
    assert.ok(property.name.length > 20, `${property.id} has no report name`);
    assert.ok(property.clauses.length || property.stable, `${property.id} cites nothing`);
    assert.ok(!property.id.startsWith("stable-") || property.stable, `${property.id} is named stable but states no stable property`);
    assert.equal(propertyById(property.id), property);
  }
});

test("every cited quote is in its source, inside the cited rulebook section", () => {
  const rulebook = read("prototypes/showdown/RULEBOOK.md");
  const sections = Object.fromEntries(rulebook.split(/^## /m).slice(1).map((chunk) => [chunk.split("\n")[0].trim(), flat(chunk)]));
  for (const property of PROPERTIES) {
    for (const { source, section, quote } of property.clauses) {
      const text = section ? sections[section] : flat(source.endsWith(".js") ? comments(read(source)) : read(source));
      assert.ok(text, `${property.id}: ${source} has no section "${section}"`);
      assert.ok(text.includes(flat(quote)), `${property.id}: "${quote}" is not in ${source}${section ? ` §${section}` : ""}`);
    }
  }
});

test("each property draws from its own fast-check seed", () => {
  const seeds = PROPERTIES.map((property) => seedFor(BASE_SEED, property.id));
  assert.equal(new Set(seeds).size, seeds.length);
  assert.ok(seeds.every((seed) => Number.isInteger(seed) && seed === (seed | 0)));
  assert.equal(seedFor(BASE_SEED, "rb3-deal"), seedFor(BASE_SEED, "rb3-deal"));
  assert.notEqual(seedFor(BASE_SEED, "rb3-deal"), seedFor(BASE_SEED + 1, "rb3-deal"));
});

// ---------------------------------------------------------------- the generators
test("a policy only narrows the choice: pick always returns a listed action", () => {
  const action = fc.record({ type: fc.constantFrom("end", "attack", "cover", "summon", "spell", "gear", "location", "set"), slot: fc.nat({ max: 2 }) });
  fc.assert(fc.property(fc.array(action, { minLength: 1, maxLength: 12 }), fc.nat({ max: 0xffff }), fc.constantFrom(...POLICIES), (legal, choice, policy) => {
    assert.ok(legal.includes(pick(legal, choice, policy)));
  }), { seed: BASE_SEED, numRuns: 200 });
});

test("redeal keeps what the viewer sees and moves only the cards hidden from it", () => {
  const game = gameOf({ setupSeed: 7, baseOrbs: null, policy: "uniform", choices: [] });
  const state = ENGINE.createShowdown(game.seed, structuredClone(game.options));
  for (const viewer of SIDES) {
    const twin = redeal(state, viewer, 99);
    const [own, other] = [twin.sides[viewer], twin.sides[opponent(viewer)]];
    const was = state.sides[opponent(viewer)];
    assert.deepEqual(own.hand, state.sides[viewer].hand);
    assert.deepEqual([...own.deck].sort(), [...state.sides[viewer].deck].sort());
    assert.deepEqual([...other.hand, ...other.traps, ...other.deck].sort(), [...was.hand, ...was.traps, ...was.deck].sort());
    assert.deepEqual([other.hand.length, other.traps.length, other.deck.length], [was.hand.length, was.traps.length, was.deck.length]);
    assert.ok(!same(twin, state), "the redeal moved nothing");
  }
});

// ---------------------------------------------------------------- the real engine, 25 cases each
test(`every property passes its quick ${QUICK_RUNS}-case run on the real engine`, () => {
  for (const property of PROPERTIES) {
    const result = runProperty(property);
    assert.equal(result.runs, QUICK_RUNS, property.id);
    assert.equal(result.seed, seedFor(BASE_SEED, property.id), property.id);
    assert.ok(result.passed, `${property.id}: ${result.error?.message}`);
  }
});

test("the same seed gives the same result, and rules-fatigue-clock reports games against the 60-turn goal", () => {
  const property = propertyById("rules-fatigue-clock");
  const [first, second] = [runProperty(property), runProperty(property)];
  assert.deepEqual(first, second);
  assert.equal(first.observed.games, QUICK_RUNS);
  assert.equal(first.observed.pastGoal.turn, TURN_GOAL);
  assert.ok(first.observed.maxFinalTurn <= 81, `a game ran to turn ${first.observed.maxFinalTurn}`);
});

// ---------------------------------------------------------------- planted faults
// Each fault breaks one rule on top of the real engine; the property for that rule must fail,
// shrink, and fail again when replayed from the reported path.
const FAULTS = {
  "contract-hidden-invariance": {
    what: "viewFor shows the other side's hand",
    engine: { ...ENGINE, viewFor: (state, side) => ({ ...ENGINE.viewFor(state, side), peek: state.sides[opponent(side)].hand }) },
  },
  "rb4-turn-boundary": {
    what: "the side starting its turn keeps its troops in cover",
    engine: {
      ...ENGINE,
      applyAction(state, action) {
        const out = ENGINE.applyAction(state, action);
        if (action.type !== "end" || out.state.result) return out;
        const next = structuredClone(out.state);
        for (const troop of next.sides[next.active].board) if (troop) troop.cover = true;
        return { ...out, state: next };
      },
    },
  },
  "stable-log-replay": {
    what: "applyAction writes onto the state it was given",
    engine: { ...ENGINE, applyAction(state, action) { const out = ENGINE.applyAction(state, action); state.lastAction = action; return out; } },
  },
};

for (const [id, fault] of Object.entries(FAULTS)) {
  test(`${id} catches a planted fault (${fault.what}), shrinks it and replays it`, () => {
    const property = propertyById(id);
    const result = runProperty(property, { engine: fault.engine, numRuns: 100 });
    assert.equal(result.passed, false, `${id} missed: ${fault.what}`);
    assert.ok(result.runs >= 1 && result.runs <= 100);
    assert.equal(typeof result.error.shrinks, "number");
    assert.ok(result.error.path && result.error.counterexample, "no replay path or counterexample");
    const again = runProperty(property, { engine: fault.engine, numRuns: 100, path: result.error.path });
    assert.equal(again.passed, false);
    assert.deepEqual(again.error.counterexample, result.error.counterexample);
    assert.equal(again.error.message, result.error.message);
    const report = buildReport([result], { ids: [id], commit: "0".repeat(40), generatedAt: "2026-11-23T00:00:00.000Z" });
    assert.equal(report.properties[0].status, "failed");
    assert.equal(report.errors[0].id, id);
    assert.match(report.errors[0].replay, new RegExp(`--only ${id} --path ${result.error.path}$`));
  });
}

// ---------------------------------------------------------------- the receipt
test("the receipt meets the docs/SCORECARD.md contract and its stable digest ignores only when and where", () => {
  const results = ["rb3-deal", "rb5-targets"].map((id) => runProperty(propertyById(id), { numRuns: 3 }));
  const options = { numRuns: 3, ids: ["rb3-deal", "rb5-targets"], commit: "a".repeat(40) };
  const early = buildReport(results, { ...options, generatedAt: "2026-11-23T00:00:00.000Z" });
  const late = buildReport(results, { ...options, commit: "b".repeat(40), generatedAt: "2026-11-24T08:30:00.000Z" });
  assert.deepEqual(receiptProblems(early), []);
  assert.equal(early.schema, SCHEMA);
  assert.equal(early.stableSha256, late.stableSha256);
  assert.equal(early.stableSha256, stableDigest(early));
  for (const entry of early.properties) {
    assert.deepEqual(Object.keys(entry).filter((key) => ["id", "file", "status", "numRuns", "seed", "runs", "passed"].includes(key)).sort(),
      ["file", "id", "numRuns", "passed", "runs", "seed", "status"]);
    assert.equal(entry.file, TEST_FILE);
  }
  assert.match(read(TEST_FILE), /^import fc from "fast-check";$/m, "the scorecard counts only test files that import fast-check");
  assert.ok(early.fingerprint.files.some((file) => file.path === "src/game/showdown/rules.js"));
  assert.ok(early.fingerprint.files.some((file) => file.path === "prototypes/showdown/RULEBOOK.md"));
  assert.match(early.authorship.draft, /^Claude Code/);
  assert.match(early.authorship.completion, /^Kiro CLI/);
  const tampered = structuredClone(early);
  tampered.properties[0].numRuns = 10_000;
  assert.ok(receiptProblems(tampered).length >= 2, "a changed case count must break the receipt");
  assert.ok(receiptProblems({ ...early, commit: null }).some((problem) => problem.startsWith("commit")));
});

test("the commit is read from this checkout's .git", () => {
  const commit = readCommit();
  assert.ok(commit === null || /^[0-9a-f]{40}$/.test(commit), String(commit));
});

// ---------------------------------------------------------------- the command line
test("quick runs are 25, --ci is 10000, and bad arguments are refused", () => {
  assert.deepEqual(parseArgs([]), { numRuns: QUICK_RUNS, baseSeed: BASE_SEED, ids: null, path: null, report: null, list: false });
  assert.equal(parseArgs(["--ci"]).numRuns, CI_RUNS);
  assert.equal(CI_RUNS, 10_000);
  assert.equal(parseArgs(["--runs", "300"]).numRuns, 300);
  assert.equal(parseArgs(["--report"]).report, DEFAULT_REPORT);
  assert.equal(parseArgs(["--report", "out.json", "--runs", "2"]).report, "out.json");
  assert.deepEqual(parseArgs(["--only", "rb3-deal,rb7-traps"]).ids, ["rb3-deal", "rb7-traps"]);
  for (const bad of [["--runs", "0"], ["--runs"], ["--seed", "1.5"], ["--only", "no-such-property"], ["--fast"]]) {
    assert.throws(() => parseArgs(bad), RangeError, bad.join(" "));
  }
});
