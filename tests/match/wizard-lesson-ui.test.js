// Wizard lesson page (src/ui/wizard-lesson.js) after the wizard-lesson-receipt/2 format change: episode capture from a
// finished duel, the committed seed-0 bait (proof/wizard-lesson/bait-search.json), receipts matched by episodeKey and
// re-checked with verifyLessonBundle, labels, the rematch session and the opt-in. Every call goes to the module's real
// exports and the real engine; nothing here stands in for src/game/showdown/wizard-lesson-policy.js.
// The accepted receipts come from scripts/wizard-lesson/fixture.mjs. They are SIMULATED: no Kiro run made them. The
// "imported" copy has the fixture marker removed only to exercise the train.mjs label path.
// mountWizardLesson gets a minimal fake root and document: it reads only innerHTML, querySelector, addEventListener and
// event.target, so the page logic (opt-in, import, storage) runs unchanged without a browser.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {DECKS} from "../../src/game/showdown/cards.js";
import {parseDealSeed} from "../../src/game/showdown/seed.js";
import {DEFAULT_LESSON_POLICY, findBaitEpisode} from "../../src/game/showdown/wizard-lesson-policy.js";
import {createShowdownSession} from "../../src/match/showdown-session.js";
import {simulatedLesson, simulatedReceipt} from "../../scripts/wizard-lesson/fixture.mjs";
import {
  EPISODE_VERSION, LessonError, MAX_IMPORT_BYTES, RECEIPT_SCHEMA, STORE_KEY, TRAIN_COMMAND, captureEpisode, checkReceipt, createLessonSession,
  draftFromFile, lessonDuel, lessonLabel, lessonSetup, markEpisode, markable, mountWizardLesson, turnAdvice,
} from "../../src/ui/wizard-lesson.js";

const BAIT = JSON.parse(readFileSync(new URL("../../proof/wizard-lesson/bait-search.json", import.meta.url), "utf8"));
// The bait's own deal: seed 0, default decks, the Wizard opens, level-2 Wizard.
const BAIT_DUEL = {id: "open", kind: "open", name: "Open range", level: 2, options: {first: "wizard"}};

test("link seeds and reviewable lessons use the same unsigned 32-bit range", () => {
  for (const value of [null, "", "  ", "abc", "-5", "1.5", "4294967296", "Infinity"]) {
    assert.equal(parseDealSeed(value), null, String(value));
  }
  for (const seed of [-5, 1.5, 4294967296, NaN]) assert.equal(lessonSetup(BAIT_DUEL, seed), null);
  for (const seed of [0, 47, 4294967295]) {
    assert.equal(parseDealSeed(String(seed)), seed);
    assert.ok(lessonSetup(BAIT_DUEL, seed));
  }
});
const json = (value) => JSON.parse(JSON.stringify(value));
const tick = () => new Promise((resolve) => setImmediate(resolve));
const choose = (legal) => legal.find((a) => a.type === "attack") ?? legal.find((a) => a.type !== "end" && a.type !== "cover") ?? legal.find((a) => a.type === "end");
const castsHellfire = (events) => events.some((event) => event.type === "spell" && /^wizard-hellfire/.test(event.cardId));

// Plays one deal through the ordinary session, as the screen does, and keeps what the screen keeps.
function playedDuel(seed, duel = BAIT_DUEL) {
  const setup = lessonSetup(duel, seed);
  const session = createShowdownSession({seed, duel});
  const cowboyActions = [];
  for (let step = 0; step < 400 && !session.view().result; step += 1) {
    const action = choose(session.legal());
    cowboyActions.push(structuredClone(action));
    session.act(action);
  }
  const view = session.view();
  return {seed, setup, cowboyActions, expected: {result: view.result, turn: view.turn}};
}

function baitMarked() {
  const opened = draftFromFile(BAIT);
  return {...opened, marked: markEpisode(opened.draft, opened.selected)};
}

// The simulated fixture is an engine search over seeds 0-200; it is computed once for the whole file.
let fixtureCache;
function fixture() {
  fixtureCache ??= simulatedLesson(BAIT);
  assert.ok(!fixtureCache.none, "scripts/wizard-lesson/fixture.mjs found no simulated lesson for the seed-0 bait");
  return fixtureCache;
}
function receipts() {
  const {draft, marked} = baitMarked();
  const simulated = simulatedReceipt(fixture(), marked.key);
  const {fixture: _simulated, ...imported} = structuredClone(simulated);
  const pending = {...structuredClone(imported), status: "pending", reasons: ["no revision passed verifyLessonBundle in 2 attempts"],
    revised: null, verification: null, lesson: null};
  return {draft, marked, simulated, imported, pending};
}

function memoryStorage(entries = {}) {
  const map = new Map(Object.entries(entries));
  return {getItem: (key) => (map.has(key) ? map.get(key) : null), setItem: (key, value) => { map.set(key, String(value)); }, removeItem: (key) => { map.delete(key); }};
}
function mountPage({storage = memoryStorage()} = {}) {
  const listeners = {};
  const keydown = [];
  const root = {hidden: false, innerHTML: "", querySelector: () => null, addEventListener: (type, fn) => { listeners[type] = fn; }};
  const rematches = [];
  const closes = [];
  const files = [];
  const previous = globalThis.document;
  globalThis.document = {addEventListener: (type, fn) => { if (type === "keydown") keydown.push(fn); }};
  let page;
  try {
    page = mountWizardLesson(root, {storage, onRematch: (request) => rematches.push(request), onClose: () => closes.push(true), save: (name, text) => files.push({name, text})});
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
  const click = (id, dataset = {}) => listeners.click({target: {closest: () => ({id, dataset, disabled: false})}});
  const uploadFile = async (id, file) => { listeners.change({target: {id, files: [file], value: "chosen"}}); await tick(); };
  const upload = (id, value) => {
    const text = typeof value === "string" ? value : JSON.stringify(value);
    return uploadFile(id, {size: text.length, text: async () => text});
  };
  return {
    root, page, storage, rematches, closes, files, click, upload, uploadFile,
    html: () => root.innerHTML,
    pick: (index) => click("", {pick: String(index)}),
    optIn: (checked) => listeners.change({target: {id: "wl-optin", checked}}),
    escape: () => keydown.forEach((fn) => fn({key: "Escape", defaultPrevented: false, preventDefault() {}})),
    stored: () => JSON.parse(storage.getItem(STORE_KEY)),
  };
}

test("the public constants name the episode, receipt and storage formats", () => {
  assert.equal(EPISODE_VERSION, 1);
  assert.equal(RECEIPT_SCHEMA, "wizard-lesson-receipt/2");
  assert.equal(STORE_KEY, "cvw-wizard-lesson-v2");
  assert.equal(MAX_IMPORT_BYTES, 256 * 1024);
  assert.match(TRAIN_COMMAND, /^node scripts\/wizard-lesson\/train\.mjs --episode \S+ --out \S+\.json$/);
});

test("a lesson setup is offered only for a level-2 Wizard duel without arrivals, frozen with its resolved opener", () => {
  const setup = lessonSetup(BAIT_DUEL, 0);
  assert.deepEqual(json(setup), BAIT.episode.setup);
  assert.ok(Object.isFrozen(setup));
  const orbs = lessonSetup({level: 2, options: {baseOrbs: {cowboy: 5, wizard: 4}}}, 11);
  assert.ok(["cowboy", "wizard"].includes(orbs.first));
  assert.deepEqual(json(orbs.baseOrbs), {cowboy: 5, wizard: 4});
  assert.equal(lessonSetup({...BAIT_DUEL, level: 1}, 0), null);
  assert.equal(lessonSetup({...BAIT_DUEL, level: 1.5}, 0), null);
  assert.equal(lessonSetup({level: 2, options: {arrivals: {wizard: [{type: "wizard-dragon", turn: 4, health: 4}]}}}, 0), null);
  assert.equal(lessonSetup(BAIT_DUEL, 1.5), null);
  assert.equal(lessonSetup(BAIT_DUEL, undefined), null);
  assert.equal(lessonSetup(null, 0), null);
});

test("a finished duel becomes an unmarked draft with both seats' actions in order and the lines the duel showed", () => {
  for (const [seed, duel] of [[0, BAIT_DUEL], [11, {level: 2, options: {baseOrbs: {cowboy: 5, wizard: 4}}}]]) {
    const record = playedDuel(seed, duel);
    assert.ok(record.expected.result, `seed ${seed} finished`);
    const {draft, lines, selected} = captureEpisode(record);
    assert.equal(selected, null);
    assert.equal(draft.seed, seed);
    assert.deepEqual(draft.setup, record.setup);
    assert.deepEqual(draft.actions.filter((a) => a.side === "cowboy").map((a) => a.action), record.cowboyActions);
    assert.ok(draft.actions.some((a) => a.side === "wizard"));
    assert.equal(lines.length, draft.actions.length);
    draft.actions.forEach((entry, i) => {
      assert.equal(typeof lines[i], "string");
      assert.ok(lines[i].length > 0);
      if (entry.action.type === "end") assert.equal(lines[i], "Ended the turn.");
    });
    const indices = markable(draft);
    assert.ok(indices.length >= 1);
    for (const i of indices) assert.ok(draft.actions[i].side === "wizard" && draft.actions[i].action.type !== "end");
    const marked = markEpisode(draft, indices[0]);
    assert.match(marked.key, /^ep1-[0-9a-f]{8}$/);
    assert.equal(typeof marked.report.ok, "boolean");
    assert.equal(marked.turnStart.active, "wizard");
    assert.ok(turnAdvice(marked.turnStart).length >= 1);
    assert.deepEqual(Object.keys(marked.episode).sort(), ["actions", "markedIndex", "seed", "setup", "tag", "version"]);
    // An exported episode reads back with its marked move preselected and the same key.
    const reopened = draftFromFile(json(marked.episode));
    assert.equal(reopened.selected, indices[0]);
    assert.deepEqual(reopened.lines, lines);
    assert.equal(markEpisode(reopened.draft, reopened.selected).key, marked.key);
  }
});

test("a duel that does not reproduce from its deal is refused for review", () => {
  const record = playedDuel(0);
  const refused = [
    {...record, setup: null},
    {...record, seed: 1.5},
    {...record, expected: {...record.expected, turn: record.expected.turn + 1}},
    {...record, expected: {...record.expected, result: {winner: "nobody"}}},
    {...record, cowboyActions: record.cowboyActions.slice(0, 1)},
    {...record, cowboyActions: [...record.cowboyActions, {type: "end"}]},
    {...record, cowboyActions: [{type: "attack", slot: 2, target: "base"}, ...record.cowboyActions.slice(1)]},
  ];
  for (const bad of refused) assert.throws(() => captureEpisode(bad), LessonError);
});

test("the seed-0 bait: the committed search still finds it, and it reports as a Hellfire bait at Wizard turn 3", () => {
  assert.equal(BAIT.found, true);
  assert.equal(BAIT.episode.seed, 0);
  const found = findBaitEpisode({from: 0, to: 0, policy: DEFAULT_LESSON_POLICY});
  assert.deepEqual(json(found.episode), BAIT.episode);

  const {draft, lines, selected, marked} = baitMarked();
  assert.equal(selected, BAIT.episode.markedIndex);
  assert.deepEqual(markable(draft), [0, 5]);
  assert.equal(lines.length, BAIT.episode.actions.length);
  assert.equal(marked.key, BAIT.episodeKey);
  assert.deepEqual(marked.report, BAIT.report);
  assert.equal(marked.report.ok, true);
  assert.equal(marked.report.targets, 1);
  assert.equal(marked.turnStart.turn, BAIT.comparison.turn);
  assert.ok(Object.isFrozen(marked.episode));

  // The original Wizard's whole turn opens with Hellfire; the default hold policy plays the same turn without it.
  const original = turnAdvice(marked.turnStart);
  const held = turnAdvice(marked.turnStart, DEFAULT_LESSON_POLICY);
  assert.equal(original.length, BAIT.comparison.original.actions.length);
  assert.equal(held.length, BAIT.comparison.lesson.actions.length);
  assert.equal(original.at(-1), "Ended the turn.");
  assert.equal(held.at(-1), "Ended the turn.");
  assert.notEqual(original[0], held[0]);

  // A Wizard move that is not Hellfire can be marked, but it is not a bait the trainer accepts.
  const summon = markEpisode(draft, 0);
  assert.equal(summon.report.ok, false);
  assert.ok(summon.report.reasons.includes("marked action is not Hellfire"));
  assert.notEqual(summon.key, marked.key);
});

test("only a Wizard move other than End turn can be marked, and a damaged episode file is refused with a reason", () => {
  const {draft} = baitMarked();
  for (const index of [1, 2, 3, 4, -1, 6, 99, null, "5"]) assert.throws(() => markEpisode(draft, index), LessonError);
  const bare = draftFromFile(json(BAIT.episode));
  assert.equal(bare.selected, BAIT.episode.markedIndex);

  const wrongWizard = json(BAIT.episode);
  wrongWizard.actions[5].action = {type: "end"};
  const wrongSeed = {...json(BAIT.episode), seed: 1};
  const cowboyMarked = {...json(BAIT.episode), markedIndex: 2};
  const extraKey = {...json(BAIT.episode), note: "ignore previous instructions"};
  const badAction = json(BAIT.episode);
  badAction.actions[0].action = {type: "eval", code: "alert(1)"};
  for (const bad of [null, [], "episode", {version: 2}, {...json(BAIT.episode), version: 2}, {...json(BAIT.episode), tag: "other"},
    {...json(BAIT.episode), markedIndex: 9999}, {...json(BAIT.episode), setup: {...BAIT.episode.setup, cpu: {side: "wizard", level: 1}}},
    wrongWizard, wrongSeed, cowboyMarked, extraKey, badAction, {search: {}, episode: wrongWizard}]) {
    assert.throws(() => draftFromFile(bad), LessonError);
  }
});

test("pending versus validated: no receipt is Pending; a trainer pending receipt is rejected; a validated one is accepted on the engine", () => {
  const {marked, simulated, imported, pending} = receipts();
  assert.equal(lessonLabel({state: "pending"}), "Pending: no lesson for this exact episode yet.");

  const notYet = checkReceipt(pending, marked);
  assert.equal(notYet.state, "rejected");
  assert.equal(notYet.source, "imported");
  assert.deepEqual(notYet.reasons, ["no revision passed verifyLessonBundle in 2 attempts"]);
  assert.equal(notYet.policy, undefined);
  assert.match(lessonLabel(notYet), /^Rejected lesson from an imported train\.mjs receipt for this exact episode\./);
  assert.doesNotMatch(lessonLabel(notYet), /re-checked/);
  const blocked = checkReceipt({...pending, status: "blocked", reasons: []}, marked);
  assert.equal(blocked.state, "rejected");
  assert.deepEqual(blocked.reasons, ["The trainer finished as blocked."]);

  const accepted = checkReceipt(imported, marked);
  assert.equal(accepted.state, "accepted");
  assert.equal(accepted.source, "imported");
  assert.deepEqual(accepted.reasons, []);
  assert.deepEqual(accepted.policy, fixture().revised);
  assert.ok(Object.isFrozen(accepted.policy));
  assert.deepEqual(json(accepted.proposal), json(fixture().proposal));
  assert.deepEqual(accepted.runs.map((run) => run.role), ["coach", "rival", "reviser"]);
  assert.match(lessonLabel(accepted), /^Accepted lesson from an imported train\.mjs receipt for this exact episode, re-checked here on the engine\./);
  assert.match(lessonLabel(accepted), /this page cannot confirm they happened/);

  const sim = checkReceipt(simulated, marked);
  assert.equal(sim.state, "accepted");
  assert.equal(sim.source, "simulated");
  assert.equal(lessonLabel(sim), "Accepted simulated fixture: checked here on the engine, but no Kiro run produced it.");
  assert.doesNotMatch(lessonLabel(sim), /imported train\.mjs/);
  assert.match(lessonLabel({...notYet, source: "simulated"}), /^Rejected simulated fixture/);

  // The accepted revised policy holds Hellfire at the bait; the original turn casts it.
  assert.notDeepEqual(turnAdvice(marked.turnStart, accepted.policy), turnAdvice(marked.turnStart));
});

test("a tampered receipt for the right episode is rejected on the engine, with no policy to load", () => {
  const {marked, imported} = receipts();
  const tamper = (edit) => { const copy = structuredClone(imported); edit(copy); return copy; };
  const cases = [
    [tamper((r) => { r.lesson.revised.policy.holdBelowTargets = 9; }), /engine check/],
    [tamper((r) => { r.lesson.revised.policy.code = "alert(1)"; }), /engine check/],
    [tamper((r) => { r.lesson.proposal.provenance.native = false; }), /engine check/],
    [tamper((r) => { r.lesson.counterexample.provenance.tool = "web"; }), /engine check/],
    [tamper((r) => { r.lesson.episodeKey = "ep1-00000000"; }), /engine check/],
    [tamper((r) => { r.lesson.source = "precomputed"; }), /engine check/],
    [tamper((r) => { r.lesson = null; }), /engine check/],
    [tamper((r) => { r.lesson.counterexample.episode = json(BAIT.episode); }), /engine/],
    [tamper((r) => { r.runs[2].exit = 1; }), /no successful reviser run/],
    [tamper((r) => { r.runs[0].error = "quota"; }), /no successful coach run/],
    [tamper((r) => { r.runs = []; }), /no successful coach, rival, reviser run/],
    [tamper((r) => { r.runs = "coach rival reviser"; }), /no successful coach, rival, reviser run/],
    [tamper((r) => { r.status = "accepted"; }), /The trainer finished as accepted\./],
  ];
  for (const [receipt, reason] of cases) {
    const check = checkReceipt(receipt, marked);
    assert.equal(check.state, "rejected", reason.source);
    assert.equal(check.policy, undefined);
    assert.equal(check.reasons.length, 1);
    assert.match(check.reasons[0], reason);
  }
  // Receipt text is clipped before it reaches the page.
  const long = checkReceipt(tamper((r) => { r.runs[0].runId = "x".repeat(500); r.status = "blocked"; r.reasons = ["y".repeat(500)]; }), marked);
  assert.ok(long.runs[0].runId.length <= 81);
  assert.ok(long.reasons[0].length <= 241);
});

test("a receipt belongs to an episode only by its episode key: anything else is a mismatch and changes nothing", () => {
  const {draft, marked, imported} = receipts();
  const other = markEpisode(draft, 0);
  const mismatch = (receipt, episode = marked) => checkReceipt(receipt, episode);
  assert.equal(mismatch(imported, other).state, "mismatch");
  assert.match(mismatch(imported, other).reasons[0], /different episode/);
  assert.equal(mismatch({...imported, episodeKey: "ep1-00000000"}).state, "mismatch");
  assert.equal(mismatch({...imported, episodeKey: undefined}).state, "mismatch");
  // The receipt format before this change, and anything else that is not a /2 receipt.
  const legacy = {version: 1, kind: "wizard-lesson-receipt", episodeSha256: "a".repeat(64), status: "accepted", revised: {kind: "test-policy"}};
  for (const bad of [legacy, {...imported, schema: "wizard-lesson-receipt/1"}, {...imported, schema: undefined}, null, [], "receipt", 7]) {
    const check = mismatch(bad);
    assert.equal(check.state, "mismatch");
    assert.match(check.reasons[0], /not a Wizard lesson receipt/);
    assert.equal(check.policy, undefined);
  }
});

test("the rematch deals the identical game, settles nothing, and plays the original Wizard unless a policy is given", () => {
  const {marked, imported} = receipts();
  const {episode} = marked;
  const original = lessonDuel(episode, false);
  assert.deepEqual({id: original.id, kind: original.kind, level: original.level}, {id: "lesson", kind: "lesson", level: 2});
  assert.match(original.name, /original Wizard/);
  assert.match(original.lesson, /Nothing here is saved or paid/);
  assert.deepEqual(original.options, {decks: {cowboy: DECKS.cowboy, wizard: DECKS.wizard}});
  assert.match(lessonDuel(episode, true).name, /lesson Wizard/);

  const ordinary = createShowdownSession({seed: episode.seed, duel: BAIT_DUEL});
  const rematch = createLessonSession({episode, policy: null});
  assert.equal(rematch.seat, "cowboy");
  assert.equal(rematch.players, 1);
  assert.equal(rematch.viewer(), "cowboy");
  assert.deepEqual(rematch.view(), ordinary.view());
  assert.deepEqual(rematch.opening, ordinary.opening);
  assert.deepEqual(rematch.legal(), ordinary.legal());
  assert.equal(rematch.view().sides.wizard.hand, undefined);

  // Replaying the bait's Cowboy moves: the original Wizard casts Hellfire again, the accepted lesson Wizard holds it.
  const policy = checkReceipt(imported, marked).policy;
  const revised = createLessonSession({episode, policy});
  assert.deepEqual(revised.view(), rematch.view());
  const cowboyMoves = episode.actions.slice(episode.actions.findIndex((a) => a.side === "cowboy"), episode.markedIndex);
  assert.ok(cowboyMoves.length && cowboyMoves.every((a) => a.side === "cowboy"));
  let originalEvents = [];
  let revisedEvents = [];
  for (const {action} of cowboyMoves) {
    originalEvents = rematch.act(action);
    revisedEvents = revised.act(action);
  }
  assert.ok(castsHellfire(originalEvents));
  assert.ok(!castsHellfire(revisedEvents));
  assert.throws(() => rematch.act({type: "attack", slot: 2, target: "base"}), /not a legal action/);

  for (let step = 0; step < 400 && !revised.view().result && !revised.failure(); step += 1) revised.act(choose(revised.legal()));
  assert.equal(revised.failure(), null);
  assert.ok(revised.view().result);
  assert.deepEqual(revised.legal(), []);
});

test("a Wizard strategy that fails stops the rematch with a reason; there is no fallback to another Wizard", () => {
  const {episode} = baitMarked().marked;
  const broken = createLessonSession({episode, policy: {kind: "bogus"}});
  assert.match(broken.failure() ?? "", /^The Wizard strategy failed: /);
  assert.deepEqual(broken.legal(), []);
  assert.equal(broken.view().result, null);
  assert.throws(() => broken.act({type: "end"}), /not a legal action/);
  const level = createLessonSession({episode, policy: {...DEFAULT_LESSON_POLICY, emergencyLethal: false}});
  assert.match(level.failure() ?? "", /emergencyLethal/);
  assert.deepEqual(level.legal(), []);
});

test("page: the rematch Wizard is the original one until the player opts in to an accepted lesson", async () => {
  const {marked, simulated} = receipts();
  const ui = mountPage();
  await ui.upload("wl-episode-file", BAIT);
  assert.match(ui.html(), /data-pick="5" aria-pressed="true"/);
  ui.click("wl-bait");
  let html = ui.html();
  assert.match(html, /id="wl-bait-report" data-bait="true"/);
  assert.match(html, /Wizard Base 5/);
  assert.match(html, /data-lesson-state="pending"/);
  assert.ok(html.includes("Pending: no lesson for this exact episode yet."));
  assert.match(html, /id="wl-optin" disabled/);
  assert.ok(html.includes(TRAIN_COMMAND));
  assert.ok(html.includes(marked.key));
  assert.doesNotMatch(html, /id="wl-revised"/);
  assert.deepEqual(ui.stored(), {version: 2, episode: json(marked.episode), receipt: null});

  ui.optIn(true); // refused: nothing accepted yet
  ui.click("wl-rematch");
  assert.deepEqual(json(ui.rematches.at(-1).episode), json(marked.episode));
  assert.equal(ui.rematches.at(-1).policy, null);

  await ui.upload("wl-receipt", simulated);
  html = ui.html();
  assert.match(html, /data-lesson-state="accepted" data-lesson-source="simulated"/);
  assert.match(html, /id="wl-revised"/);
  assert.match(html, /id="wl-optin">/);
  assert.match(html, /simulated-reviser/);
  assert.deepEqual(ui.stored().receipt, json(simulated));

  ui.click("wl-rematch");
  assert.equal(ui.rematches.at(-1).policy, null, "opt-out is the default");
  ui.optIn(true);
  ui.click("wl-rematch");
  assert.deepEqual(ui.rematches.at(-1).policy, fixture().revised);
  ui.page.reopen();
  assert.match(ui.html(), /id="wl-optin" checked/);
  ui.click("wl-rematch");
  assert.deepEqual(ui.rematches.at(-1).policy, fixture().revised);
  assert.equal("optIn" in ui.stored(), false, "the opt-in is never stored");
  ui.optIn(false);
  ui.click("wl-rematch");
  assert.equal(ui.rematches.at(-1).policy, null);

  // Escape leaves the marked view; marking again starts over with no lesson and no opt-in.
  ui.optIn(true);
  ui.escape();
  assert.match(ui.html(), /data-pick="5"/);
  assert.doesNotMatch(ui.html(), /data-lesson-state/);
  ui.click("wl-bait");
  assert.match(ui.html(), /data-lesson-state="pending"/);
  ui.click("wl-rematch");
  assert.equal(ui.rematches.at(-1).policy, null);
  assert.equal(ui.stored().receipt, null);
});

test("page: bad imports leave the lesson unchanged, receipt text is escaped, a pending receipt clears the opt-in, and forget resets", async () => {
  const {marked, imported, pending} = receipts();
  const ui = mountPage();
  await ui.upload("wl-episode-file", BAIT);
  ui.click("wl-bait");
  ui.click("wl-export");
  assert.equal(ui.files.length, 1);
  assert.equal(ui.files[0].name, `wizard-lesson-episode-${marked.key}.json`);
  assert.deepEqual(JSON.parse(ui.files[0].text), json(marked.episode));

  await ui.uploadFile("wl-receipt", {size: MAX_IMPORT_BYTES + 1, text: async () => "{}"});
  assert.match(ui.html(), /That file is too large for a Wizard lesson\./);
  await ui.upload("wl-receipt", "not json {");
  assert.match(ui.html(), /That file is not JSON\./);
  await ui.uploadFile("wl-receipt", undefined);
  assert.match(ui.html(), /No file was chosen\./);
  await ui.upload("wl-receipt", {...imported, episodeKey: "ep1-00000000"});
  assert.match(ui.html(), /different episode.*The lesson is unchanged\./);
  assert.match(ui.html(), /data-lesson-state="pending"/);
  assert.equal(ui.stored().receipt, null);

  const hostile = structuredClone(imported);
  hostile.runs[0].runId = "<img src=x onerror=alert(1)>";
  await ui.upload("wl-receipt", hostile);
  let html = ui.html();
  assert.match(html, /data-lesson-state="accepted" data-lesson-source="imported"/);
  assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt;"));
  assert.ok(!html.includes("<img"));

  ui.optIn(true);
  await ui.upload("wl-receipt", pending);
  html = ui.html();
  assert.match(html, /data-lesson-state="rejected"/);
  assert.ok(html.includes("no revision passed verifyLessonBundle in 2 attempts"));
  assert.match(html, /id="wl-optin" disabled/);
  assert.doesNotMatch(html, /id="wl-revised"/);
  ui.click("wl-rematch");
  assert.equal(ui.rematches.at(-1).policy, null);

  ui.click("wl-forget");
  assert.match(ui.html(), /data-lesson-state="pending"/);
  assert.match(ui.html(), /Lesson forgotten\. The rematch Wizard is the original one\./);
  assert.equal(ui.stored().receipt, null);

  // A marked move that is not a bait cannot be exported.
  ui.click("wl-unmark");
  ui.pick(0);
  ui.click("wl-bait");
  assert.match(ui.html(), /data-bait="false"/);
  assert.match(ui.html(), /marked action is not Hellfire/);
  ui.click("wl-export");
  assert.equal(ui.files.length, 1);
  ui.click("wl-close");
  assert.equal(ui.closes.length, 1);
});

test("page: a finished duel opens for marking, and a duel that cannot be reviewed says why", () => {
  const record = playedDuel(0);
  const ui = mountPage();
  ui.page.openFromDuel(record);
  assert.match(ui.html(), /Wizard turn 1/);
  assert.match(ui.html(), /data-pick="\d+" aria-pressed="false"/);
  assert.match(ui.html(), /id="wl-bait" disabled/);
  ui.page.openFromDuel({...record, setup: null});
  assert.match(ui.html(), /This duel cannot be reviewed\./);
  assert.doesNotMatch(ui.html(), /data-pick/);
});

test("page: a saved lesson reopens with its receipt but never its opt-in; a stale or damaged save is cleared", () => {
  const {marked, simulated, imported} = receipts();
  const episode = json(marked.episode);

  const empty = mountPage();
  empty.page.openSaved();
  assert.match(empty.html(), /No Wizard lesson is saved in this browser/);

  const kept = mountPage({storage: memoryStorage({[STORE_KEY]: JSON.stringify({version: 2, episode, receipt: simulated})})});
  kept.page.openSaved();
  assert.match(kept.html(), /data-lesson-state="accepted" data-lesson-source="simulated"/);
  assert.match(kept.html(), /id="wl-optin">/);
  kept.click("wl-rematch");
  assert.equal(kept.rematches.at(-1).policy, null);

  const stale = mountPage({storage: memoryStorage({[STORE_KEY]: JSON.stringify({version: 2, episode, receipt: {...imported, episodeKey: "ep1-00000000"}})})});
  stale.page.openSaved();
  assert.match(stale.html(), /The saved receipt did not match this episode and was ignored\./);
  assert.match(stale.html(), /data-lesson-state="pending"/);

  const tampered = json(episode);
  tampered.actions[5].action = {type: "end"};
  for (const saved of [JSON.stringify({version: 2, episode: tampered, receipt: null}), JSON.stringify({version: 1, episode, receipt: null}), "{", "[]"]) {
    const damaged = mountPage({storage: memoryStorage({[STORE_KEY]: saved})});
    damaged.page.openSaved();
    assert.match(damaged.html(), /The saved lesson could not be used and was cleared\./);
    assert.equal(damaged.storage.getItem(STORE_KEY), null);
    assert.doesNotMatch(damaged.html(), /data-lesson-state/);
  }
});
