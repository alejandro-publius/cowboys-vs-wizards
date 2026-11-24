// Replay the recorded proposal without modifying a checkout. --full also verifies every paired outcome.
// Engine setup (pinned snapshot, candidate build, bot play) is shared with the seat audit in billy-replay-engine.mjs.
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {mkdtempSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {engines, play, record} from "./billy-replay-engine.mjs";

function trace(engine) {
  const events = [];
  const result = play(engine, record.seed, record.first, (before, applied) => {
    for (const event of applied.events) {
      const row = {turn: before.turn, event};
      if (event.type === "attack" && event.target !== "base") {
        const attacker = before.sides[event.side].board.find(troop => troop?.cardId === event.cardId);
        const defender = before.sides[engine.opponent(event.side)].board.find(troop => troop?.cardId === event.target);
        row.attack = engine.attackOf(before, attacker);
        row.targetOrbsBefore = defender.health;
      }
      events.push(row);
    }
  });
  return {events, result};
}

function verifyTurn(pair) {
  const traces = pair.map(trace);
  const [before, after] = traces.map(t => t.events);
  const firstChange = before.findIndex((row, i) => !after[i] || row.turn !== after[i].turn || JSON.stringify(row.event) !== JSON.stringify(after[i].event));
  assert.equal(firstChange, record.matchedEvents, "First changed event");
  for (const [i, expected] of [record.baseline, record.candidate].entries()) {
    const {turn, event, attack, targetOrbsBefore} = traces[i].events[firstChange];
    assert.deepEqual([turn, event.type, event.cardId, event.target, targetOrbsBefore, attack, event.targetLeft],
      [record.turn, "attack", record.attackerId, record.targetId, record.targetOrbsBefore, expected.attack, expected.targetOrbsAfter], "First changed attack");
    assert.deepEqual(traces[i].result, {winner: expected.winner, endTurn: expected.endTurn}, "Recorded finish");
  }
  console.log(`Verified seed ${record.seed}, ${record.matchedEvents} matching events, turn ${record.turn} and both endings.`);
}

function verifyCohort(pair) {
  const k = record.cohort;
  const totals = {gamesPerArm: 0, baselineCowboyWins: 0, candidateCowboyWins: 0, baselineFirstWins: 0, candidateFirstWins: 0, switchedCowboyToWizard: 0, switchedWizardToCowboy: 0};
  const hash = createHash("sha256").update("seed,first,baseline_winner,candidate_winner,baseline_turn,candidate_turn\n");
  for (let seed = k.firstSeed; seed < k.firstSeed + k.deals; seed++) {
    for (const first of ["cowboy", "wizard"]) {
      const [b, c] = pair.map(engine => play(engine, seed, first));
      totals.gamesPerArm++;
      totals.baselineCowboyWins += Number(b.winner === "cowboy");
      totals.candidateCowboyWins += Number(c.winner === "cowboy");
      totals.baselineFirstWins += Number(b.winner === first);
      totals.candidateFirstWins += Number(c.winner === first);
      totals.switchedCowboyToWizard += Number(b.winner === "cowboy" && c.winner === "wizard");
      totals.switchedWizardToCowboy += Number(b.winner === "wizard" && c.winner === "cowboy");
      hash.update([seed, first, b.winner, c.winner, b.endTurn, c.endTurn].join(",") + "\n");
    }
  }
  for (const [key, value] of Object.entries(totals)) assert.equal(value, k[key], key);
  assert.equal(hash.digest("hex"), k.csvSha256, "SHA-256 of every paired outcome");
  console.log(`Verified ${2 * totals.gamesPerArm} games. Cowboy wins ${totals.baselineCowboyWins} -> ${totals.candidateCowboyWins} of ${totals.gamesPerArm}; CSV SHA-256 ${k.csvSha256}.`);
}

const args = process.argv.slice(2);
if (args.length && !(args.length === 1 && args[0] === "--full")) {
  console.error("Usage: node scripts/verify-billy-replay.mjs [--full]");
  process.exitCode = 2;
} else {
  const scratch = mkdtempSync(join(tmpdir(), "showdown-billy-"));
  try {
    const pair = await engines(scratch);
    verifyTurn(pair);
    if (args.length) verifyCohort(pair);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    rmSync(scratch, {recursive: true, force: true});
  }
}
