import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {mkdtempSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {COWBOY_CATALOG, DEFAULT_COUNTS} from "../../src/game/deck-builder.js";

const script = fileURLToPath(new URL("../../scripts/screen-cowboy-decks.mjs", import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "screen-decks-"));
test.after(() => rmSync(dir, {recursive: true, force: true}));

const run = (...args) => spawnSync(process.execPath, [script, ...args], {encoding: "utf8"});
const write = (name, body) => {
  const path = join(dir, name);
  writeFileSync(path, typeof body === "string" ? body : JSON.stringify(body));
  return path;
};
const starter = DEFAULT_COUNTS;

test("starter-as-candidate matches the baseline exactly", () => {
  const result = run("--candidate", write("starter.json", starter), "--from", "72000", "--count", "4");
  assert.equal(result.status, 0, result.stderr);
  const {rows, seeds} = JSON.parse(result.stdout);
  assert.deepEqual(seeds, {from: 72000, count: 4});
  assert.equal(rows.length, 4);
  for (const cpu of ["normal", "hard"]) {
    const [stock, candidate] = rows.filter((row) => row.cpu === cpu);
    assert.equal(stock.name, "stock");
    assert.equal(candidate.name, "candidate");
    const {name: _a, ...a} = stock;
    const {name: _b, ...b} = candidate;
    assert.deepEqual(b, a);
    assert.equal(typeof a.successfulSpells, "number");
    assert.equal("successfulDeadeyes" in a, false);
    assert.equal(a.wins + a.losses + a.draws, 8);
    assert.equal(a.meanRounds, a.rounds / 8);
  }
});

test("illegal or malformed candidates fail before simulation", () => {
  const bad = {
    "not json": "{nope",
    "wrong total": {...starter, [COWBOY_CATALOG[0].type]: 5},
    "unknown type": {...starter, "cowboy-nobody": 1},
    "fractional": {...starter, [COWBOY_CATALOG[0].type]: 5.5, [COWBOY_CATALOG[1].type]: 3.5},
    "array": [6, 3, 1, 2],
    "no sheriff": {...starter, "cowboy-sheriff": 0, "cowboy-billy": 6, "cowboy-mounted-billy": 4},
  };
  for (const [name, body] of Object.entries(bad)) {
    const result = run("--candidate", write("bad.json", body), "--count", "1");
    assert.notEqual(result.status, 0, name);
    assert.equal(result.stdout, "", name);
    assert.match(result.stderr, /screen-cowboy-decks/, name);
  }
  assert.notEqual(run("--candidate").status, 0);
  assert.notEqual(run("--count", "2").status, 0);
  const tooMany = run("--candidate", write("starter2.json", starter), "--count", "1025");
  assert.notEqual(tooMany.status, 0);
  assert.equal(tooMany.stdout, "");
  assert.match(tooMany.stderr, /1024/);
  const invalidRange = run("--candidate", write("starter3.json", starter), "--from", "4294967295", "--count", "2");
  assert.notEqual(invalidRange.status, 0);
  assert.equal(invalidRange.stdout, "");
  assert.match(invalidRange.stderr, /unsigned 32-bit/);
});
