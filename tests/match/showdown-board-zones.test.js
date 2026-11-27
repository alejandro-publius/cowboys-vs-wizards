import assert from "node:assert/strict";
import test from "node:test";
import {boardZonesHtml} from "../../src/ui/showdown-board-zones.js";

const side = {base: 4, baseMax: 5, handCount: 3, deckCount: 12, trapCount: 1, board: [], discard: []};
const view = {viewer: "cowboy", sides: {
  cowboy: {...side, traps: ["cowboy-bear-trap-1"]},
  wizard: {...side, board: [{cardId: "wizard-dragon-1", gear: []}], discard: ["wizard-skeleton-1"]},
}};

test("board details show public names and counts and expose each occupied pile in one press", () => {
  const html = boardZonesHtml(view, {});
  assert.match(html, /<summary>Board details<\/summary>/);
  assert.match(html, /Base 4\/5 orbs · Hand 3 · Deck 12/);
  assert.match(html, /Traps 1 · Graveyard 1/);
  assert.match(html, /Troops · Dragon/);
  assert.match(html, /Traps 1 \(Bear Trap\)/);
  assert.match(html, /<\/details><button [^>]*data-graveyard="wizard"[^>]*newest Skeleton/);
  assert.equal(html.match(/data-graveyard=/g).length, 1);
  assert.doesNotMatch(html, /(?:cowboy|wizard)-[a-z-]+-\d+/);
  assert.doesNotMatch(boardZonesHtml(view, {shared: true}), /Bear Trap/);
});

test("the title challenge shows only the occupied pile action", () => {
  const html = boardZonesHtml(view, {challenge: true});
  assert.match(html, /^<button [^>]*data-graveyard="wizard"/);
  assert.doesNotMatch(html, /details|Traps|Base|data-graveyard="cowboy"/);
});
