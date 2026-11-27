// G04 compares the two real gate processes with the preregistered Billy audit.
import assert from "node:assert/strict";
import {execFileSync, spawnSync} from "node:child_process";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {verifyEvidence} from "../scripts/billy-balance-gate.mjs";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const gate = "scripts/billy-balance-gate.mjs";
const logLimit = 4096;
const sourceCommit = "eedab9385931e093e156fdb7885c470eb2ec64eb";
const protocolSha256 = "195057485d248f0c0fa7a113f263e19d8d34fc446f8712042c01f536f6b369b3";
const csvSha256 = "947167821e4480482145a9d30fc6237a4dbe92c795e0a936572a56786b8b706f";
const expected = {
  baseline: {
    attack: 2, exit: 2, verdict: "RED", cowboy: "59.792", wizard: "40.208", skew: "9.412",
    meaning: "Do not forward this candidate.",
    stderr: "billy-balance-gate: RED for the baseline arm (observation; nothing deployed): NSB-1: Cowboy share 59.79% is outside 45-55%; NSB-1: Wizard share 40.21% is outside 45-55%\n",
  },
  candidate: {
    attack: 1, exit: 0, verdict: "PASS", cowboy: "51.92", wizard: "48.08", skew: "8.136",
    meaning: "Measured match shares meet NSB-1 and NSB-2. Ready for Fable/Alex review only; not applied to any card or release.",
    stderr: "",
  },
};

export function verifyArm(arm, child) {
  const want = expected[arm];
  if (child.error) throw child.error;
  assert.equal(child.signal, null, `${arm} terminated by signal`);
  assert.equal(child.status, want.exit, `${arm} exit`);
  for (const stream of ["stdout", "stderr"]) {
    assert.ok(typeof child[stream] === "string" && Buffer.byteLength(child[stream]) <= logLimit, `${arm} invalid ${stream}`);
  }
  const lines = [
    `Billy balance gate, ${arm} arm (Billy attack ${want.attack}): observation on recorded games; nothing deployed.`,
    `Evidence re-derived: 100000 duels match result.json (protocol SHA-256 ${protocolSha256}, CSV SHA-256 ${csvSha256}).`,
    `NSB-1 ${want.verdict}: Cowboy ${want.cowboy}%, Wizard ${want.wizard}%; allowed 45% to 55% inclusive`,
    `NSB-2 PASS: first-seat distance from 50% ${want.skew} pp (baseline 9.412 pp); allowed at most 10.412 pp (+1)`,
    `Overall ${want.verdict}. ${want.meaning}`,
  ];
  assert.equal(child.stdout, lines.join("\n") + "\n", `${arm} stdout differs from the historical verdict`);
  assert.equal(child.stderr, want.stderr, `${arm} stderr differs from the historical verdict`);
}

function judge(args) {
  assert.ok(args.length === 1 && /^[a-f0-9]{40}$/.test(args[0]), "usage: node .devcontainer/judge-billy.mjs <full checkout SHA>");
  // A bind mount may retain the host UID. Trust only this mount for these two reads.
  const git = (...args) => execFileSync("git", ["-c", `safe.directory=${root}`, "-c", "core.filemode=false", ...args], {cwd: root, encoding: "utf8"}).trim();
  const head = git("rev-parse", "--verify", "HEAD^{commit}");
  assert.equal(head, args[0], "judge checkout differs from requested build");
  // The container can create untracked setup files. Bind the executable sources, contract and
  // evidence to the revision being judged, including edits already staged in the index.
  const changed = git("diff", "--no-ext-diff", "--name-only", "HEAD", "--", ".devcontainer", "scripts",
    ".kiro/specs/night-shift-balance-contract/requirements.md", "docs/evidence/billy-seat-audit");
  assert.equal(changed, "", `judge inputs differ from the requested build: ${changed}`);
  const receipt = verifyEvidence();
  assert.equal(receipt.protocol.sourceCommit, sourceCommit, "historical engine commit");
  assert.equal(receipt.protocolSha256, protocolSha256, "historical protocol digest");
  assert.equal(receipt.csvSha256, csvSha256, "historical outcomes digest");
  console.log(`Judge checkout ${head} | ${process.platform} ${process.arch} Node ${process.version} | recorded engine ${sourceCommit}`);

  const runs = Object.keys(expected).map(arm => {
    const child = spawnSync(process.execPath, [gate, "--arm", arm], {cwd: root, encoding: "utf8", maxBuffer: logLimit, timeout: 30_000});
    console.log(`$ node ${gate} --arm ${arm} (exit ${child.status}, signal ${child.signal})`);
    for (const stream of ["stdout", "stderr"]) {
      const log = child[stream];
      if (typeof log === "string" && Buffer.byteLength(log) <= logLimit) process.stdout.write(`${stream} (${Buffer.byteLength(log)} bytes):\n${log}`);
    }
    return {arm, child};
  });
  for (const {arm, child} of runs) verifyArm(arm, child);
  console.log("Verified both historical Billy verdicts.");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { judge(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
