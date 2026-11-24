import assert from "node:assert/strict";
import {execFileSync, spawnSync} from "node:child_process";
import {mkdtempSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join, sep} from "node:path";

// Export only the files the original receipt binds, so fixture mutations leave both
// the working engine and the recorded evidence untouched.
export function historicalEngine(t, repo, commit, paths) {
  assert.match(commit, /^[0-9a-f]{40}$/);
  const git = (args) => spawnSync("git", args, {cwd: repo, encoding: "utf8"});
  const pin = git(["cat-file", "-e", `${commit}^{commit}`]);
  if (pin.status !== 0) {
    const checkout = git(["rev-parse", "--is-shallow-repository"]);
    if (checkout.status !== 0 || checkout.stdout.trim() === "true") {
      t.skip(`historical source ${commit} requires a Git checkout with full history`);
      return null;
    }
    assert.fail(`historical source ${commit} is missing from the full Git checkout`);
  }
  const root = mkdtempSync(join(tmpdir(), "orb-power-history-"));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  const files = [...new Set(["package.json", ...paths])];
  const input = execFileSync("git", ["archive", "--format=tar", commit, "--", ...files], {
    cwd: repo, maxBuffer: 8 * 1024 * 1024,
  });
  const unpack = spawnSync("tar", ["-xf", "-", "-C", root], {input, encoding: "utf8"});
  assert.equal(unpack.status, 0, unpack.stderr || String(unpack.error ?? "archive extraction failed"));
  return root + sep;
}
