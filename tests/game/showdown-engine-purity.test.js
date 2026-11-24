// FH-R1.2 (.kiro/specs/showdown-first-hour/requirements.md) and AGENTS.md:
// src/game/showdown/ modules and their reachable helper graph must stay pure JavaScript with no DOM,
// rendering, filesystem, network or model dependencies, and storage may enter src/game/showdown/ only
// as a caller-supplied argument. Reuses scripts/trace.mjs's JS lexer so comments and plain strings do
// not false-positive.
import test from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { builtinModules } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { lex } from "../../scripts/trace.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SHOWDOWN_DIR = "src/game/showdown";
const ALLOWED_PREFIXES = ["src/game/", "src/profile/"];
const NODE_BUILTINS = new Set(builtinModules.map((name) => name.replace(/^node:/, "")));

const IO_GLOBALS = new Set([
  "window", "self", "document", "navigator", "indexedDB", "caches",
  "HTMLElement", "HTMLCanvasElement", "OffscreenCanvas",
  "WebGLRenderingContext", "WebGL2RenderingContext",
  "requestAnimationFrame", "cancelAnimationFrame", "Audio", "AudioContext", "Image",
  "fetch", "XMLHttpRequest", "WebSocket", "EventSource", "Worker",
  "process", "require", "__dirname", "__filename",
]);
const SHOWDOWN_GLOBALS = new Set([...IO_GLOBALS, "localStorage", "sessionStorage", "globalThis"]);

const toPosix = (filePath) => filePath.split("\\").join("/");
const punct = (tok, value) => tok?.type === "punct" && tok.value === value;

function listJsFiles(root, dir) {
  const out = [];
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...listJsFiles(root, rel));
    else if (entry.isFile() && /\.(?:js|mjs)$/.test(entry.name)) out.push(rel);
  }
  return out.sort();
}

function resolveImport(fromFile, spec) {
  const base = resolve(dirname(fromFile), spec);
  for (const candidate of [base, `${base}.js`, `${base}.mjs`, join(base, "index.js")]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function scanSpecifiers(toks) {
  const specs = [];
  const dynamicProblems = [];
  for (let i = 0; i < toks.length; i++) {
    const tok = toks[i];
    if (tok.type !== "word" || punct(toks[i - 1], ".")) continue;
    if (tok.value === "import" && toks[i + 1]?.type === "str") {
      specs.push({ spec: toks[i + 1].value, line: toks[i + 1].line });
    } else if (tok.value === "import" && punct(toks[i + 1], "(")) {
      if (toks[i + 2]?.type === "str" && (punct(toks[i + 3], ")") || punct(toks[i + 3], ","))) {
        specs.push({ spec: toks[i + 2].value, line: toks[i + 2].line });
      } else {
        dynamicProblems.push({ line: tok.line, detail: "non-literal dynamic import()" });
      }
    } else if (tok.value === "from" && toks[i + 1]?.type === "str") {
      specs.push({ spec: toks[i + 1].value, line: toks[i + 1].line });
    }
  }
  return { specs, dynamicProblems };
}

export function auditShowdownPurity(root = ROOT) {
  const entries = listJsFiles(root, SHOWDOWN_DIR);
  const visited = new Set();
  const violations = [];
  const queue = entries.map((rel) => join(root, rel));

  while (queue.length > 0) {
    const abs = queue.shift();
    if (visited.has(abs)) continue;
    visited.add(abs);

    const rel = toPosix(relative(root, abs));
    const inShowdown = rel.startsWith(`${SHOWDOWN_DIR}/`);
    const forbiddenGlobals = inShowdown ? SHOWDOWN_GLOBALS : IO_GLOBALS;
    const toks = lex(readFileSync(abs, "utf8"));
    const { specs, dynamicProblems } = scanSpecifiers(toks);

    for (const problem of dynamicProblems) {
      violations.push(`${rel}:${problem.line}: ${problem.detail}`);
    }
    for (const { spec, line } of specs) {
      if (!spec.startsWith("./") && !spec.startsWith("../")) {
        const bare = spec.replace(/^node:/, "").split("/")[0];
        const kind = spec.startsWith("node:") || NODE_BUILTINS.has(bare) ? "Node built-in" : "non-relative";
        violations.push(`${rel}:${line}: forbidden ${kind} import "${spec}"`);
        continue;
      }
      const target = resolveImport(abs, spec);
      if (!target) {
        violations.push(`${rel}:${line}: unresolved import "${spec}"`);
        continue;
      }
      const targetRel = toPosix(relative(root, target));
      if (!/\.(?:js|mjs)$/.test(targetRel)) {
        violations.push(`${rel}:${line}: forbidden non-JS/model import "${spec}" -> ${targetRel}`);
        continue;
      }
      if (!ALLOWED_PREFIXES.some((prefix) => targetRel.startsWith(prefix))) {
        violations.push(`${rel}:${line}: forbidden cross-layer import "${spec}" -> ${targetRel}`);
        continue;
      }
      queue.push(target);
    }

    for (let i = 0; i < toks.length; i++) {
      const tok = toks[i];
      if (tok.type !== "word") continue;
      if (punct(toks[i - 1], ".")) {
        if (toks[i - 2]?.type === "word" && toks[i - 2].value === "globalThis" && IO_GLOBALS.has(tok.value)) {
          violations.push(`${rel}:${tok.line}: forbidden global reference "globalThis.${tok.value}"`);
        }
        continue;
      }
      if ((punct(toks[i - 1], "{") || punct(toks[i - 1], ",")) && punct(toks[i + 1], ":")) continue;
      if (forbiddenGlobals.has(tok.value)) {
        violations.push(`${rel}:${tok.line}: forbidden global reference "${tok.value}"`);
      }
    }
  }

  return { entries, files: [...visited].map((abs) => toPosix(relative(root, abs))).sort(), violations };
}

// FH-R1.2 (.kiro/specs/showdown-first-hour/requirements.md)
test("FH-R1.2: src/game/showdown and its reachable modules have no DOM, rendering, storage, filesystem, network or model dependencies", () => {
  const report = auditShowdownPurity();
  for (const required of ["trail.js", "progress.js", "playtest.js", "rules.js", "cards.js", "contract.js", "presenter.js", "campaign-store.js", "inherited.js", "savecode.js"]) {
    assert.ok(report.entries.includes(`${SHOWDOWN_DIR}/${required}`), `missing ${required}`);
  }
  assert.ok(report.files.includes("src/game/card-specs.generated.js"));
  assert.ok(report.files.includes("src/profile/player-profile.js"));
  assert.deepEqual(report.violations, []);
});

test("the purity check rejects a planted filesystem dependency in src/game/showdown", (t) => {
  const tempRoot = mkdtempSync(join(tmpdir(), "showdown-purity-"));
  t.after(() => rmSync(tempRoot, { recursive: true, force: true }));
  cpSync(join(ROOT, "src/game"), join(tempRoot, "src/game"), { recursive: true });
  cpSync(join(ROOT, "src/profile"), join(tempRoot, "src/profile"), { recursive: true });
  assert.deepEqual(auditShowdownPurity(tempRoot).violations, []);

  const target = join(tempRoot, "src/game/showdown/trail.js");
  writeFileSync(target, `${readFileSync(target, "utf8")}\nimport { readFileSync } from "node:fs";\n`);
  const planted = auditShowdownPurity(tempRoot);
  assert.equal(planted.violations.length, 1);
  assert.match(planted.violations[0], /^src\/game\/showdown\/trail\.js:\d+: forbidden Node built-in import "node:fs"$/);
});
