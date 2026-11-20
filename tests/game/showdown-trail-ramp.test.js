// Issue 143 slice 2: the Trail ramp check runs in npm test against the canonical modules.
// The full ramp (every Trail duel, rival and hunt, 80 deals) is the unchanged test in
// prototypes/showdown/progress.test.js, which scripts/verify-duel.mjs already discovers. This file
// proves that test reaches src/game/showdown through the prototype paths, and checks the first-hour
// cushion (Trail 1 and 2) on its own so a slice 2 regression is named here.
import test from "node:test";
import assert from "node:assert/strict";
import * as progress from "../../src/game/showdown/progress.js";
import * as trail from "../../src/game/showdown/trail.js";
import * as playtest from "../../src/game/showdown/playtest.js";
import * as oldProgress from "../../prototypes/showdown/progress.js";
import * as oldTrail from "../../prototypes/showdown/trail.js";
import * as oldPlaytest from "../../prototypes/showdown/playtest.js";
import {LADDER, winRate} from "../../prototypes/showdown/trail-sim.mjs";

test("the prototype paths export exactly the canonical modules", () => {
  for (const [canonical, old] of [[progress, oldProgress], [trail, oldTrail], [playtest, oldPlaytest]]) {
    assert.deepEqual(Object.keys(old).sort(), Object.keys(canonical).sort());
    for (const name of Object.keys(canonical)) assert.equal(old[name], canonical[name], name);
  }
});

test("the ramp's cushion: any legal play wins Trail 1 and 2 on 80 deals", () => {
  for (const label of ["Trail 1", "Trail 2"]) {
    const [, save, id] = LADDER.find(([each]) => each.startsWith(label));
    assert.equal(save.wins, Number(label.at(-1)) - 1);
    assert.ok(winRate(save, id, 0, 80) >= .95, `${label} is not a sure win for careless play`);
  }
});
