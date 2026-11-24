#!/usr/bin/env node
// HYPOTHETICAL, NON-RELEASE counterfactual probe for referee cluster C1
// (docs/evidence/kiro-referee-disagreement-triage.md).
//
// Question: if the frozen referee rejected Hellfire when the opponent has no troops (as the engine
// does), how many of the saved 2,500 duels would still disagree?
//
// What it does, offline, writing nothing in the repository:
//   1. Checks that proof/referee (oracle tree), corpus.mjs, adapter.mjs, the recipe and the engine
//      files match proof/referee/freeze.json and the first-run receipt, using prove.mjs's helpers.
//   2. Copies the oracle tree to a temporary directory and checks the copy's tree digest equals the
//      frozen digest.
//   3. Runs the unmodified copy through prove.mjs streamComparison on the frozen recipe (before).
//   4. Applies one exact text substitution to the copy's referee.py, checks the old text occurs
//      exactly once and the patched file digest, then runs it again (after).
//   5. Deletes the temporary directory in every case and prints one JSON report to stdout.
// It never calls prove(), never writes receipts, and never edits the frozen referee or the game.
//
// Usage: node scripts/referee/hellfire-parity-probe.mjs [--limit N]
// Exit: 0 report printed; 2 a precondition failed (nothing compared); 1 unexpected error.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {canonicalJson, hashFile, hashTree, oracleSkip, proofPaths, sha256, streamComparison} from "./prove.mjs";
import * as corpus from "./corpus.mjs";
import * as adapter from "./adapter.mjs";

const RECEIPT_KEY = "6e2f2f904791e114e177577277ca4efee52a59b2d9b1e23d751daba2fa16fcd6";

// The only change: after the existing "no target" check, reject Hellfire (the one damage-all
// spell) when every enemy troop slot is empty. Mirrors the engine's enemy.board.some(Boolean).
const OLD = `        elif target is not None:
            raise Illegal("spell-takes-no-target")
`;
const NEW = `${OLD}        elif effect == "damage-all" and all(x is None for x in foe_troops):
            raise Illegal("hellfire-no-enemy-troops")
`;

const paths = proofPaths(fileURLToPath(new URL("../../", import.meta.url)));
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

function preconditions() {
  const freeze = readJson(paths.freeze);
  const receipt = readJson(path.join(paths.receipts, `first-run-${RECEIPT_KEY}.json`));
  const mismatchFile = path.join(paths.receipts, `first-run-${RECEIPT_KEY}.mismatches.jsonl`);
  const checks = {
    oracleTree: [hashTree(paths.oracleDir, oracleSkip), freeze.referee.treeSha256],
    receiptOracleTree: [receipt.oracle.treeSha256, freeze.referee.treeSha256],
    corpus: [hashFile(paths.corpus), freeze.corpus.sha256],
    adapter: [hashFile(paths.adapter), freeze.adapter.sha256],
    recipe: [canonicalJson(corpus.recipe({quick: false})), canonicalJson(freeze.recipe)],
    engineFile: [hashFile(paths.engine), receipt.baseline.engineSha256],
    showdownTree: [hashTree(paths.showdown), receipt.baseline.showdownTreeSha256],
    firstRunMismatches: [hashFile(mismatchFile), receipt.mismatches.sha256],
  };
  const failed = Object.entries(checks).filter(([, [actual, want]]) => actual !== want).map(([name]) => name);
  return {freeze, receipt, failed, refereeSha256: hashFile(paths.referee)};
}

function copyTree(from, to) {
  const walk = (rel) => {
    for (const name of fs.readdirSync(path.join(from, rel)).sort()) {
      const r = rel ? `${rel}/${name}` : name;
      if (oracleSkip(r)) continue;
      const src = path.join(from, r);
      if (fs.statSync(src).isDirectory()) { fs.mkdirSync(path.join(to, r)); walk(r); }
      else fs.copyFileSync(src, path.join(to, r));
    }
  };
  walk("");
}

// First divergence of each mismatching duel, plus whether it is the C1 pattern.
function collector() {
  const firsts = [];
  const sink = (line) => {
    const m = line.mismatches[0];
    const s = m.engine?.state ?? m.referee?.state;
    const foe = s && (s.active === "cowboy" ? "wizard" : "cowboy");
    const enemyTroops = s ? s.players[foe].troops.filter(Boolean).length : null;
    const hellfire = m.action?.type === "spell" && /^wizard-hellfire-\d+$/.test(m.action.cardId ?? "");
    firsts.push({duel: line.duel, seed: line.seed, step: line.firstStep, turn: line.firstTurn, kind: m.kind,
      action: m.action, refereeReason: m.referee?.reason ?? null, enemyTroops,
      c1: hellfire && enemyTroops === 0 && m.kind === "rejected-by-engine", later: line.mismatches.length - 1});
  };
  return {firsts, sink};
}

async function compare(refereeFile, freeze, limit) {
  const {firsts, sink} = collector();
  const run = await streamComparison({
    duels: corpus.duels(corpus.recipe({quick: false})), engine: adapter, sink, limit, cwd: paths.root,
    command: [process.env.REFEREE_PYTHON || "python3", "-u", refereeFile, "--stream"],
  });
  const t = run.totals;
  return {
    complete: run.complete, errors: run.errors, duelsSent: run.duelsSent,
    inputsSha256: run.inputsSha256, inputsMatchFreeze: run.inputsSha256 === freeze.inputs.sha256,
    actions: t.actions, completed: t.completed, mismatchDuels: t.mismatchDuels, mismatches: t.mismatches,
    mismatchesByKind: t.mismatchesByKind, unsupported: t.unsupported, oracleViolations: t.oracleViolations,
    firstDivergencesC1: firsts.filter((f) => f.c1).length, firstDivergences: firsts,
  };
}

async function main(argv) {
  const at = argv.indexOf("--limit");
  const limit = at >= 0 ? Number(argv[at + 1]) : Infinity;
  if (at >= 0 && !(Number.isInteger(limit) && limit > 0)) throw new Error("--limit needs a positive integer");

  const pre = preconditions();
  if (pre.failed.length) {
    process.stdout.write(`${JSON.stringify({status: "precondition-failed", failed: pre.failed}, null, 2)}\n`);
    return 2;
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hellfire-parity-probe-"));
  const cleanup = () => fs.rmSync(tmp, {recursive: true, force: true});
  const onSignal = () => { cleanup(); process.exit(130); };
  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);
  try {
    copyTree(paths.oracleDir, tmp);
    const copyTreeSha256 = hashTree(tmp, oracleSkip);
    const tmpReferee = path.join(tmp, "referee.py");
    if (copyTreeSha256 !== pre.freeze.referee.treeSha256 || hashFile(tmpReferee) !== pre.refereeSha256) {
      process.stdout.write(`${JSON.stringify({status: "precondition-failed", failed: ["temporary copy differs from frozen tree"]}, null, 2)}\n`);
      return 2;
    }
    const before = await compare(tmpReferee, pre.freeze, limit);

    const source = fs.readFileSync(tmpReferee, "utf8");
    const occurrences = source.split(OLD).length - 1;
    if (occurrences !== 1) {
      process.stdout.write(`${JSON.stringify({status: "precondition-failed", failed: [`substitution text occurs ${occurrences} times`]}, null, 2)}\n`);
      return 2;
    }
    const patched = source.replace(OLD, NEW);
    fs.writeFileSync(tmpReferee, patched);
    const substitution = {old: OLD, new: NEW, oldSha256: sha256(OLD), newSha256: sha256(NEW),
      refereeSha256Before: pre.refereeSha256, refereeSha256After: hashFile(tmpReferee), expectedAfter: sha256(patched),
      linesAdded: 2, linesRemoved: 0};
    const after = await compare(tmpReferee, pre.freeze, limit);

    const report = {
      label: "HYPOTHETICAL counterfactual. Not release evidence. Frozen referee unchanged; no receipt written.",
      receiptKey: RECEIPT_KEY,
      frozenOracleTreeSha256: pre.freeze.referee.treeSha256, copyTreeSha256,
      recipe: pre.freeze.recipe, limit: Number.isFinite(limit) ? limit : null,
      preserved: {mismatchDuels: pre.receipt.counts.mismatchDuels, mismatches: pre.receipt.counts.mismatches,
        mismatchesByKind: pre.receipt.counts.mismatchesByKind},
      substitution, before, after,
    };
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return 0;
  } finally {
    cleanup();
    process.removeListener("SIGINT", onSignal);
    process.removeListener("SIGTERM", onSignal);
  }
}

main(process.argv.slice(2)).then((code) => { process.exitCode = code; },
  (error) => { process.stderr.write(`${error.stack ?? error.message}\n`); process.exitCode = 1; });
