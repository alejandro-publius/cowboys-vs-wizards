// Issue 143 slice 1: the graybox Showdown session gives the screen only the seat's view, the
// seat's legal actions and presentable events.
import assert from "node:assert/strict";
import test from "node:test";
import {EVENTS} from "../../src/game/showdown/contract.js";
import {PRESENTERS, presentEvent} from "../../src/game/showdown/presenter.js";
import {applyAction, createShowdown, opponent, playTurn} from "../../src/game/showdown/rules.js";
import {bootHill, createShowdownSession, twoPlayers} from "../../src/match/showdown-session.js";

test("the screen's presenter is the canonical one: a handler for every EVENTS entry, throws on anything else", () => {
  assert.deepEqual(Object.keys(PRESENTERS).sort(), Object.keys(EVENTS).sort());
  assert.throws(() => presentEvent({type: "not-an-event"}), /Unknown Showdown event type/);
});

test("Boot Hill is Trail duel 1 for a new player: starter deck, Cowboys open, Wizard Base 3", () => {
  const duel = bootHill();
  assert.equal(duel.name, "Boot Hill");
  assert.deepEqual(duel.options.decks.cowboy, {"cowboy-sheriff": 8, "cowboy-billy": 5, "cowboy-deadeye": 3});
  assert.deepEqual(duel.options.baseOrbs, {cowboy: 5, wizard: 3});
  assert.equal(duel.options.first, "cowboy");
});

// Plays every seed with the first non-end legal action (attacks preferred) and checks each view.
test("over played Boot Hill duels the view never lists a Wizard hand, trap or deck card, and only legal actions apply", () => {
  let wins = 0;
  for (let seed = 0; seed < 40; seed += 1) {
    const session = createShowdownSession({seed, duel: bootHill()});
    for (let step = 0; step < 400 && !session.view().result; step += 1) {
      const view = session.view();
      assert.equal(view.viewer, "cowboy");
      assert.equal(view.seed, undefined);
      const wizard = view.sides.wizard;
      for (const hidden of ["hand", "traps", "deck"]) assert.equal(wizard[hidden], undefined);
      assert.equal(view.sides.cowboy.deck, undefined);
      assert.equal(typeof wizard.handCount, "number");
      const visibleIds = JSON.stringify(view).match(/wizard-[a-z-]+-\d+/g) ?? [];
      const publicIds = new Set([...wizard.discard, ...wizard.board.filter(Boolean).flatMap((t) => [t.cardId, ...t.gear]), view.location?.cardId].filter(Boolean));
      for (const id of visibleIds) assert.ok(publicIds.has(id), `seed ${seed}: ${id} is not public`);
      const legal = session.legal();
      assert.ok(legal.length > 0, "the seat always has an action on its own turn");
      const events = session.act(legal.find((a) => a.type === "attack") ?? legal.find((a) => a.type !== "end" && a.type !== "cover") ?? legal.find((a) => a.type === "end"));
      for (const event of events) assert.equal(typeof presentEvent(event), "string");
    }
    const result = session.view().result;
    assert.ok(result, `seed ${seed} finished`);
    if (result.winner === "cowboy") wins += 1;
    assert.deepEqual(session.legal(), []);
    assert.throws(() => session.act({type: "end"}), /not this seat's turn/);
  }
  assert.ok(wins >= 36, `a simple attacker wins most Boot Hill deals (${wins} of 40)`);
});

test("an action outside the seat's legal list is refused", () => {
  const session = createShowdownSession({seed: 1, duel: bootHill()});
  assert.throws(() => session.act({type: "attack", slot: 0, target: "base"}), /illegal action/);
});

// Fable's even-fight brief, item 4: once a duel ends both hands are shown, on the screen only.
// The same deal is played on the rules beside the session, so the shown hands can be compared
// with the real ones. Solo (the bot replies inside the session) and two players on one screen.
test("a finished duel shows both hands and no deck or trap card; while it runs, finished() is null and view() never gains them", () => {
  const pick = (legal) => legal.find((a) => a.type === "attack") ?? legal.find((a) => a.type !== "end" && a.type !== "cover") ?? legal.find((a) => a.type === "end");
  for (const [players, duel] of [[1, bootHill()], [2, twoPlayers()]]) {
    for (let seed = 0; seed < 12; seed += 1) {
      const session = createShowdownSession({seed, duel, players});
      let state = createShowdownShadow(seed, duel, players);
      for (let step = 0; step < 600 && !session.view().result; step += 1) {
        assert.equal(session.finished(), null, "no finished picture while the duel runs");
        const view = session.view();
        const other = opponent(view.viewer);
        assert.equal(view.sides[other].hand, undefined, `${players}p seed ${seed}: the other hand is hidden mid-duel`);
        const action = pick(session.legal());
        session.act(action);
        state = shadowAct(state, action, duel, players);
      }
      const view = session.view(), finished = session.finished();
      assert.ok(view.result && state.result, `${players}p seed ${seed} finished`);
      // view() keeps its shape: the end reveal adds nothing to what is recorded from it.
      assert.equal(view.sides[opponent(view.viewer)].hand, undefined);
      assert.deepEqual(Object.keys(finished).sort(), Object.keys(view).sort());
      for (const side of ["cowboy", "wizard"]) {
        const shown = finished.sides[side];
        assert.deepEqual(shown.hand, state.sides[side].hand, `${players}p seed ${seed}: ${side} hand`);
        assert.equal(shown.deck, undefined);
        assert.equal(shown.deckCount, state.sides[side].deck.length);
        assert.deepEqual(Object.keys(shown).sort(), [...Object.keys(view.sides[side]), ...(view.sides[side].hand ? [] : ["hand"])].sort());
        const text = JSON.stringify(finished);
        for (const hidden of state.sides[side].deck) assert.ok(!text.includes(`"${hidden}"`), `${hidden} from the ${side} deck is shown`);
        if (side !== view.viewer) for (const hidden of state.sides[side].traps) assert.ok(!text.includes(`"${hidden}"`), `set trap ${hidden} is shown`);
      }
      assert.equal(finished.seed, undefined);
    }
  }
});

// The session's own play, on the rules: solo lets the bot take every Wizard turn.
function shadowBot(state, duel, players) {
  while (players === 1 && !state.result && state.active !== "cowboy") state = playTurn(state, duel.level).state;
  return state;
}
const createShowdownShadow = (seed, duel, players) => shadowBot(createShowdown(seed, duel.options), duel, players);
const shadowAct = (state, action, duel, players) => shadowBot(applyAction(state, action).state, duel, players);
