// Kiro PostFileSave wrapper for docs/**/*.md. Runs the offline link checker
// (scripts/check-links.mjs), keeps its output on stderr/stdout, propagates its
// exit code and writes a small receipt to .artifacts/doc-link-hook/.
// Untracked files are skipped. No network, build or tests.
import {spawnSync} from "node:child_process";
import {appendFileSync, mkdirSync, writeFileSync} from "node:fs";

const dir = ".artifacts/doc-link-hook";
mkdirSync(dir, {recursive: true});

// The hook may pass the event as JSON on stdin; do not wait for it forever.
const stdin = await new Promise((resolve) => {
  if (process.stdin.isTTY) return resolve("");
  let data = "";
  const timer = setTimeout(() => resolve(data), 300);
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => { data += chunk; });
  process.stdin.on("end", () => { clearTimeout(timer); resolve(data); });
  process.stdin.on("error", () => { clearTimeout(timer); resolve(data); });
});

const file = /[\w./-]+\.md/.exec(stdin)?.[0] ?? process.argv[2] ?? null;
const tracked = file === null || spawnSync("git", ["ls-files", "--error-unmatch", "--", file], {stdio: "ignore"}).status === 0;
let status = 0, output = "";
if (tracked) {
  const run = spawnSync("node", ["scripts/check-links.mjs"], {encoding: "utf8"});
  output = run.stdout + run.stderr;
  status = run.status ?? 1;
  process.stdout.write(run.stdout);
  process.stderr.write(run.stderr);
}
const envKeys = Object.keys(process.env).filter((key) => /^(KIRO|CLAUDE|HOOK)/i.test(key)).sort();
appendFileSync(`${dir}/receipts.jsonl`, JSON.stringify({
  at: new Date().toISOString(), file, tracked, status, envKeys, stdinBytes: stdin.length, stdin: stdin.slice(0, 500), output: output.slice(0, 2000),
}) + "\n");
if (!tracked) console.log(`skipped untracked file ${file}`);
process.exit(status);
