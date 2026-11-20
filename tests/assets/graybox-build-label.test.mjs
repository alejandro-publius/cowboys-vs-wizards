// K-087: the graybox page's public build label, from git, carried into the bundle by scripts/build-graybox.mjs.
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {build} from "esbuild";
import {BUILD_LABEL_PATTERN, grayboxBuildLabel} from "../../scripts/graybox-build-label.mjs";
import {buildLabel} from "../../src/match/showdown-playtest.js";

const root = fileURLToPath(new URL("../../", import.meta.url));

test("the label is this checkout's commit prefix, and the playtest log accepts exactly that shape", () => {
  const label = grayboxBuildLabel(root);
  assert.match(label, BUILD_LABEL_PATTERN);
  assert.ok(execFileSync("git", ["rev-parse", "HEAD"], {cwd: root, encoding: "utf8"}).startsWith(label.slice(0, 12)));
  assert.equal(buildLabel(label), label);
  assert.equal(buildLabel(`${label.slice(0, 12)}+local`), `${label.slice(0, 12)}+local`);
});

test("outside a git checkout there is no label, so the page says its build is not identified", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "cvw-no-git-"));
  try { assert.equal(grayboxBuildLabel(dir), null); } finally { await rm(dir, {recursive: true, force: true}); }
});

test("bundled with the build script's define, the page knows its label; a bad define is ignored", async () => {
  const pageBuild = async (value) => {
    const out = await build({absWorkingDir: root, entryPoints: ["src/match/showdown-playtest.js"], bundle: true, write: false,
      format: "esm", platform: "neutral", define: {__CVW_GRAYBOX_BUILD__: JSON.stringify(value)}});
    return (await import(`data:text/javascript,${encodeURIComponent(out.outputFiles[0].text)}`)).PAGE_BUILD;
  };
  assert.equal(await pageBuild("0123456789ab"), "0123456789ab");
  assert.equal(await pageBuild("0123456789ab+local"), "0123456789ab+local");
  assert.equal(await pageBuild(null), null);
  assert.equal(await pageBuild("/Users/someone"), null);
});
