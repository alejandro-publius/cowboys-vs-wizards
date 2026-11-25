// Step 2 traceability (scripts/trace.mjs): every existing spec style, CARD EARS IDs, and what counts
// as proof. Fixtures are inline strings or a temporary root; trace.mjs never reads this file (SELF_TEST).
import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import {CARD_ID, SELF_TEST, namedTests, parseBugfix, parseSpec, trace} from "../../scripts/trace.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCRIPT = join(ROOT, "scripts", "trace.mjs");
const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], {encoding: "utf8"});
const lineOf = (text, needle) => text.split("\n").findIndex((l) => l.includes(needle)) + 1;
const clause = (report, key) => report.clauses.find((c) => c.key === key);

// One fixture per style already used in .kiro/specs, plus sections that must not produce clauses.
const MIXED_PATH = ".kiro/specs/mixed/requirements.md";
const MIXED = `# Requirements: mixed fixture

| ID | Requirement | Check |
| --- | --- | --- |
| MX-1 | WHEN a batch holds a clash, THE log SHALL return lines. | test 1 |

- **MX2.** When a player stops the reel, the gallery shall clear.

## Glossary
- R9 is a glossary line, not a clause.

## Requirements

### R1 Card size
1. WHEN shown at 1280px, THE art SHALL be 180px wide.
2. WHEN shown at 390px, THE art SHALL be 150px wide.

### R5 Desktop layout
WHEN at 1280px, THE catalog SHALL be visible.

### Requirement 2: Card Selection

**User Story:** As a player, I want to select a card.

#### Acceptance Criteria

1. THE Card_UI SHALL display the deck count.
2. WHEN the player clicks a card, THE Card_UI SHALL mark it
   selected and unmark any other card.

## Requirement FH-R3: The save is joined

1. A new profile SHALL load as \`newSave()\`.

## Normative requirements

- NSB-9: Each faction's win share SHALL be within 45% to 55%.
- **G4 Public payload.** The page carries only the verified setup.
  No outcome reaches the page.

R7 One zone per side. Each side has one trap zone.
   A second set is rejected.

1. First-brief diagnosis. The agent states its diagnosis first.

## Decisions
- D1 Rejection reasons reuse \`summon-used\`.

## Measurement
2. NSB-9 is checked on both shares.

| Req | Proof | Status |
| --- | --- | --- |
| G4 | same test | passed |

## Asset Gaps
#### Acceptance Criteria
1. THE renderer SHALL show a labelled stand-in.

\`\`\`text
- NSB-77: a fenced example SHALL NOT be a clause.
\`\`\`
`;

const CARDS_PATH = ".kiro/specs/cards/requirements.md";
const CARDS = `# Card rules

## Billy
- CARD-COWBOY-BILLY-01: WHEN Billy is summoned, THE engine SHALL give him 3 health.
- **CARD-COWBOY-BILLY-02** WHILE Billy guards, THE engine SHALL halve lane damage.

## Dragon
| ID | Requirement | Proof |
| --- | --- | --- |
| CARD-WIZARD-DRAGON-01 | WHEN the Dragon attacks, THE engine SHALL burn the lane. | property |

### CARD-WIZARD-DRAGON-02 Fire spread
IF the lane is empty, THEN THE engine SHALL burn the Base.

## Mistakes
- CARD-COWBOY-BILLY-1: WHEN Billy is summoned, THE engine SHALL draw.
- CARD-OUTLAW-BILLY-01: WHEN an outlaw is summoned, THE engine SHALL draw.
- CARD-COWBOY-SHERIFF-01: The Sheriff has 3 health.
`;

test("every existing spec style is indexed under its own ID, and non-requirement sections are not", () => {
  const spec = parseSpec(MIXED_PATH, MIXED);
  assert.deepEqual(spec.clauses.map((c) => [c.key, c.style]), [
    ["MX-1", "table"], ["MX2", "list"],
    ["mixed/R1.1", "numbered"], ["mixed/R1.2", "numbered"], ["mixed/R5", "heading"],
    ["mixed/2.1", "numbered"], ["mixed/2.2", "numbered"], ["FH-R3.1", "numbered"],
    ["NSB-9", "list"], ["mixed/G4", "list"], ["mixed/R7", "paragraph"], ["mixed/1", "numbered"],
  ]);
  assert.deepEqual(spec.styles, ["table", "list", "numbered", "heading", "paragraph"]);
  assert.equal(clause(spec, "MX-1").line, lineOf(MIXED, "| MX-1 |"));
  assert.equal(clause(spec, "mixed/R5").line, lineOf(MIXED, "### R5"));
  assert.equal(clause(spec, "mixed/R5").text, "Desktop layout WHEN at 1280px, THE catalog SHALL be visible.");
  assert.equal(clause(spec, "mixed/2.2").text, "WHEN the player clicks a card, THE Card_UI SHALL mark it selected and unmark any other card.");
  assert.equal(clause(spec, "mixed/G4").text, "Public payload. The page carries only the verified setup. No outcome reaches the page.");
  assert.equal(clause(spec, "mixed/R7").text, "One zone per side. Each side has one trap zone. A second set is rejected.");
  assert.deepEqual(spec.problems, [{at: `${MIXED_PATH}:${lineOf(MIXED, "labelled stand-in")}`,
    kind: "unidentified-normative", detail: "1. THE renderer SHALL show a labelled stand-in."}]);
  assert.deepEqual(parseSpec(".kiro/specs/prose/requirements.md", "# Notes\n\nThe engine is pure.\n").problems,
    [{at: ".kiro/specs/prose/requirements.md:1", kind: "no-clauses", detail: "no numbered requirement clause recognized"}]);
});

test("CARD EARS IDs are clauses in any section and in list, table or heading form; bad ones are reported", () => {
  assert.ok(CARD_ID.test("CARD-COWBOY-BILLY-01") && CARD_ID.test("CARD-WIZARD-DRAGON-01"));
  const spec = parseSpec(CARDS_PATH, CARDS);
  assert.deepEqual(spec.clauses.map((c) => [c.key, c.style]), [
    ["CARD-COWBOY-BILLY-01", "list"], ["CARD-COWBOY-BILLY-02", "list"], ["CARD-WIZARD-DRAGON-01", "table"],
    ["CARD-WIZARD-DRAGON-02", "heading"], ["CARD-COWBOY-SHERIFF-01", "list"],
  ]);
  assert.equal(clause(spec, "CARD-COWBOY-BILLY-02").text, "WHILE Billy guards, THE engine SHALL halve lane damage.");
  assert.equal(clause(spec, "CARD-WIZARD-DRAGON-02").text, "Fire spread IF the lane is empty, THEN THE engine SHALL burn the Base.");
  assert.deepEqual(spec.problems.map((p) => [p.at, p.kind, p.detail]), [
    [`${CARDS_PATH}:${lineOf(CARDS, "BILLY-1:")}`, "malformed-id", "CARD-COWBOY-BILLY-1"],
    [`${CARDS_PATH}:${lineOf(CARDS, "OUTLAW")}`, "malformed-id", "CARD-OUTLAW-BILLY-01"],
    [`${CARDS_PATH}:${lineOf(CARDS, "SHERIFF")}`, "not-ears", "CARD-COWBOY-SHERIFF-01 has no SHALL response"],
  ]);
});

const VALID_TESTS = [
  'import test from "node:test";',
  'import assert from "node:assert/strict";',
  'import fc from "fast-check";',
  'const QUOTES = /["\'`]/g; // a regex literal holding quotes must not derail the lexer',
  'test("CARD-COWBOY-BILLY-01: Billy enters with 3 health", () => {',
  "  assert.equal(3, 3);",
  "});",
  "test(`CARD-WIZARD-DRAGON-01 burns every occupied lane`, () => {",
  "  fc.assert(fc.property(fc.integer(), (n) => n === n));",
  "});",
  'test("mixed/R1.1 and mixed/2.2 hold at 1280px", () => assert.ok(QUOTES));',
  'test("CARD-COWBOY-BILLY-012 and CARD-COWBOY-BILLY-01x are different tokens", () => assert.ok(true));',
  'test("R1.1 alone names no spec", () => assert.ok(true));',
  'test("CARD-COWBOY-DEADEYE-01 has no requirement yet", () => assert.ok(true));',
].join("\n");

test("a distinct test or fast-check property title proves exactly the clause it names", () => {
  const report = trace({specs: [{path: MIXED_PATH, text: MIXED}, {path: CARDS_PATH, text: CARDS}],
    tests: [{path: "tests/cards.test.js", text: VALID_TESTS}]});
  assert.deepEqual(clause(report, "CARD-COWBOY-BILLY-01").refs,
    [{at: "tests/cards.test.js:5", title: "CARD-COWBOY-BILLY-01: Billy enters with 3 health", kind: "test"}]);
  assert.deepEqual(clause(report, "CARD-WIZARD-DRAGON-01").refs,
    [{at: "tests/cards.test.js:8", title: "CARD-WIZARD-DRAGON-01 burns every occupied lane", kind: "property"}]);
  for (const key of ["mixed/R1.1", "mixed/2.2"]) assert.deepEqual(clause(report, key).refs.map((r) => r.at), ["tests/cards.test.js:11"]);
  assert.ok(report.orphans.includes("CARD-COWBOY-BILLY-02"), "a longer or suffixed token is not BILLY-02 or BILLY-01");
  assert.deepEqual(report.unresolved.map((u) => [u.at, u.token, u.reason, u.candidates]), [
    ["tests/cards.test.js:12", "CARD-COWBOY-BILLY-012", "unknown-id", undefined],
    ["tests/cards.test.js:13", "R1.1", "unqualified", ["mixed/R1.1"]],
    ["tests/cards.test.js:14", "CARD-COWBOY-DEADEYE-01", "unknown-id", undefined],
  ]);
  assert.deepEqual(report.duplicates, []);
});

test("a duplicate ID is reported at every file:line and proves nothing", () => {
  const a = ".kiro/specs/a/requirements.md", b = ".kiro/specs/b/requirements.md";
  const report = trace({
    specs: [
      {path: a, text: "# Requirements: a\n\n- CARD-COWBOY-BILLY-01: WHEN Billy is summoned, THE engine SHALL give him 3 health.\n"},
      {path: b, text: "# Requirements: b\n\n## Requirements\n\n### R1 Size\n1. THE art SHALL be wide.\n1. THE art SHALL be tall.\n\n- CARD-COWBOY-BILLY-01: WHEN Billy is summoned, THE engine SHALL give him 4 health.\n"},
    ],
    tests: [{path: "tests/billy.test.js", text: 'test("CARD-COWBOY-BILLY-01 Billy enters", () => assert.ok(true));'}],
  });
  assert.deepEqual(report.duplicates, [
    {key: "CARD-COWBOY-BILLY-01", at: [`${a}:3`, `${b}:9`]},
    {key: "b/R1.1", at: [`${b}:6`, `${b}:7`]},
  ]);
  assert.deepEqual(report.unresolved, [{at: "tests/billy.test.js:1", title: "CARD-COWBOY-BILLY-01 Billy enters",
    token: "CARD-COWBOY-BILLY-01", reason: "ambiguous", candidates: [`${a}:3`, `${b}:9`]}]);
  assert.ok(report.clauses.every((c) => c.refs.length === 0));
  assert.deepEqual(report.orphans, ["CARD-COWBOY-BILLY-01", "b/R1.1"]);
});

const SPOOFS = [
  'import test, {describe, it} from "node:test";',
  'import assert from "node:assert/strict";',
  "// CARD-COWBOY-BILLY-01 is covered by the suite below",
  "/*",
  'test("CARD-COWBOY-BILLY-01 hidden in a block comment", () => { assert.ok(true); });',
  "*/",
  'const template = `test("CARD-COWBOY-BILLY-01 inside a template", () => { assert.ok(true); });`;',
  "const quoted = 'test(\"CARD-COWBOY-BILLY-01 inside a string\", () => { assert.ok(true); })';",
  'const IDS = ["CARD-COWBOY-BILLY-01"];',
  "for (const id of IDS) test(id, () => assert.ok(id));",
  "for (const id of IDS) test(`${id} generated from an array`, () => assert.ok(id));",
  'test("CARD-COWBOY-" + "BILLY-01 concatenated", () => assert.ok(true));',
  'test(["CARD-COWBOY-BILLY-01"].join(" "), () => assert.ok(true));',
  'assert.ok(/CARD-COWBOY-BILLY-01/.test("CARD-COWBOY-BILLY-01"));',
  'test.skip("CARD-COWBOY-BILLY-01 skipped", () => assert.ok(true));',
  'test.todo("CARD-COWBOY-BILLY-01 todo");',
  'test("CARD-COWBOY-BILLY-01 skipped by option", {skip: "not ready"}, () => assert.ok(true));',
  'describe.skip("a skipped suite", () => { it("CARD-COWBOY-BILLY-01 in a skipped suite", () => assert.ok(true)); });',
  'test("CARD-COWBOY-BILLY-01 with an empty body", () => {});',
  'test("CARD-COWBOY-BILLY-01 with an empty function", function () { /* nothing */ });',
  'test("CARD-COWBOY-BILLY-01 without a callback");',
].join("\n");

test("comments, strings, generated titles, skipped, empty and callback-less tests leave the clause without proof", () => {
  const report = trace({specs: [{path: CARDS_PATH, text: CARDS}], tests: [{path: "tests/spoof.test.js", text: SPOOFS}]});
  assert.deepEqual(clause(report, "CARD-COWBOY-BILLY-01").refs, []);
  assert.ok(report.orphans.includes("CARD-COWBOY-BILLY-01"));
  const at = (needle) => `tests/spoof.test.js:${lineOf(SPOOFS, needle)}`;
  assert.deepEqual(report.unresolved.map((u) => [u.at, u.token, u.reason]), [
    [at("01 skipped\""), "CARD-COWBOY-BILLY-01", "skipped"],
    [at("01 todo"), "CARD-COWBOY-BILLY-01", "skipped"],
    [at("skipped by option"), "CARD-COWBOY-BILLY-01", "skipped"],
    [at("in a skipped suite"), "CARD-COWBOY-BILLY-01", "skipped"],
    [at("empty body"), "CARD-COWBOY-BILLY-01", "empty-test"],
    [at("empty function"), "CARD-COWBOY-BILLY-01", "empty-test"],
    [at("without a callback"), "CARD-COWBOY-BILLY-01", "no-callback"],
  ]);
  // The only accepted named test is the generated one, whose static title text carries no ID.
  assert.deepEqual(namedTests(SPOOFS).filter((t) => !t.rejected).map((t) => t.title), ["\0 generated from an array"]);
});

test("the CLI gates a required prefix, reports duplicates, ignores design, tasks, manifests and fixtures", (t) => {
  const root = mkdtempSync(join(tmpdir(), "dec4-trace-"));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  const write = (path, text) => { mkdirSync(dirname(join(root, path)), {recursive: true}); writeFileSync(join(root, path), text); };
  const proof = (id) => `import test from "node:test";\nimport assert from "node:assert/strict";\ntest("${id} is proven here", () => assert.ok(true));\n`;
  write(CARDS_PATH, "# Requirements: cards\n\n- CARD-COWBOY-BILLY-01: WHEN Billy is summoned, THE engine SHALL give him 3 health.\n- CARD-WIZARD-DRAGON-01: WHEN the Dragon attacks, THE engine SHALL burn the lane.\n");
  write(".kiro/specs/cards/design.md", "Property 1 validates CARD-WIZARD-DRAGON-01.\n");
  write(".kiro/specs/cards/tasks.md", "- [x] 1. Dragon fire\n  _Requirements: CARD-WIZARD-DRAGON-01_\n");
  write("docs/requirement-test-map.json", JSON.stringify({"CARD-WIZARD-DRAGON-01": "tests/dragon.test.js"}));
  write(SELF_TEST, proof("CARD-WIZARD-DRAGON-01"));
  write("tests/fixtures/dragon.test.js", proof("CARD-WIZARD-DRAGON-01"));
  write("tests/billy.test.js", proof("CARD-COWBOY-BILLY-01"));

  const missing = run("--root", root, "--json", "--require", "CARD-");
  assert.equal(missing.status, 1, missing.stderr);
  const report = JSON.parse(missing.stdout);
  assert.deepEqual(clause(report, "CARD-COWBOY-BILLY-01").refs.map((r) => r.at), ["tests/billy.test.js:3"]);
  assert.deepEqual(report.orphans, ["CARD-WIZARD-DRAGON-01"]);
  assert.deepEqual(report.required, {prefixes: ["CARD-"], missing: ["CARD-WIZARD-DRAGON-01"], unmatched: []});
  assert.deepEqual([report.duplicates, report.problems, report.unresolved], [[], [], []]);

  write("tests/dragon.test.js", proof("CARD-WIZARD-DRAGON-01"));
  const proven = run("--root", root, "--require", "CARD-");
  assert.equal(proven.status, 0, proven.stdout);
  assert.match(proven.stdout, /^trace: specs 1, clauses 2, proven by a named test 2, orphan IDs 0$/m);
  assert.match(proven.stdout, /^required CARD-: all proven$/m);
  const unmatched = run("--root", root, "--json", "--require", "CARD-WIZARD-LICH-");
  assert.equal(unmatched.status, 1);
  assert.deepEqual(JSON.parse(unmatched.stdout).required.unmatched, ["CARD-WIZARD-LICH-"]);

  write(".kiro/specs/more/requirements.md", "# Requirements: more\n\n- CARD-WIZARD-DRAGON-01: WHEN the Dragon lands, THE engine SHALL shake the board.\n");
  const duplicate = run("--root", root, "--json");
  assert.equal(duplicate.status, 1);
  assert.deepEqual(JSON.parse(duplicate.stdout).duplicates,
    [{key: "CARD-WIZARD-DRAGON-01", at: [`${CARDS_PATH}:4`, ".kiro/specs/more/requirements.md:3"]}]);
  assert.equal(run("--bogus").status, 2);
  assert.equal(run("--root", join(root, "missing")).status, 2);
});

test("the retired orb-duel spec and the balance contract index exactly as their text reads", () => {
  const read = (path) => parseSpec(path, readFileSync(join(ROOT, path), "utf8"));
  const orb = read(".kiro/specs/orb-duel/requirements.md");
  assert.equal(orb.clauses.length, 90);
  assert.deepEqual([orb.clauses[0].key, orb.clauses[83].key], ["orb-duel/1.1", "orb-duel/12.9"]);
  assert.deepEqual(orb.clauses.slice(84).map((c) => c.key),
    ["orb-duel/13.1", "orb-duel/13.2", "orb-duel/13.3", "orb-duel/13.4", "orb-duel/13.5", "orb-duel/13.6"]);
  assert.deepEqual(orb.problems, []);
  const contract = read(".kiro/specs/night-shift-balance-contract/requirements.md");
  assert.deepEqual(contract.clauses.map((c) => c.key), ["NSB-1", "NSB-2"]);
  assert.deepEqual(contract.problems, []);
});

// The Kiro IDE bugfix layout, as in .kiro/specs/showdown-bear-trap-log/bugfix.md, plus three mistakes.
const BUGFIX_PATH = ".kiro/specs/fix/bugfix.md";
const BUGFIX = `# Bugfix Requirements Document

## Introduction

The approved fix: the log SHALL say "defeated" when no orbs are left.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a trap defeats a troop THEN the system shows "cancelled"

### Expected Behavior (Correct)

2.1 WHEN a trap defeats a troop THEN the system SHALL show "defeated"
    in the trap line.

2.2 WHEN any trap event has 0 orbs left THEN the system SHALL check that before \`stopped\`

- THE log SHALL also flash.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a Hex springs THEN the system SHALL CONTINUE TO show "cancelled"

2.9 WHEN a Hex springs THEN the system SHALL CONTINUE TO name the Hex

3.2 WHEN any other event is shown THEN the system shows the same text

\`\`\`text
3.3 WHEN fenced THEN the system SHALL be ignored
\`\`\`
`;

test("a native Kiro bugfix spec indexes its Expected (2.N) and Unchanged (3.N) clauses; defect lines and the introduction are context", () => {
  const spec = parseBugfix(BUGFIX_PATH, BUGFIX);
  assert.deepEqual(spec.clauses.map((c) => [c.key, c.style, c.line]), [
    ["fix/2.1", "bugfix", lineOf(BUGFIX, "2.1 WHEN")], ["fix/2.2", "bugfix", lineOf(BUGFIX, "2.2 WHEN")],
    ["fix/3.1", "bugfix", lineOf(BUGFIX, "3.1 WHEN")], ["fix/3.2", "bugfix", lineOf(BUGFIX, "3.2 WHEN")],
  ]);
  assert.equal(clause(spec, "fix/2.1").text, 'WHEN a trap defeats a troop THEN the system SHALL show "defeated" in the trap line.');
  assert.deepEqual(spec.problems.map((p) => [p.at, p.kind]), [
    [`${BUGFIX_PATH}:${lineOf(BUGFIX, "also flash")}`, "unidentified-normative"],
    [`${BUGFIX_PATH}:${lineOf(BUGFIX, "2.9 WHEN")}`, "malformed-id"],
    [`${BUGFIX_PATH}:${lineOf(BUGFIX, "3.2 WHEN")}`, "not-ears"],
  ]);
  assert.deepEqual(parseBugfix(BUGFIX_PATH, "# Bugfix\n\n## Defect\n\n1. The focus moves. It SHALL stay.\n").problems.map((p) => p.kind), ["no-clauses"]);
  const report = trace({specs: [{path: BUGFIX_PATH, text: BUGFIX}],
    tests: [{path: "tests/fix.test.js", text: 'test("fix/2.1 fix/3.1 the fatal line reads defeated", () => assert.ok(true));\ntest("fix/1.1 is context, not a clause", () => assert.ok(true));'}]});
  assert.deepEqual(report.clauses.filter((c) => c.refs.length).map((c) => c.key), ["fix/2.1", "fix/3.1"]);
  assert.deepEqual(report.unresolved.map((u) => [u.token, u.reason]), [["fix/1.1", "unknown-id"]]);
});

test("the CLI reads bugfix.md only where .config.kiro declares a bugfix spec, and fails closed on broken metadata", (t) => {
  const root = mkdtempSync(join(tmpdir(), "dec4-trace-bugfix-"));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  const write = (path, text) => { mkdirSync(dirname(join(root, path)), {recursive: true}); writeFileSync(join(root, path), text); };
  const clauses = "## Expected Behavior\n\n2.1 WHEN it breaks THEN the system SHALL recover\n\n## Unchanged Behavior\n\n3.1 WHEN it works THEN the system SHALL CONTINUE TO work\n";
  write(".kiro/specs/native/.config.kiro", JSON.stringify({specId: "x", workflowType: "requirements-first", specType: "bugfix"}));
  write(".kiro/specs/native/bugfix.md", `# Bugfix Requirements Document\n\n${clauses}`);
  write(".kiro/specs/by-hand/bugfix.md", `# Bugfix written by hand\n\n${clauses}`);
  write(".kiro/specs/feature/.config.kiro", JSON.stringify({specType: "feature"}));
  write(".kiro/specs/feature/requirements.md", "# Requirements: feature\n\n- NSB-1: THE gate SHALL hold.\n");
  write(".kiro/specs/feature/bugfix.md", `# Not read\n\n${clauses}`);
  write("tests/native.test.js", 'import test from "node:test";\nimport assert from "node:assert/strict";\ntest("native/2.1 recovers", () => assert.ok(true));\n');

  const partial = run("--root", root, "--json", "--require", "native/");
  assert.equal(partial.status, 1, partial.stderr);
  const report = JSON.parse(partial.stdout);
  assert.deepEqual(report.specs.map((s) => s.file), [".kiro/specs/feature/requirements.md", ".kiro/specs/native/bugfix.md"]);
  assert.deepEqual(report.required, {prefixes: ["native/"], missing: ["native/3.1"], unmatched: []});
  assert.deepEqual([report.duplicates, report.problems, report.unresolved], [[], [], []]);

  write("tests/native-kept.test.js", 'import test from "node:test";\nimport assert from "node:assert/strict";\ntest("native/3.1 keeps working", () => assert.ok(true));\n');
  const proven = run("--root", root, "--require", "native/");
  assert.equal(proven.status, 0, proven.stdout);
  assert.match(proven.stdout, /^required native\/: all proven$/m);

  rmSync(join(root, ".kiro/specs/native/bugfix.md"));
  const missing = run("--root", root);
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /native\/\.config\.kiro declares a bugfix spec but bugfix\.md is missing/);
  write(".kiro/specs/native/.config.kiro", "{specType: bugfix");
  const broken = run("--root", root);
  assert.equal(broken.status, 2);
  assert.match(broken.stderr, /native\/\.config\.kiro is not readable JSON/);
});

test("the shipped Bear Trap log decision's native bugfix spec is indexed from this checkout and linked to its tests", () => {
  const config = JSON.parse(readFileSync(join(ROOT, ".kiro/specs/showdown-bear-trap-log/.config.kiro"), "utf8"));
  assert.equal(config.specType, "bugfix");
  const report = JSON.parse(run("--json").stdout);
  const spec = report.specs.find((s) => s.file === ".kiro/specs/showdown-bear-trap-log/bugfix.md");
  assert.deepEqual(spec && [spec.clauses, spec.styles], [8, ["bugfix"]]);
  assert.deepEqual(report.problems.filter((p) => p.at.startsWith(".kiro/specs/showdown-bear-trap-log/")), []);
  for (const id of ["2.1", "2.2", "3.1", "3.2", "3.3", "3.4", "3.6"]) {
    const refs = clause(report, `showdown-bear-trap-log/${id}`)?.refs ?? [];
    assert.ok(refs.some((r) => r.at.startsWith("tests/game/showdown-bear-trap.test.js:")), `showdown-bear-trap-log/${id} has no linked test`);
  }
  assert.ok(clause(report, "CARD-COWBOY-BEAR-TRAP-14").refs.some((r) => r.at.startsWith("tests/game/showdown-bear-trap.test.js:")));
});

test("the CLI reads this checkout and never takes evidence from its own fixtures", () => {
  const result = run("--json");
  assert.ok([0, 1].includes(result.status), result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.summary.clauses, report.clauses.length);
  assert.ok(report.specs.some((s) => s.file === ".kiro/specs/orb-duel/requirements.md"));
  const cited = [...report.clauses.flatMap((c) => c.refs.map((r) => r.at)), ...report.unresolved.map((u) => u.at)];
  assert.ok(cited.every((at) => !at.startsWith(`${SELF_TEST}:`) && !at.includes("/fixtures/")));
});
