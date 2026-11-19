// docs/cards.csv is generated from the catalog; this fails when a card is added or changed without re-running the export.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {CARD_SPECS} from "../../src/game/card-specs.generated.js";
import {cardLibraryCsv, cardRows, cardTypesCsv} from "../../scripts/export-card-library.mjs";
import {FRAMES, frameOf} from "../../src/ui/card-frames.js";

test("card library: docs/cards.csv matches the catalog", () => {
  assert.equal(readFileSync(new URL("../../docs/cards.csv", import.meta.url), "utf8"), cardLibraryCsv(),
    "docs/cards.csv is out of date. Run: node scripts/export-card-library.mjs");
});

test("card library: one row per card, each with an effect, a job and an answer", () => {
  const rows = cardRows();
  assert.deepEqual(rows.map((row) => row[0]), CARD_SPECS.map((spec) => spec.name));
  for (const row of rows) for (const column of [2, 8, 10, 12, 13]) assert.ok(String(row[column]).length > 3, `${row[0]} column ${column}`);
});

test("card library: docs/card-types.csv matches the frames, and every card has a frame", () => {
  assert.equal(readFileSync(new URL("../../docs/card-types.csv", import.meta.url), "utf8"), cardTypesCsv(),
    "docs/card-types.csv is out of date. Run: node scripts/export-card-library.mjs");
  for (const spec of CARD_SPECS) assert.ok(FRAMES[frameOf(spec)], spec.type);
  const of = (type, options) => frameOf(CARD_SPECS.find((spec) => spec.type === type), options);
  assert.deepEqual([of("cowboy-sheriff"), of("cowboy-deadeye"), of("cowboy-captured-dragon"), of("wizard-lantern-wraith"), of("wizard-dragon", {wanted: true})],
    ["troop", "spell", "captured", "wanted", "wanted"]);
});
