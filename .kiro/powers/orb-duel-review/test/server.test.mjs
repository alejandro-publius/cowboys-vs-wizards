// Run: node --test .kiro/powers/orb-duel-review/test/server.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {spawn, spawnSync} from "node:child_process";
import {cpSync, mkdirSync, mkdtempSync, writeFileSync, appendFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {tmpdir} from "node:os";
import {join, dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {createInterface} from "node:readline";

const src = join(dirname(fileURLToPath(import.meta.url)), "..");
const tmp = mkdtempSync(join(tmpdir(), "orb-review-"));
const plugin = join(tmp, "installed", "orb-duel-review");
const data = join(tmp, "data");
const project = join(tmp, "project");
cpSync(src, plugin, {recursive: true});

function glb(json, length) {
  let body = Buffer.from(JSON.stringify(json));
  while (body.length % 4) body = Buffer.concat([body, Buffer.from(" ")]);
  const b = Buffer.alloc(20 + body.length);
  b.writeUInt32LE(0x46546c67, 0); b.writeUInt32LE(2, 4); b.writeUInt32LE(length ?? b.length, 8);
  b.writeUInt32LE(body.length, 12); b.writeUInt32LE(0x4e4f534a, 16); body.copy(b, 20);
  return b;
}
const page = "<html>build 1</html>";
const sha = (s) => createHash("sha256").update(s).digest("hex");
mkdirSync(join(project, "assets/models"), {recursive: true});
mkdirSync(join(project, "scripts"), {recursive: true});
mkdirSync(join(project, "dist"), {recursive: true});
mkdirSync(join(project, ".artifacts/kiro/replay"), {recursive: true});
writeFileSync(join(project, "package.json"), JSON.stringify({name: "cowboys-vs-wizards-board"}));
writeFileSync(join(project, "scripts/audit-assets.mjs"), "");
writeFileSync(join(project, "dist/cowboys-vs-wizards-board-duel.html"), page);
writeFileSync(join(project, ".artifacts/kiro/replay/browser-run.json"), JSON.stringify({
  page: {sha256: sha(page)}, consoleErrors: [], seed: 0,
  steps: Array.from({length: 8}, (_, i) => ({id: `s${i}`, state: "observed"})),
}));
writeFileSync(join(project, "assets/models/billy.glb"), glb({meshes: [{primitives: [{attributes: {POSITION: 0}, indices: 1}]}], accessors: [{count: 3}, {count: 3}], skins: [{joints: [1, 2]}], animations: [{name: "Attack"}]}));
writeFileSync(join(project, "assets/models/wizard.glb"), glb({}, 999));

function start(env) {
  const child = spawn("node", [join(plugin, "server.mjs")], {cwd: plugin, env: {...process.env, PLUGIN_ROOT: plugin, ...env}, stdio: ["pipe", "pipe", "inherit"]});
  const waiting = new Map();
  createInterface({input: child.stdout}).on("line", (l) => { const m = JSON.parse(l); waiting.get(m.id)?.(m); });
  let n = 0;
  const call = (method, params) => new Promise((res) => { const id = ++n; waiting.set(id, res); child.stdin.write(JSON.stringify({jsonrpc: "2.0", id, method, params}) + "\n"); });
  const tool = async (name, args) => { const r = await call("tools/call", {name, arguments: args}); return r.error ?? {...r.result, json: JSON.parse(r.result.content[0].text)}; };
  return {call, tool, stop: () => child.kill()};
}

test("manifest and MCP entry use supported packaging fields", async () => {
  const {default: fs} = await import("node:fs");
  assert.equal("skills" in JSON.parse(fs.readFileSync(join(plugin, "plugin.json"), "utf8")), false);
  assert.deepEqual(JSON.parse(fs.readFileSync(join(plugin, "mcp.json"), "utf8")).mcpServers.review, {type: "stdio", command: "node", args: ["${PLUGIN_ROOT}/server.mjs"]});
});

test("setup validates and writes only project.json", () => {
  const bad = spawnSync("node", [join(plugin, "setup.mjs"), tmp, data]);
  assert.notEqual(bad.status, 0);
  const ok = spawnSync("node", [join(plugin, "setup.mjs"), project, data]);
  assert.equal(ok.status, 0, ok.stderr.toString());
});

test("unbound PLUGIN_DATA is unavailable", {timeout: 5000}, async (t) => {
  const s = start({PLUGIN_DATA: join(tmp, "empty")});
  t.after(s.stop);
  const r = await s.tool("inspect_duel_replay", {});
  assert.equal(r.json.verdict, "unavailable");
  const c = await s.tool("inspect_character_asset", {model: "billy"});
  assert.equal(c.isError, true);
});

test("bound server from copied plugin", {timeout: 5000}, async (t) => {
  const s = start({PLUGIN_DATA: data});
  t.after(s.stop);
  const init = await s.call("initialize", {protocolVersion: "2024-11-05"});
  assert.equal(init.result.serverInfo.version, "1.6.0");
  assert.equal(JSON.parse((await import("node:fs")).readFileSync(join(plugin, "plugin.json"), "utf8")).version, "1.6.0");
  assert.deepEqual((await s.call("tools/list")).result.tools.map((t) => t.name), ["inspect_duel_replay", "inspect_character_asset", "start_showdown_duel", "observe_showdown", "act_showdown", "inspect_showdown_receipt", "inspect_ride_decision", "showdown_replay_lesson"]);

  const lane = (await s.tool("inspect_duel_replay", {})).json;
  assert.equal(lane.verdict, "pass");
  // A page-hash pass is labelled as the lane build, never as Showdown gameplay proof.
  assert.equal(lane.kind, "lane-duel-chrome-replay");
  assert.equal(lane.showdownProof, false);
  // This lane-only project has no Showdown receipt or engine.
  assert.equal((await s.tool("inspect_showdown_receipt", {})).json.verdict, "absent");
  appendFileSync(join(project, "dist/cowboys-vs-wizards-board-duel.html"), "<!-- mutated -->");
  assert.equal((await s.tool("inspect_duel_replay", {})).json.verdict, "stale");

  for (const args of [{path: "/etc/passwd"}, {target: "../x"}, {target: "standalone", url: "http://x"}]) {
    assert.equal((await s.tool("inspect_duel_replay", args)).code, -32602);
  }
  assert.equal((await s.tool("inspect_character_asset", {model: "../../etc/passwd"})).code, -32602);

  const ok = await s.tool("inspect_character_asset", {model: "billy"});
  assert.equal(ok.json.triangles, 1);
  assert.equal(ok.json.joints, 2);
  assert.deepEqual(ok.json.clips, ["Attack"]);
  const bad = await s.tool("inspect_character_asset", {model: "wizard"});
  assert.equal(bad.isError, true);
  assert.match(bad.json.error, /invalid GLB/);
});
