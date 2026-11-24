// Browser-reachable referee transcripts (scripts/referee/browser-transcripts.mjs): which deals the illustrated
// page's Camp > Two players can show, the public seed duels, the gesture gaps and the frozen referee's adjudication.
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {test} from "node:test";
import {TYPES, tributes} from "../../src/game/showdown/cards.js";
import {generate, recipe} from "../../scripts/referee/corpus.mjs";
import {replayDuel} from "../../scripts/referee/engine.mjs";
import {adjudicate, freezeProblems, gestureGap, playPublicDuel, publicDeal, reachable, readFreeze, refereeProblem,
  transcriptOf} from "../../scripts/referee/browser-transcripts.mjs";
import {duelOf, validateCohort} from "../../scripts/referee/browser.mjs";

test("the public seed-1 deal is what native Chrome showed for ?seed=1 at Camp > Two players", () => {
  // Observed by scripts/referee/browser.mjs --canary in Chrome on the staged dist/web/index.html
  // (pageSha256 72098edc…, 2026-11-23T15:33Z, .artifacts/referee-browser-canary/duels/1.json "opening").
  const deal = publicDeal(1);
  assert.equal(deal.first, "wizard");
  assert.deepEqual(deal.decks.wizard.slice(0, 4), ["wizard-hellfire-1", "wizard-hex-1", "wizard-dragon-1", "wizard-bone-wall-2"]);
  assert.equal(deal.decks.wizard.length - 4, 12);
  assert.equal(deal.decks.cowboy.length - 5, 11);
});

test("corpus seed N plays list N % 3, so frozen seeds 1 and 2 cannot be dealt by the page and seed 3 can", () => {
  const [one, two, three] = [...generate({...recipe({quick: false}), count: 3, minMoves: 0})].map((r) => r.duel);
  assert.deepEqual([one.seed, two.seed, three.seed], [1, 2, 3]);
  // The canary's own finding: the corpus seed-1 Wizard hand is not the page's.
  assert.deepEqual(one.decks.wizard.slice(0, 4), ["wizard-bone-armor-1", "wizard-boneyard-1", "wizard-hellfire-1", "wizard-wizard-2"]);
  assert.deepEqual([one, two, three].map(reachable), [false, false, true]);
});

test("a tribute paid for a free troop has no page gesture; every other shape has one", () => {
  const troops = Object.entries(TYPES).filter(([, card]) => card.kind === "troop" && !card.bounty);
  const free = `${troops.find(([type]) => tributes(`${type}-1`) === 0)[0]}-1`;
  const paid = `${troops.find(([type]) => tributes(`${type}-1`) === 1)[0]}-1`;
  assert.match(gestureGap({type: "summon", cardId: free, tributes: [0]}), /free troop/);
  assert.equal(gestureGap({type: "summon", cardId: free, tributes: []}), null);
  assert.equal(gestureGap({type: "summon", cardId: paid, tributes: [0]}), null);
  assert.equal(gestureGap({type: "summon", cardId: paid, tributes: []}), null);
  for (const action of [{type: "end"}, {type: "attack", slot: 0, target: "base"}, {type: "spell", cardId: "wizard-hex-1"}, {type: "cover", slot: 1}])
    assert.equal(gestureGap(action), null);
});

test("a public seed duel is the public deal played to a finish with engine-legal moves, the same every time", () => {
  const duel = playPublicDuel(1);
  assert.deepEqual(playPublicDuel(1), duel);
  assert.ok(reachable(duel));
  const replay = replayDuel(duel, {states: false});
  assert.ok(replay.terminal);
  assert.ok(replay.steps.every((s) => s.accepted));
  assert.ok(!duel.actions.some(gestureGap));
  assert.notDeepEqual(playPublicDuel(2).decks, duel.decks);
});

const python = process.env.REFEREE_PYTHON || "python3";
const hasPython = spawnSync(python, ["--version"]).status === 0;

test("the frozen referee adjudicates the exact public seed-1 input, and the transcript carries its result unchanged", {skip: !hasPython && `${python} not found`}, async () => {
  const freeze = readFreeze();
  assert.deepEqual(freezeProblems(freeze), []);
  const duel = playPublicDuel(1);
  const seen = [];
  const {sent} = await adjudicate([duel], (d, line, result) => { seen.push({line, result}); return true; });
  assert.equal(sent, 1);
  const [{line, result}] = seen;
  assert.equal(result.seed, 1);
  assert.equal(result.steps.length, duel.actions.length);
  assert.deepEqual(result.unsupported, []);
  const transcript = transcriptOf(duel, line, result, {corpus: "public", source: {kind: "public-setup"}, treeSha256: freeze.referee.treeSha256});
  assert.equal(transcript.referee.result, result);
  const last = result.steps.at(-1).state;
  assert.equal(transcript.complete, last.over);
  assert.deepEqual(transcript.result, {winner: last.winner, reason: last.reason});
  // Whatever the referee decided, browser.mjs reads it back as the per-step expectation.
  const {duel: read, problems} = duelOf(JSON.parse(JSON.stringify(transcript)));
  assert.deepEqual(problems, []);
  assert.deepEqual(read.referee.steps.map((s) => s.accepted), result.steps.map((s) => s.accepted));
  if (refereeProblem(duel, result) === null) assert.deepEqual(validateCohort([transcript], {mode: "canary"}).errors, []);
  assert.match(validateCohort([transcript], {mode: "full"}).errors.join(), /"public"; --full takes primary/);
});

test("refereeProblem names results the browser cannot use", () => {
  const duel = {seed: 4, actions: [{type: "end"}]};
  const state = (over) => ({over, players: {}});
  assert.equal(refereeProblem(duel, {seed: 4, initial: state(false), steps: [{accepted: true, state: state(true)}], unsupported: []}), null);
  assert.match(refereeProblem(duel, {seed: 5, initial: state(false), steps: [], unsupported: []}), /seed 5/);
  assert.match(refereeProblem(duel, {seed: 4, initial: state(false), steps: [], unsupported: []}), /0 steps for 1/);
  assert.match(refereeProblem(duel, {seed: 4, initial: state(false), steps: [{accepted: true, state: state(false)}], unsupported: []}), /did not finish/);
  assert.match(refereeProblem(duel, {seed: 4, initial: state(false), steps: [{accepted: false, state: state(true)}], unsupported: ["step 0: x"]}), /unsupported/);
});
