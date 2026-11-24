// fast-check properties G1-G4 of scripts/contest-gate-properties.mjs over whole Showdown games on
// src/game/showdown/ (deals from tests/helpers/boundary-properties/showdown/generate.js). Fixed
// fast-check seed FC_SEED; CONTEST_FC_SEED, CONTEST_FC_PATH and CONTEST_FC_RUNS replay a reported case.
// Needs the devDependency fast-check. The hook-side runner is scripts/contest-release-gate.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { ENGINE } from "../helpers/boundary-properties/showdown/engine.js";
import { f4ViewLeaksOtherHandCard, f6DealKeepsHiddenState } from "../helpers/boundary-properties/showdown/faults.js";
import * as props from "../../scripts/contest-gate-properties.mjs";
import { FC_SEED, PROPERTIES, caseArbitrary, fcProperty, formatFailure, inputOf, paramsFromEnv, propertyById } from "../../scripts/contest-gate-properties.mjs";
import { FAST_RUNS, RELEASE_RUNS, childEnv, guardFileEdit, introducesCompletion, propertyPlan } from "../../scripts/contest-release-gate.mjs";

const params = paramsFromEnv(process.env, { numRuns: 40 });
const G1 = propertyById("G1");

for (const property of PROPERTIES) {
  test(`${property.id} ${property.title}`, (t) => {
    t.diagnostic(`fast-check seed ${params.seed}, ${params.numRuns} runs${params.path ? `, path ${params.path}` : ""}`);
    fc.assert(fcProperty(property), params);
  });
}

test("the ending property reaches both a Base ending and the turn-cap ending under the recorded seed", () => {
  const reasons = new Set();
  fc.assert(fc.property(caseArbitrary, (raw) => { reasons.add(G1.check(inputOf(raw), ENGINE)); }), { seed: FC_SEED, numRuns: 40 });
  assert.deepEqual([...reasons].sort(), ["base", "turn-cap"]);
});

test("a deal with 120-orb Bases and no choices ends at the cap, on turn TURN_CAP + 1", () => {
  const input = inputOf({ setupSeed: 0, baseOrbs: 120, choices: [] });
  assert.equal(G1.check(input, ENGINE), "turn-cap");
});

// Harness verification only: disposable wrappers around the engine, not production bugs.
const faulty = (overrides) => Object.freeze({ ...ENGINE, ...overrides });
const noTurnCap = () => faulty({
  applyAction(state, action) {
    const out = ENGINE.applyAction(state, action);
    if (out.state.result?.reason === "turn-cap") out.state.result = null;
    return out;
  },
});
const fatigueBelowZero = () => faulty({
  applyAction(state, action) {
    const out = ENGINE.applyAction(state, action);
    // The real rules clamp at 0; this fault lets the fatigue draw that empties a Base go one below.
    for (const event of out.events) if (event.type === "fatigue" && out.state.sides[event.side].base === 0) out.state.sides[event.side].base = -1;
    return out;
  },
});
const FAULT_CASES = [
  ["G1", noTurnCap, "turn-cap"],
  ["G2", fatigueBelowZero, "orbs"],
  ["G3", () => f6DealKeepsHiddenState(ENGINE), "replay-diverged"],
  ["G4", () => f4ViewLeaksOtherHandCard(ENGINE), "hidden-leak"],
];

const errorText = (details) => String(details.errorInstance?.message ?? details.error ?? "");

for (const [id, makeEngine, kind] of FAULT_CASES) {
  test(`HARNESS-VERIFY ${id} catches a planted ${makeEngine.name || kind} fault, shrinks it and replays it from seed and path`, (t) => {
    const property = propertyById(id);
    const details = fc.check(fcProperty(property, makeEngine()), { seed: FC_SEED, numRuns: 100 });
    assert.equal(details.failed, true, `${id} missed the planted fault`);
    assert.match(errorText(details), new RegExp(`${kind}:`));
    const report = formatFailure({ property, details });
    assert.match(report, /CONTEST_FC_SEED=-?\d+ CONTEST_FC_PATH=[\d:]+ /);
    t.diagnostic(report.split("\n").slice(0, 3).join(" | "));
    // The reported seed and path reproduce the same minimal counterexample in one run.
    const again = fc.check(fcProperty(property, makeEngine()), { seed: details.seed, path: details.counterexamplePath, numRuns: 1 });
    assert.equal(again.failed, true);
    assert.deepEqual(again.counterexample, details.counterexample);
  });
}

// ---------------------------------------------------------------- gate script (no checks are run here)
const OVERRIDES = { CONTEST_FC_PROPERTY: "G4", CONTEST_FC_SEED: "7", CONTEST_FC_PATH: "3:1", CONTEST_FC_RUNS: "1", PATH: "/bin" };

test("GATE replay overrides change fast mode only; stamping modes run every property at the fixed seed", () => {
  const all = PROPERTIES.map(({ id }) => id);
  for (const mode of ["release", "post-task", "stop"]) {
    const plan = propertyPlan(mode, OVERRIDES, props);
    assert.deepEqual(plan.ids, all, mode);
    assert.equal(plan.seed, FC_SEED, mode);
    assert.equal(plan.numRuns, RELEASE_RUNS, mode);
    assert.equal("path" in plan, false, mode);
  }
  const fast = propertyPlan("fast", OVERRIDES, props);
  assert.deepEqual([fast.ids, fast.seed, fast.path, fast.numRuns], [["G4"], 7, "3:1", 1]);
  assert.deepEqual(propertyPlan("fast", {}, props).ids, all);
  assert.equal(propertyPlan("fast", {}, props).numRuns, FAST_RUNS);
  // verify-duel and deck-balance never inherit the overrides (this test file would otherwise read them).
  assert.deepEqual(childEnv(OVERRIDES), { PATH: "/bin" });
});

const TASKS = ".kiro/specs/demo/tasks.md";
const BEFORE = "# Tasks\n\n- [ ] 1. Wire the gate\n- [-] 2. Write tests\n  - note\n- [x] 3. Old work\n";
const guard = (event, { fresh = false, file = BEFORE, raw } = {}) => {
  let asked = 0;
  let reads = 0;
  const verdict = guardFileEdit({
    raw: raw ?? JSON.stringify(event), event, read: () => { reads++; return file; }, cwd: "/repo",
    fresh: () => { asked++; return fresh; },
  });
  return { ...verdict, asked, reads };
};
const payload = (tool_name, tool_input) => ({ hook_event_name: "PreToolUse", cwd: "/repo", tool_name, tool_input });

test("GATE tasks.md completion detection: a new [x] counts; notes, status markers and rewording a done item do not", () => {
  assert.equal(introducesCompletion(BEFORE, BEFORE.replace("- [ ] 1.", "- [x] 1.")), true);
  assert.equal(introducesCompletion(BEFORE, BEFORE.replace("- [-] 2.", "- [X] 2.")), true);
  assert.equal(introducesCompletion(BEFORE, `${BEFORE}- [x] 4. Added done\n`), true);
  assert.equal(introducesCompletion(BEFORE, BEFORE.replace("- [ ] 1.", "- [-] 1.")), false);
  assert.equal(introducesCompletion(BEFORE, BEFORE.replace("  - note", "  - note, blocked on fast-check")), false);
  assert.equal(introducesCompletion(BEFORE, BEFORE.replace("3. Old work", "3. Old work (done Nov 21)")), false);
  assert.equal(introducesCompletion("- [ ] a\n", "- [ ] a\n- [ ] b\n"), false);
});

test("GATE refuses an introduced [x] in a spec tasks.md without a fresh stamp, for every edit shape", () => {
  const refused = [
    payload("str_replace", { path: `/repo/${TASKS}`, oldStr: "- [ ] 1. Wire", newStr: "- [x] 1. Wire" }),
    payload("fs_write", { path: TASKS, text: BEFORE.replace("- [ ] 1.", "- [x] 1.") }),
    payload("fs_append", { path: TASKS, text: "- [x] 5. Extra\n" }),
    payload("fs_write", { command: "str_replace", path: TASKS, old_str: "- [-] 2.", new_str: "- [x] 2." }),
    payload("fs_write", { command: "create", path: ".kiro/specs/a/b/tasks.md", file_text: "- [x] 1. Wire the gate\n" }),
    payload("fs_write", { command: "append", path: TASKS, new_str: "- [x] 6.\n" }),
  ];
  for (const event of refused) {
    const verdict = guard(event);
    assert.equal(verdict.allow, false, JSON.stringify(event.tool_input));
    assert.match(verdict.reason, /would mark a task \[x\].*node scripts\/contest-release-gate\.mjs release/s);
    assert.equal(guard(event, { fresh: true }).allow, true, "a fresh passing stamp lets it through");
  }
});

test("GATE allows status, progress and note edits to tasks.md, and every other file, without consulting the stamp", () => {
  const allowed = [
    payload("str_replace", { path: TASKS, oldStr: "- [ ] 1.", newStr: "- [-] 1." }),
    payload("str_replace", { path: TASKS, oldStr: "  - note", newStr: "  - note: waiting on review" }),
    payload("fs_write", { path: TASKS, text: `${BEFORE}\nProgress: 1 of 3.\n` }),
    payload("fs_append", { path: TASKS, text: "- [ ] 7. Later\n" }),
    payload("str_replace", { path: "docs/tasks.md", oldStr: "- [ ] a", newStr: "- [x] a" }),
    payload("fs_write", { path: ".kiro/specs/demo/requirements.md", text: "- [x] anything\n" }),
    payload("send_message", { message: "done", severity: "success" }),
  ];
  for (const event of allowed) {
    const verdict = guard(event);
    assert.equal(verdict.allow, true, `${event.tool_name} ${JSON.stringify(event.tool_input)}: ${verdict.reason}`);
    assert.equal(verdict.asked, 0, "the stamp is only fingerprinted for a covered completion");
  }
  // Paths outside .kiro/specs/**/tasks.md are decided before any file is read.
  for (const event of allowed.slice(4)) assert.equal(guard(event).reads, 0, JSON.stringify(event.tool_input));
});

test("GATE judges partial str_replace, append and insert on the whole resulting tasks.md", () => {
  const refused = [
    // "[ ]" -> "[x]" alone completes "- [ ] 1. Wire the gate" (the only "[ ]" in BEFORE).
    payload("str_replace", { path: TASKS, oldStr: "[ ]", newStr: "[x]" }),
    payload("fs_write", { command: "str_replace", path: TASKS, old_str: "[ ]", new_str: "[x]" }),
    // Fragment with trailing text, no list marker in either string.
    payload("str_replace", { path: TASKS, oldStr: "[ ] 1. Wire", newStr: "[x] 1. Wire" }),
    payload("str_replace", { path: TASKS, oldStr: "[-] 2. Write tests", newStr: "[x] 2. Write tests (done)" }),
    // Insert a done item after line 2.
    payload("fs_write", { command: "insert", path: TASKS, insert_line: 2, new_str: "- [x] 8. Inserted" }),
  ];
  for (const event of refused) {
    const verdict = guard(event);
    assert.equal(verdict.allow, false, JSON.stringify(event.tool_input));
    assert.match(verdict.reason, /would mark a task \[x\]/);
    assert.equal(guard(event, { fresh: true }).allow, true, "a fresh passing stamp lets it through");
  }
  // Appending onto an unfinished last line: the joined result "- [x] 1. Wire hooks" is a completion.
  const unfinished = "# Tasks\n\n- [";
  const append = payload("fs_write", { command: "append", path: TASKS, new_str: "x] 1. Wire hooks\n" });
  assert.equal(guard(append, { file: unfinished }).allow, false);
  assert.equal(guard(payload("fs_append", { path: TASKS, text: "x] 1. Wire hooks\n" }), { file: unfinished }).allow, false);
  assert.equal(guard(append, { file: unfinished, fresh: true }).allow, true);
  // The same partial replacements that leave items open stay allowed without the stamp.
  for (const event of [
    payload("str_replace", { path: TASKS, oldStr: "[ ]", newStr: "[-]" }),
    payload("str_replace", { path: TASKS, oldStr: "1. Wire the gate", newStr: "1. Wire the gate (blocked)" }),
    payload("str_replace", { path: TASKS, oldStr: "Old work", newStr: "Old work $& $1" }),
    payload("fs_write", { command: "insert", path: TASKS, insert_line: 4, new_str: "  - note: waiting" }),
    payload("fs_write", { command: "append", path: TASKS, new_str: "Progress: 1 of 3.\n" }),
  ]) {
    const verdict = guard(event);
    assert.equal(verdict.allow, true, `${JSON.stringify(event.tool_input)}: ${verdict.reason}`);
    assert.equal(verdict.asked, 0);
  }
});

test("GATE fails closed on ambiguous or unresolvable partial edits to a covered tasks.md", () => {
  const twoOpen = "- [ ] 1. Wire hooks\n- [ ] 2. Write tests\n";
  const ambiguous = payload("str_replace", { path: TASKS, oldStr: "[ ]", newStr: "[x]" });
  const verdict = guard(ambiguous, { file: twoOpen });
  assert.equal(verdict.allow, false);
  assert.match(verdict.reason, /occurs 2 times, not exactly once \(fail closed\)/);
  assert.equal(guard(ambiguous, { file: twoOpen, fresh: true }).allow, true);
  assert.equal(guard(payload("str_replace", { path: TASKS, oldStr: "absent", newStr: "[x]" })).allow, false, "zero matches");
  assert.equal(guard(payload("str_replace", { path: TASKS, oldStr: "", newStr: "- [x] 1." })).allow, false, "empty old text");
  assert.equal(guard(payload("str_replace", { path: TASKS, oldStr: "[ ]", newStr: "[x]" }), { file: null }).allow, false, "unreadable file");
  assert.equal(guard(payload("fs_append", { path: TASKS, text: "- [x] 9.\n" }), { file: null }).allow, false, "unreadable append target");
  assert.equal(guard(payload("fs_write", { command: "insert", path: TASKS, new_str: "- [ ] 9." })).allow, false, "insert without insert_line");
  assert.equal(guard(payload("fs_write", { command: "insert", path: TASKS, insert_line: 99, new_str: "- [ ] 9." })).allow, false, "insert past the end");
});

test("GATE fails closed on an unparseable or unrecognised edit to a covered tasks.md", () => {
  const unparseable = guard(null, { raw: `{"tool_name":"fs_write","tool_input":{"path":"${TASKS}"` });
  assert.equal(unparseable.allow, false);
  assert.match(unparseable.reason, /unparseable hook payload/);
  assert.equal(guard(payload("str_replace", { path: TASKS, oldStr: "- [ ] 1." })).allow, false);
  assert.equal(guard(payload("fs_write", { command: "delete", path: TASKS })).allow, false);
  assert.equal(guard(payload("fs_write", { path: TASKS, text: 42 })).allow, false);
  assert.equal(guard(null, { raw: "not json" }).allow, true, "unparseable input that names no tasks.md is not covered");
  assert.equal(guard(null, { raw: "garbage tasks.md", fresh: true }).allow, true);
});
