// Refusals are shown only for an active player's hand card with no legal action.
import assert from "node:assert/strict";
import test from "node:test";
import {viewFor} from "../../src/game/showdown/contract.js";
import {createShowdown, legalActions, opponent} from "../../src/game/showdown/rules.js";
import {blockedReason} from "../../src/ui/showdown-screen.js";

function reason(state, cardId, otherCards = []) {
  state.sides[state.active].hand = [cardId, ...otherCards];
  const moves = legalActions(state);
  assert.ok(!moves.some((move) => move.cardId === cardId), cardId + " must be blocked");
  assert.ok(moves.some((move) => move.type === "end"));
  return blockedReason(viewFor(state, state.active), state.active, cardId);
}
const deal = (options = {}) => createShowdown(12, {first: "cowboy", ...options});

test("turn limits explain a disabled card and retain the one-troop message", () => {
  assert.equal(reason({...deal(), summonUsed: true}, "cowboy-sheriff-1"), "One troop a turn.");
  assert.match(reason({...deal(), attacking: true}, "cowboy-sheriff-1"), /no more cards this turn.*End turn/);
  assert.match(reason({...deal(), setUsed: true}, "cowboy-bear-trap-1"), /One trap a turn.*End turn/);
  assert.match(reason({...deal(), castUsed: true}, "cowboy-deadeye-1"), /One spell, gear or location a turn.*End turn/);
});

test("the refusal distinguishes insufficient tribute, a full board and filled trap slots", () => {
  assert.match(reason(deal(), "cowboy-mounted-billy-1"), /Need 2 troops.*End turn/);
  assert.match(reason(deal(), "cowboy-mounted-billy-1", ["cowboy-sheriff-1"]), /Need 2 troops.*Play Sheriff/);
  const full = deal({opening: {cowboy: [{type: "cowboy-billy"}, {type: "cowboy-sheriff"}, {type: "cowboy-ranger"}]}});
  assert.match(reason(full, "cowboy-outrider-1"), /three slots are full.*End turn/);
  full.sides.cowboy.traps = ["cowboy-bear-trap-1", "cowboy-bear-trap-2"];
  assert.match(reason(full, "cowboy-bear-trap-3"), /Both trap slots are rigged.*End turn/);
});

test("gear, location and spell refusals account for the actual board", () => {
  const state = deal();
  assert.match(reason(state, "cowboy-six-shooter-1"), /No troop to carry this gear.*End turn/);
  state.location = {side: "cowboy", cardId: "cowboy-sheriffs-office-1"};
  assert.match(reason(state, "cowboy-sheriffs-office-2"), /already in play.*End turn/);
  // A spell may have no legal target even when an enemy troop is on the board.
  const ghost = deal({opening: {wizard: [{type: "wizard-lantern-wraith"}]}});
  for (const board of [state, ghost]) {
    assert.match(reason(board, "cowboy-deadeye-1"), /No enemy troop this spell can hit.*End turn/);
  }
});

test("both seats get the same reason when hidden enemy identities change", () => {
  for (const [seat, card, trap] of [
    ["cowboy", "cowboy-mounted-billy-1", "wizard-hex"],
    ["wizard", "wizard-dragon-1", "cowboy-bear-trap"],
  ]) {
    const original = deal({first: seat});
    const foe = opponent(seat);
    original.sides[foe].traps = [trap + "-1"];
    const changed = structuredClone(original);
    changed.sides[foe].hand.reverse();
    changed.sides[foe].deck.reverse();
    changed.sides[foe].traps = [trap + "-2"];
    assert.equal(reason(original, card), reason(changed, card));
  }
});
