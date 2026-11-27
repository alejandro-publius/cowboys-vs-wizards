import assert from "node:assert/strict";
import test from "node:test";
import {TYPES, tributes, typeOf} from "../../src/game/showdown/cards.js";
import {attackOf, opponent} from "../../src/game/showdown/rules.js";
import {bookPractice} from "../../src/match/showdown-book-practice.js";
import {createShowdownSession} from "../../src/match/showdown-session.js";
import {presentationBeats} from "../../src/ui/showdown-3d/event-positions.js";
import {lessonSetup} from "../../src/ui/wizard-lesson.js";

const open = (id) => createShowdownSession(bookPractice(id));
const plays = (session, id) => session.legal().filter(a => a.cardId && typeOf(a.cardId) === id);

function act(session, action) {
  assert.ok(action, "the player can choose this move");
  const trace = [];
  const events = session.act(action, step => trace.push(step));
  return {events, beats: presentationBeats(trace), after: session.view()};
}

test("the book accepts only exact registered type IDs", () => {
  for (const id of [null, 0, ["cowboy-billy"], "", "constructor", "__proto__", "Cowboy", "cowboy-billy-1"]) {
    assert.equal(bookPractice(id), null);
  }
});

for (const [id, card] of Object.entries(TYPES)) {
  test(`${card.name} opens on its owner's decision and animates the move the player chooses`, () => {
    const session = open(id);
    const {duel, seed, seat} = bookPractice(id);
    const before = session.view();
    const foe = opponent(seat);
    assert.equal(seat, card.side);
    assert.equal(before.active, seat);
    assert.deepEqual(before, open(id).view(), "retry restores the exercise");
    assert.equal(duel.kind, "turn", "uses the no-settlement and no-playtest path");
    assert.equal(lessonSetup(duel, seed), null);
    assert.equal(before.sides[foe].hand, undefined);
    assert.ok(session.opening.every(e => e.side !== seat || ["turn", "draw"].includes(e.type)));

    const hand = plays(session, id);
    assert.ok(hand.length, "also playable from hand, with its real costs and targets");
    if (card.kind === "troop") {
      const troop = before.sides[seat].board[0];
      assert.equal(typeOf(troop.cardId), id);
      assert.equal(troop.health, card.health);
      const attacks = session.legal().filter(a => a.type === "attack" && a.slot === 0);
      if (card.attack === 0) {
        assert.equal(attacks.length, 0);
        const {beats, after} = act(session, {type: "cover", slot: 0});
        assert.equal(beats[0].kind, "cover");
        assert.equal(after.sides[seat].board[0].cover, true);
      } else {
        assert.ok(attacks.length >= 2, "the player chooses the defender");
        const {beats, after} = act(session, attacks.find(a => a.target === 0));
        assert.deepEqual(beats[0].from, {side: seat, slot: 0});
        assert.deepEqual(beats[0].targets, [{side: foe, slot: 0}]);
        assert.equal(beats[0].damage, Math.min(card.attack, before.sides[foe].board[0].health));
        assert.ok((after.sides[foe].board[0]?.health ?? 0) < before.sides[foe].board[0].health);
        if (card.keys.includes("sweep")) {
          assert.ok(beats.some(b => b.kind === "sweep"));
          assert.equal(after.sides[foe].board[1], null);
        }
        if (card.keys.includes("laststand")) assert.ok(beats.some(b => b.kind === "laststand"));
      }

      const retry = open(id);
      const summon = plays(retry, id).at(-1); // For Raise, pay the Skeleton beside the Wizard.
      assert.equal(summon.tributes.length, tributes(id));
      const {events, after} = act(retry, summon);
      assert.equal(events.filter(e => e.type === "tribute").length, tributes(id));
      assert.ok(after.sides[seat].board.some(t => t?.cardId === summon.cardId));
      if (card.keys.includes("scout")) assert.equal(after.sides[seat].deckCount, before.sides[seat].deckCount - 1);
      if (card.keys.includes("raise")) assert.equal(after.sides[seat].board.find(t => t?.cardId === before.sides[seat].board[1].cardId).health, 1);
      return;
    }

    const action = hand.at(-1);
    const {beats, after} = act(session, action);
    const mine = after.sides[seat];
    assert.ok(!mine.hand.includes(action.cardId));
    if (card.kind === "spell") {
      assert.ok(mine.discard.includes(action.cardId));
      const impact = beats.find(b => b.type === "spell" && b.kind !== "play" && b.kind !== "burial");
      assert.equal(impact.targets.length, card.effect === "hellfire" ? 2 : 1);
      if (card.effect === "tie") {
        assert.equal(after.sides[foe].board[action.target].stunned, true);
        assert.equal(after.sides[foe].board[action.target].health, before.sides[foe].board[action.target].health);
      } else {
        assert.equal(after.sides[foe].board[1], null);
        assert.equal(after.sides[foe].board[0].health, before.sides[foe].board[0].health - (card.effect === "hellfire" ? 1 : 0));
      }
    } else if (card.kind === "gear") {
      assert.equal(hand.length, 2, "two legal carriers");
      const carrier = mine.board[action.slot];
      assert.ok(carrier.gear.includes(action.cardId));
      assert.deepEqual(beats[0].targets, [{side: seat, slot: action.slot}]);
      const prior = before.sides[seat].board[action.slot];
      assert.equal(attackOf(after, carrier) - attackOf(before, prior), card.effect === "sixshooter" ? 1 : 0);
      assert.equal(carrier.health - prior.health, card.effect === "bonearmor" ? 2 : 0);
    } else if (card.kind === "location") {
      assert.equal(beats[0].kind, "location");
      assert.deepEqual(after.location, {cardId: action.cardId, side: seat});
      assert.equal(attackOf(after, mine.board[0]), attackOf(before, before.sides[seat].board[0]) + 1);
    } else {
      assert.equal(card.kind, "trap");
      assert.equal(beats[0].kind, "set");
      assert.deepEqual(mine.traps, [action.cardId]);
      const reply = act(session, {type: "end"});
      const trap = reply.beats.find(b => b.kind === "trap" && b.cardId === action.cardId);
      assert.equal(trap.stopped, true);
      assert.equal(trap.targets[0].side, foe);
      assert.equal(trap.left, card.effect === "snare" ? 0 : 1);
      assert.ok(reply.after.sides[seat].discard.includes(action.cardId));
    }
  });
}

test("riding past a defender or fighting it changes which piece loses orbs", () => {
  const ride = open("cowboy-mounted-billy");
  const fight = open("cowboy-mounted-billy");
  const past = act(ride, {type: "attack", slot: 0, target: "base"});
  const into = act(fight, {type: "attack", slot: 0, target: 0});
  assert.equal(past.beats[0].kind, "ride");
  assert.deepEqual([past.after.sides.wizard.base, past.after.sides.wizard.board[0].health], [4, 4]);
  assert.deepEqual([into.after.sides.wizard.base, into.after.sides.wizard.board[0].health], [5, 1]);
});

test("Bone Wall can cover before the CPU attacks and keep the overflow off its Base", () => {
  const cover = open("wizard-bone-wall");
  const pass = open("wizard-bone-wall");
  cover.act({type: "cover", slot: 0});
  const defended = act(cover, {type: "end"});
  const exposed = act(pass, {type: "end"});
  assert.ok(defended.events.some(e => e.type === "attack" && e.target === "wizard-bone-wall-0" && e.covered));
  assert.equal(defended.after.sides.wizard.base, 5);
  assert.equal(exposed.after.sides.wizard.base, 4);
});
