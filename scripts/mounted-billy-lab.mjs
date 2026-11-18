// Mounted Billy: keep, simplify or cut? Results are in docs/evidence/fable-mounted-billy.md.
//   node scripts/mounted-billy-lab.mjs [--from 32000 --count 1024]   matched-seed report (JSON)
//   node scripts/mounted-billy-lab.mjs --board 823 [--cpu normal] [--lane 2]   four endings of one board
//   node scripts/mounted-billy-lab.mjs --scan --from 0 --count 2000   boards where the choice goes each way
//   node scripts/mounted-billy-lab.mjs --build   dist/mounted-billy/index.html and attack-{3,4}.html
// The alternative is one number: Mounted Billy's attack 3 -> 4. It exists only in patched
// copies of src/ under .artifacts/mounted-billy/, so the shipped card and page are unchanged.
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {cpSync, mkdirSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {parseArgs} from "node:util";
import {DEADEYE_CONTROL} from "../src/game/deck-presets.js";
import {commitsAt, decisionBoard, hideBilly, isBilly} from "./mounted-billy-decision.js";

const root = new URL("../", import.meta.url);
const STAT = '"name":"Mounted Billy","kind":"troop","stars":7,"health":5,"attack":';
// Playtest boards, each a seed's first Mounted Billy decision. The first is the pages' default.
// docs/evidence/fable-mounted-billy.md says how --scan led to each one.
const BOARDS = [823, 254, 167];
const boardQuery = (seed) => `?mode=match&deck=starter&seed=${seed}`;

// Every edit must hit exactly one place, so a changed source stops the lab.
function patch(base, file, edits) {
  const target = new URL(file, base);
  let text = readFileSync(target, "utf8");
  for (const [from, to] of edits) {
    assert.equal(text.split(from).length, 2, `${file}: expected exactly one "${from}"`);
    text = text.replace(from, () => to);
  }
  writeFileSync(target, text);
}

// A copy of src/ where Mounted Billy has `attack` and the graybox page deals BOARDS[0]
// (unless the address names another deal), lets the bots play the opening and hands over at
// the first turn he can be summoned. Guided lessons keep their normal start.
function writeTree(attack) {
  const base = new URL(`.artifacts/mounted-billy/attack-${attack}/`, root);
  rmSync(base, {recursive: true, force: true});
  cpSync(new URL("src/", root), new URL("src/", base), {recursive: true});
  cpSync(new URL("scripts/build-graybox.mjs", root), new URL("scripts/build-graybox.mjs", base));
  cpSync(new URL("scripts/mounted-billy-decision.js", root), new URL("src/mounted-billy-decision.js", base));
  patch(base, "src/game/card-specs.generated.js", [[`${STAT}3`, `${STAT}${attack}`]]);
  patch(base, "src/graybox.js", [
    ['import {chooseAction, cpuFor} from "./game/cpu.js";', 'import {chooseAction, cpuFor} from "./game/cpu.js";\nimport {decisionBoard} from "./mounted-billy-decision.js";'],
    ["new URLSearchParams(location.search)", `new URLSearchParams(location.search || "${boardQuery(BOARDS[0])}")`],
    ["FABLE_ENGINE.createMatch(seed, options)", "(guided ? (state) => state : (state) => decisionBoard({...FABLE_ENGINE, cpuFor}, state))(FABLE_ENGINE.createMatch(seed, options))"],
  ]);
  patch(base, "src/ui/graybox.html", [
    ["| Graybox</title>", `| Mounted Billy attack ${attack}</title>`],
    ['<section id="match"', `<p>Mounted Billy lab, attack ${attack}. The opening rounds were played for you. Keep your Sheriffs or tribute them for Mounted Billy, then play the duel out. Restart in the ☰ menu returns to this decision. <a href="index.html" style="color:inherit">Other boards</a></p>\n    <section id="match"`],
  ]);
  return base;
}
const altRoot = writeTree(4);

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

const points = (state) => (state.result.winner === "cowboy" ? 1 : state.result.winner === null ? 0.5 : 0);

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
          if (isBilly(action.cardId)) split.botCommits++;
        }
        summoned ||= isBilly(action.cardId);
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
    const start = game.createMatch(seed);
    const state = decisionBoard(game, start, {cpu, log});
    assert.notEqual(state, start, `seed ${seed}: Mounted Billy never becomes summonable`);
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

// Every seed in the range, dealt as the pages deal it, at its first Mounted Billy decision.
// Keep means he stays in hand for the rest of the match; commit means he enters that lane now.
// The Normal bots finish each line under both rule sets.
function scan({from, count}) {
  const boards = [];
  for (let seed = from; seed < from + count; seed++) {
    const row = {seed};
    let shared;
    for (const [ruleSet, game] of Object.entries(rules)) {
      const start = game.createMatch(seed);
      const state = decisionBoard(game, start);
      if (state === start) break;
      shared ??= state;
      assert.deepEqual(state, shared, `seed ${seed}: the rule sets reach different boards`);
      const choose = game.cpuFor("normal");
      const commits = commitsAt(game, state).map((commit) => points(finish(game, step(game, state, commit), choose)));
      Object.assign(row, {round: state.round, troops: state.sides.cowboy.board.map((troop) => (troop ? game.CARDS[troop.cardId].name : "-")).join(" | ")});
      row[ruleSet] = {keep: points(finish(game, state, choose, {never: true})), bestCommit: Math.max(...commits), worstCommit: Math.min(...commits)};
    }
    if (row.current) boards.push(row);
  }
  const sheriffs = (row) => row.troops.split(" | ").filter((name) => name !== "-").every((name) => name === "Sheriff");
  const groups = {
    // Keeping wins and every commit lane loses, at both attack values, with only Sheriffs on the board.
    keepWinsEveryCommitLoses: (row) => sheriffs(row) && ["current", "attack-4"].every((id) => row[id].keep === 1 && row[id].bestCommit === 0),
    keepBeatsEveryCommitAtAttack4: (row) => row["attack-4"].keep > row["attack-4"].bestCommit,
    reversalKeepToCommit: (row) => row.current.keep > row.current.bestCommit && row["attack-4"].bestCommit > row["attack-4"].keep,
    reversalCommitToKeep: (row) => row.current.bestCommit > row.current.keep && row["attack-4"].keep > row["attack-4"].bestCommit,
  };
  console.log(JSON.stringify({
    seeds: {from, count}, wizard: "normal", boards: boards.length,
    ...Object.fromEntries(Object.entries(groups).map(([name, test]) => [name, {count: boards.filter(test).length, seeds: boards.filter(test).map((row) => row.seed)}])),
  }, null, 2));
}

// Two pages that open on the same round-three board and differ only in Mounted Billy's attack.
function buildPages() {
  for (const seed of BOARDS) {
    const [current, changed] = Object.values(rules).map((game) => decisionBoard(game, game.createMatch(seed)));
    assert.deepEqual(current, changed, `seed ${seed}: both pages must open on the same board and hand`);
    assert.ok(commitsAt(rules.current, current).length > 0, `seed ${seed}: no Mounted Billy decision`);
  }
  const out = new URL("dist/mounted-billy/", root);
  rmSync(out, {recursive: true, force: true}); // this lab's own output, including pages from its earlier version
  mkdirSync(out, {recursive: true});
  const pages = [3, 4].map((attack) => {
    const base = attack === 4 ? altRoot : writeTree(attack);
    execFileSync(process.execPath, [fileURLToPath(new URL("scripts/build-graybox.mjs", base))], {stdio: "ignore"});
    const html = readFileSync(new URL("dist/cowboys-vs-wizards-board-duel.html", base), "utf8");
    writeFileSync(new URL(`attack-${attack}.html`, out), html);
    console.log(`Built dist/mounted-billy/attack-${attack}.html`);
    return html;
  });
  // Title, lab line and the card's attack: three characters, each 3 against 4, and nothing else.
  assert.equal(pages[0].length, pages[1].length, "the pages differ by more than Mounted Billy's attack");
  const differing = [...pages[0]].flatMap((char, index) => (char === pages[1][index] ? [] : [char + pages[1][index]]));
  assert.deepEqual(differing, ["34", "34", "34"], "the pages differ by more than Mounted Billy's attack");
  // The link page names no outcome: the player chooses first and reads the evidence note after.
  writeFileSync(new URL("index.html", out), `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark light">
<title>Mounted Billy lab boards</title>
<body style="font: 1rem/1.5 system-ui, sans-serif; max-width: 40rem; margin: 2rem auto; padding: 0 1rem">
<h1>Mounted Billy lab</h1>
<p>Each board opens on the first turn Mounted Billy can be summoned. Both versions of a board start with the same lanes and the same hand. His attack is the only difference. Keep your troops or tribute them, then play the duel out.</p>
<ul>
${BOARDS.map((seed) => `  <li>Seed ${seed}: ${[3, 4].map((attack) => `<a href="attack-${attack}.html${boardQuery(seed).replaceAll("&", "&amp;")}">attack ${attack}</a>`).join(" · ")}</li>`).join("\n")}
</ul>
</body>
</html>
`);
  console.log("Built dist/mounted-billy/index.html");
}

const {values} = parseArgs({options: {
  from: {type: "string", default: "32000"}, count: {type: "string", default: "1024"},
  board: {type: "string"}, cpu: {type: "string", default: "normal"}, lane: {type: "string", default: "2"},
  build: {type: "boolean", default: false}, scan: {type: "boolean", default: false},
}});
if (values.build) buildPages();
else if (values.scan) scan({from: Number(values.from), count: Number(values.count)});
else if (values.board) board(Number(values.board), values.cpu, Number(values.lane));
else report({from: Number(values.from), count: Number(values.count)});
