import assert from "node:assert/strict";
import test from "node:test";
import {clashLog} from "../../src/match/clash-log.js";
import {cardModel} from "../../src/ui/card-model.js";

test("clash log names a Dragon Fire burn-through", () => {
  const log = clashLog([
    {type: "damage", lane: 1, attacker: {side: "cowboy", cardId: "cowboy-billy-1"}, target: {kind: "base", side: "wizard"}, before: 3, after: 0, fire: true},
    {type: "clash", round: 7},
  ]);
  assert.deepEqual(log.lines, ["Dragon Fire burned through: Wizard Base 3 → 0."]);
  const own = clashLog([
    {type: "damage", lane: 1, attacker: {side: "wizard", cardId: "wizard-dragon-1"}, target: {kind: "base", side: "cowboy"}, before: 2, after: 0, fire: true},
    {type: "clash", round: 1},
  ]);
  assert.deepEqual(own.lines, ["Dragon Fire burned through: your Base 2 → 0."]);
});

test("card model carries fireArc only when given", () => {
  assert.equal("fireArc" in cardModel({}), false);
  const fireArc = {stage: "position-b", note: "Rival note", mark: 1};
  assert.deepEqual(cardModel({fireArc}).fireArc, fireArc);
});
