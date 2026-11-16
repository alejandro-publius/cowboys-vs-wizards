// Local duel verification, run once from the project root:
//   node scripts/verify-duel.mjs            Node suites in tests/game, tests/match, tests/assets
//   node scripts/verify-duel.mjs --browser  also build once and replay seed 0 in native Chrome
// Browser outputs (screenshots, browser-run.json) go to .artifacts/kiro/replay.
// The first failing check's exit status is returned.
import {spawnSync} from "node:child_process";
import {readdirSync} from "node:fs";
import {fileURLToPath} from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const unknown = args.filter((a) => a !== "--browser");
if (unknown.length) {
  console.error(`unknown argument: ${unknown.join(" ")}\nusage: node scripts/verify-duel.mjs [--browser]`);
  process.exit(2);
}

function run(cmd, cmdArgs) {
  console.log(`\n$ ${[cmd, ...cmdArgs].join(" ")}`);
  const r = spawnSync(cmd, cmdArgs, {cwd: root, stdio: "inherit"});
  if (r.error) {
    console.error(r.error.message);
    process.exit(1);
  }
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const files = ["tests/game", "tests/match", "tests/assets"].flatMap((dir) =>
  readdirSync(new URL(`../${dir}/`, import.meta.url))
    .filter((f) => /\.test\.m?js$/.test(f))
    .sort()
    .map((f) => `${dir}/${f}`));
run(process.execPath, ["--test", ...files]);

if (args.includes("--browser")) {
  run(process.execPath, ["scripts/build.mjs"]);
  run(process.execPath, ["scripts/browser-match-check.mjs", "--seed", "0", "--out-dir", ".artifacts/kiro/replay"]);
}
