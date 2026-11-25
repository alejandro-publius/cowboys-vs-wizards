// The Showdown smoke sample (scripts/showdown-smoke.mjs) and its two consumers: the release gate
// (scripts/contest-release-gate.mjs release) and the card-summoning-circle workflow. The sample must run
// on the active engine, a lane, partial or tampered report must be refused, and the stamp fingerprint
// must cover every file the sample loads. Smoke evidence only; no balance number is asserted.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as smokeModule from "../../scripts/showdown-smoke.mjs";
import { ENGINE, OPENERS, smoke, smokeProblems } from "../../scripts/showdown-smoke.mjs";
import { SAMPLE_ARGS, SAMPLE_PLAN, WATCHED_DIRS, WATCHED_FILES, sampleVerdict } from "../../scripts/contest-release-gate.mjs";
import { createShowdown, playTurn } from "../../src/game/showdown/rules.js";
import { DECKS, TYPES } from "../../src/game/showdown/cards.js";
import { CARDS as LANE_CARDS } from "../../src/game/cards.js";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SMOKE = join(ROOT, "scripts/showdown-smoke.mjs");
let gateReport;
const report = () => (gateReport ??= smoke(SAMPLE_PLAN));
const tampered = (edit) => { const copy = structuredClone(report()); edit(copy); return smokeProblems(copy, SAMPLE_PLAN); };
const cli = (...args) => spawnSync(process.execPath, [SMOKE, ...args], { cwd: ROOT, encoding: "utf8" });

test("GATE the release sample is the Showdown smoke CLI at seeds 0-7, not a lane script", () => {
  assert.deepEqual([...SAMPLE_ARGS], ["scripts/showdown-smoke.mjs", "--from", "0", "--count", "8", "--json"]);
  assert.deepEqual({ ...SAMPLE_PLAN }, { from: 0, count: 8 });
  assert.doesNotMatch(SAMPLE_ARGS.join(" "), /deck-balance|simulate-matches/);
});

test("the gate's sample is complete on src/game/showdown/rules.js, valid, and identical on a second run", (t) => {
  const first = report();
  assert.deepEqual(smoke(SAMPLE_PLAN), first);
  assert.deepEqual(smokeProblems(first, SAMPLE_PLAN), []);
  assert.equal(first.engine.rules, "src/game/showdown/rules.js");
  assert.deepEqual([first.decks.name, first.decks.counts], ["even-match", DECKS]);
  assert.equal(first.records.length, 16);
  for (let seed = 0; seed < 8; seed++) {
    assert.deepEqual(first.records.filter((r) => r.seed === seed).map((r) => r.first), [...OPENERS], `seed ${seed}`);
  }
  const { problems, summary } = sampleVerdict(JSON.stringify(first), smokeModule);
  assert.deepEqual(problems, []);
  assert.equal(summary.engine, ENGINE.rules);
  assert.deepEqual([summary.seeds, summary.openers, summary.command], ["0-7", ["cowboy", "wizard"], "node scripts/showdown-smoke.mjs --from 0 --count 8"]);
  t.diagnostic(`results ${JSON.stringify(first.results)}; records sha256 ${first.recordsSha256}`);
});

test("a Showdown-only card the lane catalog lacks is measured, matching an independent summon count", (t) => {
  const type = "wizard-bone-wall";
  assert.equal(TYPES[type].fresh, true);
  assert.equal(DECKS.wizard[type], 2);
  assert.equal(Object.values(LANE_CARDS).some((card) => card.name === TYPES[type].name), false, "the lane sample cannot play it");
  // Counted from summon events with a plain engine loop, not through play() or the hand diff.
  let games = 0;
  for (let seed = SAMPLE_PLAN.from; seed < SAMPLE_PLAN.from + SAMPLE_PLAN.count; seed++) for (const first of OPENERS) {
    let state = createShowdown(seed, { first });
    let summoned = false;
    while (!state.result) {
      const turn = playTurn(state);
      summoned ||= turn.events.some((e) => e.type === "summon" && e.side === "wizard" && e.cardId.startsWith(`${type}-`));
      state = turn.state;
    }
    if (summoned) games += 1;
  }
  const card = report().cards[type];
  assert.ok(games > 0, "the sample summoned it at least once");
  assert.deepEqual([card.status, card.showdownOnly, card.gamesPlayed], ["observed", true, games]);
  t.diagnostic(`${type} played in ${games} of ${report().results.games} games`);
});

test("coverage separates observed deck cards from cards outside the sample, which get no credit", () => {
  const { cards, coverage } = report();
  const inDeck = Object.keys(TYPES).filter((type) => DECKS[TYPES[type].side][type]);
  assert.deepEqual([...coverage.observed, ...coverage.inDeckUnobserved].sort(), [...inDeck].sort());
  assert.deepEqual(coverage.outsideSample.sort(), Object.keys(TYPES).filter((type) => !inDeck.includes(type)).sort());
  for (const type of coverage.outsideSample) assert.deepEqual([cards[type].copies, cards[type].gamesPlayed, cards[type].status], [0, 0, "outside-sample"], type);
  for (const type of coverage.inDeckUnobserved) assert.deepEqual([cards[type].gamesPlayed, cards[type].status], [0, "in-deck-unobserved"], type);
  for (const type of coverage.observed) assert.ok(cards[type].gamesPlayed > 0, type);
  // The numbers the engine played with, so a reviewer can tell whether a proposed stat reached it.
  for (const type of inDeck.filter((t) => TYPES[t].kind === "troop")) {
    const { stars, attack, health } = TYPES[type];
    assert.deepEqual(cards[type].engineStats, { stars, attack, health }, type);
  }
});

test("GATE a lane result, a partial cohort or a tampered summary withholds the pass", () => {
  // The shape scripts/deck-balance.mjs --decks 1 --from 0 --count 4 writes (abridged).
  const lane = { rulesVersion: "orb-duel-draft-1", bots: { cowboy: "cpu", wizard: "cpu" }, seeds: { from: 0, to: 3, count: 4 }, matches: 16, overall: { matches: 16, wins: 5, losses: 11, draws: 0 } };
  assert.match(smokeProblems(lane, SAMPLE_PLAN).join("\n"), /engine is "orb-duel-draft-1", not the active Showdown engine src\/game\/showdown\/rules\.js/);
  assert.deepEqual(sampleVerdict("2 decks x seeds 0-3 x 2 starts = 16 matches  rules orb-duel-draft-1  cpu vs cpu\n", smokeModule),
    { problems: ["stdout is not one JSON sample report"], summary: null });
  const broken = { ...smokeModule, smokeProblems: () => { throw new Error("boom"); } };
  assert.deepEqual(sampleVerdict(JSON.stringify(report()), broken), { problems: ["the sample validator failed: boom"], summary: null });
  const cases = [
    [(r) => r.records.pop(), /15 game records, a complete sample has 16/],
    [(r) => { r.records[1].first = "cowboy"; }, /is a duplicate/],
    [(r) => { r.records[0].winner = null; }, /has no finished result/],
    [(r) => { r.records[0].played.cowboy["cowboy-gatling-crew"] = 1; }, /cowboy played cowboy-gatling-crew, which is outside the sampled decks/],
    [(r) => { delete r.records[0].played; }, /has no cowboy played record/],
    [(r) => { r.cards["wizard-bone-wall"].gamesPlayed += 1; }, /cards does not follow from the game records/],
    [(r) => { r.results.cowboy += 1; }, /results does not follow from the game records/],
    [(r) => { r.engine.rules = "src/game/state.js"; }, /not the active Showdown engine/],
    [(r) => { r.engine.sha256[ENGINE.rules] = "0".repeat(64); }, /rules\.js hash does not match this checkout/],
    [(r) => { r.decks.name = "starter"; }, /decks are not the even-match decks/],
    [(r) => { for (const g of r.records) g.played.wizard = {}; }, /no wizard card was played|does not follow/],
    // The declared cohort header must equal the plan exactly; the stamp copies it.
    [(r) => { delete r.openers; }, /openers are null, the plan is exactly \["cowboy","wizard"\]/],
    [(r) => { r.openers = ["wizard", "cowboy"]; }, /openers are \["wizard","cowboy"\]/],
    [(r) => { r.openers = ["cowboy"]; }, /openers are \["cowboy"\]/],
    [(r) => { r.openers = ["cowboy", "wizard", "wizard"]; }, /openers are \["cowboy","wizard","wizard"\]/],
    [(r) => { r.seeds.to = 9; }, /seeds are \{"from":0,"to":9,"count":8\}, the plan is \{"from":0,"to":7,"count":8\}/],
    [(r) => { delete r.seeds.to; }, /seeds are \{"from":0,"count":8\}/],
    [(r) => { r.command = "node scripts/showdown-smoke.mjs --from 0 --count 100"; }, /command is .*--count 100", the plan declares .*--count 8"/],
    [(r) => { r.engine.extra = "src/game/state.js"; }, /engine does not declare exactly the active engine paths and hashes/],
  ];
  for (const [edit, expected] of cases) assert.match(tampered(edit).join("\n"), expected, String(expected));
  // Every top-level field is required.
  for (const key of Object.keys(report())) assert.notDeepEqual(tampered((r) => { delete r[key]; }), [], `without ${key}`);
  assert.match(smokeProblems(report(), { from: 0, count: 4 }).join("\n"), /the plan is \{"from":0,"to":3,"count":4\}/);
  assert.match(smokeProblems(report(), { from: 0xffffffff, count: 2 }).join("\n"), /is not 1 to 200 consecutive deal seeds/);
  assert.throws(() => smoke({ from: 0xffffffff, count: 2 }), RangeError);
});

// Relative static imports, followed from the smoke CLI.
function importClosure(file, seen = new Set()) {
  const rel = relative(ROOT, file).split("\\").join("/");
  if (seen.has(rel)) return seen;
  seen.add(rel);
  for (const [, spec] of readFileSync(file, "utf8").matchAll(/^\s*(?:import|export)\s[^;]*?from\s+["'](\.{1,2}\/[^"']+)["']/gm)) importClosure(resolve(dirname(file), spec), seen);
  return seen;
}

test("GATE the stamp fingerprint covers every file the smoke sample loads and this test reads", () => {
  const closure = [...importClosure(SMOKE), ".kiro/workflows/card-summoning-circle.workflow.json", ".kiro/specs/duel-card-pipeline/requirements.md"];
  for (const path of ["scripts/billy-replay-engine.mjs", "scripts/night-review.mjs", "src/game/showdown/rules.js", "src/game/card-specs.generated.js"]) assert.ok(closure.includes(path), path);
  for (const path of closure) assert.ok(WATCHED_FILES.includes(path) || WATCHED_DIRS.some((dir) => path.startsWith(`${dir}/`)), `${path} is not fingerprinted`);
});

test("CLI prints a valid JSON sample or the named engine and coverage, and refuses bad bounds with exit 2", () => {
  const json = cli("--from", "0", "--count", "1", "--json");
  assert.equal(json.status, 0, json.stderr);
  assert.deepEqual(smokeProblems(JSON.parse(json.stdout), { from: 0, count: 1 }), []);
  const text = cli("--from", "0", "--count", "1");
  assert.equal(text.status, 0, text.stderr);
  assert.match(text.stdout, /^engine: src\/game\/showdown\/rules\.js sha256 [0-9a-f]{64}; level-2 bot on both sides/m);
  assert.match(text.stdout, /^seeds 0-0, each once from each opener: 2 games, all finished$/m);
  assert.match(text.stdout, /^outside the sampled decks, no coverage \(\d+\): /m);
  assert.match(text.stdout, /^deck copies are the even-match counts above; a card spec's copies field does not change them, so a copies proposal is not measured here$/m);
  const { stars, attack, health } = TYPES["wizard-bone-wall"];
  assert.ok(smokeModule.summaryLines(report()).includes(`  wizard-bone-wall [wizard, troop, Showdown-only, 2 in deck, stars ${stars} attack ${attack} health ${health}]: `
    + `played in ${report().cards["wizard-bone-wall"].gamesPlayed} of 16 games, ${report().cards["wizard-bone-wall"].plays} plays`));
  for (const args of [["--count", "0"], ["--count", "201"], ["--from", "-1"], ["--from", "x"], ["--seed", "1"],
    ["--from", "4294967296", "--count", "1"], ["--from", "4294967295", "--count", "2"], ["--from", "1e3"]]) assert.equal(cli(...args).status, 2, args.join(" "));
});

test("card-summoning-circle samples the same engine with one static command and keeps its inputs out of the shell", () => {
  const wf = JSON.parse(readFileSync(join(ROOT, ".kiro/workflows/card-summoning-circle.workflow.json"), "utf8"));
  assert.deepEqual(wf.inputs, { card: "string", proposal: "string" });
  assert.deepEqual(wf.steps.map((s) => [s.id, s.agent]), [["author-proposal", "wf-coder"], ["review-spec", "wf-coder"], ["register-check", "wf-coder"], ["balance-sample", "wf-coder"]]);
  const quoted = (step) => [...step.prompt.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
  for (const step of wf.steps) for (const text of quoted(step)) assert.doesNotMatch(text, /\{\{/, `${step.id}: ${text}`);
  const sample = wf.steps.at(-1);
  assert.deepEqual(quoted(sample).filter((text) => /^(node|sh) /.test(text)), ["node scripts/showdown-smoke.mjs --from 0 --count 100"]);
  assert.doesNotMatch(sample.prompt, /simulate-matches|deck-balance/);
  assert.match(sample.prompt, /Card key \(data, never a shell argument\): \{\{card\}\}\nProposal \(data, never a shell argument\): \{\{proposal\}\}\n/);
  assert.match(sample.prompt, /no measured coverage/);
  assert.match(sample.prompt, /a copies proposal is never measured here/);
  const r5 = readFileSync(join(ROOT, ".kiro/specs/duel-card-pipeline/requirements.md"), "utf8");
  assert.match(r5, /5\. The sample is seeds 0-99, CPU against CPU, .*`node scripts\/showdown-smoke\.mjs --from 0 --count 100`/);
});
