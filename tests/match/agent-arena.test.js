// Agent Arena: playbooks steer legal Showdown play from the seat view only, replay the same way,
// and anything outside the closed schema is rejected. Fixture playbooks below are test data, not
// the Kiro-authored ones the workflow writes.
import assert from "node:assert/strict";
import test from "node:test";
import {playGame, playSeries, recordReplay, replayProblems} from "../../experiments/agent-arena/arena.mjs";
import {SCHEMA, actionFacts, canonical, decide, parsePlaybook, policyDigest, seatView, validatePlaybook} from "../../experiments/agent-arena/playbook.js";
import {applyAction, createShowdown, legalActions, opponent} from "../../src/game/showdown/rules.js";

const SHERIFF = {
  schema: SCHEMA, persona: "cautious-sheriff", motto: "Nobody dies on my watch.",
  order: ["set", "summon", "gear", "spell", "attack", "cover", "end"],
  attack: {prefer: ["win-now", "kill", "attacker-survives", "biggest-threat"], avoid: ["suicide", "even-trade", "chip"]},
  summon: {prefer: ["free", "guard", "toughest"], maxTributes: 0},
  spell: {prefer: ["kill", "biggest-threat"], onlyToKill: true},
  gear: {prefer: ["most-threatened"]},
  cover: {when: "threatened"},
};
const WIZARD = {
  schema: SCHEMA, persona: "reckless-wizard", motto: "Burn it all, ask later.",
  order: ["spell", "location", "summon", "gear", "attack", "end"],
  attack: {prefer: ["win-now", "go-face", "base-damage", "biggest-threat"], avoid: []},
  summon: {prefer: ["ready", "hardest-hitting"], maxTributes: 2},
  spell: {prefer: ["most-hit", "biggest-threat"], onlyToKill: false},
  gear: {prefer: ["ready", "hardest-hitting"]},
  cover: {when: "always"},
};
const book = (value) => {
  const checked = validatePlaybook(value, value.persona);
  assert.ok(checked.ok, checked.errors.join("; "));
  return checked.playbook;
};
const BOOKS = {cowboy: book(SHERIFF), wizard: book(WIZARD)};

// Real positions: every decision of seeded games played by the referee loop with the fixture books.
function* positions(seeds) {
  for (const seed of seeds) for (const first of ["cowboy", "wizard"]) {
    let state = createShowdown(seed, {first});
    while (!state.result) {
      const legal = legalActions(state);
      yield {state, legal};
      state = applyAction(state, decide(seatView(state), legal, BOOKS[state.active]).action).state;
    }
  }
}
const range = (n) => [...Array(n).keys()];

test("the two playbooks pick different legal tactics in the same real position", () => {
  let differing = 0;
  let recklessAttack = null;
  for (const {state, legal} of positions(range(20))) {
    const view = seatView(state);
    const sheriff = decide(view, legal, BOOKS.cowboy);
    const wizard = decide(view, legal, BOOKS.wizard);
    assert.ok(legal.includes(sheriff.action) && legal.includes(wizard.action));
    if (sheriff.index === wizard.index) continue;
    differing += 1;
    const facts = wizard.type === "attack" ? actionFacts(view, wizard.action) : null;
    if (!recklessAttack && facts && !facts["win-now"] && (facts.suicide || facts["even-trade"] || facts.chip)) recklessAttack = {state, legal, sheriff, wizard};
  }
  assert.ok(differing > 0, "no position where the playbooks disagree");
  assert.ok(recklessAttack, "no position where the wizard makes an attack the sheriff rules out");
  const {state, legal, sheriff, wizard} = recklessAttack;
  // The sheriff's avoid list removes exactly the wizard's attack; it waits, covers or plays something else.
  assert.notDeepEqual(sheriff.action, wizard.action);
  assert.ok(sheriff.ruledOut > 0 || sheriff.type !== "attack");
  assert.doesNotThrow(() => applyAction(state, legal[sheriff.index]));
  assert.doesNotThrow(() => applyAction(state, legal[wizard.index]));
});

test("the seat view hides the other hand, deck order and trap identities, and decisions ignore them", () => {
  let checked = 0;
  for (const {state, legal} of positions(range(6))) {
    const enemy = state.sides[opponent(state.active)];
    if (!enemy.hand.length || !enemy.deck.length) continue;
    const view = seatView(state);
    assert.deepEqual(Object.keys(view.sides[opponent(state.active)]).sort(), ["base", "baseMax", "board", "deckCount", "discard", "handCount", "trapCount"]);
    // Change everything the deciding seat cannot see, keeping the counts.
    const other = structuredClone(state);
    const hidden = other.sides[opponent(state.active)];
    hidden.hand = hidden.hand.map((_, i) => hidden.deck[i % hidden.deck.length]);
    hidden.deck.reverse();
    hidden.traps = hidden.traps.map(() => hidden.deck[0]);
    other.sides[state.active].deck.reverse();
    assert.deepEqual(seatView(other), view);
    assert.deepEqual(legalActions(other), legal);
    for (const each of Object.values(BOOKS)) assert.equal(decide(seatView(other), legal, each).index, decide(view, legal, each).index);
    // Reading any hidden card while building the view would throw.
    const trapped = structuredClone(state);
    const guard = (list) => new Proxy(list, {get: (target, key) => {
      if (key === "length") return target.length;
      throw new Error(`read hidden ${String(key)}`);
    }});
    const side = trapped.sides[opponent(state.active)];
    side.hand = guard(side.hand);
    side.deck = guard(side.deck);
    side.traps = guard(side.traps);
    trapped.sides[state.active].deck = guard(trapped.sides[state.active].deck);
    assert.doesNotThrow(() => decide(seatView(trapped), legal, BOOKS[state.active]));
    if (++checked >= 40) break;
  }
  assert.ok(checked > 0);
});

test("the same seeds and playbooks give the same series and replay", () => {
  const series = {from: 0, deals: 2};
  const a = playSeries(series, BOOKS);
  const b = playSeries(series, BOOKS);
  assert.equal(canonical(a), canonical(b));
  assert.equal(a.games.length, 4);
  for (const game of a.games) {
    assert.ok(["cowboy", "wizard", "draw"].includes(game.winner));
    assert.ok(game.turns >= 1 && game.decisions > 0);
  }
  const digests = {"cautious-sheriff": policyDigest(BOOKS.cowboy), "reckless-wizard": policyDigest(BOOKS.wizard)};
  const replay = recordReplay(series, BOOKS, digests);
  assert.equal(canonical(replay), canonical(recordReplay(series, BOOKS, digests)));
  assert.ok(replay.result, "the replay reaches the end of the match");
  assert.deepEqual(replayProblems(JSON.parse(JSON.stringify(replay)), BOOKS), []);
  assert.equal(canonical(playGame(replay.seed, replay.first, BOOKS).game.bases), canonical(replay.finalBases));
  // A tampered step is caught.
  const tampered = JSON.parse(JSON.stringify(replay));
  const step = tampered.steps.find((each) => each.legal.length > 1);
  step.chosen = (step.chosen + 1) % step.legal.length;
  step.action = step.legal[step.chosen];
  assert.notDeepEqual(replayProblems(tampered, BOOKS), []);
});

test("invalid playbooks and player programs are rejected", () => {
  const bad = (change) => {
    const value = structuredClone(SHERIFF);
    change(value);
    return JSON.stringify(value);
  };
  const cases = {
    "unknown key": bad((p) => { p.script = "return attack()"; }),
    "nested unknown key": bad((p) => { p.attack.when = "always"; }),
    "prototype key": bad(() => {}).replace("{", "{\"__proto__\":{\"order\":[]},"),
    "missing field": bad((p) => { delete p.cover; }),
    "wrong schema": bad((p) => { p.schema = "agent-arena-playbook/2"; }),
    "other persona": bad((p) => { p.persona = "reckless-wizard"; }),
    "free-text order": bad((p) => { p.order = ["attack", "eval(process.exit())", "end"]; }),
    "no end": bad((p) => { p.order = ["attack", "cover"]; }),
    "repeated type": bad((p) => { p.order = ["attack", "attack", "end"]; }),
    "unknown preference": bad((p) => { p.attack.prefer = ["peek-at-hand"]; }),
    "tributes out of range": bad((p) => { p.summon.maxTributes = 3; }),
    "string boolean": bad((p) => { p.spell.onlyToKill = "yes"; }),
    "long motto": bad((p) => { p.motto = "x".repeat(81); }),
    "control character": bad((p) => { p.motto = "line\nbreak"; }),
    "oversized": bad((p) => { p.padding = " ".repeat(5000); }),
    "javascript": "module.exports = {decide: () => ({type: 'end'})}",
    "array": "[]",
  };
  for (const [name, text] of Object.entries(cases)) {
    const parsed = parsePlaybook(text, "cautious-sheriff");
    assert.equal(parsed.ok, false, name);
    assert.ok(parsed.errors.length > 0, name);
  }
  assert.equal(parsePlaybook(JSON.stringify(SHERIFF), "cautious-sheriff").ok, true);
  assert.equal(parsePlaybook(JSON.stringify(SHERIFF), "nobody").ok, false);
  // decide runs only checked, frozen playbooks: a hand-made object, even with a function in it, is refused.
  const state = createShowdown(1, {first: "cowboy"});
  assert.throws(() => decide(seatView(state), legalActions(state), {...SHERIFF, order: ["end"], decide: () => ({type: "end"})}));
  assert.ok(Object.isFrozen(BOOKS.cowboy) && Object.isFrozen(BOOKS.cowboy.attack.prefer));
});
