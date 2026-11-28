// Run from the repository root. Supply a checkout of the cohort engine as the argument.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {resolve} from "node:path";
import {loadEngine, playDeals, sha256} from "../../../scripts/balance-evidence.mjs";

const arm = name => JSON.parse(readFileSync(new URL(`../../../reports/balance/catalog-drawn-${name}.json`, import.meta.url)));
const office = "cowboy-sheriffs-office";
const boneyard = "wizard-boneyard";
const baseline = arm("control");
const officeOnly = arm(office);
const boneyardOnly = arm(boneyard);
const root = resolve(process.argv[2] || ".");
const git = (...args) => execFileSync("git", ["-C", root, ...args], {encoding: "utf8"}).trim();
assert.equal(git("rev-parse", "HEAD:src/game"), git("rev-parse", baseline.commit + ":src/game"));
assert.equal(git("status", "--porcelain", "--", "src/game"), "");
for (const receipt of [officeOnly, boneyardOnly]) {
  assert.equal(receipt.commit, baseline.commit);
  assert.deepEqual(receipt.seeds, baseline.seeds);
  assert.deepEqual(receipt.seatOrder, baseline.seatOrder);
}
const engine = await loadEngine(root);
const decks = structuredClone(engine.DECKS);
decks.cowboy["cowboy-sheriff"]--;
decks.wizard["wizard-skeleton"]--;
decks.cowboy[office] = 1;
decks.wizard[boneyard] = 1;
const contested = playDeals({...engine, DECKS: decks,
  createShowdown: (seed, options) => engine.createShowdown(seed, {...options, decks})},
  baseline.seeds.from, baseline.seeds.to - baseline.seeds.from + 1);

function compare(before, after) {
  assert.equal(before.length, after.length);
  let gained = 0, lost = 0;
  for (let i = 0; i < before.length; i++) {
    if (before[i] !== "c" && after[i] === "c") gained++;
    if (before[i] === "c" && after[i] !== "c") lost++;
  }
  return {cowboyWinsGained: gained, cowboyWinsLost: lost};
}

console.log(JSON.stringify({commit: baseline.commit, seeds: baseline.seeds, seats: baseline.seatOrder,
  games: contested.outcomes.length, outcomesSha256: sha256(contested.outcomes),
  cowboyWins: [...contested.outcomes].filter(code => code === "c").length,
  drawn: {[office]: contested.perCard[office].drawn, [boneyard]: contested.perCard[boneyard].drawn},
  addOfficeAgainstDefault: compare(baseline.outcomes, officeOnly.outcomes),
  addOfficeAgainstBoneyard: compare(boneyardOnly.outcomes, contested.outcomes)}, null, 2));
