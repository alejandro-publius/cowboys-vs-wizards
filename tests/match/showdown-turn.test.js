// K-095: the experiment turn ?turn=dragon-c5 replays the referee's s3-C5-dragon-resting checkpoint
// (experiments/showdown-dragon-strategy/counter-output.json on kiro/graywave-dragon-referee) through the
// graybox session, and both recorded choices reach the referee's recorded results.
import assert from "node:assert/strict";
import test from "node:test";
import {cardOf} from "../../src/game/showdown/cards.js";
import {planTurn} from "../../src/game/showdown/rules.js";
import {createShowdownSession} from "../../src/match/showdown-session.js";
import {TURNS, turnDuel} from "../../src/match/showdown-turn.js";

const open = () => { const {duel, seed} = turnDuel("dragon-c5"); return createShowdownSession({seed, duel}); };
const board = (view, side) => view.sides[side].board.map((t) => (t ? `${cardOf(t.cardId).name} ${t.health}${t.cover ? " cover" : ""}` : "-")).join(" | ");

// The referee's Cowboy policy (counter.mjs): planTurn on a state rebuilt from the Cowboy's public view,
// re-planned after a trap or a Cowboy draw, and at the start of each turn.
function publicState(view) {
  const fill = (n, id) => Array.from({length: n}, (_, i) => `${id}-${900 + i}`);
  const side = (name) => {
    const {handCount, deckCount, trapCount, hand, traps, ...rest} = view.sides[name];
    return {...rest, hand: hand ?? fill(handCount, "wizard-skeleton"), traps: traps ?? [], deck: fill(deckCount, name === "cowboy" ? "cowboy-sheriff" : "wizard-skeleton")};
  };
  const {viewer, sides, ...table} = view;
  return {...table, seed: null, sides: {cowboy: side("cowboy"), wizard: side("wizard")}};
}
function playOut(session) {
  let plan = planTurn(publicState(session.view())), turn = session.view().turn;
  while (!session.view().result) {
    if (session.view().turn !== turn || !plan.length) [plan, turn] = [planTurn(publicState(session.view())), session.view().turn];
    const action = plan.shift();
    if (!session.legal().some((a) => JSON.stringify(a) === JSON.stringify(action))) { plan = []; continue; }
    const events = session.act(action);
    if (events.some((e) => e.type === "trap" || ((e.type === "draw" || e.type === "burn") && e.side === "cowboy"))) plan = [];
  }
  const view = session.view();
  return {winner: view.result.winner, turn: view.turn, bases: {cowboy: view.sides.cowboy.base, wizard: view.sides.wizard.base}};
}

test("only an allowlisted id opens a turn; a URL value never becomes actions", () => {
  assert.deepEqual(Object.keys(TURNS), ["dragon-c5"]);
  for (const id of [null, "", "dragon-c5 ", "DRAGON-C5", "__proto__", "constructor", "toString", '[{"type":"end"}]', "seed:3"]) assert.equal(turnDuel(id), null, String(id));
});

test("a fresh landing is the referee's decision state, with hidden zones as counts and no seed", () => {
  const session = open();
  const view = session.view();
  assert.equal(session.duel.kind, "turn");
  assert.deepEqual([view.turn, view.active, view.sides.cowboy.base, view.sides.wizard.base], [5, "cowboy", 5, 3]);
  assert.equal(board(view, "cowboy"), "Ranger 4 | Dynamiter 1 | -");
  assert.equal(board(view, "wizard"), "Dragon 4 | Jack-o'-Lantern 1 cover | -");
  assert.equal(view.sides.wizard.board[0].cardId, "wizard-dragon-0");
  assert.deepEqual(view.sides.cowboy.traps.map((id) => cardOf(id).name), ["Bear Trap"]);
  assert.deepEqual(view.sides.cowboy.hand.map((id) => cardOf(id).name), ["Gatling Crew", "Outrider", "Billy"]);
  assert.equal(view.seed, undefined);
  for (const hidden of ["hand", "traps", "deck"]) assert.equal(view.sides.wizard[hidden], undefined);
  assert.equal(view.sides.cowboy.deck, undefined);
  const legal = session.legal().map((a) => JSON.stringify(a));
  for (const target of [0, 1]) assert.ok(legal.includes(JSON.stringify({type: "attack", slot: 0, target})));
  assert.ok(session.opening.length > 0, "the replayed history is returned for the log");
});

test("choice A (Ranger hits the resting Dragon) reaches the referee's Cowboy win on turn 15", () => {
  const session = open();
  session.act({type: "attack", slot: 0, target: 0});
  const view = session.view();
  assert.equal(view.sides.wizard.board[0].health, 2);
  assert.equal(view.sides.cowboy.board[0].health, 1);
  assert.deepEqual(playOut(session), {winner: "cowboy", turn: 15, bases: {cowboy: 2, wizard: 0}});
});

test("choice B (Ranger hits the Jack, the policy's pick) reaches the referee's Wizard win on turn 10", () => {
  const session = open();
  session.act({type: "attack", slot: 0, target: 1});
  assert.equal(session.view().sides.wizard.board[1], null);
  assert.deepEqual(playOut(session), {winner: "wizard", turn: 10, bases: {cowboy: 0, wizard: 3}});
});

test("retry is a fresh replay: the same landing after a played line", () => {
  const first = open().view();
  const played = open();
  played.act({type: "attack", slot: 0, target: 0});
  playOut(played);
  assert.deepEqual(open().view(), first);
});

test("a prefix with an illegal or short action list refuses to open", () => {
  const {seed, duel} = turnDuel("dragon-c5");
  assert.throws(() => createShowdownSession({seed, duel: {...duel, prefix: [{type: "attack", slot: 2, target: "base"}]}}), /not legal/);
  assert.throws(() => createShowdownSession({seed, duel: {...duel, prefix: duel.prefix.slice(0, 3)}}), /did not reach/);
});
