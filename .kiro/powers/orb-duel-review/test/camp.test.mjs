// Run: node --test .kiro/powers/orb-duel-review/test/camp.test.mjs
// The Camp-routed case on throwaway git copies of the game's gate, engine and decision files, with stand-in pages that
// carry (or lack) the build label and the case entry. The real built page is checked in the browser, not here.
import test from "node:test";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {appendFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import {inspectRideDecision} from "../ride.mjs";
import {minified} from "../camp.mjs";

const plugin = join(dirname(fileURLToPath(import.meta.url)), "..");
const repo = join(plugin, "../../../");
const ID = "outrider-camp-case";
const tmp = mkdtempSync(join(tmpdir(), "orb-camp-"));
const COPY = ["package.json", "src", "scripts/outrider-gate.mjs", "scripts/graybox-build-label.mjs", "experiments/showdown-outrider",
  "docs/evidence/outrider-gate/receipt.json"];
const git = (cwd, ...args) => execFileSync("git", args, {cwd, encoding: "utf8"}).trim();
const replay = JSON.parse(readFileSync(join(repo, "experiments/showdown-outrider/decision/replay.json"), "utf8"))["case-e"];
const entry = minified({id: "case-e", setup: {wins: 2}, seed: replay.seed, prefix: replay.prefix, at: replay.at});

function project(name) {
  const root = join(tmp, name) + "/";
  for (const rel of COPY) { mkdirSync(dirname(join(root, rel)), {recursive: true}); cpSync(join(repo, rel), join(root, rel), {recursive: true}); }
  git(root, "init", "-q"); git(root, "add", "-A"); git(root, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "copy");
  return root;
}
const commit = (root) => { git(root, "add", "-A"); git(root, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "edit"); };
function page(root, {label = git(root, "rev-parse", "HEAD").slice(0, 12), withCase = true} = {}) {
  for (const rel of ["dist/web/index.html", "dist/cowboys-vs-wizards-board-duel.html"]) {
    mkdirSync(dirname(join(root, rel)), {recursive: true});
    writeFileSync(join(root, rel), `<script>var b="${label}",v=[${withCase ? entry : ""}];</script>`);
  }
}
test.after(() => rmSync(tmp, {recursive: true, force: true}));

test("current page at this head: link, separate judge-only lines for both choices, example-only advice", {timeout: 60000}, async () => {
  const root = project("pass"); page(root);
  const out = await inspectRideDecision(root, ID);
  assert.equal(out.verdict, "pass", JSON.stringify(out.reasons));
  assert.equal(out.game.sourceLabel, git(root, "rev-parse", "HEAD").slice(0, 12));
  assert.match(out.links.local.url, /^http:\/\/127\.0\.0\.1:47391\/\?outrider=case-e$/);
  assert.equal(out.links.public.url, "https://alejandro-publius.github.io/cowboys-vs-wizards/?outrider=case-e");
  assert.deepEqual([out.judgeOnly.ride.winner, out.judgeOnly.decline.winner], ["wizard", "cowboy"]);
  assert.deepEqual([out.advice.allowed, out.advice.scope, out.advice.general], [true, "this example only", false]);
  assert.match(out.advice.generalReason, /failed its holdout/);
  const text = JSON.stringify(out);
  assert.ok(!/"seed"|"prefix"|case-[a-df-j]"/.test(text), "no seed, prefix or other case");
  assert.ok(!/winner/.test(JSON.stringify(out.decision)), "the position carries no outcome");
  assert.ok(!["hand", "deck", "traps"].some((k) => k in out.decision.position.sides.wizard));
});

for (const [name, setup, pattern] of [
  ["a page built at an older commit", (root) => { page(root); appendFileSync(join(root, "src/app.js"), "\n// later\n"); commit(root); }, /was not built from/],
  ["a page without this case", (root) => page(root, {withCase: false}), /does not carry this case/],
  ["no built page", () => {}, /absent: run/],
  ["uncommitted page sources", (root) => { page(root); appendFileSync(join(root, "src/app.js"), "\n// dirty\n"); }, /uncommitted page sources/],
]) {
  test(`${name}: stale, no link, no outcome, no advice`, {timeout: 60000}, async () => {
    const root = project(name.replace(/\W+/g, "-")); setup(root);
    const out = await inspectRideDecision(root, ID);
    assert.equal(out.verdict, "stale");
    assert.ok(out.reasons.some((r) => pattern.test(r)), JSON.stringify(out.reasons));
    assert.equal(out.links.local, null);
    assert.equal(out.judgeOnly, null);
    assert.equal(out.advice.allowed, false);
  });
}

test("a gameplay mutation (ride strike 1 -> 2 orbs) is stale even on a page rebuilt at the new head", {timeout: 60000}, async () => {
  const root = project("mutation");
  const rules = join(root, "src/game/showdown/rules.js");
  writeFileSync(rules, readFileSync(rules, "utf8").replace("enemy.board.some(Boolean) ? 1 : attack", "enemy.board.some(Boolean) ? 2 : attack"));
  commit(root); page(root);
  const out = await inspectRideDecision(root, ID);
  assert.equal(out.verdict, "stale");
  assert.ok(out.reasons.some((r) => /^gate:/.test(r)));
  assert.equal(out.judgeOnly, null);
  assert.equal(out.advice.allowed, false);
});

test("an unrelated committed edit with a page rebuilt at the new head stays pass (negative control)", {timeout: 60000}, async () => {
  const root = project("unrelated");
  appendFileSync(join(root, "src/game/showdown/rules.js"), "\n// comment only\n");
  commit(root); page(root);
  assert.equal((await inspectRideDecision(root, ID)).verdict, "pass");
});
