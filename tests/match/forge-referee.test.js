import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {test} from "node:test";
import {fileURLToPath} from "node:url";
import {TYPES} from "../../src/game/showdown/cards.js";
import {applyAction, createShowdown} from "../../src/game/showdown/rules.js";
import {dealHellfire} from "../../src/ui/forge-hellfire.js";

test("the independent rulebook referee and the playable Forge agree on the four actions of deal 0", () => {
  const opening = createShowdown(0, {first: "cowboy"});
  const sides = ["cowboy", "wizard"];
  const decks = Object.fromEntries(sides.map(side =>
    [side, [...opening.sides[side].hand, ...opening.sides[side].deck]]));
  const cardNames = Object.fromEntries(Object.entries(TYPES).map(([id, card]) => [id, card.name]));
  const cast = {type: "spell", cardId: "wizard-hellfire-1"};
  const actions = [
    {type: "summon", cardId: "cowboy-sheriff-3", tributes: []},
    {type: "end"},
    {type: "summon", cardId: "wizard-skeleton-4", tributes: []},
    cast,
  ];
  const referee = fileURLToPath(new URL("../../proof/referee/referee.py", import.meta.url));
  const trace = JSON.parse(execFileSync("python3", [referee, "--stream"], {
    input: JSON.stringify({seed: 0, first: "cowboy", decks, cardNames, actions}) + "\n",
    encoding: "utf8",
  }));
  assert.deepEqual(trace.unsupported, []);
  assert.deepEqual(trace.steps.map(step => step.accepted), [true, true, true, true]);

  const before = dealHellfire();
  const after = applyAction(before, cast).state;
  for (const [step, game] of [[2, before], [3, after]]) {
    for (const side of sides) {
      const actual = game.sides[side].board.map(troop => troop && [troop.cardId, troop.health]);
      const ruled = trace.steps[step].state.players[side].troops.map(troop => troop && [troop.id, troop.orbs]);
      assert.deepEqual(actual, ruled, `action ${step + 1}, ${side}`);
    }
  }
});
