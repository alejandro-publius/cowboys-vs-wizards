import assert from "node:assert/strict";
import {mkdtemp, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "esbuild";
import {BOT_LEVEL, loadEngines, play, prepareEngines, record} from "./billy-replay-engine.mjs";

// Capture the legal position immediately before the shot, using the same two
// compiled rule sets as the seat audit. The browser plays forward from here.
function position(engine, line) {
  let shot;
  const finish = play(engine, record.seed, record.first, (before, {events}) => {
    if (before.turn !== record.turn) return;
    const hit = events.find(event => event.type === "attack" && event.cardId === record.attackerId && event.target === record.targetId);
    if (!hit) return;
    assert.equal(shot, undefined, "Billy takes the recorded shot once");
    const own = before.sides[before.active], enemy = before.sides[engine.opponent(before.active)];
    const slot = own.board.findIndex(troop => troop?.cardId === record.attackerId);
    const target = enemy.board.findIndex(troop => troop?.cardId === record.targetId);
    assert.equal(engine.attackOf(before, own.board[slot]), line.attack);
    assert.equal(enemy.board[target].health, record.targetOrbsBefore);
    assert.equal(hit.targetLeft, line.targetOrbsAfter);
    shot = {state: before, action: {type: "attack", slot, target}};
  });
  assert.ok(shot, "The source deal must reach Billy and Bone Wall");
  assert.deepEqual(finish, {winner: line.winner, endTurn: line.endTurn});
  return shot;
}

export async function buildSaloonTable(options) {
  const scratch = await mkdtemp(join(tmpdir(), "showdown-saloon-"));
  try {
    let urls;
    try {
      urls = prepareEngines(scratch);
    } catch (error) {
      // An exported source tree without the historical inputs can still play the normal game.
      if (!error.message.startsWith("Cannot read pinned game inputs.")) throw error;
      console.warn("Saloon duel table unavailable: the pinned Billy rules could not be verified.");
      return await build(options);
    }
    const [printed, proposed] = await loadEngines(urls);
    const shot = position(printed, record.baseline);
    assert.deepEqual(position(proposed, record.candidate), shot, "Both rules must start at the identical table");
    const binding = join(scratch, "table.mjs");
    const [basePath, candidatePath] = urls.map(url => JSON.stringify(fileURLToPath(url)));
    await writeFile(binding, [
      `import {applyAction as baseShot, playTurn as baseTurn} from ${basePath};`,
      `import {applyAction as proposedShot, playTurn as proposedTurn, legalActions} from ${candidatePath};`,
      `export const __CVW_BILLY_TABLE__ = {shot:${JSON.stringify(shot)}, botLevel:${BOT_LEVEL},`,
      "baseline:{applyAction:baseShot,playTurn:baseTurn},candidate:{applyAction:proposedShot,playTurn:proposedTurn,legalActions}};",
    ].join("\n"));
    return await build({...options, inject: [binding]});
  } finally {
    await rm(scratch, {recursive: true, force: true});
  }
}
