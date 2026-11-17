import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DECK_SIZE } from "../../src/game/deck-builder.js";
import { MAX_COWBOY_COPIES, tributeCost } from "../../src/game/cards.js";

const source = readFileSync(new URL("../../src/ui/deck-workbench.js", import.meta.url), "utf8");

test("deck workbench reads limits and tribute tiers from game rules (issue #72)", () => {
  assert.equal(MAX_COWBOY_COPIES, 6);
  assert.equal(DECK_SIZE, 12);
  assert.deepEqual([1, 4, 5, 6, 7, 8].map(tributeCost), [0, 0, 1, 1, 2, 2]);
  assert.match(source, /import \{[^}]*MAX_COWBOY_COPIES[^}]*tributeCost[^}]*\} from '\.\.\/game\/cards\.js'/);
  assert.match(source, /import \{[^}]*DECK_SIZE[^}]*\} from '\.\.\/game\/deck-builder\.js'/);
  assert.doesNotMatch(source, /MAX_COPIES|stars\s*<\s*[57]|\b12\b|(?<![\w.])6 copies/);
});
