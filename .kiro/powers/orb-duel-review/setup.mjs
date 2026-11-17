// Usage: node setup.mjs <projectRoot> <PLUGIN_DATA dir>
// Validates the project and writes only <PLUGIN_DATA>/project.json.
import {existsSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync} from "node:fs";
import {join} from "node:path";

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
