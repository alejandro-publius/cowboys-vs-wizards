import assert from "node:assert/strict";
import test from "node:test";
import { TYPES } from "../../src/game/showdown/cards.js";
import { attackExample, attackPreviews } from "../../src/ui/showdown-3d/attack-preview.js";
import { presentationBeats } from "../../src/ui/showdown-3d/event-positions.js";
import { replayCards } from "../../src/ui/showdown-3d/replay-cards.js";

const replay = (id, mode) => replayCards(id, attackExample(id, mode));

test("every gallery action keeps its portraits and final outcome across the contact snapshots", () => {
  for (const id of Object.keys(TYPES)) {
    for (const [mode] of attackPreviews(id)) {
      const example = attackExample(id, mode);
      const { pieces, outcome } = replayCards(id, example);
      assert.ok(pieces.length >= 2 && pieces.length <= 4, id);
      assert.ok(pieces.every((p) => (p.id === null || TYPES[p.id]) && p.name && p.before && p.after), id);
      assert.ok(outcome, id);
      const initial = pieces.map((p) => ({ ...p, after: p.before }));
      assert.deepEqual(replayCards(id, example, example.before).pieces, initial);
      for (const { hit } of presentationBeats(example.trace)) {
        const frame = replayCards(id, example, hit);
        assert.deepEqual(frame.pieces.map((p) => ({ ...p, after: p.before })), initial);
        assert.equal(frame.outcome, outcome);
      }
    }
  }
});

test("defeat, Ride, Guard and Last Stand show the actual participants and orb counts", () => {
  const mounted = "cowboy-mounted-billy";
  assert.equal(replay(mounted, "attack").outcome, "Skeleton defeated");
  const ride = replay(mounted, "ride");
  assert.deepEqual(ride.pieces[1], { id: null, name: "Wizard Base", before: "5 orbs", after: "4 orbs" });
  assert.equal(ride.outcome, "Wizard Base 5 → 4");
  const guard = replay("wizard-bone-wall", "guard");
  assert.deepEqual(guard.pieces.map((p) => p.name), ["Sheriff", "Bone Wall"]);
  assert.equal(guard.outcome, "Guard · Bone Wall 4 → 3");
  assert.doesNotMatch(replay("cowboy-covered-wagon", "attack").outcome, /Guard/);

  const id = "wizard-jack-o-lantern";
  const example = attackExample(id, "laststand");
  const [strike, retaliation] = presentationBeats(example.trace);
  assert.deepEqual(replayCards(id, example, strike.hit).pieces.map((p) => p.after), ["3 orbs", "Defeated"]);
  const { pieces, outcome } = replayCards(id, example, retaliation.hit);
  assert.deepEqual(pieces.map((p) => p.after), ["2 orbs", "Defeated"]);
  assert.equal(outcome, "Last Stand · Jack-o'-Lantern defeated · Sheriff 3 → 2");
});

test("Sweep distinguishes identical troops and includes Base damage and secondary defeats", () => {
  const captured = replay("cowboy-captured-dragon", "attack");
  assert.deepEqual(captured.pieces.slice(1).map((p) => [p.name, p.after]), [
    ["Skeleton (slot 1)", "Defeated"], ["Skeleton (slot 2)", "2 orbs"], ["Headless Horseman", "2 orbs"],
  ]);
  assert.match(captured.outcome, /Wizard Base 5 → 4/);
  assert.equal(replay("wizard-dragon", "attack").outcome, "Sheriff defeated · Billy 4 → 3 · Dynamiter defeated");
});

test("spells show the casting card, a stun and each target in an area cast", () => {
  const lasso = replay("cowboy-lasso", "cast");
  assert.deepEqual(lasso.pieces.map((p) => [p.name, p.after]), [
    ["Lasso", "Cast by Sheriff"], ["Wizard", "4 orbs · Stunned"],
  ]);
  const fire = replay("wizard-hellfire", "cast");
  assert.deepEqual(fire.pieces.map((p) => p.after), ["Cast", "2 orbs", "4 orbs", "3 orbs"]);
  const area = replay("wizard-singularity", "sheriffs");
  assert.deepEqual(area.pieces.map((p) => p.after), ["Cast by Wizard", "2 orbs", "2 orbs", "2 orbs"]);
  assert.equal(area.outcome, "Each Sheriff loses one orb.");
});
