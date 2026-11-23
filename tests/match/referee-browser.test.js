// Pure parts of the referee browser audit: flags, cohort rules, control plans and the observer's parsers.
// The browser run itself needs Playwright and a staged page: node scripts/referee/browser.mjs --canary ...
import assert from "node:assert/strict";
import {test} from "node:test";
import {COHORT_SIZE, DEFAULT_OUT, checkOpening, decodeInstanceId, duelOf, parseArgs, parseTranscripts, pickOpen, planControls, refereeChecks,
  refereeOf, refusalKind, selfChecks, stableView, validateCohort} from "../../scripts/referee/browser.mjs";
import {parseBaseNote, parseCurtain, parseLocation, parseOrbs, parseStatus, parseTraps, parseWorldLabel} from "../../src/ui/showdown-3d/referee-observer.js";
import {BROWSER_REPORT, browserVerdicts, dealKey, inspectBrowserEvidence} from "../../scripts/referee/browser.mjs";
import {canonicalJson, evaluateBrowser, sha256} from "../../scripts/referee/prove.mjs";
import {mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";

const deck = (side, n, offset = 0) => Array.from({length: n}, (_, i) => `${side}-card-${i + 1 + offset}`);
const transcript = (seed, extra = {}) => ({corpus: "primary", complete: true,
  duel: {seed, first: "cowboy", decks: {cowboy: deck("cowboy", 20, seed * 100), wizard: deck("wizard", 20, seed * 100)}, actions: [{type: "end"}]}, ...extra});

test("flags: canary or full, one at a time; comparison refused", () => {
  assert.equal(parseArgs(["--canary", "--transcripts", "t.jsonl"]).mode, "canary");
  assert.equal(parseArgs(["--full", "--transcripts", "t.jsonl"]).mode, "full");
  assert.equal(parseArgs(["--canary", "--seed", "7", "--transcripts", "t"]).seed, 7);
  assert.throws(() => parseArgs(["--canary", "--full", "--transcripts", "t"]), /one of/);
  assert.throws(() => parseArgs(["--transcripts", "t"]), /--canary/);
  assert.throws(() => parseArgs(["--full", "--seed", "1", "--transcripts", "t"]), /canary only/);
  assert.throws(() => parseArgs(["--full", "--transcripts", "t", "--compare"]), /not frozen|frozen/);
  assert.throws(() => parseArgs(["--canary", "--bogus"]), /unknown flag/);
});

test("browser concurrency defaults to serial and is capped at eight contexts", () => {
  const args = ["--full", "--transcripts", "t.jsonl"];
  assert.equal(parseArgs(args).jobs, 1);
  assert.equal(parseArgs([...args, "--jobs", "6"]).jobs, 6);
  for (const count of ["0", "-1", "9", "1.5", "Infinity", "2e0"]) {
    assert.throws(() => parseArgs([...args, "--jobs", count]), /--jobs must be a whole number from 1 to 8/);
  }
  assert.throws(() => parseArgs([...args, "--jobs"]), /--jobs needs a value/);
});

test("instance ids decode to a catalog id and copy number", () => {
  assert.deepEqual(decodeInstanceId("cowboy-sheriff-2"), {catalogId: "cowboy-sheriff", copy: 2});
  assert.deepEqual(decodeInstanceId("wizard-bone-wall-10"), {catalogId: "wizard-bone-wall", copy: 10});
  assert.equal(decodeInstanceId("Sheriff"), null);
  assert.equal(decodeInstanceId("cowboy-sheriff"), null);
});

test("transcripts read as a JSON array or JSON Lines; steps may wrap actions", () => {
  assert.equal(parseTranscripts('[{"a":1},{"a":2}]').length, 2);
  assert.equal(parseTranscripts('{"a":1}\n\n{"a":2}\n').length, 2);
  const {duel, problems} = duelOf({seed: 3, first: "wizard", decks: {cowboy: ["cowboy-x-1"], wizard: ["wizard-y-1"]},
    actions: [{action: {type: "end"}, accepted: true}], cardNames: {"cowboy-x": "X"}});
  assert.deepEqual(problems, []);
  assert.deepEqual(duel.actions, [{type: "end"}]);
  assert.deepEqual(duel.cardNames, {"cowboy-x": "X"});
});

test("duel problems are named, never skipped", () => {
  const {problems} = duelOf({seed: -1, first: "both", decks: {cowboy: ["cowboy-x-1", "cowboy-x-1"], wizard: ["Bad Id"]}, actions: [{type: "dance"}]});
  assert.ok(problems.some((p) => p.includes("seed")));
  assert.ok(problems.some((p) => p.includes("first")));
  assert.ok(problems.some((p) => p.includes("repeats")));
  assert.ok(problems.some((p) => p.includes("do not decode")));
  assert.ok(problems.some((p) => p.includes("dance")));
});

test("the full cohort is exactly 250 distinct complete primary duels, and its seeds are recorded", () => {
  const good = Array.from({length: COHORT_SIZE}, (_, i) => transcript(i));
  const ok = validateCohort(good, {mode: "full"});
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.seeds.length, COHORT_SIZE);
  assert.deepEqual(ok.seeds.slice(0, 3), [0, 1, 2]);
  assert.match(validateCohort(good.slice(1), {mode: "full"}).errors.join(), /exactly 250/);
  const sameSeed = [...good.slice(0, -1), transcript(0)];
  assert.match(validateCohort(sameSeed, {mode: "full"}).errors.join(), /share seed 0/);
  const sameDeal = [...good.slice(0, -1), {...transcript(0), duel: {...transcript(0).duel, seed: 999}}];
  assert.match(validateCohort(sameDeal, {mode: "full"}).errors.join(), /same deal/);
  const unfinished = [...good.slice(0, -1), {...transcript(500), complete: false}];
  assert.match(validateCohort(unfinished, {mode: "full"}).errors.join(), /not marked complete/);
  const other = [...good.slice(0, -1), transcript(501, {corpus: "holdout"})];
  assert.match(validateCohort(other, {mode: "full"}).errors.join(), /not primary/);
});

test("canary runs one duel, chosen by seed when given", () => {
  const set = [transcript(4), transcript(9)];
  assert.deepEqual(validateCohort(set, {mode: "canary"}).seeds, [4]);
  assert.deepEqual(validateCohort(set, {mode: "canary", seed: 9}).seeds, [9]);
  assert.match(validateCohort(set, {mode: "canary", seed: 5}).errors.join(), /no transcript has seed 5/);
});

test("each contract action maps to page controls", () => {
  assert.deepEqual(planControls({type: "summon", cardId: "cowboy-a-1", tributes: [0, 2]}).steps.map((s) => s.click),
    ['#sd-hand [data-card="cowboy-a-1"]', '#sd-board [data-own="0"]', '#sd-board [data-own="2"]']);
  assert.equal(planControls({type: "spell", cardId: "wizard-s-1"}).steps.length, 1);
  assert.equal(planControls({type: "spell", cardId: "wizard-s-1", target: 1}).steps[1].click, '#sd-board [data-enemy="1"]');
  assert.equal(planControls({type: "gear", cardId: "cowboy-g-1", slot: 1}).steps[1].click, '#sd-board [data-own="1"]');
  assert.equal(planControls({type: "location", cardId: "x-l-1"}).steps.length, 1);
  assert.equal(planControls({type: "set", cardId: "x-t-1"}).steps.length, 1);
  assert.equal(planControls({type: "attack", slot: 0, target: "base"}).steps[1].click, '#sd-board [data-enemy="base"]');
  assert.equal(planControls({type: "cover", slot: 2}).steps[1].click, "#sd-cover");
  assert.deepEqual(planControls({type: "end"}).steps.map((s) => s.click), ["#sd-end"]);
  assert.match(planControls({type: "pass"}).unsupported, /no page control/);
});

test("observer parsers read the page's visible wording", () => {
  assert.deepEqual(parseOrbs("3 of 5 orbs"), {now: 3, max: 5});
  assert.equal(parseOrbs("three"), null);
  assert.deepEqual(parseBaseNote("Hand 4 · Deck 17 · Graveyard 0"), {hand: 4, deck: 17, graveyard: 0});
  assert.deepEqual(parseTraps("▲ Set: Snare, Pit"), {count: 2, names: ["Snare", "Pit"]});
  assert.deepEqual(parseTraps("▲ 1 card face down"), {count: 1, names: null});
  assert.deepEqual(parseTraps("▲ Nothing face down"), {count: 0, names: null});
  assert.deepEqual(parseStatus("Two players · turn 3 · the Wizards' turn"), {turn: 3, active: "wizard", result: null});
  assert.deepEqual(parseStatus("The Cowboys win: the Wizard Base fell.").result, {winner: "cowboy", reason: "base-fell"});
  assert.deepEqual(parseStatus("Draw.").result, {winner: null, reason: null});
  assert.equal(parseCurtain("Pass the screen to the Wizard player.").next, "wizard");
  assert.equal(parseLocation("■ Location: Saloon Row. Cowboy troops get +1 attack."), "Saloon Row");
  assert.deepEqual(parseWorldLabel("Traps 1/2"), {title: "Traps", count: 1, of: 2});
  assert.deepEqual(parseWorldLabel("Deck 12"), {title: "Deck", count: 12});
});

const side = (hand) => ({base: {now: 5, max: 5}, counts: {hand, deck: 15, graveyard: 0}, traps: {count: 0, names: []}, backs: null,
  slots: [0, 1, 2].map((slot) => ({side: "x", slot, empty: true}))});
const obs = (hand, extra = {}) => ({curtain: null, viewer: "cowboy", status: {text: "turn 1", turn: 1, active: "cowboy", result: null},
  sides: {cowboy: side(hand.length), wizard: {...side(5), backs: 5}}, hand: hand.map((id) => ({id, enabled: true})),
  controls: {cancel: {shown: false}}, location: null, graveyards: {cowboy: [], wizard: []}, world: {present: true, labels: [{title: "Deck", count: 15}], pawns: null}, ...extra});

test("the opening check compares the visible hand with the transcript deck order", () => {
  const duel = {first: "cowboy", decks: {cowboy: ["a-1", "b-1", "c-1", "d-1", "e-1"], wizard: []}};
  assert.deepEqual(checkOpening(duel, obs(["a-1", "b-1", "c-1", "d-1"])), []);
  assert.match(checkOpening(duel, obs(["b-1", "a-1", "c-1", "d-1"])).join(), /not the deck's first 4/);
  assert.match(checkOpening({...duel, first: "wizard"}, obs(["a-1"])).join(), /transcript first is wizard/);
});

test("self checks flag a hand list that disagrees with its count, and pass a consistent table", () => {
  assert.ok(selfChecks(obs(["a-1", "b-1"])).every((c) => c.pass));
  const off = obs(["a-1"]);
  off.sides.cowboy.counts.hand = 2;
  assert.ok(selfChecks(off).some((c) => !c.pass && c.name === "cowboy hand list matches count"));
  const pawns = obs(["a-1"], {world: {present: true, labels: [{title: "Deck", count: 15}], pawns: [{side: "wizard", slot: 1, name: "Imp"}]}});
  assert.ok(selfChecks(pawns).some((c) => !c.pass && c.name === "wizard slot 1 3D miniature matches"));
});

test("a rejection is judged on the visible table, not on animation state", () => {
  const a = obs(["a-1"]);
  const b = {...obs(["a-1"]), world: {...a.world, motion: "summon"}};
  assert.equal(stableView(a), stableView(b));
  assert.notEqual(stableView(a), stableView(obs(["a-1", "b-1"])));
});

test("flags: --cohort runs every transcript; each mode has its own default report directory, and only --full writes the gate's", () => {
  assert.equal(parseArgs(["--cohort", "--transcripts", "t"]).mode, "cohort");
  assert.equal(parseArgs(["--canary", "--transcripts", "t"]).out, DEFAULT_OUT.canary);
  assert.equal(parseArgs(["--cohort", "--transcripts", "t"]).out, DEFAULT_OUT.cohort);
  assert.equal(parseArgs(["--full", "--transcripts", "t"]).out, BROWSER_REPORT.replace("/report.json", ""));
  assert.equal(parseArgs(["--canary", "--transcripts", "t", "--out", "x"]).out, "x");
  assert.throws(() => parseArgs(["--cohort", "--full", "--transcripts", "t"]), /one of/);
  assert.throws(() => parseArgs(["--cohort", "--seed", "1", "--transcripts", "t"]), /canary only/);
});

test("a cohort is 1 to 250 distinct complete duels, primary or public; --full refuses public duels", () => {
  const set = [transcript(3), transcript(6, {corpus: "public"})];
  assert.deepEqual(validateCohort(set, {mode: "cohort"}).errors, []);
  assert.deepEqual(validateCohort(set, {mode: "cohort"}).seeds, [3, 6]);
  assert.deepEqual(validateCohort([transcript(1, {corpus: "public"})], {mode: "canary"}).errors, []);
  assert.match(validateCohort([transcript(3), transcript(3)], {mode: "cohort"}).errors.join(), /share seed 3/);
  assert.match(validateCohort([], {mode: "cohort"}).errors.join(), /1 to 250/);
  const full = Array.from({length: COHORT_SIZE}, (_, i) => transcript(i, i === 7 ? {corpus: "public"} : {}));
  assert.match(validateCohort(full, {mode: "full"}).errors.join(), /transcript 7: corpus is "public"; --full takes primary/);
});

// A referee state (proof/referee/SCHEMA.md) and the observation of a page that shows it.
const troop = (card, attack, orbs, gear = []) => ({id: `${card.toLowerCase()}-1`, card, type: "Undead", attack, orbs, gear, statuses: [], rest: false, acted: false});
const player = (over = {}) => ({base: 5, hand: [], deck: ["x-1", "x-2"], discard: [], troops: [null, null, null], traps: [null, null], ...over});
const refState = (over = {}) => ({turn: 3, active: "cowboy", first: "cowboy", over: false, winner: null, reason: null, location: null,
  allowances: {troop: true, other: true, trap: true, cards: true},
  players: {cowboy: player({hand: ["cowboy-a-1", "cowboy-b-1"]}), wizard: player({hand: ["w-1", "w-2", "w-3"], discard: ["wizard-imp-1"],
    troops: [null, troop("Skeleton", 1, 2, ["wizard-bone-armor-1"]), null], traps: [{id: "wizard-hex-1", card: "Hex", setTurn: 2}, null]})}, ...over});
const names = {"cowboy-a": "A", "cowboy-b": "B", "wizard-imp": "Imp", "wizard-bone-armor": "Bone Armor", "wizard-hex": "Hex"};
const pageOf = () => {
  const o = obs(["cowboy-a-1", "cowboy-b-1"], {status: {text: "Two players · turn 3 · the Cowboys' turn", turn: 3, active: "cowboy", result: null},
    graveyards: {cowboy: [], wizard: ["Imp"]}});
  o.sides.cowboy.counts = {hand: 2, deck: 2, graveyard: 0};
  o.sides.wizard = {...o.sides.wizard, counts: {hand: 3, deck: 2, graveyard: 1}, traps: {count: 1, names: null},
    slots: [{slot: 0, empty: true}, {slot: 1, empty: false, name: "Skeleton", attack: 1, orbs: {now: 2, max: 1}, gear: ["Bone Armor"]}, {slot: 2, empty: true}]};
  return o;
};

test("referee checks: a page showing the referee state passes every check", () => {
  const checks = refereeChecks(pageOf(), refState(), {names, at: "move 4"});
  assert.deepEqual(checks.filter((c) => !c.pass), []);
  assert.ok(checks.length >= 20);
  assert.ok(checks.every((c) => c.name.startsWith("move 4: ")));
});

test("referee checks: each visible difference fails by name with both values", () => {
  const failed = (page, state = refState()) => refereeChecks(page, state, {names}).filter((c) => !c.pass).map((c) => `${c.name} = ${c.detail}`);
  const base = pageOf(); base.sides.wizard.base = {now: 4, max: 5};
  assert.deepEqual(failed(base), ["state: wizard base = page 4, referee 5"]);
  const orbs = pageOf(); orbs.sides.wizard.slots[1].orbs = {now: 1, max: 1};
  assert.match(failed(orbs).join(), /wizard slot 1 = page Skeleton, 1 attack, 1 orbs gear Bone Armor; referee Skeleton, 1 attack, 2 orbs gear Bone Armor/);
  const hand = pageOf(); hand.hand.reverse();
  assert.match(failed(hand).join(), /cowboy hand = page \[cowboy-b-1, cowboy-a-1\], referee \[cowboy-a-1, cowboy-b-1\]/);
  const grave = pageOf(); grave.graveyards.wizard = ["Skeleton"];
  assert.match(failed(grave).join(), /wizard graveyard cards = page \[Skeleton\], referee \[Imp\]/);
  const turn = pageOf(); turn.status = {...turn.status, turn: 4};
  assert.match(failed(turn).join(), /state: turn = page turn 4, referee turn 3/);
  assert.match(failed(pageOf(), refState({location: {id: "cowboy-saloon-1", card: "Saloon", owner: "cowboy"}})).join(), /location = page none, referee Saloon/);
});

test("referee checks: the result must be shown exactly when the referee game is over, with its winner", () => {
  const over = refState({over: true, winner: "wizard", reason: "base-destroyed"});
  over.players.cowboy.base = 0;
  const shown = pageOf();
  shown.status = {text: "The Wizards win: the Cowboy Base fell.", turn: null, active: null, result: {winner: "wizard", reason: "base-fell"}};
  shown.sides.cowboy.base = {now: 0, max: 5};
  shown.hand = [];
  assert.deepEqual(refereeChecks(shown, over, {names}).filter((c) => !c.pass), []);
  assert.match(refereeChecks(pageOf(), over, {names}).filter((c) => !c.pass).map((c) => c.detail).join(), /shows "Two players · turn 3 · the Cowboys' turn"; referee wizard \(base-destroyed\)/);
  assert.match(refereeChecks(shown, refState(), {names}).filter((c) => !c.pass).map((c) => c.name).join(), /no result yet/);
  assert.match(refereeChecks({curtain: {next: "wizard"}}, refState()).map((c) => c.detail).join(), /curtain is up/);
});

test("a transcript's referee result must give one step per action; refusals are named by their visible form", () => {
  const steps = [{accepted: false, state: refState(), error: "troop-resting"}];
  assert.equal(refereeOf({}, 1).referee, null);
  assert.deepEqual(refereeOf({referee: {result: {seed: 1, initial: refState(), steps, unsupported: []}}}, 1).referee.steps[0],
    {accepted: false, state: refState(), error: "troop-resting"});
  assert.match(refereeOf({referee: {result: {seed: 1, initial: refState(), steps, unsupported: []}}}, 2).problems.join(), /1 steps for 2 actions/);
  assert.match(refereeOf({referee: {result: {seed: 1, initial: refState(), steps, unsupported: ["step 0: x"]}}}, 1).problems.join(), /unsupported/);
  const {problems} = duelOf({...transcript(2), browser: {gestureGaps: []}});
  assert.match(problems.join(), /one entry per action/);
  assert.deepEqual([refusalKind("absent"), refusalKind("disabled"), refusalKind("not visible"), refusalKind("not clickable: x")],
    ["control-absent", "control-disabled", "control-hidden", "control-unclickable"]);
  assert.equal(pickOpen(obs(["a-1"])), false);
  assert.equal(pickOpen(obs(["a-1"], {controls: {cancel: {shown: true}}})), true);
  assert.equal(pickOpen({curtain: {next: "wizard"}}), false);
});

// ---------- browserVerdicts gate ----------
// Every artifact below is written to a fresh temporary root. These are test inputs for the gate's
// logic only; nothing here is read from or written to the checkout's real evidence paths.

const HEAD = "a".repeat(40);
const BUILT_AT = "2026-11-23T10:00:00.000Z";
const frozenDuel = (seed) => ({seed, first: seed % 2 ? "cowboy" : "wizard",
  decks: {cowboy: [`sheriff-${seed}`, "deputy-1"], wizard: ["skeleton-1", "imp-1"]}, actions: [{type: "end"}]});
const CORPUS_MODULE = `import fs from "node:fs";
export const recipe = () => ({name: "gate-test"});
export async function* duels() {
  for (const line of fs.readFileSync(new URL("./frozen.ndjson", import.meta.url), "utf8").split("\\n")) if (line) yield JSON.parse(line);
}
`;

async function writeJson(file, value) {
  await mkdir(path.dirname(file), {recursive: true});
  await writeFile(file, JSON.stringify(value, null, 1) + "\n");
}

// A root holding a staged build, a frozen corpus and a --full browser run in the shapes main() and
// stage-pages.mjs write. `edit` changes pieces before they are written.
async function gateRoot(t, edit = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "referee-browser-gate-"));
  t.after(() => rm(root, {recursive: true, force: true}));
  const seeds = Array.from({length: COHORT_SIZE}, (_, i) => i + 1);
  const corpus = seeds.map(frozenDuel);
  const corpusText = corpus.map((d) => `${canonicalJson(d)}\n`).join("");
  await mkdir(path.join(root, "scripts/referee"), {recursive: true});
  await writeFile(path.join(root, "scripts/referee/corpus.mjs"), CORPUS_MODULE);
  await writeFile(path.join(root, "scripts/referee/frozen.ndjson"), corpusText);
  const html = "<!doctype html><title>illustrated Showdown</title>";
  const index = path.join(root, "dist/web/index.html");
  await mkdir(path.dirname(index), {recursive: true});
  await writeFile(index, html);
  const build = {version: 1, commit: HEAD, builtAt: BUILT_AT, indexHtmlSha256: sha256(html), ...edit.build};
  if (!edit.noBuild) await writeJson(path.join(root, "dist/web/build.json"), build);
  const transcripts = corpus.map((duel) => ({corpus: "primary", complete: true, result: {winner: duel.first}, duel: structuredClone(duel)}));
  edit.transcripts?.(transcripts);
  const transcriptFile = path.join(root, ".artifacts/referee-transcripts.jsonl");
  await mkdir(path.dirname(transcriptFile), {recursive: true});
  await writeFile(transcriptFile, transcripts.map((x) => JSON.stringify(x)).join("\n") + "\n");
  const out = path.join(root, path.dirname(BROWSER_REPORT));
  const records = transcripts.map(({duel, result}) => ({seed: duel.seed, first: duel.first, dealKey: dealKey(duel), status: "complete",
    assertions: {passed: 4, failed: 0, incomplete: 0}, failures: [], incomplete: [], unobservable: [],
    moves: duel.actions.map((action, index) => ({index, action, clicks: [], rejected: null, presentations: []})),
    observedResult: {winner: result?.winner ?? null, reason: "base-fell"}}));
  edit.records?.(records);
  if (!edit.noRun) for (const r of records) if (r) await writeJson(path.join(out, "duels", `${r.seed}.json`), r);
  const report = {tool: "scripts/referee/browser.mjs", mode: "full", page: index, pageSha256: sha256(html), transcripts: transcriptFile,
    startedAt: "2026-11-23T11:00:00.000Z", comparison: "none: referee schema not frozen", reducedMotion: false,
    cohort: {size: COHORT_SIZE, seeds}, totals: {complete: COHORT_SIZE, incomplete: 0, mismatch: 0, passed: 4 * COHORT_SIZE, failed: 0, incompleteFields: 0},
    firstMismatch: null, duels: records.filter(Boolean).map((r) => ({seed: r.seed, status: r.status, assertions: r.assertions, moves: r.moves.length, incomplete: []})),
    finishedAt: "2026-11-23T12:00:00.000Z"};
  edit.report?.(report);
  if (!edit.noRun) await writeJson(path.join(root, BROWSER_REPORT), report);
  const freeze = {schema: "referee-freeze/1", recipe: {name: "gate-test"}, inputs: {sha256: sha256(corpusText), duels: COHORT_SIZE}, ...edit.freeze};
  return {root, ctx: {root, freezeKey: "freeze-key-1", head: HEAD, freeze, ...edit.ctx}};
}

const rejects = (ctx, pattern) => assert.rejects(browserVerdicts(ctx), (error) => {
  assert.match(error.message, /^no genuine frozen-build 250-duel browser receipt: /);
  assert.match(error.message, pattern);
  return true;
});

test("gate: with no browser run and no build identity it fails closed and names both artifacts", async (t) => {
  const {ctx} = await gateRoot(t, {noRun: true, noBuild: true});
  await rejects(ctx, /dist\/web\/build\.json is missing/);
  await rejects(ctx, /referee-browser\/report\.json is missing/);
  const evidence = await inspectBrowserEvidence(ctx);
  assert.equal(evidence.verdicts, null);
  assert.ok(evidence.issues.length >= 2);
});

test("gate: prove.mjs records a thrown gate as missing, never as pass", async (t) => {
  const {ctx} = await gateRoot(t, {noRun: true});
  let section;
  try { section = evaluateBrowser(await browserVerdicts(ctx), ctx); } catch (error) { section = {status: "missing", problems: [error.message]}; }
  assert.equal(section.status, "missing");
  assert.match(section.problems[0], /no --full browser run/);
});

test("gate: a genuine frozen-build 250-duel run yields 250 agreeing verdicts that pass evaluateBrowser", async (t) => {
  const {ctx} = await gateRoot(t);
  const result = await browserVerdicts(ctx);
  assert.equal(result.freezeKey, ctx.freezeKey);
  assert.equal(result.build.commit, HEAD);
  assert.equal(result.verdicts.length, COHORT_SIZE);
  assert.ok(result.verdicts.every((v) => v.verdict === "agree" && v.completed && v.illustrated));
  assert.equal(result.verdicts[0].dealDigest, sha256(canonicalJson({first: frozenDuel(1).first, decks: frozenDuel(1).decks})));
  assert.equal(evaluateBrowser(result, ctx).status, "pass");
});

test("gate: a run of another build, page or commit is refused", async (t) => {
  await rejects((await gateRoot(t, {build: {commit: "b".repeat(40)}})).ctx, /not HEAD a{40}/);
  await rejects((await gateRoot(t, {report: (r) => { r.pageSha256 = "0".repeat(64); }})).ctx, /pageSha256 0{64} is not the staged/);
  await rejects((await gateRoot(t, {report: (r) => { r.page = "/elsewhere/graybox/index.html"; }})).ctx, /is not the staged dist\/web\/index\.html/);
  await rejects((await gateRoot(t, {report: (r) => { r.startedAt = "2026-11-23T09:00:00.000Z"; }})).ctx, /before the staged build/);
});

test("gate: a canary, short, unfinished or simulated report is refused", async (t) => {
  await rejects((await gateRoot(t, {report: (r) => { r.mode = "canary"; }})).ctx, /mode is "canary"/);
  await rejects((await gateRoot(t, {report: (r) => { r.cohort.size = 249; }})).ctx, /cohort is 249/);
  await rejects((await gateRoot(t, {report: (r) => { delete r.finishedAt; }})).ctx, /did not finish/);
  await rejects((await gateRoot(t, {report: (r) => { r.simulated = true; }})).ctx, /marked simulated/);
  await rejects((await gateRoot(t, {records: (rs) => { rs[3].synthetic = "generated"; }})).ctx, /duels\/4\.json: marked synthetic/);
});

test("gate: transcripts must be the frozen corpus duels, and the corpus must match the freeze", async (t) => {
  await rejects((await gateRoot(t, {transcripts: (ts) => { ts[0].duel.actions.push({type: "end"}); }})).ctx, /1 transcript\(s\) are not frozen corpus duels \(first seeds 1\)/);
  await rejects((await gateRoot(t, {freeze: {inputs: {sha256: "f".repeat(64)}}})).ctx, /not the frozen inputs f{64}/);
  await rejects((await gateRoot(t, {ctx: {freeze: null}})).ctx, /ctx\.freeze has no recipe/);
  await rejects((await gateRoot(t, {transcripts: (ts) => { ts[5].complete = false; delete ts[5].result; }})).ctx, /transcript 5: not marked complete/);
});

test("gate: a missing or inconsistent duel record is refused", async (t) => {
  await rejects((await gateRoot(t, {records: (rs) => { rs[9] = null; }})).ctx, /duels\/10\.json is missing/);
  await rejects((await gateRoot(t, {records: (rs) => { rs[0].dealKey = "x"; }})).ctx, /duels\/1\.json: dealKey is not the transcript deal/);
  await rejects((await gateRoot(t, {records: (rs) => { rs[0].moves = []; }})).ctx, /complete after 0 of 1 moves/);
  await rejects((await gateRoot(t, {report: (r) => { r.totals.complete = 249; }})).ctx, /totals disagree/);
});

test("gate: a genuine run whose duels disagree or stop short returns verdicts that fail evaluateBrowser", async (t) => {
  const {ctx} = await gateRoot(t, {records: (rs) => {
    rs[0].observedResult.winner = rs[0].observedResult.winner === "cowboy" ? "wizard" : "cowboy";
    Object.assign(rs[1], {status: "incomplete", assertions: {passed: 1, failed: 0, incomplete: 1}, observedResult: null});
  }, report: (r) => { r.duels[1].status = "incomplete"; r.totals.complete--; r.totals.incomplete++; }});
  const result = await browserVerdicts(ctx);
  assert.deepEqual(result.verdicts.slice(0, 2).map((v) => v.verdict), ["disagree", "incomplete"]);
  const section = evaluateBrowser(result, ctx);
  assert.equal(section.status, "fail");
  assert.equal(section.counts.other, 2);
});

test("gate: the gate only reads; it writes nothing under the root", async (t) => {
  const {root, ctx} = await gateRoot(t);
  const before = await readFile(path.join(root, BROWSER_REPORT), "utf8");
  await browserVerdicts(ctx);
  assert.equal(await readFile(path.join(root, BROWSER_REPORT), "utf8"), before);
});
