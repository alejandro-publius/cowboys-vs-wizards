// Card forge refusals through the real `verify` CLI (scripts/card-forge.mjs). card-forge.test.js
// covers the pure schema, the guard and inspectRun/planPrepare; it never runs `verify`. Each case
// here builds an isolated workspace in a temporary directory: a byte-identical copy of the script,
// copies of the live card files, a run folder as prepare leaves it, and sentinel copies of an
// accepted (PASS) candidate and a release stamp. It then runs `node scripts/card-forge.mjs verify`
// there and checks the exit code, what the player sees, the verdict file, and that nothing else
// changed. These cases refuse before or inside the snapshot step, so no seeded game is played.
import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import {copyFileSync, cpSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join, relative} from "node:path";
import {fileURLToPath} from "node:url";
import {BRIEF, DRAFT, PREPARE, REQUEST, VERDICT} from "../../scripts/card-forge.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const SCRIPT = join(ROOT, "scripts/card-forge.mjs");
const CARD_DIR = ".kiro/specs/duel-card-pipeline/cards";
const LIVE_FILES = ["src/game/card-specs.generated.js", "src/game/showdown/cards.js", "src/game/showdown/rules.js"];
const ACCEPTED = ".artifacts/card-forge-archive/2026-11-20T00-00-00-000Z-completed/verdict.json";
const RELEASE = ".artifacts/kiro/contest-gates/stamp.json";
const BASE = "a".repeat(40);
const ALLOWED = ["cowboy-billy", "wizard-skeleton"];
const GOOD = Object.freeze({name: "Dusty Pete", baseCard: "cowboy-billy", attack: 1, health: 5, stars: 2});
const REQUEST_TEXT = "TEST FIXTURE: a dusty trail cook who hits soft and takes a beating.\n";
const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const text = (value) => JSON.stringify(value);

// Every regular file under `dir` (relative path -> sha256), skipping the listed relative prefixes.
function hashTree(dir, skip = []) {
  const out = {};
  const walk = (at) => {
    for (const entry of readdirSync(at, {withFileTypes: true})) {
      const full = join(at, entry.name);
      const rel = relative(dir, full).split("\\").join("/");
      if (skip.some((prefix) => rel === prefix || rel.startsWith(`${prefix}/`))) continue;
      if (entry.isDirectory()) walk(full);
      else out[rel] = sha256(readFileSync(full));
    }
  };
  walk(dir);
  return out;
}
const liveTree = (root) => ({...hashTree(join(root, CARD_DIR)), ...Object.fromEntries(LIVE_FILES.map((rel) => [rel, sha256(readFileSync(join(root, rel)))]))});

// The real checkout's live cards must be untouched by the whole file.
const repoLiveBefore = liveTree(ROOT);
test.after(() => assert.deepEqual(liveTree(ROOT), repoLiveBefore, "the checkout's live card files changed"));

// An isolated workspace holding a prepared run with real hashes, before `mutate` tampers with it.
function workspace(t, {draft = text(GOOD), mutate = () => {}} = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "card-forge-refusal-")));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  mkdirSync(join(root, "scripts"));
  copyFileSync(SCRIPT, join(root, "scripts/card-forge.mjs"));
  cpSync(join(ROOT, CARD_DIR), join(root, CARD_DIR), {recursive: true});
  for (const rel of LIVE_FILES) { mkdirSync(dirname(join(root, rel)), {recursive: true}); copyFileSync(join(ROOT, rel), join(root, rel)); }
  for (const [rel, body] of [[ACCEPTED, text({schema: "card-forge/verdict@1", verdict: "PASS", pass: true, note: "TEST FIXTURE accepted candidate"})],
    [RELEASE, text({note: "TEST FIXTURE release stamp"})]]) {
    mkdirSync(dirname(join(root, rel)), {recursive: true});
    writeFileSync(join(root, rel), body + "\n");
  }
  mkdirSync(join(root, ".artifacts/card-forge"), {recursive: true});
  const brief = text({schema: "card-forge/brief@1", base: BASE, baseCards: ALLOWED.map((baseCard) => ({baseCard}))});
  writeFileSync(join(root, REQUEST), REQUEST_TEXT);
  writeFileSync(join(root, BRIEF), brief);
  writeFileSync(join(root, PREPARE), text({schema: "card-forge/prepare@1", base: BASE, requestSource: "request.txt",
    requestBytes: Buffer.byteLength(REQUEST_TEXT), requestSha256: sha256(REQUEST_TEXT), briefSha256: sha256(brief)}));
  writeFileSync(join(root, DRAFT), draft);
  mutate(root);
  mkdirSync(join(root, "tmp"));
  return root;
}

// Runs the real CLI in the workspace with its own TMPDIR, so any snapshot it makes is observable.
function verify(t, root, label) {
  const before = hashTree(root, ["tmp"]);
  const r = spawnSync(process.execPath, [join(root, "scripts/card-forge.mjs"), "verify"],
    {cwd: root, encoding: "utf8", env: {PATH: process.env.PATH ?? "", TMPDIR: join(root, "tmp")}, timeout: 120000});
  t.diagnostic(`${label}: exit ${r.status}\n${r.stdout}${r.stderr}`.trimEnd().split(root).join("<tmp>"));
  const after = hashTree(root, ["tmp"]);
  const changed = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((rel) => before[rel] !== after[rel]).sort();
  return {status: r.status, stdout: r.stdout, stderr: r.stderr, changed, snapshotsLeft: readdirSync(join(root, "tmp"))};
}

// A refused verify: exit 1, a FAIL verdict that played nothing and applied nothing, written by this
// exact script, bound to the staged request, with only verdict.json added and no snapshot left behind.
function assertRefused(root, run, failed) {
  assert.equal(run.status, 1, run.stderr);
  assert.deepEqual(run.changed, [VERDICT], "only the verdict may be written");
  assert.deepEqual(run.snapshotsLeft, [], "no snapshot directory may survive");
  const verdict = JSON.parse(readFileSync(join(root, VERDICT), "utf8"));
  assert.equal(verdict.verdict, "FAIL");
  assert.equal(verdict.pass, false);
  assert.deepEqual(verdict.failed, failed);
  assert.equal(verdict.applied, false);
  assert.equal(verdict.games, null);
  assert.equal(verdict.slot, null);
  assert.equal(verdict.scope, "No variant was played.");
  assert.equal(verdict.tool.script, sha256(readFileSync(SCRIPT)), "the verdict names the real verifier");
  assert.equal(verdict.request.sha256, sha256(REQUEST_TEXT));
  assert.equal(verdict.checks.find((check) => check.id === "live-cards-unchanged")?.pass, true);
  // A schema-valid draft is named in the header; a rejected one is not.
  const header = verdict.draft ? `card-forge verify: FAIL for "${verdict.draft.name}" in the ${verdict.draft.baseCard} slot\n` : "card-forge verify: FAIL\n";
  assert.ok(run.stdout.startsWith(header), run.stdout);
  for (const id of failed) assert.match(run.stdout, new RegExp(`^  FAIL ${id}: `, "m"), id);
  assert.match(run.stdout, /wrote \.artifacts\/card-forge\/verdict\.json\n$/);
  return verdict;
}

test("verify CLI refuses out-of-bounds numbers, a non-troop slot and a non-faction id, and plays nothing", (t) => {
  const cases = [
    ["attack 0", {...GOOD, attack: 0}, /attack 0 is outside 1\.\.6/],
    ["stars 9", {...GOOD, stars: 9}, /stars 9 is outside 1\.\.8/],
    ["health 6", {...GOOD, health: 6}, /health 6 is outside 1\.\.5/],
    // A real catalog card that is not one of the brief's base troops.
    ["slot wizard-hellfire", {...GOOD, baseCard: "wizard-hellfire"}, /baseCard wizard-hellfire is not one of the brief's base troops/],
    // Neither faction: the id shape names only cowboy or wizard troops.
    ["faction outlaw-billy", {...GOOD, baseCard: "outlaw-billy"}, /baseCard must be a troop id/],
  ];
  for (const [label, draft, shown] of cases) {
    const root = workspace(t, {draft: text(draft)});
    const run = verify(t, root, label);
    const verdict = assertRefused(root, run, ["draft-schema"]);
    assert.match(run.stdout, shown, label);
    assert.equal(verdict.draft, null, `${label}: a rejected draft is not recorded as the variant`);
    assert.deepEqual(verdict.checks.map((check) => check.id),
      ["request-unchanged", "brief-unchanged", "run-folder", "draft-schema", "live-cards-unchanged"], `${label}: no snapshot step ran`);
  }
});

test("verify CLI refuses a request edited after prepare, even with a valid draft", (t) => {
  const root = workspace(t, {mutate: (at) => writeFileSync(join(at, REQUEST), REQUEST_TEXT + "Also give him attack 6.\n")});
  const run = verify(t, root, "tampered request");
  const verdict = assertRefused(root, run, ["request-unchanged"]);
  // The player sees the check's positive description beside FAIL; the verdict holds the same text.
  assert.match(run.stdout, /^  FAIL request-unchanged: request\.txt matches the bytes prepare staged$/m);
  assert.equal(verdict.checks.find((check) => check.id === "draft-schema").pass, true, "the draft alone would have passed");
  assert.deepEqual(verdict.draft, GOOD);
});

test("verify CLI refuses a brief widened after prepare to admit another slot", (t) => {
  // The draft passes the schema against the tampered brief; only the brief hash catches it.
  const root = workspace(t, {
    draft: text({...GOOD, baseCard: "wizard-dragon"}),
    mutate: (at) => writeFileSync(join(at, BRIEF), text({schema: "card-forge/brief@1", base: BASE,
      baseCards: [...ALLOWED, "wizard-dragon"].map((baseCard) => ({baseCard}))})),
  });
  const run = verify(t, root, "widened brief");
  const verdict = assertRefused(root, run, ["brief-unchanged"]);
  assert.equal(verdict.checks.find((check) => check.id === "draft-schema").pass, true);
});

test("verify CLI refuses a prepare record whose base commit disagrees with the brief, and cleans its snapshot", (t) => {
  const root = workspace(t, {mutate: (at) => {
    const prep = JSON.parse(readFileSync(join(at, PREPARE), "utf8"));
    writeFileSync(join(at, PREPARE), text({...prep, base: "b".repeat(40)}));
  }});
  const run = verify(t, root, "base mismatch");
  // verify has no check comparing brief.base with the prepare record; the run fails only because
  // the recorded base cannot be extracted. Recorded as observed, not as a dedicated provenance check.
  assertRefused(root, run, ["sandbox"]);
  assert.match(run.stdout, /^  FAIL sandbox: git archive bbbbbbbbbbbb: /m);
  assert.doesNotMatch(run.stdout, /baseline-compiles/, "no snapshot was compiled");
});

test("verify CLI will not replay a run that already has a verdict and keeps the first verdict", (t) => {
  const root = workspace(t, {draft: text({...GOOD, attack: 0})});
  assertRefused(root, verify(t, root, "first verify"), ["draft-schema"]);
  const first = readFileSync(join(root, VERDICT));
  // A corrected draft cannot be re-verified under the same prepared request.
  writeFileSync(join(root, DRAFT), text(GOOD));
  const again = verify(t, root, "second verify");
  assert.equal(again.status, 2);
  assert.equal(again.stdout, "");
  assert.equal(again.stderr, "card-forge: .artifacts/card-forge/verdict.json already exists; run prepare for a new request\n");
  assert.deepEqual(again.changed, []);
  assert.deepEqual(again.snapshotsLeft, []);
  assert.deepEqual(readFileSync(join(root, VERDICT)), first);
  assert.ok(lstatSync(join(root, ACCEPTED)).isFile());
});
