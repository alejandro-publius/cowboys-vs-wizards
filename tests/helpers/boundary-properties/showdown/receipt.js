// The committed receipt of reduced planted-fault failures (minimal-cases.json): for each
// property, the first generated case its fault fails, reduced with shrink.js.
import { BASE_SEED } from "../rng.js";
import { FAULTS } from "./faults.js";
import { PROPERTIES, inputFor } from "./properties.js";
import { minimalCase } from "./shrink.js";

export const RECEIPT = new URL("./minimal-cases.json", import.meta.url);
export const buildReceipt = () => ({
  baseSeed: BASE_SEED,
  note: "First failing generated case per planted fault, reduced. Regenerate: node tests/helpers/boundary-properties/showdown/replay.mjs --write-minimal",
  cases: PROPERTIES.map((property) => minimalCase(property, FAULTS[property.id][0], inputFor)),
});
