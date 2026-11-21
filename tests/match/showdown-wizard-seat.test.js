// The Wizard seat of the graybox Showdown session, for the proposed Wizard campaign
// (docs/design/showdown-wizard-campaign-brief.md): createShowdownSession({seat: "wizard"}) gives the
// human the Wizards and the bot the Cowboys. The default seat stays the Cowboys.
import assert from "node:assert/strict";
import test from "node:test";
import {DECKS} from "../../src/game/showdown/cards.js";
import {presentEvent} from "../../src/game/showdown/presenter.js";
import {bootHill, createShowdownSession, twoPlayers} from "../../src/match/showdown-session.js";

// Every Cowboy card id in the Wizard's view is on the board, in a graveyard or the location.
function assertCowboyPrivate(view, label) {
  const cowboy = view.sides.cowboy;
  for (const hidden of ["hand", "traps", "deck"]) assert.equal(cowboy[hidden], undefined, `${label}: Cowboy ${hidden}`);
  assert.equal(view.sides.wizard.deck, undefined, `${label}: own deck order`);
  assert.equal(view.seed, undefined);
  assert.equal(typeof cowboy.handCount, "number");
  assert.equal(typeof cowboy.trapCount, "number");
  const publicIds = new Set([...cowboy.discard, ...cowboy.board.filter(Boolean).flatMap((t) => [t.cardId, ...t.gear]), view.location?.cardId].filter(Boolean));
  for (const id of JSON.stringify(view).match(/cowboy-[a-z-]+-\d+/g) ?? []) assert.ok(publicIds.has(id), `${label}: ${id} is not public`);
}

test("the default seat is still the Cowboys", () => {
  const session = createShowdownSession({seed: 0, duel: bootHill()});
  assert.equal(session.seat, "cowboy");
  assert.equal(session.view().viewer, "cowboy");
});

test("Wizard seat on Boot Hill seed 0: the bot's Cowboy opening is played first, then a concrete Wizard summon applies once", () => {
  const session = createShowdownSession({seed: 0, duel: bootHill(), seat: "wizard"});
  assert.equal(session.seat, "wizard");
  assert.equal(session.viewer(), "wizard");
  assert.ok(session.opening.some((event) => event.type === "turn"), "the Cowboy bot's turn ended inside the opening");
  const view = session.view();
  assert.deepEqual([view.viewer, view.active, view.turn, view.first], ["wizard", "wizard", 2, "cowboy"]);
  assertCowboyPrivate(view, "seed 0");
  const summon = session.legal().find((a) => a.type === "summon");
  assert.ok(summon && view.sides.wizard.hand.includes(summon.cardId));
  const handBefore = view.sides.wizard.hand.length;
  const events = session.act(summon);
  assert.equal(events.filter((e) => e.type === "summon" && e.cardId === summon.cardId).length, 1);
  const after = session.view();
  assert.ok(after.sides.wizard.board.some((t) => t?.cardId === summon.cardId) || after.sides.wizard.discard.includes(summon.cardId));
  assert.ok(after.sides.wizard.hand.length < handBefore || after.turn > view.turn);
  assert.ok(!session.legal().some((a) => a.cardId === summon.cardId), "the same card is not offered again");
});

test("Fable's fixture from the Wizard seat: tribute slot 0 summons the Wizard and raises a 1-orb Skeleton", () => {
  const duel = {name: "fixture", level: 0, options: {first: "wizard", decks: {wizard: {"wizard-wizard": 16}},
    opening: {wizard: [{type: "wizard-skeleton", health: 1}, {type: "wizard-skeleton", health: 3}]}}};
  const session = createShowdownSession({seed: 0, duel, seat: "wizard"});
  assert.deepEqual(session.opening, []);
  const action = session.legal().find((a) => a.type === "summon" && a.tributes.join() === "0");
  assert.ok(action);
  assert.deepEqual(session.act(action).map((e) => e.type), ["tribute", "summon", "raise"]);
  const board = session.view().sides.wizard.board.map((t) => t && [t.cardId.replace(/-\d+$/, ""), t.health]);
  assert.deepEqual(board, [["wizard-wizard", 4], ["wizard-skeleton", 3], ["wizard-skeleton", 1]]);
});

test("illegal actions are refused from the Wizard seat, and a finished duel accepts none", () => {
  const session = createShowdownSession({seed: 0, duel: bootHill(), seat: "wizard"});
  assert.throws(() => session.act({type: "attack", slot: 0, target: "base"}), /illegal action/);
  assert.throws(() => session.act({type: "summon", cardId: "cowboy-sheriff-1", tributes: []}), /illegal action/);
  for (let step = 0; step < 400 && !session.view().result; step += 1) session.act({type: "end"});
  const result = session.view().result;
  assert.equal(result?.winner, "cowboy", "a Wizard who only ends turns loses Boot Hill");
  assert.deepEqual(session.legal(), []);
  assert.throws(() => session.act({type: "end"}), /not this seat's turn/);
});

// Even decks (traps on both sides) against the level 1 bot, played by a simple attacker from the Wizard seat.
test("over played even-deck duels from the Wizard seat, Cowboy hand and traps stay counts, actions are only offered on the Wizard turn, and results name a side", () => {
  const winners = {cowboy: 0, wizard: 0, null: 0};
  let cowboyTrapsSeen = 0;
  for (let seed = 0; seed < 20; seed += 1) {
    const session = createShowdownSession({seed, duel: {...twoPlayers(), level: 1, options: {decks: DECKS}}, seat: "wizard"});
    for (let step = 0; step < 400 && !session.view().result; step += 1) {
      const view = session.view();
      assertCowboyPrivate(view, `seed ${seed}`);
      cowboyTrapsSeen = Math.max(cowboyTrapsSeen, view.sides.cowboy.trapCount);
      assert.equal(view.active, "wizard", "control comes back only on a Wizard turn");
      const legal = session.legal();
      assert.ok(legal.length > 0);
      const events = session.act(legal.find((a) => a.type === "attack") ?? legal.find((a) => a.type !== "end" && a.type !== "cover") ?? legal.find((a) => a.type === "end"));
      for (const event of events) assert.equal(typeof presentEvent(event), "string");
    }
    const result = session.view().result;
    assert.ok(result, `seed ${seed} finished`);
    assert.ok(result.winner === null || result.winner === "cowboy" || result.winner === "wizard");
    winners[result.winner] += 1;
  }
  assert.ok(cowboyTrapsSeen > 0, "the Cowboy bot set at least one face-down trap");
  assert.equal(winners.cowboy + winners.wizard + winners.null, 20);
});

test("two players ignore the seat: the active side views and acts", () => {
  const session = createShowdownSession({seed: 0, duel: twoPlayers(), players: 2, seat: "wizard"});
  assert.equal(session.seat, null);
  assert.equal(session.viewer(), session.view().active);
});
