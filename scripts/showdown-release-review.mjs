// Showdown release review: the deterministic part of .kiro/workflows/independent-release-review.workflow.json.
//   node scripts/showdown-release-review.mjs --expected <40-hex SHA>
//   node scripts/showdown-release-review.mjs --check-receipt <receipt.json> --expected <40-hex SHA>
// Run mode refuses (exit 3) unless HEAD is detached at exactly the expected SHA with no tracked or untracked
// change. It then runs the Showdown Node suites, an every-branch sweep of each allowlisted experiment turn
// (src/match/showdown-turn.js TURNS, so a newly released turn is covered without editing this file), one
// graybox build and the existing Showdown headless Chrome checks of that build, re-checks HEAD and the tree,
// and writes receipt.json. Everything goes to .artifacts/kiro/showdown-release-review/<sha>/.
// Check mode refuses (exit 4) a receipt that names another SHA, did not pass, or whose HTML or browser
// reports no longer hash to what it recorded.
// Exit: 0 pass, 1 a check failed, 2 usage, 3 provenance refused, 4 receipt refused.
// Scripted checks only: flow, storage and hidden-information facts. Not a human playtest, art review or device test.
import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import {existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";

export const SHA = /^[0-9a-f]{40}$/;
export const HTML = "dist/cowboys-vs-wizards-board-duel.html";
// Existing Showdown checks of the built graybox page. Each owns its seeds and routes; this file does not.
export const BROWSER = [
  {id: "entry", script: "scripts/browser-showdown-check.mjs", report: "browser-showdown.json"},
  {id: "camp-trail", script: "scripts/browser-showdown-trail-check.mjs", report: "browser-showdown-trail.json"},
  {id: "modes-hidden-saves", script: "scripts/browser-showdown-modes-check.mjs", report: "browser-showdown-modes.json"},
  {id: "turn", script: "scripts/browser-showdown-turn-check.mjs", report: "report.json"},
  {id: "keyboard", script: "scripts/browser-showdown-keyboard-check.mjs", report: "browser-showdown-keyboard.json"},
  {id: "ledger", script: "scripts/browser-ledger-check.mjs", report: "browser-ledger.json"},
];

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const git = (root, ...args) => spawnSync("git", args, {cwd: root, encoding: "utf8"});

// Provenance facts of the checkout; refusals name every reason, not only the first.
export function provenance(root, expected) {
  const head = git(root, "rev-parse", "HEAD").stdout.trim();
  const detached = git(root, "symbolic-ref", "-q", "HEAD").status !== 0;
  const status = git(root, "status", "--porcelain", "--untracked-files=all").stdout.trim();
  const reasons = [];
  if (head !== expected) reasons.push(`HEAD ${head || "(none)"} is not the expected ${expected}`);
  if (!detached) reasons.push("HEAD is on a branch; check out the expected SHA detached");
  if (status) reasons.push(`the tree is not clean:\n${status}`);
  return {head, detached, clean: !status, reasons};
}

export function showdownTests(root) {
  const pick = (dir, re) => readdirSync(path.join(root, dir)).filter((f) => re.test(f)).sort().map((f) => `${dir}/${f}`);
  return [
    ...pick("tests/game", /^showdown-.*\.test\.m?js$/),
    ...pick("tests/match", /^(showdown-.*|sheriffs-ledger|showdown-release-review)\.test\.m?js$/),
    ...pick("prototypes/showdown", /\.test\.m?js$/),
  ];
}

// Every legal choice at each allowlisted turn's landing, played out by a fixed policy. Checks that the landing
// hides the other seat's hand, traps and deck and the seed, that each branch finishes, and that a replay of the
// same branch ends the same way. Nothing here reads or writes a save.
export async function sweepTurns(root) {
  const {TURNS, turnDuel} = await import(pathToFileURL(path.join(root, "src/match/showdown-turn.js")).href);
  const {createShowdownSession} = await import(pathToFileURL(path.join(root, "src/match/showdown-session.js")).href);
  const policy = (legal) => legal.find((a) => a.type === "attack") ?? legal.find((a) => a.type !== "end" && a.type !== "cover") ?? legal.find((a) => a.type === "end");
  const open = (id) => { const {seed, duel} = turnDuel(id); return createShowdownSession({seed, duel}); };
  const play = (id, first) => {
    const session = open(id);
    session.act(first);
    for (let step = 0; step < 600 && !session.view().result; step += 1) session.act(policy(session.legal()));
    const view = session.view();
    return view.result ? {winner: view.result.winner, turn: view.turn} : null;
  };
  const turns = [];
  for (const id of Object.keys(TURNS)) {
    const problems = [];
    const landing = open(id).view();
    const other = landing.viewer === "cowboy" ? "wizard" : "cowboy";
    for (const hidden of ["hand", "traps", "deck"]) if (landing.sides[other][hidden] !== undefined) problems.push(`landing shows the ${other} ${hidden}`);
    if (landing.seed !== undefined) problems.push("landing shows the seed");
    if (JSON.stringify(open(id).view()) !== JSON.stringify(landing)) problems.push("a second open differs from the first");
    const branches = open(id).legal().map((action) => {
      const result = play(id, action);
      if (!result) problems.push(`${JSON.stringify(action)} did not finish in 600 actions`);
      else if (JSON.stringify(play(id, action)) !== JSON.stringify(result)) problems.push(`${JSON.stringify(action)} replayed differently`);
      return {action, result};
    });
    if (!branches.length) problems.push("no legal choice at the landing");
    turns.push({id, seed: TURNS[id].seed, at: TURNS[id].at, branches, problems});
  }
  return turns;
}

// Reasons a receipt does not cover this checkout's build for the expected SHA; empty means it does.
export function receiptProblems(receipt, expected, root) {
  const problems = [];
  if (!SHA.test(expected)) return [`expected SHA must be 40 lowercase hex characters, got ${JSON.stringify(expected)}`];
  if (receipt?.schema !== "showdown-release-review/1") problems.push("not a showdown-release-review/1 receipt");
  if (receipt?.expectedSha !== expected) problems.push(`receipt expectedSha ${receipt?.expectedSha} is not ${expected}`);
  if (receipt?.before?.head !== expected || receipt?.after?.head !== expected) problems.push("receipt HEAD before or after the run is not the expected SHA");
  if (receipt?.verdict !== "pass") problems.push(`receipt verdict is ${receipt?.verdict}`);
  const html = path.join(root, HTML);
  if (!existsSync(html)) problems.push(`${HTML} is missing`);
  else if (sha256(readFileSync(html)) !== receipt?.build?.htmlSha256) problems.push(`${HTML} no longer hashes to the receipt's ${receipt?.build?.htmlSha256}`);
  for (const check of receipt?.browser ?? []) {
    const file = check.reportPath && path.join(root, check.reportPath);
    if (!file || !existsSync(file)) problems.push(`${check.id}: report ${check.reportPath} is missing`);
    else if (sha256(readFileSync(file)) !== check.reportSha256) problems.push(`${check.id}: report changed since the receipt`);
  }
  return problems;
}

function parse(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = {"--expected": "expected", "--check-receipt": "receipt"}[argv[i]];
    if (!key || argv[i + 1] === undefined) return null;
    options[key] = argv[i + 1];
  }
  return options.expected === undefined ? null : options;
}

function run(root, command, args, log) {
  const started = Date.now();
  const r = spawnSync(command, args, {cwd: root, encoding: "utf8", maxBuffer: 64 << 20});
  const output = `${r.stdout ?? ""}${r.stderr ?? ""}${r.error ? r.error.message : ""}`;
  writeFileSync(log, output);
  return {command: [path.basename(command) === path.basename(process.execPath) ? "node" : command, ...args].join(" "),
    exit: r.status ?? 1, seconds: Math.round((Date.now() - started) / 100) / 10, output};
}

async function main() {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const options = parse(process.argv.slice(2));
  if (!options) {
    console.error("usage: node scripts/showdown-release-review.mjs --expected <sha> [--check-receipt <receipt.json>]");
    return 2;
  }
  if (!SHA.test(options.expected)) {
    console.error(`REFUSED: expected SHA must be 40 lowercase hex characters, got ${JSON.stringify(options.expected)}`);
    return 3;
  }
  if (options.receipt) {
    let receipt = null;
    try { receipt = JSON.parse(readFileSync(path.resolve(root, options.receipt), "utf8")); } catch (error) { console.error(`REFUSED: ${error.message}`); return 4; }
    const problems = receiptProblems(receipt, options.expected, root);
    if (problems.length) { console.error(`REFUSED receipt:\n- ${problems.join("\n- ")}`); return 4; }
    console.log(`ACCEPTED: receipt covers ${options.expected}, HTML ${receipt.build.htmlSha256}`);
    return 0;
  }

  const outRel = `.artifacts/kiro/showdown-release-review/${options.expected}`;
  const out = path.join(root, outRel);
  const before = provenance(root, options.expected);
  if (before.reasons.length) {
    console.error(`REFUSED:\n- ${before.reasons.join("\n- ")}`);
    return 3;
  }
  rmSync(out, {recursive: true, force: true});
  mkdirSync(out, {recursive: true});
  const receipt = {schema: "showdown-release-review/1", expectedSha: options.expected, node: process.version,
    started: new Date().toISOString(), before: {head: before.head, detached: before.detached, clean: before.clean}};
  const say = (line) => console.log(line);

  const tests = run(root, process.execPath, ["--test", ...showdownTests(root)], path.join(out, "node-tests.log"));
  const count = (name) => Number(tests.output.match(new RegExp(`^ℹ ${name} (\\d+)`, "m"))?.[1] ?? NaN);
  receipt.node_tests = {command: tests.command, exit: tests.exit, seconds: tests.seconds, tests: count("tests"), pass: count("pass"), fail: count("fail"), log: `${outRel}/node-tests.log`};
  say(`node tests: exit ${tests.exit}, ${receipt.node_tests.pass}/${receipt.node_tests.tests} passed`);

  let turns;
  try { turns = await sweepTurns(root); } catch (error) { turns = [{id: "(sweep)", problems: [error.message], branches: []}]; }
  receipt.turns = turns;
  for (const t of turns) say(`turn ${t.id} (seed ${t.seed}): ${t.branches.length} branches, ${t.problems.length ? t.problems.join("; ") : "ok"}`);

  const build = run(root, process.execPath, ["scripts/build-graybox.mjs"], path.join(out, "build.log"));
  receipt.build = {command: build.command, exit: build.exit, html: HTML};
  if (build.exit === 0) {
    const bytes = readFileSync(path.join(root, HTML));
    Object.assign(receipt.build, {htmlSha256: sha256(bytes), htmlBytes: bytes.length});
  }
  say(`build: exit ${build.exit}${receipt.build.htmlSha256 ? `, ${receipt.build.htmlSha256}` : ""}`);

  receipt.browser = [];
  for (const check of build.exit === 0 ? BROWSER : []) {
    const dir = `${outRel}/${check.id}`;
    const r = run(root, process.execPath, [check.script, HTML, dir], path.join(out, `${check.id}.log`));
    const reportPath = `${dir}/${check.report}`;
    const entry = {id: check.id, command: r.command, exit: r.exit, seconds: r.seconds, reportPath, summary: r.output.trim().split("\n").at(-1).replaceAll(root, "").slice(0, 200)};
    if (existsSync(path.join(root, reportPath))) {
      const bytes = readFileSync(path.join(root, reportPath));
      const report = JSON.parse(bytes);
      Object.assign(entry, {reportSha256: sha256(bytes), pageErrors: report.errors?.length ?? null,
        pageSha256Matches: report.pageSha256 === undefined ? null : report.pageSha256 === receipt.build.htmlSha256});
    }
    receipt.browser.push(entry);
    say(`${check.id}: exit ${r.exit}, ${entry.summary}`);
  }

  const after = provenance(root, options.expected);
  receipt.after = {head: after.head, detached: after.detached, clean: after.clean};
  const failures = [
    ...(tests.exit || !(receipt.node_tests.fail === 0 && receipt.node_tests.pass === receipt.node_tests.tests && receipt.node_tests.tests > 0) ? ["node tests"] : []),
    ...turns.filter((t) => t.problems.length).map((t) => `turn ${t.id}`),
    ...(build.exit ? ["build"] : []),
    ...(receipt.browser.length !== BROWSER.length ? ["browser checks not all run"] : []),
    ...receipt.browser.filter((b) => b.exit || !b.reportSha256 || b.pageErrors !== 0).map((b) => `browser ${b.id}`),
    ...after.reasons.map((r) => `after the run: ${r}`),
  ];
  receipt.failures = failures;
  receipt.verdict = failures.length ? "fail" : "pass";
  receipt.ended = new Date().toISOString();
  writeFileSync(path.join(out, "receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`);
  say(`verdict: ${receipt.verdict}${failures.length ? ` (${failures.join(", ")})` : ""}; receipt ${outRel}/receipt.json`);
  return failures.length ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await main();
