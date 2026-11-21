// Compares two checkouts of the Showdown engine and presenter on the same seeded corpus.
//   node scripts/showdown-trap-corpus.mjs <parent-root> <new-root> [--seeds 80]
// Each seed is played to its result (at most 200 turns) by the level-2 bot on both sides
// (playTurn applies every step through applyAction, which rejects illegal actions).
// Raw states and events must be identical between the roots. Displayed lines must be
// byte-identical except fatal trap lines (trap events with left === 0). Exits 1 otherwise.
import {createHash} from "node:crypto";
import {isDeepStrictEqual} from "node:util";
import {pathToFileURL} from "node:url";
import {resolve} from "node:path";

const args = process.argv.slice(2);
const seedsAt = args.indexOf("--seeds");
const seeds = seedsAt >= 0 ? Number(args.splice(seedsAt, 2)[1]) : 80;
if (args.length !== 2 || !Number.isInteger(seeds) || seeds < 1) {
  console.error("usage: node scripts/showdown-trap-corpus.mjs <parent-root> <new-root> [--seeds 80]");
  process.exit(2);
}

async function load(root) {
  const at = (file) => pathToFileURL(resolve(root, "src/game/showdown", file)).href;
  return {...await import(at("rules.js")), ...await import(at("presenter.js"))};
}

function play({createShowdown, playTurn, presentEvent}, seed) {
  const turns = [];
  let state = createShowdown(seed);
  for (let n = 0; !state.result && n < 200; n++) {
    const played = playTurn(state, 2);
    state = played.state;
    turns.push({state: played.state, events: played.events, lines: played.events.map((event) => presentEvent(event))});
  }
  return {turns, result: state.result};
}

const [parent, next] = await Promise.all(args.map(load));
const hash = {parentRaw: createHash("sha256"), newRaw: createHash("sha256"), parentLines: createHash("sha256"), newLines: createHash("sha256")};
const totals = {seeds, turns: 0, events: 0, lines: 0, traps: 0, fatalTraps: 0, changedLines: 0, unresolved: 0};
const failures = [];
const changed = [];

for (let seed = 0; seed < seeds; seed++) {
  const a = play(parent, seed);
  const b = play(next, seed);
  hash.parentRaw.update(JSON.stringify(a.turns.map(({state, events}) => ({state, events}))));
  hash.newRaw.update(JSON.stringify(b.turns.map(({state, events}) => ({state, events}))));
  hash.parentLines.update(a.turns.flatMap((t) => t.lines).join("\n") + "\n");
  hash.newLines.update(b.turns.flatMap((t) => t.lines).join("\n") + "\n");
  if (!a.result) totals.unresolved++;
  if (a.turns.length !== b.turns.length || !isDeepStrictEqual(a.result, b.result)) { failures.push(`seed ${seed}: different game length or result`); continue; }
  a.turns.forEach((turn, t) => {
    const other = b.turns[t];
    if (!isDeepStrictEqual(turn.state, other.state) || !isDeepStrictEqual(turn.events, other.events)) failures.push(`seed ${seed} turn ${t}: raw state or events differ`);
    totals.turns++;
    turn.events.forEach((event, i) => {
      totals.events++;
      totals.lines++;
      const fatal = event.type === "trap" && event.left === 0;
      if (event.type === "trap") totals.traps++;
      if (fatal) totals.fatalTraps++;
      if (turn.lines[i] === other.lines[i]) return;
      totals.changedLines++;
      if (!fatal) failures.push(`seed ${seed} turn ${t} event ${i}: non-fatal line changed`);
      else changed.push({seed, event, parent: turn.lines[i], new: other.lines[i]});
    });
  });
}

const digests = Object.fromEntries(Object.entries(hash).map(([key, h]) => [key, h.digest("hex")]));
console.log(JSON.stringify({totals, digests, changed}, null, 2));
if (totals.changedLines !== totals.fatalTraps) failures.push(`${totals.fatalTraps} fatal trap lines but ${totals.changedLines} changed lines`);
if (!totals.fatalTraps) failures.push("no fatal trap in the corpus");
for (const line of failures) console.error(`FAIL ${line}`);
console.log(failures.length ? `FAIL (${failures.length})` : "PASS");
process.exit(failures.length ? 1 : 0);
