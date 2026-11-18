// Mounted Billy: keep, simplify or cut? Results are in docs/evidence/fable-mounted-billy.md.
//   node scripts/mounted-billy-lab.mjs [--from 32000 --count 1024]   matched-seed report (JSON)
//   node scripts/mounted-billy-lab.mjs --board 823 [--cpu normal] [--lane 2]   four endings of one board
//   node scripts/mounted-billy-lab.mjs --build   playable pages in dist/mounted-billy/
// The alternative is one number: Mounted Billy's attack 3 -> 4. It exists only in a
// patched copy of src/ under .artifacts/mounted-billy/, so the shipped card is unchanged.
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {cpSync, mkdirSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {parseArgs} from "node:util";
import {DEADEYE_CONTROL} from "../src/game/deck-presets.js";

const root = new URL("../", import.meta.url);
const altRoot = new URL(".artifacts/mounted-billy/attack-4/", root);
const MB = "cowboy-mounted-billy-1";
const STAT = '"name":"Mounted Billy","kind":"troop","stars":7,"health":5,"attack":';

rmSync(altRoot, {recursive: true, force: true});
cpSync(new URL("src/", root), new URL("src/", altRoot), {recursive: true});
cpSync(new URL("scripts/build-graybox.mjs", root), new URL("scripts/build-graybox.mjs", altRoot));
const specs = new URL("src/game/card-specs.generated.js", altRoot);
const stock = readFileSync(specs, "utf8");
assert.equal(stock.split(`${STAT}3`).length, 2, "expected one Mounted Billy spec with attack 3");
writeFileSync(specs, stock.replace(`${STAT}3`, `${STAT}4`));

async function load(base) {
  const game = {};
  for (const name of ["cards", "cpu", "state", "actions", "legal", "view", "deck-builder", "opening-policy"]) {
    Object.assign(game, await import(new URL(`src/game/${name}.js`, base)));
  }
  return game;
}
const rules = {current: await load(root), "attack-4": await load(altRoot)};
// A copied tree that still resolved to the shipped card would make every comparison a silent no-op.
for (const [id, card] of Object.entries(rules.current.CARDS)) {
  assert.deepEqual(rules["attack-4"].CARDS[id], card.name === "Mounted Billy" ? {...card, attack: 4} : card);
}

// The Cowboy's view without Mounted Billy in hand; the Wizard's view is returned as is.
const hideBilly = (view) => view.viewer !== "cowboy" ? view :
  {...view, sides: {...view.sides, cowboy: {...view.sides.cowboy, hand: view.sides.cowboy.hand.filter((id) => id !== MB)}}};
const points = (state) => (state.result.winner === "cowboy" ? 1 : state.result.winner === null ? 0.5 : 0);
const commitsAt = (game, state) => state.activeSide !== "cowboy" ? [] :
  game.legalActions(game.publicState(state, "cowboy"), "cowboy").filter((action) => action.type === "summon" && action.cardId === MB);

function step(game, state, action, log) {
  const applied = game.applyAction(state, action);
  assert.ok(applied.ok, applied.reason);
  log?.(state, action, applied);
  return applied.state;
}
// Bots finish the match. `never` keeps Mounted Billy in the Cowboy's hand for good.
function finish(game, state, choose, {never = false, log} = {}) {
  for (let steps = 0; !state.result; steps++) {
    assert.ok(steps < 80, "match did not finish");
    const view = game.publicState(state, state.activeSide);
    state = step(game, state, choose(never ? hideBilly(view) : view), log);
  }
  return state;
}

// One arm: a deck under one rule set, every seed with each side acting first.
// `fork` also splits each match at the first moment Mounted Billy can be summoned:
// commit now (each legal lane) against the bot's best other play this turn.
function arm(game, cpu, counts, {from, count, never = false, fork = false}) {
  const choose = game.cpuFor(cpu);
  const cowboyDeck = game.deckIds(counts);
  const row = {matches: 0, points: 0, firstSeat: 0, secondSeat: 0, billyMatches: 0, perSeed: []};
  const split = {boards: 0, botCommits: 0, commitBetter: 0, same: 0, keepBetter: 0, keep: 0, bestLane: 0, averageLane: 0};
  for (let seed = from; seed < from + count; seed++) {
    let seedPoints = 0;
    for (const seat of ["cowboy", "wizard"]) {
      let state = game.openingMatch(seed, "shipped", seat, {cowboyDeck});
      let forked = !fork;
      let summoned = false;
      for (let steps = 0; !state.result; steps++) {
        assert.ok(steps < 80, "match did not finish");
        const view = game.publicState(state, state.activeSide);
        const action = choose(never ? hideBilly(view) : view);
        const commits = forked ? [] : commitsAt(game, state);
        if (commits.length) {
          forked = true;
          const keep = points(finish(game, step(game, state, choose(hideBilly(view))), choose));
          const lanes = commits.map((commit) => points(finish(game, step(game, state, commit), choose)));
          const best = Math.max(...lanes);
          split.boards++;
          split.keep += keep;
          split.bestLane += best;
          split.averageLane += lanes.reduce((sum, value) => sum + value, 0) / lanes.length;
          split[best > keep ? "commitBetter" : best < keep ? "keepBetter" : "same"]++;
          if (action.cardId === MB) split.botCommits++;
        }
        summoned ||= action.cardId === MB;
        state = step(game, state, action);
      }
      const result = points(state);
      row.matches++;
      row.points += result;
      row[seat === "cowboy" ? "firstSeat" : "secondSeat"] += result;
      if (summoned) row.billyMatches++;
      seedPoints += result / 2;
    }
    row.perSeed.push(seedPoints);
  }
  return fork ? {...row, split} : row;
}

function report({from, count}) {
  const starter = rules.current.DEFAULT_COUNTS;
  const arms = [
    ["starter", "current", starter, {fork: true}],
    ["starter, Mounted Billy never summoned", "current", starter, {never: true}],
    ["starter, Billy in place of Mounted Billy", "current", {...starter, "cowboy-billy": 4, "cowboy-mounted-billy": 0}, {}],
    [DEADEYE_CONTROL.name, "current", DEADEYE_CONTROL.counts, {}],
    ["starter, Mounted Billy attack 4", "attack-4", starter, {fork: true}],
  ];
  const pct = (value) => Number((100 * value).toFixed(2));
  const rows = [];
  for (const cpu of ["normal", "hard"]) {
    let base;
    for (const [name, ruleSet, counts, options] of arms) {
      const {perSeed, split, ...row} = arm(rules[ruleSet], cpu, counts, {from, count, ...options});
      base ??= perSeed;
      const changes = perSeed.map((value, index) => value - base[index]);
      const mean = changes.reduce((sum, value) => sum + value, 0) / count;
      const se = Math.sqrt(changes.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (count - 1) / count);
      rows.push({
        cpu, deck: name, rules: ruleSet, matches: row.matches,
        cowboyWinShare: pct(row.points / row.matches),
        actingFirst: pct(row.firstSeat / count), actingSecond: pct(row.secondSeat / count),
        changeFromStarter: perSeed === base ? null : {points: pct(mean), ci95: [pct(mean - 1.96 * se), pct(mean + 1.96 * se)]},
        matchesWithMountedBilly: row.billyMatches,
        ...(split && {firstChance: {
          boards: split.boards, botCommits: split.botCommits,
          commitBetter: split.commitBetter, same: split.same, keepBetter: split.keepBetter,
          keepShare: pct(split.keep / split.boards), bestLaneShare: pct(split.bestLane / split.boards),
          averageLaneShare: pct(split.averageLane / split.boards),
        }}),
      });
    }
  }
  // A win counts 1 and a draw 0.5 toward a share.
  console.log(JSON.stringify({seeds: {from, count}, seats: "each side acts first once per seed", rows}, null, 2));
}

// The natural seed (as the graybox deals it with ?deck=starter) played by the bots up to the
// first moment Mounted Billy can be summoned, then four endings: commit in `lane` or keep him
// in hand for the rest of the match, under each rule set. Lanes are printed 1 to 3.
function board(seed, cpu, lane) {
  const lines = [];
  let shared;
  for (const [ruleSet, game] of Object.entries(rules)) {
    const choose = game.cpuFor(cpu);
    const name = (id) => game.CARDS[id].name;
    const side = (state, who) => `${who} Base ${state.sides[who].baseOrbs} [${state.sides[who].board.map((troop) => (troop ? `${name(troop.cardId)} ${troop.health}` : "-")).join(" | ")}]`;
    const log = (before, action, applied) => {
      const text = action.type === "summon"
        ? `summon ${name(action.cardId)} in lane ${action.slot + 1}${action.tributes.length ? `, tribute lanes ${action.tributes.map((slot) => slot + 1).join(" and ")}` : ""}`
        : action.type === "spell"
          ? `cast ${name(action.cardId)} on lane ${action.target + 1}${action.destination == null ? "" : `, move to lane ${action.destination + 1}`}`
          : "end turn";
      lines.push(`  R${before.round} ${before.activeSide.padEnd(6)} ${text}`);
      if (applied.events.some((event) => event.type === "clash")) lines.push(`     after clash ${before.round}: ${side(applied.state, "cowboy")}   ${side(applied.state, "wizard")}`);
    };
    lines.push(`\n== ${ruleSet}: opening, Wizard CPU ${cpu}`);
    let state = game.createMatch(seed);
    while (!state.result && commitsAt(game, state).length === 0) {
      state = step(game, state, choose(hideBilly(game.publicState(state, state.activeSide))), log);
    }
    assert.ok(!state.result, `seed ${seed}: Mounted Billy never becomes summonable`);
    shared ??= JSON.stringify(state);
    assert.equal(JSON.stringify(state), shared, "both rule sets must reach the same board");
    lines.push(`  BOARD round ${state.round}: ${side(state, "cowboy")}   ${side(state, "wizard")}   hand: ${state.sides.cowboy.hand.map(name).join(", ")}`);
    const commit = commitsAt(game, state).find((action) => action.slot === lane - 1);
    assert.ok(commit, `seed ${seed}: Mounted Billy cannot enter lane ${lane}`);
    for (const [choice, start, never] of [["commit", step(game, state, commit, (...args) => (lines.push(`\n== ${ruleSet}: commit`), log(...args))), false], ["keep", state, true]]) {
      if (never) lines.push(`\n== ${ruleSet}: keep`);
      const {result} = finish(game, start, choose, {never, log});
      lines.push(`  RESULT ${ruleSet} / ${choice}: ${result.winner ? `${result.winner} wins` : "draw"} (${result.reason}) in round ${result.round}`);
    }
  }
  console.log(lines.join("\n").trim());
}

function buildPages() {
  const out = new URL("dist/mounted-billy/", root);
  mkdirSync(out, {recursive: true});
  for (const [name, base, label] of [["current", root, "Mounted Billy attack 3 (current)"], ["attack-4", altRoot, "Mounted Billy attack 4 (experiment)"]]) {
    execFileSync(process.execPath, [new URL("scripts/build-graybox.mjs", base).pathname], {stdio: "ignore"});
    const html = readFileSync(new URL("dist/cowboys-vs-wizards-board-duel.html", base), "utf8");
    assert.ok(html.includes("<title>Cowboys vs. Wizards | Graybox</title>"), "graybox title changed");
    writeFileSync(new URL(`${name}.html`, out), html.replace("| Graybox</title>", `| ${label}</title>`));
    console.log(`Built dist/mounted-billy/${name}.html  (${label})`);
  }
}

const {values} = parseArgs({options: {
  from: {type: "string", default: "32000"}, count: {type: "string", default: "1024"},
  board: {type: "string"}, cpu: {type: "string", default: "normal"}, lane: {type: "string", default: "2"},
  build: {type: "boolean", default: false},
}});
if (values.build) buildPages();
else if (values.board) board(Number(values.board), values.cpu, Number(values.lane));
else report({from: Number(values.from), count: Number(values.count)});
