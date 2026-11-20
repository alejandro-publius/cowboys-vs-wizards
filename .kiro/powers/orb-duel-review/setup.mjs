// Usage: node setup.mjs <projectRoot> <PLUGIN_DATA dir>
// Validates the project and writes only <PLUGIN_DATA>/project.json. Reports whether the project
// carries the Showdown engine and its fingerprint, so the binding names the intended game checkout.
import {existsSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync} from "node:fs";
import {join} from "node:path";
import {ENGINE_ENTRIES, engineFingerprint} from "./showdown.mjs";

const [projectArg, dataArg, ...extra] = process.argv.slice(2);
function die(message) { console.error(`setup: ${message}`); process.exit(1); }
if (!projectArg || !dataArg || extra.length) die("usage: node setup.mjs <projectRoot> <PLUGIN_DATA dir>");
let projectRoot;
try {
  projectRoot = realpathSync(projectArg);
  if (!statSync(projectRoot).isDirectory()) throw new Error();
} catch { die(`project root is not a directory: ${projectArg}`); }
try {
  if (JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8")).name !== "cowboys-vs-wizards-board") throw new Error();
} catch { die("package.json is missing or is not cowboys-vs-wizards-board"); }
for (const marker of ["assets/models", "scripts/audit-assets.mjs"]) {
  if (!existsSync(join(projectRoot, marker))) die(`project marker missing: ${marker}`);
}
mkdirSync(dataArg, {recursive: true});
const file = join(realpathSync(dataArg), "project.json");
writeFileSync(file, JSON.stringify({projectRoot}, null, 2) + "\n");
console.log(`bound ${projectRoot} -> ${file}`);
// Older lane-only checkouts stay bindable; Showdown tools then report the engine as unavailable.
const absent = ENGINE_ENTRIES.filter((rel) => !existsSync(join(projectRoot, rel)));
if (absent.length) console.log(`showdown engine: absent (${absent.join(", ")})`);
else {
  const engine = engineFingerprint(projectRoot + "/");
  console.log(`showdown engine: ${engine.sha256} (${engine.fileCount} files)`);
}
