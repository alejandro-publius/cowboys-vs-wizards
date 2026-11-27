import assert from "node:assert/strict";
import test from "node:test";
import {compactSelectionPrompt} from "../../src/ui/showdown-3d/table-ui.js";

const cover = "cover: until your next turn it keeps extra damage off your Base, but it will not hit back.";
const trap = "A face-down trap springs before damage.";

test("a Guard with a face-down trap still offers both the legal attack and cover", () => {
  const full = `A Guard stands in the way: attack it first. ${trap} Or take ${cover}`;
  const cue = compactSelectionPrompt(full);
  assert.match(cue, /Guard/);
  assert.match(cue, /trap before damage/i);
  assert.match(cue, /take cover/i);
  assert.ok(cue.split(/[\s·]+/).length <= 10, cue);
});

test("the Even Fight cover-only cue includes its spell protection", () => {
  const full = `This troop cannot attack now. Take ${cover} Spells cannot hit a troop in cover.`;
  const cue = compactSelectionPrompt(full, true);
  assert.match(cue, /cannot attack/i);
  assert.match(cue, /take cover/i);
  assert.match(cue, /avoids spells/);
  assert.doesNotMatch(cue, /trap/i);
  assert.ok(cue.length < full.length);
});

test("card prompts keep the card name, legal side, and tribute count", () => {
  const spell = "Choose an enemy troop for Lasso.";
  assert.equal(compactSelectionPrompt(spell), "Lasso · Pick an enemy troop");
  assert.equal(compactSelectionPrompt(spell, true), "Lasso · Pick an uncovered enemy troop");
  assert.equal(compactSelectionPrompt("Choose one of your troops to carry Six-Shooter."), "Six-Shooter · Pick your troop");
  assert.equal(compactSelectionPrompt("Choose 2 of your troops to send to the graveyard as payment for Dragon."),
    "Dragon · Pay with 2 of your troops");
});

test("Raise distinguishes the troop paid from a different Undead returning", () => {
  const full = "Choose a tribute for Wizard. Pay Imp: Bone Wall returns with 1 orb. Pay Skeleton: Skeleton returns with 1 orb.";
  const cue = compactSelectionPrompt(full);
  assert.match(cue, /Imp → Bone Wall \(1 orb\)/);
  assert.match(cue, /Skeleton → Skeleton \(1 orb\)/);
  assert.match(compactSelectionPrompt("Choose a tribute for Wizard. The Wizard fills your last slot, so nothing returns."),
    /(?:full|last slot).*?(?:no|nothing)/i);
});

test("the illustrated aiming prompt clears between choices", () => {
  for (const idle of ["", "Play your cards: one troop a turn. Nobody attacks on the opening turn.",
    "No more cards this turn. Act with your other troops, or end the turn."]) {
    assert.equal(compactSelectionPrompt(idle), "");
  }
});
