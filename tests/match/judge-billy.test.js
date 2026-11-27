import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {test} from "node:test";
import {fileURLToPath} from "node:url";
import {verifyArm} from "../../.devcontainer/judge-billy.mjs";

const gate = fileURLToPath(new URL("../../scripts/billy-balance-gate.mjs", import.meta.url));

test("the judge accepts each recorded Billy arm only with its own verdict and evidence", () => {
  const run = arm => spawnSync(process.execPath, [gate, "--arm", arm], {encoding: "utf8"});
  const baseline = run("baseline");
  const candidate = run("candidate");
  assert.equal(baseline.status, 2, baseline.stderr);
  assert.equal(candidate.status, 0, candidate.stderr);
  verifyArm("baseline", baseline);
  verifyArm("candidate", candidate);

  const rejects = (arm, child, reason) => assert.throws(() => verifyArm(arm, child), reason);
  rejects("baseline", {...candidate, status: 2}, "candidate logs with baseline exit");
  rejects("candidate", {...baseline, status: 0}, "baseline logs with candidate exit");
  rejects("baseline", {...baseline, status: 1}, "unusable evidence exit");
  rejects("candidate", {...candidate, status: 2}, "red proposal exit");
  rejects("baseline", {...baseline,
    stdout: baseline.stdout.replace("NSB-1 RED", "NSB-1 PASS").replace("NSB-2 PASS", "NSB-2 RED"),
    stderr: baseline.stderr.replaceAll("NSB-1:", "NSB-2:"),
  }, "wrong baseline failure");
  rejects("candidate", {...candidate, stdout: candidate.stdout.split("Overall PASS")[0]}, "truncated verdict");
  rejects("candidate", {...candidate, stdout: null}, "missing stdout");
  rejects("candidate", {...candidate, stdout: candidate.stdout.replace("Cowboy 51.92%", "Cowboy 52.92%")}, "wrong historical share");
  rejects("candidate", {...candidate, stdout: candidate.stdout.replace(/CSV SHA-256 [a-f0-9]{64}/, "CSV SHA-256 " + "0".repeat(64))}, "wrong outcomes digest");
  rejects("baseline", {...baseline, signal: "SIGTERM"}, "terminated gate");
  for (const stream of ["stdout", "stderr"]) {
    assert.throws(() => verifyArm("baseline", {...baseline, [stream]: "x".repeat(4097)}), new RegExp(`invalid ${stream}`));
  }
});

test("the judge rejects a different checkout SHA before recording verdicts", () => {
  const judge = fileURLToPath(new URL("../../.devcontainer/judge-billy.mjs", import.meta.url));
  const result = spawnSync(process.execPath, [judge, "0".repeat(40)], {encoding: "utf8"});
  assert.equal(result.status, 1);
  assert.match(result.stderr, /checkout differs from requested build/);
  assert.equal(result.stdout, "");
});
