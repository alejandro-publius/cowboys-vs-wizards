// Replay Room coaching lesson over stdio: tools/list, two-stage tools/call, argument rejection,
// missing data, and a spoiler/extra-field sentinel. The tracked lessons.json is only read.
// Run: node --test .kiro/powers/orb-duel-review/test/lesson.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import {createInterface} from "node:readline";

const src = join(dirname(fileURLToPath(import.meta.url)), "..");
const repo = join(src, "../../../");
const real = JSON.parse(readFileSync(join(repo, "apps/replay-room/src/lessons.json"), "utf8"));
const tmp = mkdtempSync(join(tmpdir(), "orb-lesson-"));
const plugin = join(tmp, "installed", "orb-duel-review");
cpSync(src, plugin, {recursive: true});

// One bound project per scenario, each with its own PLUGIN_DATA/project.json.
function bind(name, lessons) {
  const project = join(tmp, name);
  mkdirSync(join(project, "apps/replay-room/src"), {recursive: true});
  if (lessons !== undefined) writeFileSync(join(project, "apps/replay-room/src/lessons.json"), typeof lessons === "string" ? lessons : JSON.stringify(lessons));
  const data = join(tmp, `${name}-data`);
  mkdirSync(data, {recursive: true});
  writeFileSync(join(data, "project.json"), JSON.stringify({projectRoot: project}));
  return data;
}

function start(env) {
  const child = spawn("node", [join(plugin, "server.mjs")], {cwd: tmp, env: {...process.env, PLUGIN_ROOT: plugin, ...env}, stdio: ["pipe", "pipe", "inherit"]});
  const waiting = new Map();
  createInterface({input: child.stdout}).on("line", (l) => { const m = JSON.parse(l); waiting.get(m.id)?.(m); });
  let n = 0;
  const call = (method, params) => new Promise((res) => { const id = ++n; waiting.set(id, res); child.stdin.write(JSON.stringify({jsonrpc: "2.0", id, method, params}) + "\n"); });
  const lesson = async (args) => {
    const r = await call("tools/call", {name: "showdown_replay_lesson", arguments: args});
    return r.error ? {code: r.error.code, message: r.error.message} : {isError: r.result.isError ?? false, text: r.result.content[0].text, json: JSON.parse(r.result.content[0].text)};
  };
  return {call, lesson, stop: () => child.kill()};
}

const OUTCOME_KEYS = /"(winner|endTurn|trace|outcomes|branches|chosen|source)"/;
const HIDDEN_KEYS = /"(hand|deck|traps|wizardHand|wizardTraps|handCount|deckCount|trapCount|stateHash|lines)"/;
const traceBoards = (l) => Object.values(l.branches).flatMap((b) => b.trace.flatMap((t) => [t.cowboyBoard, t.wizardBoard]))
  .filter((s) => s !== l.board.cowboy && s !== l.board.wizard);

test("tools/list advertises the lesson tool with closed enums and keeps the existing tools", {timeout: 5000}, async (t) => {
  const s = start({PLUGIN_DATA: bind("list", real)});
  t.after(s.stop);
  const tools = (await s.call("tools/list")).result.tools;
  assert.deepEqual(tools.map((each) => each.name), ["inspect_duel_replay", "inspect_character_asset", "start_showdown_duel", "observe_showdown", "act_showdown", "inspect_showdown_receipt", "inspect_ride_decision", "inspect_card_review", "showdown_replay_lesson"]);
  const schema = tools.at(-1).inputSchema;
  assert.deepEqual(schema.properties.turnId.enum, ["dragon-c5", "dragon-c5-70"]);
  assert.deepEqual(schema.properties.target.enum, ["dragon", "jack"]);
  assert.deepEqual(schema.required, ["turnId"]);
  assert.equal(schema.additionalProperties, false);
});

test("both seeds and both targets: stage one hides outcomes, stage two orders chosen then other", {timeout: 5000}, async (t) => {
  const s = start({PLUGIN_DATA: bind("real", real)});
  t.after(s.stop);
  for (const l of real) {
    const first = await s.lesson({turnId: l.id});
    assert.equal(first.isError, false, first.text);
    assert.deepEqual(Object.keys(first.json), ["stage", "turnId", "turn", "seed", "seat", "board", "bases", "ownTraps", "allowedTargets", "next"]);
    assert.equal(first.json.stage, "choose");
    assert.equal(first.json.turn, 5);
    assert.equal(first.json.seed, l.seed);
    assert.deepEqual(first.json.board, l.board);
    assert.deepEqual(first.json.bases, l.bases);
    assert.deepEqual(first.json.ownTraps, l.ownTraps);
    assert.deepEqual(first.json.allowedTargets.map((a) => a.id), ["dragon", "jack"]);
    // No branch outcome, no post-choice board, no hidden-seat key.
    assert.doesNotMatch(first.text, OUTCOME_KEYS);
    assert.doesNotMatch(first.text, HIDDEN_KEYS);
    for (const board of traceBoards(l)) assert.equal(first.text.includes(board), false, `stage one leaks ${board}`);

    for (const target of ["dragon", "jack"]) {
      const other = target === "dragon" ? "jack" : "dragon";
      const r = await s.lesson({turnId: l.id, target});
      assert.equal(r.isError, false, r.text);
      assert.equal(r.json.stage, "review");
      assert.equal(r.json.chosen, target);
      assert.match(r.json.source, /^recorded fixed bots/);
      assert.deepEqual(r.json.outcomes, [
        {target, label: r.json.allowedTargets.find((a) => a.id === target).label, winner: l.branches[target].winner, endTurn: l.branches[target].endTurn},
        {target: other, label: r.json.allowedTargets.find((a) => a.id === other).label, winner: l.branches[other].winner, endTurn: l.branches[other].endTurn},
      ]);
      assert.deepEqual(r.json.trace, l.branches[target].trace);
      // Only the selected trace: none of the other branch's distinct boards.
      const mine = new Set(l.branches[target].trace.flatMap((x) => [x.cowboyBoard, x.wizardBoard]));
      for (const x of l.branches[other].trace) for (const b of [x.cowboyBoard, x.wizardBoard]) if (!mine.has(b) && b !== l.board.cowboy && b !== l.board.wizard) assert.equal(r.text.includes(b), false, `stage two leaks the other trace: ${b}`);
      assert.doesNotMatch(r.text, HIDDEN_KEYS);
    }
  }
});

test("unknown ids, targets, extra or non-object args are protocol errors", {timeout: 5000}, async (t) => {
  const s = start({PLUGIN_DATA: bind("args", real)});
  t.after(s.stop);
  for (const args of [{}, {turnId: "dragon-c6"}, {turnId: "../lessons"}, {turnId: 3}, {turnId: "dragon-c5", target: "wizard"}, {turnId: "dragon-c5", target: ""},
    {turnId: "dragon-c5", target: null}, {turnId: "dragon-c5", seed: 3}, {turnId: "dragon-c5", target: "jack", path: "/etc/passwd"}, [], "dragon-c5"]) {
    const r = await s.lesson(args);
    assert.equal(r.code, -32602, JSON.stringify(args));
  }
  assert.match((await s.lesson({turnId: "x"})).message, /turnId must be one of: dragon-c5, dragon-c5-70/);
  assert.match((await s.lesson({turnId: "dragon-c5", target: "x"})).message, /target must be one of: dragon, jack/);
});

test("missing binding, file, lesson or field is reported clearly", {timeout: 5000}, async (t) => {
  const cases = [
    [{PLUGIN_DATA: join(tmp, "nowhere")}, /not bound/],
    [{PLUGIN_DATA: bind("nofile")}, /lesson data missing: apps\/replay-room\/src\/lessons.json is absent/],
    [{PLUGIN_DATA: bind("notjson", "{")}, /not valid JSON/],
    [{PLUGIN_DATA: bind("onlyone", [real[1]])}, /lesson dragon-c5 is missing/],
    [{PLUGIN_DATA: bind("nobranch", [{...real[0], branches: {dragon: real[0].branches.dragon}}])}, /dragon-c5\.branches\.jack is not an object/],
    [{PLUGIN_DATA: bind("badstep", [{...real[0], branches: {...real[0].branches, jack: {...real[0].branches.jack, trace: [{...real[0].branches.jack.trace[0], wizardBase: "SPOILER_SENTINEL"}]}}}])}, /trace\[0\]\.wizardBase is not a non-negative integer/],
  ];
  for (const [env, expected] of cases) {
    const s = start(env);
    try {
      const r = await s.lesson({turnId: "dragon-c5"});
      assert.equal(r.isError, true, r.text);
      assert.match(r.json.error, expected);
      // Errors name the field, never the value.
      assert.equal(r.text.includes("SPOILER_SENTINEL"), false);
    } finally { s.stop(); }
  }
});

test("extra fields injected anywhere in a malformed lesson file never reach either stage", {timeout: 5000}, async (t) => {
  const SENTINEL = "SPOILER_SENTINEL";
  const poisoned = structuredClone(real).map((l) => {
    Object.assign(l, {hand: [SENTINEL], deck: [SENTINEL], wizardTraps: [SENTINEL], answer: SENTINEL, turn: SENTINEL});
    Object.assign(l.board, {wizardHand: SENTINEL});
    Object.assign(l.bases, {wizardDeck: SENTINEL});
    Object.assign(l.branches, {best: SENTINEL});
    for (const b of Object.values(l.branches)) {
      if (typeof b !== "object") continue;
      Object.assign(b, {note: SENTINEL, hand: [SENTINEL]});
      for (const step of b.trace) Object.assign(step, {wizardHand: [SENTINEL], deckCount: SENTINEL, reason: SENTINEL});
    }
    return l;
  });
  poisoned.push({id: "dragon-c5-spoiler", seed: 0, note: SENTINEL});
  const s = start({PLUGIN_DATA: bind("poisoned", poisoned)});
  t.after(s.stop);
  for (const l of real) {
    for (const target of [undefined, "dragon", "jack"]) {
      const r = await s.lesson(target ? {turnId: l.id, target} : {turnId: l.id});
      assert.equal(r.isError, false, r.text);
      assert.equal(r.text.includes(SENTINEL), false, `${l.id} ${target ?? "stage one"} leaks the sentinel`);
      assert.doesNotMatch(r.text, HIDDEN_KEYS);
      assert.equal(r.json.turn, 5);
    }
  }
});

test("workspace MCP (no PLUGIN_DATA) reads the source checkout's lessons.json", {timeout: 5000}, async (t) => {
  const child = spawn("node", [join(src, "server.mjs")], {cwd: tmp, env: {...process.env, PLUGIN_DATA: ""}, stdio: ["pipe", "pipe", "inherit"]});
  t.after(() => child.kill());
  const line = new Promise((res) => createInterface({input: child.stdout}).once("line", res));
  child.stdin.write(JSON.stringify({jsonrpc: "2.0", id: 1, method: "tools/call", params: {name: "showdown_replay_lesson", arguments: {turnId: "dragon-c5-70", target: "jack"}}}) + "\n");
  const body = JSON.parse(JSON.parse(await line).result.content[0].text);
  assert.equal(body.seed, 70);
  assert.deepEqual(body.outcomes.map((o) => [o.target, o.winner, o.endTurn]), [["jack", "cowboy", 17], ["dragon", "wizard", 14]]);
});
