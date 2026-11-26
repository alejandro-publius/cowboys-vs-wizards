import assert from "node:assert/strict";
import test from "node:test";
import {DECKS, deckIds} from "../../src/game/showdown/cards.js";
import {EVEN_FIGHT_DECKS, applyAction, createShowdown, legalActions, opponent} from "../../src/game/showdown/rules.js";
import {EVEN_FIGHT_MODES, evenFightDuel, evenFightFromQuery} from "../../src/match/showdown-even-fight.js";
import {createShowdownSession} from "../../src/match/showdown-session.js";
import {face} from "../../src/ui/showdown-screen.js";

test("each preview mode deals sixteen cards and gives the second seat seven Base orbs and five cards", () => {
  const duel = evenFightDuel();
  assert.deepEqual(EVEN_FIGHT_DECKS.wizard, {...DECKS.wizard, "wizard-skeleton": 3, "wizard-imp": 2});
  assert.equal(EVEN_FIGHT_DECKS.cowboy, DECKS.cowboy);
  for (const first of ["cowboy", "wizard"]) {
    const second = opponent(first);
    const released = createShowdown(19, {first});
    assert.equal(released.sides[second].base, 5);
    assert.ok(!Object.hasOwn(released, "evenFight"));
    const candidate = createShowdown(19, {...duel.options, first});
    assert.deepEqual(candidate, createShowdown(19, {first, evenFight: true}));
    for (const side of [first, second]) {
      const {base, baseMax, hand, deck} = candidate.sides[side];
      assert.deepEqual([base, baseMax, hand.length, hand.length + deck.length],
        side === first ? [5, 5, 4, 16] : [7, 7, 5, 16]);
      assert.deepEqual([...hand, ...deck].sort(), deckIds(side, EVEN_FIGHT_DECKS[side]).sort());
    }
    const scripted = createShowdown(19, {...duel.options, first, baseOrbs: {cowboy: 4, wizard: 3}});
    assert.deepEqual([scripted.sides.cowboy.base, scripted.sides.wizard.base], [4, 3]);
  }
  assert.deepEqual(Object.values(EVEN_FIGHT_MODES).map(({players, best}) => [players, best]), [[1, 1], [1, 3], [2, 1]]);
});

test("cover blocks targeted spells and Hellfire only in Even Fight; an exposed Ghostly troop still takes Hellfire", () => {
  const fire = {type: "spell", cardId: "wizard-hellfire-1"};
  for (const evenFight of [false, true]) {
    const state = createShowdown(19, {first: "wizard", evenFight, opening: {cowboy: [
      {type: "cowboy-billy", health: 4}, {type: "cowboy-captured-wraith", health: 2},
    ]}});
    state.sides.wizard.hand = [fire.cardId, "wizard-singularity-1"];
    const board = state.sides.cowboy.board;
    board[0].cover = true;
    const targets = () => legalActions(state).filter((a) => a.cardId === "wizard-singularity-1").map((a) => a.target);
    const mayBurn = () => legalActions(state).some((a) => a.cardId === fire.cardId);
    assert.deepEqual(targets(), evenFight ? [] : [0]);
    assert.ok(mayBurn());
    const after = applyAction(state, fire);
    assert.deepEqual(after.state.sides.cowboy.board.slice(0, 2).map((t) => t.health), [evenFight ? 4 : 3, 1]);
    board[1].cover = true;
    assert.equal(mayBurn(), !evenFight);
    if (evenFight) assert.throws(() => applyAction(state, fire), /illegal action/);
    board.fill(null);
    assert.equal(mayBurn(), false);
  }
  assert.match(face("wizard-hellfire", "", true), /outside cover/);
  assert.match(face("wizard-hellfire"), /every enemy troop/);
});

test("Even Fight still allows a physical strike and Sweep against covered troops", () => {
  const state = createShowdown(2, {...evenFightDuel().options, first: "wizard", opening: {
    wizard: [{type: "wizard-dragon"}], cowboy: [{type: "cowboy-covered-wagon", health: 4}, {type: "cowboy-billy", health: 4}],
  }});
  state.turn = 3;
  for (const troop of state.sides.cowboy.board.filter(Boolean)) troop.cover = true;
  const applied = applyAction(state, {type: "attack", slot: 0, target: 0});
  assert.deepEqual(applied.state.sides.cowboy.board.slice(0, 2).map((t) => t.health), [1, 3]);
  assert.equal(applied.events.find((event) => event.type === "attack").hitBack, 0);
});

test("hotseat exposes only the viewing hand, including at the end of the preview", () => {
  const session = createShowdownSession({seed: 19, duel: evenFightDuel(), players: 2});
  for (let turns = 0; turns <= 80; turns += 1) {
    const view = session.view();
    const own = view.sides[view.viewer], rival = view.sides[opponent(view.viewer)];
    assert.ok(Array.isArray(own.hand));
    assert.ok(!("hand" in rival) && !("traps" in rival));
    assert.ok(!("deck" in own) && !("deck" in rival) && !("seed" in view));
    if (view.result) return assert.ok(rival.handCount > 0);
    session.act({type: "end"});
  }
  assert.fail("preview duel did not reach an ending");
});

test("only explicit preview routes open and established links retain precedence", () => {
  for (const mode of Object.keys(EVEN_FIGHT_MODES)) {
    assert.equal(evenFightFromQuery(new URLSearchParams(`even-fight=${mode}&seed=0`)), mode);
  }
  for (const key of ["turn", "outrider", "practice", "wizard", "lesson", "saloon", "replay", "room"]) {
    assert.equal(evenFightFromQuery(new URLSearchParams(`even-fight=1&${key}=anything`)), null);
  }
  for (const search of ["", "even-fight=unknown", "even-fight=toString"]) {
    assert.equal(evenFightFromQuery(new URLSearchParams(search)), null);
  }
});
