// Replays one Showdown property case alone and prints the result as JSON.
//   node tests/helpers/boundary-properties/showdown/replay.mjs --property SP4 --index 0 [--fault]
//   node tests/helpers/boundary-properties/showdown/replay.mjs --minimal SP4 [--fault]
//   node tests/helpers/boundary-properties/showdown/replay.mjs --write-minimal   (refresh the receipt)
// --index regenerates case <index> from the recorded base seed (BOUNDARY_SEED overrides it).
// --minimal replays the reduced input committed in minimal-cases.json.
// --fault runs the property's disposable planted fault (faults.js) instead of the real engine.
import { readFileSync, writeFileSync } from "node:fs";
import { BASE_SEED } from "../rng.js";
import { ENGINE, ENGINE_DIR } from "./engine.js";
import { FAULTS } from "./faults.js";
import { PROPERTIES, byId, inputFor } from "./properties.js";
import { RECEIPT, buildReceipt } from "./receipt.js";
import { runInput } from "./shrink.js";

const args = process.argv.slice(2);
const value = (flag) => { const at = args.indexOf(flag); return at < 0 ? undefined : args[at + 1]; };

if (args.includes("--write-minimal")) {
  writeFileSync(RECEIPT, JSON.stringify(buildReceipt(), null, 2) + "\n");
  console.log(`wrote ${RECEIPT.pathname}`);
} else {
  const id = value("--property") ?? value("--minimal");
  const property = byId(id);
  if (!property) {
    console.error(`usage: --property <${PROPERTIES.map((p) => p.id).join("|")}> --index <n> [--fault] | --minimal <id> [--fault] | --write-minimal`);
    process.exit(2);
  }
  let input;
  if (args.includes("--minimal")) {
    input = JSON.parse(readFileSync(RECEIPT, "utf8")).cases.find((entry) => entry.property === id).minimized;
  } else {
    const index = Number(value("--index"));
    if (!Number.isInteger(index) || index < 0) { console.error("--index must be a whole number"); process.exit(2); }
    input = inputFor(property, index);
  }
  const fault = args.includes("--fault") ? FAULTS[id][0] : null;
  const result = runInput(property, input, fault ? fault(ENGINE) : ENGINE);
  console.log(JSON.stringify({ property: id, title: property.title, engine: fault ? `fault ${fault.name}` : ENGINE_DIR, baseSeed: BASE_SEED,
    input: { ...input, choices: input.choices.length > 12 ? `${input.choices.length} choices` : input.choices }, result }, null, 2));
  process.exit(result.status === "pass" ? 0 : 1);
}
