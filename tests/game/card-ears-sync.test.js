import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";

const script = "scripts/sync-card-specs.mjs";
const cards = ".kiro/specs/duel-card-pipeline/cards";
const catalog = "src/game/card-specs.generated.js";

test("CARD-WIZARD-BONE-WALL-02 CARD-WIZARD-LANTERN-WRAITH-02: card sync accepts zero attack and enforces the bounty fields", (t) => {
  const root = mkdtempSync(join(tmpdir(), "cvw-card-sync-"));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  for (const path of [script, cards, catalog]) {
    cpSync(new URL("../../" + path, import.meta.url), join(root, path), {recursive: true});
  }
  const check = () => spawnSync(process.execPath, [script, "--check"], {cwd: root, encoding: "utf8"});
  const original = check();
  assert.equal(original.status, 0, original.stderr);
  for (const [card, change, diagnostic] of [
    ["wizard-bone-wall", {attack: -1}, "attack must be a non-negative integer"],
    ["wizard-lantern-wraith", {copies: 1}, "a bounty card must be a troop with zero starter copies"],
    ["wizard-lantern-wraith", {kind: "spell"}, "a bounty card must be a troop with zero starter copies"],
    ["wizard-lantern-wraith", {limit: 1}, "a bounty card has a fixed limit of one"],
  ]) {
    const file = join(root, cards, card + ".json");
    const valid = readFileSync(file, "utf8");
    writeFileSync(file, JSON.stringify({...JSON.parse(valid), ...change}));
    const invalid = check();
    assert.equal(invalid.status, 1, invalid.stderr);
    assert.ok(invalid.stderr.includes(card + ".json: " + diagnostic), invalid.stderr);
    writeFileSync(file, valid);
  }
});
