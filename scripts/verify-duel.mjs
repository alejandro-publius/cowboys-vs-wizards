// Local verification, run once from the project root:
//   node scripts/verify-duel.mjs            Node suites in tests/game, tests/match, tests/assets and
//                                           prototypes/showdown, then the Dragon and Mounted Billy GLB
//                                           structure preflight (source assets; nothing renders them)
//   node scripts/verify-duel.mjs --browser  also stage the Pages tree once for HEAD (scripts/stage-pages.mjs)
//                                           and check it in native Chrome (scripts/check-pages-tree.mjs
//                                           --browser): Play opens the Camp at / and /graybox/, and /3d/
//                                           redirects to the game with no script or asset of its own
// Browser outputs (pages-tree.json) go to .artifacts/pages-tree.
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

const files = ["tests/game", "tests/match", "tests/assets", "prototypes/showdown"].flatMap((dir) =>
  readdirSync(new URL(`../${dir}/`, import.meta.url))
    .filter((f) => /\.test\.m?js$/.test(f))
    .sort()
    .map((f) => `${dir}/${f}`));
run(process.execPath, ["--test", ...files]);

// Read-only structure preflight of the two animated shipped models (not motion approval).
run(process.execPath, ["scripts/check-sourced-animation.mjs", "assets/models/dragon.glb", "assets/models/mounted-billy.glb"]);

if (args.includes("--browser")) {
  const head = spawnSync("git", ["rev-parse", "HEAD"], {cwd: root, encoding: "utf8"});
  const commit = head.status === 0 ? head.stdout.trim() : "";
  if (!/^[0-9a-f]{40}$/.test(commit)) {
    console.error("--browser stages the Pages tree for HEAD and needs a git checkout");
    process.exit(1);
  }
  run(process.execPath, ["scripts/stage-pages.mjs", "--commit", commit]);
  run(process.execPath, ["scripts/check-pages-tree.mjs", "--commit", commit, "--browser"]);
}
