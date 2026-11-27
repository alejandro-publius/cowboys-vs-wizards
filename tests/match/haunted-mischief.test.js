// HSM-1 & HSM-2: Haunted-Western card refusal copy with explicit next-tap guidance and public-view privacy.
import assert from "node:assert/strict";
import test from "node:test";
import {viewFor} from "../../src/game/showdown/contract.js";
import {createShowdown} from "../../src/game/showdown/rules.js";
import {blockedReason} from "../../src/ui/showdown-screen.js";

function baseView() {
  const state = createShowdown(12, {first: "cowboy"});
  return viewFor(state, "cowboy");
}

test("HSM-1: blockedReason keeps 'One troop a turn.' verbatim and pairs haunted quips with next actions", () => {
  const afterSummon = {...baseView(), summonUsed: true};
  assert.equal(blockedReason(afterSummon, "cowboy", "cowboy-sheriff-1"), "One troop a turn.");

  const afterAttack = {...baseView(), attacking: true};
  assert.match(blockedReason(afterAttack, "cowboy", "cowboy-sheriff-1"), /Gunsmoke's out.*End turn/);

  const needsTribute = baseView();
  assert.match(blockedReason(needsTribute, "cowboy", "cowboy-mounted-billy-1"), /The grave demands 2 troops in tribute — summon free hands first/);

  const fullBoard = baseView();
  fullBoard.sides.cowboy.board = [
    {cardId: "cowboy-sheriff-1", health: 3, attacked: false, stunned: false, cover: false, gear: []},
    {cardId: "cowboy-sheriff-2", health: 3, attacked: false, stunned: false, cover: false, gear: []},
    {cardId: "cowboy-sheriff-3", health: 3, attacked: false, stunned: false, cover: false, gear: []},
  ];
  assert.match(blockedReason(fullBoard, "cowboy", "cowboy-sheriff-4"), /All three lanes are packed — attack or tribute a troop first/);

  const trapUsed = {...baseView(), setUsed: true};
  assert.match(blockedReason(trapUsed, "cowboy", "cowboy-bear-trap-1"), /One trap a turn — save that ambush/);

  const trapsFull = baseView();
  trapsFull.sides.cowboy.traps = ["cowboy-bear-trap-1", "cowboy-bear-trap-2"];
  assert.match(blockedReason(trapsFull, "cowboy", "cowboy-bear-trap-3"), /Both trap slots are rigged/);

  const castUsed = {...baseView(), castUsed: true};
  assert.match(blockedReason(castUsed, "cowboy", "cowboy-deadeye-1"), /One spell, gear or location a turn — act with your troops or press End turn/);

  assert.match(blockedReason(baseView(), "cowboy", "cowboy-six-shooter-1"), /Ghost holster — summon a troop first/);
  assert.match(blockedReason(baseView(), "cowboy", "cowboy-sheriffs-office-1"), /That haunted ground is already in play/);
  assert.match(blockedReason(baseView(), "cowboy", "cowboy-deadeye-1"), /Nothing undead or breathing to hex — summon a troop or press End turn/);
});

test("HSM-2: blockedReason reads only the active seat's public view and ignores hidden enemy cards", () => {
  const stateA = createShowdown(6, {first: "cowboy"});
  const stateB = structuredClone(stateA);
  stateB.sides.wizard.hand.reverse();
  stateB.sides.wizard.deck.reverse();
  stateB.sides.wizard.traps = ["wizard-hex-1"];
  stateA.sides.wizard.traps = ["wizard-hex-2"];

  const cards = ["cowboy-mounted-billy-1", "cowboy-six-shooter-1", "cowboy-deadeye-1", "cowboy-bear-trap-1"];
  for (const cardId of cards) {
    assert.equal(
      blockedReason(viewFor(stateA, "cowboy"), "cowboy", cardId),
      blockedReason(viewFor(stateB, "cowboy"), "cowboy", cardId),
    );
  }
});
