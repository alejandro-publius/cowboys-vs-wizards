// Tests for scripts/saloon-showcases.mjs. Run: node --test tests/match/saloon-showcases.test.js
// Every input here is a tiny, labelled TEST FIXTURE built in a temporary folder. None of it is a
// recorded workflow result. The arena cases play real games with the checkout's arena engine and are
// skipped when that engine (src/game/showdown, experiments/agent-arena) is not present.
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {after, test} from "node:test";
import {pairedFlips, summarizeGames} from "../../scripts/card-forge.mjs";
import {
  ARENA_PERSONAS, Refusal, VIEW, buildArenaShowcase, checkArchive, forgeCheckIds, loadArenaEngine, packageArena, packageForge,
} from "../../scripts/saloon-showcases.mjs";

const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const jsonText = (value) => JSON.stringify(value, null, 2) + "\n";
const temps = [];
const temp = () => { const dir = mkdtempSync(join(tmpdir(), "saloon-showcases-test-")); temps.push(dir); return dir; };
after(() => { for (const dir of temps) rmSync(dir, {recursive: true, force: true}); });
const writeAll = (dir, files) => {
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(join(dir, rel, ".."), {recursive: true});
    writeFileSync(join(dir, rel), text);
  }
};
const refuses = async (fn, pattern) => {
  await assert.rejects(async () => fn(), (error) => error instanceof Refusal && pattern.test(error.message));
};

// ---- Card Forge fixture: the files verify leaves in .artifacts/card-forge ----

const BASE = "f".repeat(40);
const BEFORE = {name: "Fixture Deputy", side: "cowboy", kind: "troop", rarity: "common", tag: "lawman", keys: [], attack: 2, health: 2, stars: 3};

function forgeFiles({mutate = () => {}} = {}) {
  const request = "TEST FIXTURE: a patient deputy who holds the line.\n";
  const brief = {schema: "card-forge/brief@1", base: BASE, request: ".artifacts/card-forge/request.txt", writeOnly: ".artifacts/card-forge/draft.json",
    baseCards: [{baseCard: "cowboy-deputy", copies: 2, ...BEFORE}], takenNames: ["Fixture Deputy"]};
  const draft = {name: "Iron Deputy", baseCard: "cowboy-deputy", attack: 3, health: 3, stars: 4};
  const records = (summons) => Array.from({length: 16}, (_, seed) => ["cowboy", "wizard"].map((first) => ({
    seed, first, winner: (seed + (first === "cowboy" ? 0 : 1)) % 3 === 0 ? null : seed % 2 ? "cowboy" : "wizard",
    reason: seed % 3 === 0 ? "turn-cap" : "base", turns: 8 + seed, actions: 30 + seed, slotSummons: summons(seed),
    digest: sha256(`fixture:${seed}:${first}:${summons(seed)}`)}))).flat();
  const baseline = records(() => 1), variant = records((seed) => (seed % 4 === 0 ? 0 : 1));
  const state = {request, brief, draft, baseline, variant, verdictPass: true, checks: forgeCheckIds().map((id) => ({id, pass: true, detail: "fixture"}))};
  mutate(state);
  const briefText = jsonText(state.brief);
  const prepare = {schema: "card-forge/prepare@1", createdAt: "2026-11-21T10:00:00.000Z", base: BASE, requestSource: "request.txt",
    requestBytes: Buffer.byteLength(request), requestSha256: sha256(request), briefSha256: sha256(briefText)};
  const verdict = {
    schema: "card-forge/verdict@1", createdAt: "2026-11-21T10:05:00.000Z",
    verdict: state.verdictPass ? "PASS" : "FAIL", pass: state.verdictPass, failed: state.checks.filter((c) => !c.pass).map((c) => c.id),
    request: {path: ".artifacts/card-forge/request.txt", sha256: sha256(request), source: "request.txt"},
    draft: state.draft, base: {commit: BASE},
    slot: {baseCard: "cowboy-deputy", side: "cowboy", copies: 2, before: BEFORE, after: {...BEFORE, name: draft.name, attack: 3, health: 3, stars: 4}},
    checks: state.checks,
    games: {bot: "fixture", seeds: {from: 0, to: 15, deals: 16}, seats: ["cowboy first", "wizard first"],
      baseline: summarizeGames(state.baseline, "cowboy"), variant: summarizeGames(state.variant, "cowboy"),
      paired: pairedFlips(state.baseline, state.variant), records: {baseline: state.baseline, variant: state.variant}},
    tool: {script: "a".repeat(64), node: "v22.0.0"}, applied: false,
  };
  return {"request.txt": state.request, "brief.json": briefText, "prepare.json": jsonText(prepare), "draft.json": JSON.stringify(state.draft), "verdict.json": jsonText(verdict)};
}

function forgeRoot(files = forgeFiles()) {
  const root = temp();
  writeAll(join(root, ".artifacts/card-forge"), files);
  return root;
}

test("forge: a passing fixture run becomes a shelf-ready showcase that check-archive accepts", async () => {
  const root = forgeRoot();
  const out = join(temp(), "forge");
  const {file, showcase} = packageForge(root, "fixture-forge-1", out);
  const written = JSON.parse(readFileSync(file, "utf8"));
  assert.deepEqual(written, showcase);
  assert.equal(showcase.nativeWorkflowId, "fixture-forge-1");
  assert.equal(showcase.request, "TEST FIXTURE: a patient deputy who holds the line.\n");
  assert.deepEqual(showcase.draft, {name: "Iron Deputy", baseCard: "cowboy-deputy", attack: 3, health: 3, stars: 4});
  assert.equal(showcase.verified, true);
  assert.equal(showcase.games, 32, "16 seeds from both seats; the two determinism repeats are not counted");
  assert.match(showcase.source, /fixture-forge-1/);
  assert.ok(showcase.source.length <= VIEW.lineMax);
  assert.ok(showcase.checks.length <= VIEW.checksMax && showcase.checks.every((c) => typeof c === "string" && c.length <= VIEW.lineMax));
  assert.ok(showcase.checks.includes("Variant was summoned in 24 of 32 games"));
  assert.equal(showcase.preparedAt, "2026-11-21T10:00:00.000Z");
  assert.equal(showcase.verifiedAt, "2026-11-21T10:05:00.000Z");
  assert.equal(showcase.draftSha256, sha256(forgeFiles()["draft.json"]));
  assert.ok(!JSON.stringify(showcase).includes(root), "no host path leaks into the showcase");
  assert.equal((await checkArchive(out)).kind, "forge");
  // The run folder itself and the .artifacts folder are accepted too.
  packageForge(join(root, ".artifacts/card-forge"), "fixture-forge-1", join(temp(), "a"));
  packageForge(join(root, ".artifacts"), "fixture-forge-1", join(temp(), "b"));
});

test("forge: failed, tampered or incomplete runs are refused", async () => {
  const out = () => join(temp(), "out");
  await refuses(() => packageForge(forgeRoot(forgeFiles({mutate: (s) => { s.verdictPass = false; s.checks[8].pass = false; }})), "wf-1", out()), /did not pass/);
  const tampered = forgeFiles();
  tampered["request.txt"] = "TEST FIXTURE: someone else's idea.\n";
  await refuses(() => packageForge(forgeRoot(tampered), "wf-1", out()), /request\.txt does not match/);
  const otherDraft = forgeFiles();
  otherDraft["draft.json"] = JSON.stringify({name: "Iron Deputy", baseCard: "cowboy-deputy", attack: 4, health: 3, stars: 4});
  await refuses(() => packageForge(forgeRoot(otherDraft), "wf-1", out()), /different draft/);
  await refuses(() => packageForge(forgeRoot(forgeFiles({mutate: (s) => { s.variant[1] = {...s.variant[0]}; }})), "wf-1", out()), /repeats seed 0/);
  await refuses(() => packageForge(forgeRoot(forgeFiles({mutate: (s) => { s.checks.pop(); }})), "wf-1", out()), /exactly the verifier's check set/);
  const missing = forgeFiles();
  delete missing["verdict.json"];
  await refuses(() => packageForge(forgeRoot(missing), "wf-1", out()), /no card-forge run/);
  const extra = {...forgeFiles(), "notes.txt": "extra"};
  await refuses(() => packageForge(forgeRoot(extra), "wf-1", out()), /unexpected entry notes\.txt/);
  await refuses(() => packageForge("relative/dir", "wf-1", out()), /absolute path/);
  await refuses(() => packageForge(forgeRoot(), "bad id with spaces", out()), /nativeWorkflowId/);
  const root = forgeRoot();
  await refuses(() => packageForge(root, "wf-1", join(root, ".artifacts/card-forge/out")), /outside the artifacts run folder/);
});

test("forge: check-archive refuses an edited showcase", async () => {
  const out = join(temp(), "forge");
  packageForge(forgeRoot(), "fixture-forge-2", out);
  const file = join(out, "showcase.json");
  const showcase = JSON.parse(readFileSync(file, "utf8"));
  writeFileSync(file, jsonText({...showcase, games: 34}));
  await refuses(() => checkArchive(out), /number of candidate games/);
  writeFileSync(file, jsonText({...showcase, request: "TEST FIXTURE: edited.\n"}));
  await refuses(() => checkArchive(out), /requestSha256/);
  writeFileSync(file, "{not json");
  await refuses(() => checkArchive(out), /not valid JSON/);
});

// ---- Agent Arena ----

const STUB = {PERSONAS: {"cautious-sheriff": {side: "cowboy"}, "reckless-wizard": {side: "wizard"}}, SEATS: ["cowboy", "wizard"], MAX_REPLAY_STEPS: 1500};

test("arena: a run whose status is not a passing verify is refused before any replay", () => {
  const files = Object.fromEntries(["brief.json", "results.json", "replay.json", ...ARENA_PERSONAS.map((p) => `playbooks/${p}.json`)].map((name) => [name, Buffer.from("{}")]));
  files["status.json"] = Buffer.from(jsonText({stage: "verified", pass: false, at: "2026-11-21T10:00:00.000Z", problems: ["fixture"]}));
  assert.throws(() => buildArenaShowcase(files, "fixture-arena-0", STUB), /passing verify/);
  delete files["replay.json"];
  assert.throws(() => buildArenaShowcase(files, "fixture-arena-0", STUB), /replay\.json is missing/);
});

let engine = null, engineError = null;
try { engine = await loadArenaEngine(); } catch (error) { engineError = error; }
const arenaSkip = engine ? false : `arena engine not available in this checkout (${engineError?.message.split("\n")[0]})`;

const playbookFor = (persona) => ({schema: "agent-arena-playbook/1", persona, motto: "TEST FIXTURE playbook",
  order: persona === "cautious-sheriff" ? ["summon", "attack", "cover", "end"] : ["attack", "summon", "spell", "end"],
  attack: {prefer: ["win-now", "kill", "go-face"], avoid: persona === "cautious-sheriff" ? ["suicide", "even-trade"] : []},
  summon: {prefer: ["strongest"], maxTributes: 1}, spell: {prefer: ["kill"], onlyToKill: false}, gear: {prefer: ["ready"]},
  cover: {when: "threatened"}});

// The files arena.mjs prepare, play and verify leave in .artifacts/agent-arena, from a real series.
function arenaFiles(series = {from: 0, deals: 2}) {
  const texts = {}, books = {}, playbooks = {}, digests = {};
  for (const persona of ARENA_PERSONAS) {
    const text = jsonText(playbookFor(persona));
    const parsed = engine.parsePlaybook(text, persona);
    assert.ok(parsed.ok, parsed.errors?.join("; "));
    const side = engine.PERSONAS[persona].side;
    texts[`playbooks/${persona}.json`] = text;
    books[side] = parsed.playbook;
    digests[persona] = engine.policyDigest(parsed.playbook);
    playbooks[persona] = {file: `.artifacts/agent-arena/playbooks/${persona}.json`, side, fileSha256: sha256(text), policyDigest: digests[persona], policy: parsed.playbook};
  }
  const {games, summary} = engine.playSeries(series, books);
  const replayText = jsonText(engine.recordReplay(series, books, digests));
  const replay = JSON.parse(replayText);
  const fingerprint = {sha256: "e".repeat(64), fileCount: 9};
  return {
    "brief.json": jsonText({kind: "agent-arena-brief/1", preparedAt: "2026-11-21T09:00:00.000Z",
      series: {...series, startingSeats: ["cowboy", "wizard"], games: series.deals * 2}, engine: fingerprint}),
    "status.json": jsonText({stage: "verified", pass: true, at: "2026-11-21T09:10:00.000Z", games: games.length, replayDecisions: replay.decisions}),
    "results.json": jsonText({kind: "agent-arena-results/1", surface: "fixture", playedAt: "2026-11-21T09:05:00.000Z",
      engine: {...fingerprint, files: []}, series, playbooks, games, summary,
      replay: {file: ".artifacts/agent-arena/replay.json", sha256: sha256(replayText), seed: replay.seed, first: replay.first}}),
    "replay.json": replayText,
    ...texts,
  };
}

test("arena: a verified fixture run is replayed and packaged; check-archive replays it again", {skip: arenaSkip}, async () => {
  const files = arenaFiles();
  const root = temp();
  writeAll(join(root, ".artifacts/agent-arena"), files);
  const out = join(temp(), "arena");
  const {file, showcase} = await packageArena(root, "fixture-arena-1", out, engine);
  assert.deepEqual(JSON.parse(readFileSync(file, "utf8")), showcase);
  assert.equal(showcase.verified, true);
  assert.deepEqual(showcase.summary, JSON.parse(files["results.json"]).summary);
  assert.deepEqual(showcase.replay, JSON.parse(files["replay.json"]));
  assert.deepEqual(Object.keys(showcase.policies).sort(), ["cautious-sheriff", "reckless-wizard"]);
  assert.deepEqual(showcase.policies["cautious-sheriff"], playbookFor("cautious-sheriff"));
  assert.equal(showcase.games, 4);
  assert.equal(showcase.verifiedAt, "2026-11-21T09:10:00.000Z");
  assert.ok(!JSON.stringify(showcase).includes(root));
  const checked = await checkArchive(out, engine);
  assert.equal(checked.kind, "arena");

  const edited = JSON.parse(readFileSync(file, "utf8"));
  edited.summary.wins.draw += 1;
  writeFileSync(file, jsonText(edited));
  await refuses(() => checkArchive(out, engine), /different summary/);
});

test("arena: tampered stored files and replays are refused", {skip: arenaSkip}, async () => {
  const build = (files) => () => {
    const buffers = Object.fromEntries(Object.entries(files).map(([k, v]) => [k, Buffer.from(v)]));
    return buildArenaShowcase(buffers, "fixture-arena-2", engine);
  };
  const base = arenaFiles();

  const changedBook = {...base, "playbooks/cautious-sheriff.json": base["playbooks/cautious-sheriff.json"] + " "};
  await refuses(build(changedBook), /changed after play/);

  const replay = JSON.parse(base["replay.json"]);
  replay.steps[0].chosen = replay.steps[0].legal.length; // out of range
  await refuses(build({...base, "replay.json": jsonText(replay)}), /differs from the digest/);

  // A forged replay with a matching stored digest still fails the engine's recomputation.
  const forged = JSON.parse(base["replay.json"]);
  forged.turns += 1;
  const forgedText = jsonText(forged);
  const results = JSON.parse(base["results.json"]);
  results.replay.sha256 = sha256(forgedText);
  await refuses(build({...base, "replay.json": forgedText, "results.json": jsonText(results)}), /ending differs|different replay/);

  const dup = JSON.parse(base["results.json"]);
  dup.games[1] = {...dup.games[0]};
  await refuses(build({...base, "results.json": jsonText(dup)}), /played twice/);

  const moved = JSON.parse(base["results.json"]);
  moved.engine.sha256 = "d".repeat(64);
  await refuses(build({...base, "results.json": jsonText(moved)}), /engine fingerprint/);
});
