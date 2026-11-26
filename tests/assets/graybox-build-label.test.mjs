// K-087: the graybox page's public build label, from git, carried into the bundle by scripts/build-graybox.mjs.
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {mkdir, mkdtemp, rm, writeFile} from "node:fs/promises";
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

test("local build labels follow each page's embedded artwork, decision receipt and reference screen", async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), "cvw-page-inputs-"));
  t.after(() => rm(dir, {recursive: true, force: true}));
  const git = (...args) => execFileSync("git", args, {cwd: dir, stdio: "ignore"});
  const pages = ["graybox", "illustrated", "reference"];
  const cases = [
    ["assets/scenes/showdown-title.webp", ["illustrated"]],
    ["docs/evidence/outrider-gate/receipt.json", ["graybox", "illustrated"]],
    ["prototypes/showdown/main.js", ["reference"]],
    ["src/game/showdown/rules.js", pages],
    ["README.md", []],
  ];
  git("init", "-q");
  for (const [file] of cases) {
    await mkdir(path.dirname(path.join(dir, file)), {recursive: true});
    await writeFile(path.join(dir, file), "original");
  }
  git("add", ".");
  git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "fixture");
  const clean = grayboxBuildLabel(dir);
  for (const [file, affected] of cases) {
    await writeFile(path.join(dir, file), "edited");
    for (const page of pages) assert.equal(grayboxBuildLabel(dir, page), clean + (affected.includes(page) ? "+local" : ""), file + " on " + page);
    await writeFile(path.join(dir, file), "original");
  }
});
