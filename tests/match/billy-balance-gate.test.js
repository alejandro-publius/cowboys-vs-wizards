// Billy balance gate on the committed, pinned Billy seat audit cohort (docs/evidence/billy-seat-audit).
// Corrupt cases are made from copies of the real evidence in a temporary directory; nothing in the checkout is written.
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join, resolve} from "node:path";
import {test} from "node:test";
import {fileURLToPath} from "node:url";
import {EVIDENCE_DIR, EvidenceError, main, runGate} from "../../scripts/billy-balance-gate.mjs";
import {parseBalanceContract} from "../../scripts/showdown-balance-contract.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const GATE = join(ROOT, "scripts/billy-balance-gate.mjs");
const REQUIREMENTS = join(ROOT, ".kiro/specs/night-shift-balance-contract/requirements.md");
const NSB1 = "- NSB-1: Each faction's win share SHALL be within 45% to 55%, inclusive.";
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} is not ${expected}`);
const gate = (...args) => spawnSync(process.execPath, [GATE, ...args], {encoding: "utf8"});
const quiet = fn => {
  const {log, error} = console;
  console.log = console.error = () => {};
  try { return fn(); } finally { Object.assign(console, {log, error}); }
};

function withEvidenceCopy(edit, fn) {
  const dir = mkdtempSync(join(tmpdir(), "billy-balance-gate-"));
  try {
    for (const name of ["protocol.json", "result.json", "outcomes.csv.gz"]) copyFileSync(join(EVIDENCE_DIR, name), join(dir, name));
    edit(dir);
    return fn(dir);
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
}

test("baseline arm is red on NSB-1 with the recorded shares", () => {
  const r = gate("--arm", "baseline");
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stdout, /NSB-1 RED: Cowboy 59\.792%, Wizard 40\.208%; allowed 45% to 55% inclusive/);
  assert.match(r.stdout, /NSB-2 PASS: first-seat distance from 50% 9\.412 pp \(baseline 9\.412 pp\); allowed at most 10\.412 pp/);
  assert.match(r.stdout, /nothing deployed/);
  assert.match(r.stderr, /NSB-1: Cowboy share 59\.79% is outside 45-55%/);
  assert.match(r.stderr, /NSB-1: Wizard share 40\.21% is outside 45-55%/);
});

test("candidate arm passes NSB-1 and NSB-2", () => {
  const r = gate("--arm", "candidate");
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /NSB-1 PASS: Cowboy 51\.92%, Wizard 48\.08%/);
  assert.match(r.stdout, /NSB-2 PASS: first-seat distance from 50% 8\.136 pp \(baseline 9\.412 pp\)/);
  assert.match(r.stdout, /Overall PASS/);
  assert.equal(r.stderr, "");
  const result = runGate({arm: "candidate"});
  close(result.observed.cowboyShare, 51.92);
  close(result.observed.wizardShare, 48.08);
  close(result.observed.seatSkew, 8.136);
  assert.deepEqual(result.requirements.map(x => [x.id, x.pass]), [["NSB-1", true], ["NSB-2", true]]);
});

test("narrowing the normative band to 49-51 turns the same candidate red", () => {
  const text = readFileSync(REQUIREMENTS, "utf8");
  assert.ok(text.includes(NSB1), "requirements.md holds the normative NSB-1 line");
  const policy = parseBalanceContract(text.replace(NSB1, NSB1.replace("45% to 55%", "49% to 51%")));
  assert.deepEqual(policy.band, [49, 51]);
  const result = runGate({arm: "candidate", policy});
  assert.equal(result.pass, false);
  assert.equal(result.requirements[0].pass, false);
  assert.deepEqual(result.reasons, ["NSB-1: Cowboy share 51.92% is outside 49-51%", "NSB-1: Wizard share 48.08% is outside 49-51%"]);
  assert.equal(quiet(() => main(["--arm", "candidate"], {policy})), 2);
});

test("bad arguments are unusable input, never green", () => {
  for (const args of [[], ["--arm"], ["--arm", "both"], ["--arm", "candidate", "--extra"]]) assert.equal(gate(...args).status, 1, args.join(" "));
});

test("missing, truncated or mismatched evidence fails closed", () => {
  const cases = {
    "missing CSV": dir => rmSync(join(dir, "outcomes.csv.gz")),
    "truncated CSV": dir => {
      const gz = readFileSync(join(dir, "outcomes.csv.gz"));
      writeFileSync(join(dir, "outcomes.csv.gz"), gz.subarray(0, gz.length >> 1));
    },
    "edited count": dir => {
      const result = JSON.parse(readFileSync(join(dir, "result.json"), "utf8"));
      result.byFirst.cowboy.candidate.cowboy -= 1;
      result.byFirst.cowboy.candidate.wizard += 1;
      writeFileSync(join(dir, "result.json"), JSON.stringify(result, null, 2) + "\n");
    },
    "edited protocol": dir => {
      const protocol = JSON.parse(readFileSync(join(dir, "protocol.json"), "utf8"));
      writeFileSync(join(dir, "protocol.json"), JSON.stringify({...protocol, deals: 20000}, null, 2) + "\n");
    },
  };
  for (const [name, edit] of Object.entries(cases)) {
    withEvidenceCopy(edit, dir => {
      assert.throws(() => runGate({arm: "candidate", evidenceDir: dir}), EvidenceError, name);
      assert.equal(quiet(() => main(["--arm", "candidate"], {evidenceDir: dir})), 1, name);
    });
  }
});
