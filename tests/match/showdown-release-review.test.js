// The Showdown release review's refusals and turn sweep (scripts/showdown-release-review.mjs).
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {HTML, provenance, receiptProblems, showdownTests, sweepTurns} from "../../scripts/showdown-release-review.mjs";
import {TURNS} from "../../src/match/showdown-turn.js";

const root = fileURLToPath(new URL("../../", import.meta.url));

function repo() {
  const dir = mkdtempSync(path.join(tmpdir(), "showdown-review-"));
  const git = (...args) => execFileSync("git", args, {cwd: dir, encoding: "utf8"}).trim();
  git("init", "-q");
  writeFileSync(path.join(dir, "a.txt"), "a\n");
  git("add", "a.txt");
  git("-c", "user.name=t", "-c", "user.email=t@example.invalid", "commit", "-qm", "a");
  return {dir, git, sha: git("rev-parse", "HEAD")};
}

test("provenance refuses a wrong SHA, a branch checkout and a dirty tree, and accepts a clean detached HEAD", () => {
  const {dir, git, sha} = repo();
  try {
    const wrong = sha.replace(/^./, (c) => (c === "0" ? "1" : "0"));
    assert.match(provenance(dir, wrong).reasons.join("\n"), /is not the expected/);
    assert.match(provenance(dir, sha).reasons.join("\n"), /on a branch/);
    git("checkout", "-q", "--detach", sha);
    assert.deepEqual(provenance(dir, sha).reasons, []);
    writeFileSync(path.join(dir, "new.txt"), "x\n");
    assert.match(provenance(dir, sha).reasons.join("\n"), /not clean/);
    rmSync(path.join(dir, "new.txt"));
    writeFileSync(path.join(dir, "a.txt"), "changed\n");
    assert.match(provenance(dir, sha).reasons.join("\n"), /not clean/);
  } finally { rmSync(dir, {recursive: true, force: true}); }
});

test("a receipt for another SHA, a failed run or a changed build is refused", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "showdown-receipt-"));
  try {
    const sha = "a".repeat(40);
    mkdirSync(path.join(dir, "dist"));
    writeFileSync(path.join(dir, HTML), "<html>built</html>");
    mkdirSync(path.join(dir, "r"));
    writeFileSync(path.join(dir, "r/report.json"), "{}");
    const hash = (s) => createHash("sha256").update(s).digest("hex");
    const good = {schema: "showdown-release-review/1", expectedSha: sha, verdict: "pass", before: {head: sha}, after: {head: sha},
      build: {htmlSha256: hash("<html>built</html>")}, browser: [{id: "turn", reportPath: "r/report.json", reportSha256: hash("{}")}]};
    assert.deepEqual(receiptProblems(good, sha, dir), []);
    assert.match(receiptProblems(good, "b".repeat(40), dir).join("\n"), /expectedSha/);
    assert.match(receiptProblems(good, "abc", dir).join("\n"), /40 lowercase hex/);
    assert.match(receiptProblems({...good, verdict: "fail"}, sha, dir).join("\n"), /verdict is fail/);
    assert.match(receiptProblems({...good, after: {head: "b".repeat(40)}}, sha, dir).join("\n"), /HEAD before or after/);
    writeFileSync(path.join(dir, HTML), "<html>built</html><!-- edit -->");
    assert.match(receiptProblems(good, sha, dir).join("\n"), /no longer hashes/);
    writeFileSync(path.join(dir, HTML), "<html>built</html>");
    writeFileSync(path.join(dir, "r/report.json"), "{\"edited\":true}");
    assert.match(receiptProblems(good, sha, dir).join("\n"), /report changed/);
  } finally { rmSync(dir, {recursive: true, force: true}); }
});

test("the review runs the Showdown suites, including this one, and no lane suite", () => {
  const files = showdownTests(root);
  assert.ok(files.includes("tests/match/showdown-turn.test.js"));
  assert.ok(files.includes("tests/game/showdown-campaign-store.test.js"));
  assert.ok(files.includes("tests/match/showdown-release-review.test.js"));
  assert.ok(!files.some((f) => /\/(match|orbs|ride-out|controller)\.test\.js$/.test(f)));
});

test("the sweep covers every allowlisted turn and every landing choice, each finishing the same way twice", async () => {
  const turns = await sweepTurns(root);
  assert.deepEqual(turns.map((t) => t.id), Object.keys(TURNS));
  for (const t of turns) {
    assert.deepEqual(t.problems, [], t.id);
    assert.ok(t.branches.length >= 2, `${t.id} offers a choice`);
  }
  const dragon = turns.find((t) => t.id === "dragon-c5");
  assert.equal(dragon.seed, 3);
  for (const target of [0, 1]) assert.ok(dragon.branches.some((b) => JSON.stringify(b.action) === JSON.stringify({type: "attack", slot: 0, target})));
});
