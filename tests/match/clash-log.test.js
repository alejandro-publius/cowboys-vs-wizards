// Clash log sentences (src/match/clash-log.js), built from the real seed 60
// CPU-against-CPU match: Singularity moves Mounted Billy in round 4, and he
// meets the Dragon in round 5.
import test from "node:test";
import assert from "node:assert/strict";
import { CARDS } from "../../src/game/cards.js";
import { chooseAction } from "../../src/game/cpu.js";
import { clashLog } from "../../src/match/clash-log.js";
import { playMatch } from "../../scripts/play-match.mjs";

// One list of events per round: everything up to and including that round's clash events.
const { log } = playMatch(60, { cowboy: chooseAction, wizard: chooseAction });
const rounds = {};
for (const { round, events } of log) (rounds[round] ??= []).push(...events.filter((event) => event.type !== "round-start" && event.type !== "draw"));

test("clash log: nothing to show until the round's events include a clash", () => {
  assert.equal(clashLog([]), null);
  assert.equal(clashLog(rounds[5].filter((event) => event.type !== "clash")), null);
});

test("clash log: seed 60 round 5 gives both lines of the simultaneous Mounted Billy and Dragon clash", () => {
  assert.deepEqual(clashLog(rounds[5]), {
    title: "Round 5 clash",
    lines: [
      "Your Sheriff in lane 1 hit the Wizard Base: 3 → 2 orbs", // troop hits Base
      "Your Mounted Billy in lane 2 hit the Dragon: 5 → 2 orbs", // troop hits troop
      "Dragon in lane 2 hit your Mounted Billy: 3 → 0 orbs", // and is hit back in the same clash
      "Your Mounted Billy in lane 2 was defeated", // a troop defeated
    ],
  });
});

test("clash log: a spell is described from its own event, including a move and a defeat", () => {
  assert.deepEqual(clashLog(rounds[4]).lines.slice(0, 2), [
    "Singularity hit your Mounted Billy in lane 3: 5 → 4 orbs, then moved it to lane 2",
    "Skeleton in lane 1 hit your Base: 4 → 3 orbs",
  ]);
  assert.deepEqual(clashLog(rounds[9]).lines.slice(0, 2), [
    "Your Deadeye hit the Skeleton in lane 2: 1 → 0 orbs",
    "Skeleton in lane 2 was defeated",
  ]);
});

test("clash log: every number is the event's own, and no unplayed Wizard card is named", () => {
  const wizardNames = [...new Set(Object.values(CARDS).filter((card) => card.side === "wizard").map((card) => card.name))];
  const played = new Set();
  for (const [round, events] of Object.entries(rounds)) {
    for (const event of events) if (event.type === "summon" || event.type === "spell") played.add(CARDS[event.cardId].name);
    const { lines } = clashLog(events);
    const described = events.filter((event) => ["damage", "spell", "defeat"].includes(event.type));
    assert.equal(lines.length, described.length, `round ${round}: one line per described event`);
    described.forEach((event, at) => {
      if (event.type !== "defeat") assert.match(lines[at], new RegExp(`: ${event.before} → ${event.after} orbs?`), `round ${round}`);
    });
    for (const name of wizardNames) {
      if (!played.has(name)) assert.ok(!lines.some((line) => line.replace("the Wizard Base", "").includes(name)), `round ${round} names ${name} before it was played`);
    }
  }
});
