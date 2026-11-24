// Step 2 traceability for the Kiro specs. Indexes the numbered requirement clauses of every
// .kiro/specs/*/requirements.md and links each clause to the real node:test tests (example tests or
// fast-check property tests) whose own literal title cites its ID. Comments, strings, generated
// titles, skipped or empty tests, design/tasks files, manifests and fixtures never count.
// Accepted grammar, reference syntax and limits: docs/evidence/dec4-trace.md.
import {existsSync, readdirSync, readFileSync} from "node:fs";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const SELF_TEST = "tests/game/dec4-trace.test.js";
const SKIP_DIRS = new Set([".artifacts", ".git", "dist", "fixtures", "node_modules"]);
const TEST_FILE = /\.test\.(?:js|mjs|cjs)$/;
const USAGE = `usage: node scripts/trace.mjs [--json] [--require PREFIX]... [--root DIR]
  --json            print the report as JSON
  --require PREFIX  also fail unless every clause whose key starts with PREFIX is proven (e.g. CARD-)
  --root DIR        repository to read (default: this checkout)
exit 0 clean; 1 duplicate IDs, unsupported syntax or an unproven required clause; 2 usage or read error`;

// An ID starts with a capital and ends in a digit, with optional .N parts: CL-1, PM1, FH-R3.2, R1.1, G1.
const ID = String.raw`[A-Z](?:[A-Z0-9]|-(?=[A-Z0-9]))*\d(?:\.\d+)*`;
export const CARD_ID = /^CARD-(?:COWBOY|WIZARD)-[A-Z0-9]+(?:-[A-Z0-9]+)*-\d{2}$/;
const LEAD = new RegExp(`^(${ID})(?=[\\s:.)*_|]|$)`);
const REQ_HEADING = new RegExp(`^(?:Requirement\\s+(\\d+|${ID})|(${ID}))(?=[\\s:.]|$)`);
const END = String.raw`(?![\w-]|\.\d)`;
const BARE = new RegExp(`(?<![\\w.-])${ID}${END}`, "g");
const QUALIFIED = new RegExp(`(?<![\\w/.-])([a-z0-9]+(?:-[a-z0-9]+)*)/(\\d+(?:\\.\\d+)*|${ID})${END}`, "g");
const SHALL = /\bSHALL\b/;

// Two or more leading capitals make an ID unique across specs; R1.1, G1 or 1.1 only within their spec.
const isGlobal = (id) => /^[A-Z]{2}/.test(id);
const keyOf = (spec, id) => (isGlobal(id) ? id : `${spec}/${id}`);
const family = (id) => /^[A-Z]+/.exec(id)[0];
const where = (c) => `${c.file}:${c.line}`;
const punct = (t, v) => t?.type === "punct" && t.value === v;

// The ID that opens a clause line, or {bad} for a CARD- ID outside the CARD grammar.
function lead(text) {
  const card = /^CARD-[\w.-]*/.exec(text)?.[0].replace(/\.+$/, "");
  if (card) return CARD_ID.test(card) ? {id: card} : {bad: card};
  const id = LEAD.exec(text)?.[1];
  return id ? {id} : null;
}

// Clauses of one requirements.md: {spec, file, clauses, problems, styles}.
export function parseSpec(path, text) {
  const spec = path.split("/").at(-2), clauses = [], found = [], stack = [];
  let req = null, last = null, table = null, fenced = false;
  const problem = (line, kind, detail) => found.push({line, kind, detail: detail.slice(0, 160)});
  const add = (id, line, style, body) => {
    if (req) req.criteria++;
    clauses.push(last = {key: keyOf(spec, id), id, spec, file: path, line, style, text: body, refs: []});
  };
  // A requirement heading without numbered criteria is itself the clause (deck-builder R5).
  const closeReq = () => {
    if (req && !req.criteria) add(req.id, req.line, "heading", [req.title, ...req.prose.map((p) => p.text)].join(" "));
    else for (const p of req?.prose ?? []) if (SHALL.test(p.text)) problem(p.line, "unidentified-normative", p.text);
    req = null;
  };
  const sections = () => stack.filter((h) => h.level > 1);
  const inRequirements = () => Boolean(req) || sections().some((h) => /requirement/i.test(h.title));
  const explicitOk = () => inRequirements() || !sections().length;

  text.split(/\r?\n/).forEach((raw, i) => {
    const n = i + 1, line = raw.trimEnd();
    if (/^\s*(?:```|~~~)/.test(line)) { fenced = !fenced; last = null; return; }
    if (fenced) return;
    if (!line.trim()) { last = table = null; return; }

    const heading = /^(#{1,6})\s+(.+?)[\s#]*$/.exec(line);
    if (heading) {
      const level = heading[1].length, title = heading[2], m = level > 1 && REQ_HEADING.exec(title);
      if (req && m && level > req.level) req.criteria++;
      if (req && (level <= req.level || m)) closeReq();
      while (stack.length && stack.at(-1).level >= level) stack.pop();
      stack.push({level, title});
      if (m) {
        const id = m[1] ?? m[2];
        if (id.startsWith("CARD-") && !CARD_ID.test(id)) problem(n, "malformed-id", id);
        else req = {id, level, line: n, title: title.slice(m[0].length).replace(/^[:.\s]+/, ""), prose: [], criteria: 0};
      }
      last = table = null;
      return;
    }

    if (line.trimStart().startsWith("|")) {
      const cells = line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      last = null;
      if (!table) { table = {defines: /^id$/i.test(cells[0])}; return; } // header row; only an "ID" column defines
      if (cells.every((c) => /^:?-+:?$/.test(c))) return;
      if (table.defines && (explicitOk() || cells[0].startsWith("CARD-"))) {
        const l = lead(cells[0].replace(/^[*_]+/, ""));
        if (l?.id) add(l.id, n, "table", cells[1] ?? "");
        else problem(n, "malformed-id", l?.bad ?? `table row without an ID: ${cells[0]}`);
        last = null;
      } else if (SHALL.test(line)) problem(n, "unidentified-normative", line.trim());
      return;
    }

    const item = /^(\s*)(?:[-*+]|(\d+)[.)])\s+(.*)$/.exec(line);
    const indent = (item?.[1] ?? /^\s*/.exec(line)[0]).length;
    const body = (item?.[3] ?? line.trim()).replace(/^[*_]+/, "");
    if (item || !indent) {
      const l = (explicitOk() || body.startsWith("CARD-")) && lead(body); // a CARD- ID is a clause in any section
      if (l?.bad) { problem(n, "malformed-id", l.bad); last = null; return; }
      if (l) return add(l.id, n, item ? "list" : "paragraph", body.slice(l.id.length).replace(/^[*_.:)\s]+/, ""));
      if (item?.[2] && !indent && inRequirements()) return add(req ? `${req.id}.${item[2]}` : item[2], n, "numbered", body);
    }
    if (last && (indent || !item)) { last.text += ` ${line.trim()}`; return; }
    if (req && !item) { req.prose.push({line: n, text: line.trim()}); return; }
    if (SHALL.test(line)) problem(n, "unidentified-normative", line.trim());
    last = null;
  });
  closeReq();

  for (const c of clauses) {
    if (c.id.startsWith("CARD-") && !/\bshall\b/i.test(c.text)) problem(c.line, "not-ears", `${c.id} has no SHALL response`);
    c.text = c.text.replace(/\*\*/g, "").replace(/\s+/g, " ").trim().slice(0, 160);
  }
  if (!clauses.length) problem(1, "no-clauses", "no numbered requirement clause recognized");
  const problems = found.sort((a, b) => a.line - b.line).map((p) => ({at: `${path}:${p.line}`, kind: p.kind, detail: p.detail}));
  return {spec, file: path, clauses, problems, styles: [...new Set(clauses.map((c) => c.style))]};
}

// Code tokens of a JavaScript file. Comments are dropped and every string or template literal is a
// single "str" token (substitutions become \0), so a title can only come from real code.
export function lex(src) {
  const WORD = /[A-Za-z_$][\w$]*|\d[\w.]*/y;
  const BEFORE_REGEX = new Set(["return", "typeof", "instanceof", "in", "of", "new", "delete", "void", "throw", "case", "do", "else", "yield", "await"]);
  const regexAllowed = (p) => !p || (p.type === "word" ? BEFORE_REGEX.has(p.value) : p.type === "punct" && p.value !== ")" && p.value !== "]");
  let i = src.startsWith("#!") ? (src.includes("\n") ? src.indexOf("\n") : src.length) : 0, line = 1;

  const literal = (q) => {
    let value = "";
    for (i++; i < src.length; i++) {
      let c = src[i];
      if (c === q) { i++; return value; }
      if (c === "\n") { if (q !== "`") return value; line++; }
      else if (c === "\\") { c = src[++i] ?? ""; if (c === "\n") line++; }
      else if (q === "`" && c === "$" && src[i + 1] === "{") { i += 2; scan([], true); i--; c = "\0"; }
      value += c;
    }
    return value;
  };
  const regex = () => {
    let cls = false;
    for (i++; i < src.length && src[i] !== "\n"; i++) {
      if (src[i] === "\\") i++;
      else if (src[i] === "[") cls = true;
      else if (src[i] === "]") cls = false;
      else if (src[i] === "/" && !cls) break;
    }
    if (src[i] === "/") i++;
    WORD.lastIndex = i;
    if (WORD.test(src)) i = WORD.lastIndex; // flags
  };
  const scan = (out, untilBrace) => {
    for (let depth = 0; i < src.length;) {
      const c = src[i], at = line;
      if (c === "\n") { line++; i++; }
      else if (c <= " ") i++;
      else if (src.startsWith("//", i)) i = src.includes("\n", i) ? src.indexOf("\n", i) : src.length;
      else if (src.startsWith("/*", i)) {
        const close = src.indexOf("*/", i + 2), stop = close < 0 ? src.length : close + 2;
        for (; i < stop; i++) if (src[i] === "\n") line++;
      } else if (c === '"' || c === "'" || c === "`") out.push({type: "str", value: literal(c), line: at});
      else if (c === "/" && regexAllowed(out.at(-1))) { regex(); out.push({type: "regex", line: at}); }
      else if ((WORD.lastIndex = i, WORD.test(src))) {
        out.push({type: /\d/.test(c) ? "num" : "word", value: src.slice(i, WORD.lastIndex), line: at});
        i = WORD.lastIndex;
      } else {
        if (untilBrace && c === "{") depth++;
        if (untilBrace && c === "}" && depth-- === 0) { i++; return; }
        out.push({type: "punct", value: c, line: at});
        i++;
      }
    }
  };
  const tokens = [];
  scan(tokens, false);
  return tokens;
}

const closer = (toks, j) => {
  const open = toks[j].value, close = open === "(" ? ")" : "}";
  for (let depth = 0, q = j; q < toks.length; q++) {
    if (punct(toks[q], open)) depth++;
    else if (punct(toks[q], close) && --depth === 0) return q;
  }
  return toks.length;
};
// An options object with a skip or todo key whose value is not literally false.
const optionSkips = (toks, from, to) => {
  for (let q = from + 1; q < to; q++) {
    const t = toks[q];
    if (t.type !== "word" || (t.value !== "skip" && t.value !== "todo") || !(punct(toks[q - 1], "{") || punct(toks[q - 1], ","))) continue;
    if (!(punct(toks[q + 1], ":") && toks[q + 2]?.value === "false")) return true;
  }
  return false;
};
// "no-callback" when the call passes no function, "empty-test" when the function body is {}.
const bodyProblem = (toks, from, to) => {
  for (let q = from; q < to; q++) {
    if (punct(toks[q], "=") && punct(toks[q + 1], ">")) return punct(toks[q + 2], "{") && punct(toks[q + 3], "}") ? "empty-test" : null;
    if (toks[q].type === "word" && toks[q].value === "function") {
      const params = toks.findIndex((t, r) => r > q && punct(t, "(")), open = closer(toks, params) + 1;
      return punct(toks[open], "{") && punct(toks[open + 1], "}") ? "empty-test" : null;
    }
  }
  return toks.slice(from, to).some((t) => t.type === "word") ? null : "no-callback";
};
const FC = new Set(["assert", "property", "asyncProperty"]);
const CALLEES = new Set(["test", "it", "describe", "suite"]);

// test()/it() calls with a literal title: {line, title, kind, rejected}. Only these are evidence.
export function namedTests(src) {
  const toks = lex(src), out = [], skippedSuites = [];
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k];
    if (t.type !== "word" || !CALLEES.has(t.value) || punct(toks[k - 1], ".")) continue; // RE.test(), t.test() are not tests here
    let j = k + 1, skip = false;
    if (punct(toks[j], ".")) {
      const mod = toks[j + 1]?.value;
      if (mod !== "skip" && mod !== "todo" && mod !== "only") continue;
      skip = mod !== "only";
      j += 2;
    }
    if (!punct(toks[j], "(")) continue;
    const end = closer(toks, j), title = toks[j + 1];
    let after = j + 2;
    const literal = title?.type === "str" && (punct(toks[after], ",") || punct(toks[after], ")"));
    if (punct(toks[after], ",") && punct(toks[after + 1], "{")) {
      const close = closer(toks, after + 1);
      skip ||= optionSkips(toks, after + 1, close);
      after = close + 1;
    }
    skip ||= skippedSuites.some(([from, to]) => from < k && k < to);
    if (t.value === "describe" || t.value === "suite") { if (skip) skippedSuites.push([j, end]); continue; }
    if (!literal) continue;
    const property = toks.slice(j, end).some((x, r, s) => x.type === "word" && x.value === "fc" && punct(s[r + 1], ".") && FC.has(s[r + 2]?.value));
    out.push({line: t.line, title: title.value, kind: property ? "property" : "test", rejected: skip ? "skipped" : bodyProblem(toks, after, end)});
  }
  return out;
}

// specs and tests are [{path, text}] with repository-relative POSIX paths.
export function trace({specs, tests}) {
  const parsed = specs.map(({path, text}) => parseSpec(path, text));
  const clauses = parsed.flatMap((s) => s.clauses);
  const byKey = Map.groupBy(clauses, (c) => c.key);
  const localIds = Map.groupBy(clauses.filter((c) => !isGlobal(c.id)), (c) => c.id);
  const families = new Set(clauses.filter((c) => isGlobal(c.id)).map((c) => family(c.id))).add("CARD");
  const specNames = new Set(parsed.map((s) => s.spec));
  const unresolved = [];

  for (const file of tests) for (const t of namedTests(file.text)) {
    const at = `${file.path}:${t.line}`, hits = new Set();
    const note = (token, reason, candidates) => unresolved.push({at, title: t.title, token, reason, ...(candidates && {candidates})});
    const qualified = [...t.title.matchAll(QUALIFIED)];
    for (const [text, spec, id] of qualified) {
      const found = byKey.get(keyOf(spec, id))?.filter((c) => c.spec === spec) ?? [];
      if (found.length === 1) hits.add(found[0]);
      else if (specNames.has(spec)) note(text, found.length ? "ambiguous" : "unknown-id");
    }
    for (const m of t.title.matchAll(BARE)) {
      const id = m[0];
      if (qualified.some((q) => m.index >= q.index && m.index < q.index + q[0].length)) continue;
      if (!isGlobal(id)) { if (localIds.has(id)) note(id, "unqualified", localIds.get(id).map((c) => c.key)); continue; }
      const found = byKey.get(id);
      if (found?.length === 1) hits.add(found[0]);
      else if (found) note(id, "ambiguous", found.map(where));
      else if (families.has(family(id))) note(id, "unknown-id");
    }
    for (const c of hits) {
      if (t.rejected) note(c.key, t.rejected);
      else c.refs.push({at, title: t.title, kind: t.kind});
    }
  }

  const duplicates = [...byKey].filter(([, list]) => list.length > 1).map(([key, list]) => ({key, at: list.map(where)}));
  const orphans = [...new Set(clauses.filter((c) => !c.refs.length).map((c) => c.key))];
  const problems = parsed.flatMap((s) => s.problems);
  return {
    summary: {specs: parsed.length, clauses: clauses.length, proven: clauses.filter((c) => c.refs.length).length,
      orphans: orphans.length, duplicates: duplicates.length, problems: problems.length, unresolved: unresolved.length},
    specs: parsed.map((s) => ({spec: s.spec, file: s.file, clauses: s.clauses.length, styles: s.styles})),
    duplicates, problems, unresolved, orphans,
    clauses: clauses.map((c) => ({key: c.key, id: c.id, spec: c.spec, at: where(c), style: c.style, text: c.text, refs: c.refs})),
  };
}

// Every spec requirements.md, and every *.test.{js,mjs,cjs} outside fixtures, builds and this trace's own test.
export function collect(root = ROOT) {
  const specRoot = join(root, ".kiro", "specs");
  if (!existsSync(specRoot)) throw new Error(`no .kiro/specs directory under ${root}`);
  const read = (path) => ({path, text: readFileSync(join(root, path), "utf8")});
  const specs = readdirSync(specRoot, {withFileTypes: true})
    .filter((d) => d.isDirectory() && existsSync(join(specRoot, d.name, "requirements.md")))
    .map((d) => `.kiro/specs/${d.name}/requirements.md`).sort().map(read);
  const tests = [];
  const walk = (dir) => {
    for (const d of readdirSync(join(root, dir), {withFileTypes: true})) {
      const path = dir ? `${dir}/${d.name}` : d.name;
      if (d.isDirectory()) { if (!SKIP_DIRS.has(d.name)) walk(path); }
      else if (d.isFile() && TEST_FILE.test(d.name) && path !== SELF_TEST) tests.push(path);
    }
  };
  walk("");
  return {specs, tests: tests.sort().map(read)};
}

export function format(r) {
  const s = r.summary, out = [`trace: specs ${s.specs}, clauses ${s.clauses}, proven by a named test ${s.proven}, orphan IDs ${s.orphans}`];
  for (const sp of r.specs) out.push(`  ${sp.file}: ${sp.clauses} clauses (${sp.styles.join(", ") || "none"})`);
  out.push(`duplicate IDs: ${r.duplicates.length}`, ...r.duplicates.map((d) => `  ${d.key} at ${d.at.join(", ")}`));
  out.push(`unsupported syntax: ${r.problems.length}`, ...r.problems.map((p) => `  ${p.at} ${p.kind}: ${p.detail}`));
  out.push(`unresolved test references: ${r.unresolved.length}`,
    ...r.unresolved.map((u) => `  ${u.at} ${u.token} ${u.reason}${u.candidates ? ` (${u.candidates.join(", ")})` : ""}`));
  out.push(`proven: ${s.proven}`, ...r.clauses.filter((c) => c.refs.length).map((c) => `  ${c.key} <- ${c.refs.map((x) => `${x.at} (${x.kind})`).join(", ")}`));
  out.push(`orphan IDs: ${s.orphans}`, ...[...Map.groupBy(r.clauses.filter((c) => !c.refs.length), (c) => c.spec)]
    .map(([spec, list]) => `  ${spec}: ${list.map((c) => c.id).join(" ")}`));
  for (const p of r.required?.prefixes ?? []) {
    const missing = r.required.missing.filter((k) => k.startsWith(p));
    out.push(r.required.unmatched.includes(p) ? `required ${p}: no clause has this prefix` : `required ${p}: ${missing.length ? `unproven ${missing.join(" ")}` : "all proven"}`);
  }
  return out.join("\n");
}

export function main(argv, {log = console.log, error = console.error} = {}) {
  let json = false, root = ROOT;
  const required = [];
  for (let k = 0; k < argv.length; k++) {
    const arg = argv[k];
    if (arg === "--json") json = true;
    else if (arg === "--require" && k + 1 < argv.length) required.push(argv[++k]);
    else if (arg === "--root" && k + 1 < argv.length) root = resolve(argv[++k]);
    else if (arg === "--help" || arg === "-h") { log(USAGE); return 0; }
    else { error(`trace: unexpected argument ${JSON.stringify(arg)}\n${USAGE}`); return 2; }
  }
  let report;
  try { report = trace(collect(root)); } catch (e) { error(`trace: ${e.message}`); return 2; }
  const missing = report.orphans.filter((key) => required.some((p) => key.startsWith(p)));
  const unmatched = required.filter((p) => !report.clauses.some((c) => c.key.startsWith(p)));
  report.required = {prefixes: required, missing, unmatched};
  log(json ? JSON.stringify(report, null, 2) : format(report));
  return report.duplicates.length || report.problems.length || missing.length || unmatched.length ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
