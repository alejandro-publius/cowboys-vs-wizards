// Run: node --test .kiro/powers/orb-duel-review/test/showdown.test.mjs
// Seat privacy and reproducibility of the Showdown MCP tools, on the canonical engine in this checkout.
import test from "node:test";
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {createInterface} from "node:readline";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import {loadEngine, observation, publicEvents, replayProof} from "../showdown.mjs";

const plugin = join(dirname(fileURLToPath(import.meta.url)), "..");
const root = join(plugin, "../../../");
const engine = await loadEngine(root);
const {createShowdown, legalActions, playTurn} = await import(join(root, "src/game/showdown/rules.js"));
const {viewFor} = await import(join(root, "src/game/showdown/contract.js"));

// The same public table with a different hidden Wizard side: its hand, traps and deck are dealt
// again from the same cards, and the seed differs. The Cowboy seat must not be able to tell.
function twin(state, shift) {
  const other = structuredClone(state);
  const wizard = other.sides.wizard;
  const hidden = [...wizard.hand, ...wizard.traps, ...wizard.deck];
  const turned = hidden.map((_, i) => hidden[(i + shift) % hidden.length]);
  wizard.hand = turned.splice(0, wizard.hand.length);
  wizard.traps = turned.splice(0, wizard.traps.length);
  wizard.deck = turned;
  other.seed = state.seed + 7919;
  return other;
}
const seen = (state) => JSON.stringify(observation(viewFor(state, "cowboy"), legalActions(state)));
const leaky = (state) => JSON.stringify(observation({...viewFor(state, "cowboy"), wizardHand: state.sides.wizard.hand}, legalActions(state)));

// Cowboy-to-act states from seeded games with full decks, both sides played by the level-1 bot.
function cowboyStates(seeds) {
  const states = [];
  for (const seed of seeds) {
    let state = createShowdown(seed);
    for (let turn = 0; turn < 24 && !state.result; turn++) {
      if (state.active === "cowboy" && state.sides.wizard.hand.length + state.sides.wizard.deck.length > 1) states.push(state);
      state = playTurn(state, 1).state;
    }
  }
  return states;
}

test("paired hidden states give the Cowboy seat the same observation", () => {
  const states = cowboyStates(Array.from({length: 40}, (_, i) => 1000 + i));
  assert.ok(states.length >= 200, `${states.length} generated states`);
  let trapped = 0;
  for (const state of states) {
    trapped += state.sides.wizard.traps.length > 0;
    for (const shift of [1, 3]) assert.equal(seen(twin(state, shift)), seen(state), `seed ${state.seed} turn ${state.turn}`);
    assert.ok(!seen(state).includes('"seed"'));
  }
  assert.ok(trapped > 0, "some states hold Wizard traps");
});

test("fault injection: the paired check catches an observation that shows the Wizard hand", () => {
  const states = cowboyStates([1000, 1001, 1002]);
  assert.ok(states.some((state) => leaky(twin(state, 1)) !== leaky(state)));
});

test("events keep only the contract's fields", () => {
  assert.deepEqual(publicEvents(engine.EVENTS, [{type: "draw", side: "wizard", cardId: "wizard-hex-1"}, {type: "set", side: "wizard", cardId: "wizard-hex-2"}]),
    [{type: "draw", side: "wizard"}, {type: "set", side: "wizard"}]);
});

function start(env = {}) {
  const child = spawn("node", [join(plugin, "server.mjs")], {cwd: root, env: {...process.env, PLUGIN_DATA: "", ...env}, stdio: ["pipe", "pipe", "inherit"]});
  const waiting = new Map();
  createInterface({input: child.stdout}).on("line", (line) => { const m = JSON.parse(line); waiting.get(m.id)?.(m); });
  let n = 0;
  const call = (method, params) => new Promise((res) => { const id = ++n; waiting.set(id, res); child.stdin.write(JSON.stringify({jsonrpc: "2.0", id, method, params}) + "\n"); });
  const tool = async (name, args) => {
    const r = await call("tools/call", {name, arguments: args});
    return r.error ? {protocolError: r.error} : {text: r.result.content[0].text, json: JSON.parse(r.result.content[0].text), isError: r.result.isError};
  };
  return {tool, stop: () => child.kill()};
}

// Picks from the listed intents using only the observation: strike the Base, then a troop, then summon, then end.
function choose(obs) {
  const rank = ({action}) => (action.type === "attack" && action.target === "base" ? 0 : action.type === "attack" ? 1 : action.type === "summon" ? 2 : action.type === "end" ? 4 : 3);
  return [...obs.intents].sort((a, b) => rank(a) - rank(b))[0].intent;
}

async function playBootHill(server) {
  const first = (await server.tool("start_showdown_duel", {})).json;
  const texts = [];
  let obs = first;
  while (!obs.result) {
    texts.push(JSON.stringify({view: obs.view, intents: obs.intents, events: obs.events, proof: obs.proof}));
    obs = (await server.tool("act_showdown", {session: first.session, revision: obs.revision, intent: choose(obs)})).json;
    assert.equal(obs.error, undefined);
  }
  return {first, last: obs, texts};
}

test("server plays Boot Hill through the tools, reveals the seed only at the end, and replays", {timeout: 20000}, async (t) => {
  const a = start({SHOWDOWN_MCP_DEBUG_SEED: "60"});
  const b = start({SHOWDOWN_MCP_DEBUG_SEED: "60"});
  t.after(() => { a.stop(); b.stop(); });
  const one = await playBootHill(a);
  const two = await playBootHill(b);
  assert.equal(one.first.duel.id, "boot-hill");
  for (const text of one.texts) {
    assert.ok(!/"seed"|"salt"|"deck":\[|"proof"/.test(text), "no seed, salt, deck list or proof before the end");
    const wizard = JSON.parse(text).view.sides.wizard;
    assert.deepEqual(["hand", "traps", "deck"].filter((key) => key in wizard), []);
  }
  assert.equal(one.last.result.winner, "cowboy");
  assert.equal(one.last.proof.seed, 60);
  assert.equal(one.last.proof.commitment, one.first.commitment);
  assert.deepEqual(replayProof(engine, one.last.proof), one.last.result);
  // Two servers, same debug seed, same observations: the transcript is reproducible.
  assert.deepEqual(two.texts, one.texts);
  assert.notEqual(two.first.session, one.first.session);
});

test("stale revisions, unlisted intents and extra inputs are refused", {timeout: 10000}, async (t) => {
  const s = start();
  t.after(() => s.stop());
  const started = await s.tool("start_showdown_duel", {duel: "boot-hill"});
  const obs = started.json;
  assert.ok(!started.text.includes('"seed"'));
  assert.match((await s.tool("act_showdown", {session: obs.session, revision: "0000", intent: 0})).json.error, /stale revision/);
  assert.match((await s.tool("act_showdown", {session: obs.session, revision: obs.revision, intent: 99})).json.error, /not one of/);
  assert.match((await s.tool("observe_showdown", {session: "nope"})).json.error, /unknown session/);
  assert.equal((await s.tool("observe_showdown", {session: obs.session, seed: 1})).protocolError.code, -32602);
  assert.equal((await s.tool("start_showdown_duel", {duel: "../x"})).protocolError.code, -32602);
  const moved = (await s.tool("act_showdown", {session: obs.session, revision: obs.revision, intent: 0})).json;
  assert.notEqual(moved.revision, obs.revision);
  assert.match((await s.tool("act_showdown", {session: obs.session, revision: obs.revision, intent: 0})).json.error, /stale revision/);
});

test("the Kiro CLI Boot Hill receipt replays to the same result", async () => {
  const {readFileSync} = await import("node:fs");
  const receipt = JSON.parse(readFileSync(join(root, "docs/evidence/kiro-showdown-mcp-boot-hill.json"), "utf8"));
  assert.equal(receipt.debugSeed, false);
  assert.equal(receipt.proof.actions.length, receipt.surfacedToolCalls["@orb-duel-review/act_showdown"]);
  assert.deepEqual(replayProof(engine, receipt.proof), receipt.result);
});

// Engine-bound Showdown receipts, checked by an installed-style server (PLUGIN_DATA binding) on a
// copied project holding only the engine closure, so mutations never touch this checkout.
test("inspect_showdown_receipt: pass on the same engine, stale or rejected when engine or fixture is altered", {timeout: 20000}, async (t) => {
  const fs = await import("node:fs");
  const {tmpdir} = await import("node:os");
  const {engineFingerprint} = await import("../showdown.mjs");
  const tmp = fs.mkdtempSync(join(tmpdir(), "showdown-receipt-"));
  t.after(() => fs.rmSync(tmp, {recursive: true, force: true}));
  const project = join(tmp, "project");
  const data = join(tmp, "data");
  const fingerprint = engineFingerprint(root);
  for (const rel of Object.keys(fingerprint.files)) fs.cpSync(join(root, rel), join(project, rel));
  fs.writeFileSync(join(project, "package.json"), JSON.stringify({name: "cowboys-vs-wizards-board", type: "module"}));
  fs.mkdirSync(data);
  fs.writeFileSync(join(data, "project.json"), JSON.stringify({projectRoot: project}));
  assert.equal(engineFingerprint(project + "/").sha256, fingerprint.sha256, "copied closure has the same fingerprint");

  // Record a proof through the tools themselves, with a fixed debug seed.
  const player = start({SHOWDOWN_MCP_DEBUG_SEED: "60"});
  t.after(() => player.stop());
  const played = await playBootHill(player);
  assert.equal(played.first.engine.sha256, fingerprint.sha256);
  assert.deepEqual(played.last.proof.engine, fingerprint);
  const receiptPath = join(project, "docs/evidence/showdown-installed-power/boot-hill-receipt.json");
  const write = (body) => { fs.mkdirSync(dirname(receiptPath), {recursive: true}); fs.writeFileSync(receiptPath, JSON.stringify(body)); };
  const good = {what: "test", result: played.last.result, proof: played.last.proof};
  write(good);

  const s = start({PLUGIN_DATA: data});
  t.after(() => s.stop());
  const check = async (args = {}) => (await s.tool("inspect_showdown_receipt", args)).json;
  const pass = await check();
  assert.equal(pass.verdict, "pass", JSON.stringify(pass.reasons));
  assert.equal(pass.kind, "showdown-gameplay-proof");
  assert.deepEqual(pass.power, {name: "orb-duel-review", version: "1.7.0"});
  assert.equal(pass.receipt.coversCurrentEngine, true);
  assert.deepEqual(pass.replay.result, played.last.result);

  // Mismatched build: one engine file changed after the proof was recorded.
  const rules = join(project, "src/game/showdown/rules.js");
  const original = fs.readFileSync(rules);
  fs.appendFileSync(rules, "\n// altered copy\n");
  const stale = await check();
  assert.equal(stale.verdict, "stale");
  assert.deepEqual(stale.receipt.changedFiles, ["src/game/showdown/rules.js"]);
  fs.writeFileSync(rules, original);
  assert.equal((await check()).verdict, "pass");

  // Altered fixtures on the same engine.
  write({...good, result: {...good.result, winner: "wizard"}});
  assert.equal((await check()).verdict, "rejected");
  write({...good, proof: {...good.proof, seed: good.proof.seed + 1}});
  assert.match((await check()).reasons.join(" "), /commitment/);
  write({...good, proof: {...good.proof, actions: [{type: "attack", slot: 9, target: "base"}, ...good.proof.actions]}});
  assert.equal((await check()).replay.illegalActionAt, 0);
  write({...good, proof: {...good.proof, engine: {...fingerprint, sha256: "0".repeat(64)}}});
  assert.equal((await check()).verdict, "stale");
  write({proof: {}});
  assert.equal((await check()).verdict, "malformed");

  // The earlier workspace-MCP receipt has no engine fingerprint: unbound, never pass.
  const legacy = join(project, "docs/evidence/kiro-showdown-mcp-boot-hill.json");
  fs.cpSync(join(root, "docs/evidence/kiro-showdown-mcp-boot-hill.json"), legacy);
  const unbound = await check({receipt: "mcp-boot-hill"});
  assert.equal(unbound.verdict, "unbound");
  assert.equal(unbound.replay.matchesRecordedResult, true);
  fs.rmSync(receiptPath);
  assert.equal((await check()).verdict, "absent");
  for (const args of [{receipt: "../../etc/passwd"}, {path: "/x"}]) assert.equal((await s.tool("inspect_showdown_receipt", args)).protocolError.code, -32602);
});

test("the installed-Power Boot Hill receipt passes on its recorded Showdown engine", async (t) => {
  const fs = await import("node:fs");
  const {engineFingerprint, inspectShowdownReceipt, loadEngine} = await import("../showdown.mjs");
  const {historicalEngine} = await import("./historical-engine.mjs");
  const receipt = JSON.parse(fs.readFileSync(join(root, "docs/evidence/showdown-installed-power/boot-hill-receipt.json"), "utf8"));
  assert.equal(receipt.debugSeed, false);
  assert.equal(receipt.startCommitment, receipt.proof.commitment);
  assert.equal(receipt.proof.actions.length, receipt.surfacedToolCalls["@orb-duel-review/review/act_showdown"]);
  // docs/evidence/showdown-installed-power.md identifies the source with this fingerprint.
  const historical = historicalEngine(t, root, "2fcf39b7fe4db6f78cb33f6b2c474e053e89bbc7", Object.keys(receipt.proof.engine.files));
  if (!historical) return;
  const verdict = inspectShowdownReceipt(await loadEngine(historical), engineFingerprint(historical), receipt);
  assert.equal(verdict.verdict, "pass", JSON.stringify(verdict.reasons));
});
