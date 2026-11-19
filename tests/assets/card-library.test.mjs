// docs/cards.csv is generated from the catalog; this fails when a card is added or changed without re-running the export.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {CARD_SPECS} from "../../src/game/card-specs.generated.js";
import {cardLibraryCsv, cardRows} from "../../scripts/export-card-library.mjs";

test("card library: docs/cards.csv matches the catalog", () => {
  assert.equal(readFileSync(new URL("../../docs/cards.csv", import.meta.url), "utf8"), cardLibraryCsv(),
    "docs/cards.csv is out of date. Run: node scripts/export-card-library.mjs");
});

test("card library: one row per card, each with an effect, a job and an answer", () => {
  const rows = cardRows();
  assert.deepEqual(rows.map((row) => row[0]), CARD_SPECS.map((spec) => spec.name));
  for (const row of rows) for (const column of [2, 8, 10, 12, 13]) assert.ok(String(row[column]).length > 3, `${row[0]} column ${column}`);
});
