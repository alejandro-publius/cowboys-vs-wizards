// The 3D hand-off manifest (src/render/presentation-manifest.js): every entry names a real
// troop card, a model file that exists and is bundled, and an attack clip the file contains.
import test from "node:test";
import assert from "node:assert/strict";
import {existsSync, readFileSync} from "node:fs";
import {parseGlb} from "../../scripts/audit-assets.mjs";
import {CARD_SPECS} from "../../src/game/card-specs.generated.js";
import {CARDS} from "../../src/game/cards.js";
import {arenaModelNames} from "../../src/render/model-assets.js";
import {CARD_MODELS, CODE_RIGGED, cardType, formOf} from "../../src/render/presentation-manifest.js";

const troops = new Map(CARD_SPECS.filter((spec) => spec.kind === "troop").map((spec) => [spec.type, spec]));

test("presentation manifest: every entry is a troop in the catalog, listed once", () => {
  for (const type of [...Object.keys(CARD_MODELS), ...Object.keys(CODE_RIGGED)]) {
    assert.ok(troops.has(type), `${type} is in the manifest but is not a troop card`);
  }
  for (const type of Object.keys(CARD_MODELS)) assert.ok(!CODE_RIGGED[type], `${type} is listed as both a model and a code rig`);
  for (const id of Object.keys(CARDS)) assert.ok(CARD_SPECS.some((spec) => spec.type === cardType(id)), `${id} has no catalog type`);
});

test("presentation manifest: each model file exists, is bundled and holds its attack clip", () => {
  for (const [type, {asset, rig}] of Object.entries(CARD_MODELS)) {
    const file = new URL(`../../assets/models/${asset}.glb`, import.meta.url);
    assert.ok(existsSync(file), `${type}: assets/models/${asset}.glb is missing`);
    assert.ok(arenaModelNames.includes(asset), `${type}: ${asset} is not in the bundled model list`);
    if (rig) assert.ok(parseGlb(readFileSync(file)).clips.includes(rig.clip), `${type}: ${asset}.glb has no clip named ${rig.clip}`);
  }
});

test("presentation manifest: every troop has a form, and the placeholders are listed", (t) => {
  const forms = Object.groupBy(troops.keys(), formOf);
  assert.equal(Object.values(forms).flat().length, troops.size);
  for (const [form, types] of Object.entries(forms)) t.diagnostic(`${form}: ${types.map((type) => troops.get(type).name).join(", ")}`);
});
