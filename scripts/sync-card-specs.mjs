// Validates .kiro/specs/duel-card-pipeline/cards/*.json and writes
// src/game/card-specs.generated.js. With --check it only compares and exits 1
// when the generated file is stale. Nothing is written if any spec is invalid.
import { readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SPEC_DIR = join(root, ".kiro/specs/duel-card-pipeline/cards");
const OUTPUT = join(root, "src/game/card-specs.generated.js");

const SIDES = ["cowboy", "wizard"];
const DECK_SIZE = 12;
const MAX_HEALTH = 5; // one to five health orbs per troop
const FIELDS = {
  troop: ["type", "side", "order", "name", "kind", "stars", "health", "attack", "copies"],
  spell: ["type", "side", "order", "name", "kind", "relocates", "copies"],
};
// Optional fields, written after the required ones when present. `limit` is a
// Cowboy collectible's copy limit (1 to 6); `rides` marks a troop that may Ride.
const OPTIONAL = { troop: ["limit", "rides"], spell: ["limit"] };
const MAX_LIMIT = 6;
const isInt = (value, min, max = Infinity) => Number.isSafeInteger(value) && value >= min && value <= max;

function validateSpec(file, spec) {
  const errors = [];
  const fail = (message) => errors.push(`${file}: ${message}`);
  if (spec === null || typeof spec !== "object" || Array.isArray(spec)) return [`${file}: must be an object`];

  if (!Object.hasOwn(FIELDS, spec.kind)) return [`${file}: kind must be "troop" or "spell"`];
  const fields = FIELDS[spec.kind];
  for (const key of Object.keys(spec)) {
    if (!fields.includes(key) && !OPTIONAL[spec.kind].includes(key) && key !== "bounty") fail(`unknown field "${key}" for a ${spec.kind}`);
  }
  for (const key of fields) if (!(key in spec)) fail(`missing field "${key}"`);

  if (typeof spec.type !== "string" || !/^[a-z]+(-[a-z]+)*$/.test(spec.type)) fail("type must be lowercase words joined by '-'");
  else if (file !== `${spec.type}.json`) fail(`file name must be ${spec.type}.json`);
  if (!SIDES.includes(spec.side)) fail(`side must be one of ${SIDES.join(", ")}`);
  else if (typeof spec.type === "string" && !spec.type.startsWith(`${spec.side}-`)) fail(`type must start with "${spec.side}-"`);
  if (!isInt(spec.order, 1)) fail("order must be a positive integer");
  if (typeof spec.name !== "string" || spec.name.trim() === "") fail("name must be a non-empty string");
  if (Object.hasOwn(spec, "bounty")) {
    // A Cowboy bounty card is a one-copy Wanted reward; a Wizard one is a Wanted boss.
    // Neither is in a starter deck.
    if (spec.bounty !== true || spec.kind !== "troop" || spec.copies !== 0) {
      fail("a bounty card must be a troop with zero starter copies");
    }
    if (Object.hasOwn(spec, "limit")) fail("a bounty card has a fixed limit of one");
  } else if (spec.copies === 0 && spec.side === "cowboy" && Object.hasOwn(spec, "limit")) {
    // A new Cowboy collectible: no starter copies, owned only through unlocks.
  } else if (spec.copies === 0 && spec.side === "wizard" && spec.kind === "troop" && spec.limit === 1) {
    // An optional Wizard troop (the Imp): registered, in no default deck.
  } else if (!isInt(spec.copies, 1, DECK_SIZE)) fail(`copies must be an integer from 1 to ${DECK_SIZE} (0 only for a Cowboy card with a limit, or a one-limit Wizard troop)`);
  if (Object.hasOwn(spec, "limit")) {
    if (spec.side !== "cowboy" && !(spec.side === "wizard" && spec.kind === "troop" && spec.limit === 1 && spec.copies === 0)) fail("limit is only for Cowboy cards (or a zero-copy Wizard troop with limit 1)");
    if (!isInt(spec.limit, 1, MAX_LIMIT)) fail(`limit must be an integer from 1 to ${MAX_LIMIT}`);
    else if (Number.isSafeInteger(spec.copies) && spec.copies > spec.limit) fail("copies must not exceed limit");
  }
  if (Object.hasOwn(spec, "rides") && spec.rides !== true) fail("rides must be true when present");
  if (spec.kind === "troop") {
    if (!isInt(spec.stars, 1)) fail("stars must be a positive integer");
    if (!isInt(spec.health, 1, MAX_HEALTH)) fail(`health must be an integer from 1 to ${MAX_HEALTH}`);
    if (!isInt(spec.attack, 1)) fail("attack must be a positive integer");
  } else if (typeof spec.relocates !== "boolean") fail("relocates must be true or false");
  return errors;
}

function loadSpecs() {
  const files = readdirSync(SPEC_DIR).filter((name) => name.endsWith(".json")).sort();
  const errors = [];
  const specs = [];
  for (const file of files) {
    try {
      const spec = JSON.parse(readFileSync(join(SPEC_DIR, file), "utf8"));
      const problems = validateSpec(file, spec);
      errors.push(...problems);
      if (problems.length === 0) specs.push(spec);
    } catch (error) {
      errors.push(`${file}: ${error.message}`);
    }
  }

  const types = new Set();
  for (const spec of specs) {
    if (types.has(spec.type)) errors.push(`duplicate card type "${spec.type}"`);
    types.add(spec.type);
  }
  for (const side of SIDES) {
    const own = specs.filter((spec) => spec.side === side);
    const orders = new Set();
    for (const spec of own) {
      if (orders.has(spec.order)) errors.push(`${side}: duplicate order ${spec.order}`);
      orders.add(spec.order);
    }
    const total = own.reduce((sum, spec) => sum + spec.copies, 0);
    if (total !== DECK_SIZE) errors.push(`${side}: deck has ${total} cards, expected ${DECK_SIZE}`);
  }
  if (errors.length > 0) {
    console.error(errors.join("\n"));
    process.exit(1);
  }
  return SIDES.flatMap((side) => specs.filter((spec) => spec.side === side).sort((a, b) => a.order - b.order));
}

function render(specs) {
  const lines = specs.map((spec) => {
    const ordered = Object.fromEntries(FIELDS[spec.kind].map((key) => [key, spec[key]]));
    for (const key of OPTIONAL[spec.kind]) if (Object.hasOwn(spec, key)) ordered[key] = spec[key];
    if (spec.bounty) ordered.bounty = true;
    return `  ${JSON.stringify(ordered)},`;
  });
  return [
    "// Generated by scripts/sync-card-specs.mjs from .kiro/specs/duel-card-pipeline/cards/*.json.",
    "// Do not edit by hand. Cards are listed per side in deck order.",
    "export const CARD_SPECS = [",
    ...lines,
    "];",
    "",
  ].join("\n");
}

const output = render(loadSpecs());
const current = (() => {
  try {
    return readFileSync(OUTPUT, "utf8");
  } catch {
    return null;
  }
})();

if (process.argv.includes("--check")) {
  if (current !== output) {
    console.error("src/game/card-specs.generated.js is stale. Run: node scripts/sync-card-specs.mjs");
    process.exit(1);
  }
  console.log("card specs valid; generated file is up to date");
} else if (current === output) {
  console.log("card-specs.generated.js already up to date");
} else {
  const temporary = `${OUTPUT}.${process.pid}.tmp`;
  try {
    writeFileSync(temporary, output, { flag: "wx" });
    renameSync(temporary, OUTPUT);
  } finally {
    rmSync(temporary, { force: true });
  }
  console.log("wrote src/game/card-specs.generated.js");
}
