import assert from "node:assert/strict";
import test from "node:test";
import {TYPES} from "../../src/game/showdown/cards.js";
import {attackPreviews} from "../../src/ui/showdown-3d/attack-preview.js";
import {bookSpread, setBookMove} from "../../src/ui/showdown-3d/character-book.js";

test("changing portraits is silent and each play click opens the selected move once", () => {
  const events = [];
  const button = {
    focus() { events.push("focus"); },
    setAttribute(key, value) { this[key] = value; },
  };
  const play = id => events.push(id);
  const examples = {"cowboy-billy": "Attack", "cowboy-captured-dragon": "Sweep", "wizard-bone-wall": "Guard", "wizard-hellfire": "Cast"};
  for (const [id, card] of Object.entries(TYPES)) {
    setBookMove(button, id, play);
    assert.deepEqual(events, [], id);
    assert.equal(button.hidden, !attackPreviews(id).length, id);
    if (button.hidden) {
      assert.equal(button.onclick, null);
      continue;
    }
    assert.match(button.textContent, /^(Attack|Sweep|Guard|Cast)$/, id);
    if (id in examples) assert.equal(button.textContent, examples[id]);
    assert.equal(button["aria-label"], `${button.textContent} with ${card.name}`);
    button.onclick();
    assert.deepEqual(events.splice(0), ["focus", id], id);
  }
});

for (const side of ["cowboy", "wizard"]) {
  test(`every ${side} card opens on its indexed spread`, () => {
    const roster = Object.entries(TYPES).filter(([, card]) => card.side === side);
    const seen = [];
    const {leaves} = bookSpread(side, 0);
    assert.ok(leaves > 1);
    for (let page = 0; page < leaves; page++) {
      const spread = bookSpread(side, page);
      assert.equal(spread.page, page);
      assert.ok(spread.visible.length > 0);
      for (const [id, card] of spread.visible) {
        assert.equal(TYPES[id], card);
        assert.deepEqual(bookSpread(side, (page + 1) % leaves, id), spread, id);
        seen.push(id);
      }
    }
    assert.deepEqual(seen.sort(), roster.map(([id]) => id).sort());
  });
}
