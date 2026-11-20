import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {applyAction, createShowdown, legalActions} from "../../../src/game/showdown/rules.js";
import {viewFor} from "../../../src/game/showdown/contract.js";
import {boneFence, findBranch, openAt, policy} from "./decision.js";

const read = (name) => JSON.parse(readFileSync(new URL(name, import.meta.url), "utf8"));

test("policy reads only the public view: hidden Wizard zones and the seed do not move it", () => {
  const duel = boneFence();
  for (let seed = 1000; seed < 1020; seed++) {
    let state = createShowdown(seed, duel.options);
    for (let n = 0; n < 40 && !state.result; n++) {
      const legal = legalActions(state);
      if (state.active === "cowboy") {
        const choice = policy(viewFor(state, "cowboy"), legal);
        const other = structuredClone(state);
        other.seed = -1;
        other.sides.wizard.hand = other.sides.wizard.hand.map(() => "wizard-skeleton-1");
        other.sides.wizard.deck.reverse();
        other.sides.cowboy.deck.reverse();
        assert.deepEqual(policy(viewFor(other, "cowboy"), legalActions(other)), choice);
        state = applyAction(state, choice).state;
      } else state = applyAction(state, legal.find((a) => a.type === "end") ?? legal[0]).state;
    }
  }
});

test("both arms open from the same fresh-session position", () => {
  const {branch} = findBranch(1002);
  const [a, b] = [openAt(1002, branch), openAt(1002, branch)];
  assert.deepEqual(a.view(), b.view());
  assert.deepEqual(a.view(), branch.view);
  for (const arm of ["ride", "fight"]) assert.ok(a.legal().some((x) => JSON.stringify(x) === JSON.stringify(branch.choices[arm])));
});

test("positions.json carries no seed, outcome or hidden Wizard zone", () => {
  const text = JSON.stringify(read("positions.json"));
  for (const word of ["\"seed\"", "\"winner\"", "\"kind\"", "\"prefix\""]) assert.ok(!text.includes(word), word);
  for (const {view} of read("positions.json")) for (const key of ["hand", "deck", "traps"]) assert.ok(!(key in view.sides.wizard));
});

test("checker reproduces every committed case", () => {
  execFileSync(process.execPath, [new URL("check.mjs", import.meta.url).pathname], {stdio: "pipe"});
});
