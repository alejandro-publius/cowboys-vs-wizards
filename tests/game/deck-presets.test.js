import test from "node:test";
import assert from "node:assert/strict";
import { COWBOY_CATALOG, DEFAULT_COUNTS, deckIds, validateDeck } from "../../src/game/deck-builder.js";
import { DEADEYE_CONTROL } from "../../src/game/deck-presets.js";
import { createMatch } from "../../src/game/state.js";
import { createProfileStore } from "../../src/profile/player-profile.js";

const PRESET_COUNTS = Object.freeze({
  "cowboy-sheriff": 6, "cowboy-billy": 3, "cowboy-mounted-billy": 0, "cowboy-deadeye": 3,
});

test("Deadeye Control is a frozen, valid twelve-card deck in catalog order", () => {
  assert.equal(DEADEYE_CONTROL.name, "Deadeye Control");
  assert.deepEqual(DEADEYE_CONTROL.counts, PRESET_COUNTS);
  assert.deepEqual(Object.keys(DEADEYE_CONTROL.counts), COWBOY_CATALOG.map(({ type }) => type));
  assert.deepEqual(validateDeck(DEADEYE_CONTROL.counts), { ok: true, error: null, total: 12 });
  assert(Object.isFrozen(DEADEYE_CONTROL) && Object.isFrozen(DEADEYE_CONTROL.counts));
});

test("compared with the starter it adds one Deadeye for Mounted Billy and leaves the starter unchanged", () => {
  const change = Object.fromEntries(COWBOY_CATALOG.map(({ type }) =>
    [type, DEADEYE_CONTROL.counts[type] - DEFAULT_COUNTS[type]]));
  assert.deepEqual(change, {
    "cowboy-sheriff": 0, "cowboy-billy": 0, "cowboy-mounted-billy": -1, "cowboy-deadeye": 1,
  });
  assert.deepEqual(DEFAULT_COUNTS, {
    "cowboy-sheriff": 6, "cowboy-billy": 3, "cowboy-mounted-billy": 1, "cowboy-deadeye": 2,
  });
});

test("a saved copy keeps the existing profile deck format through a reload", () => {
  const items = new Map();
  const storage = { getItem: (key) => items.get(key) ?? null, setItem: (key, value) => { items.set(key, String(value)); } };
  const draft = { ...DEADEYE_CONTROL.counts };
  createProfileStore(storage).saveDeck(draft);
  assert.deepEqual(JSON.parse(items.get("cvw-player-v1")).deck, PRESET_COUNTS);
  assert.deepEqual(Object.keys(createProfileStore(storage).get().deck), Object.keys(PRESET_COUNTS));
  assert.deepEqual(createProfileStore(storage).get().deck, PRESET_COUNTS);
  assert.deepEqual(DEADEYE_CONTROL.counts, PRESET_COUNTS);
});

test("the saved counts build seeded matches with exactly those cards and the usual Wizard setup", () => {
  const ids = deckIds(DEADEYE_CONTROL.counts);
  assert.deepEqual(ids, [
    ...Array.from({ length: 6 }, (_, i) => `cowboy-sheriff-${i + 1}`),
    "cowboy-billy-1", "cowboy-billy-2", "cowboy-billy-3",
    "cowboy-deadeye-1", "cowboy-deadeye-2", "cowboy-deadeye-3",
  ]);
  for (const seed of [0, 37]) {
    const match = createMatch(seed, { cowboyDeck: ids });
    const { hand, deck } = match.sides.cowboy;
    assert.deepEqual([...hand, ...deck].sort(), [...ids].sort());
    assert.deepEqual(match.sides.wizard, createMatch(seed).sides.wizard);
  }
});
