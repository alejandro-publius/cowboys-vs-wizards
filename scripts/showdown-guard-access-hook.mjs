// Kiro PostToolUse hook (.kiro/hooks/check-showdown-guard-access.json): after a write tool touches the
// Showdown screen or event presenter, rebuild the graybox and run the Chrome Guard access check
// (scripts/browser-showdown-guard-access-check.mjs, seed 0). Any other path is skipped.
// Reads the hook event JSON on STDIN; every string under a key containing "path" in tool_input counts.
// Each run appends one line to .artifacts/kiro/showdown-guard-access-hook.log (ignored by git), so a
// real dispatch by Kiro leaves a trace separate from a run by hand (source: "kiro" needs a hook event).
// Exit 0: skipped or passed (stdout reaches the agent). Exit 1: the check failed (stderr reaches the agent).
import {spawnSync} from "node:child_process";
import {appendFileSync, mkdirSync, readFileSync} from "node:fs";
import path from "node:path";

const WATCHED = [/(^|\/)src\/ui\/showdown-screen\.js$/, /(^|\/)src\/game\/showdown\/presenter\.js$/];
const root = process.cwd();
let event = {};
try { event = JSON.parse(readFileSync(0, "utf8") || "{}"); } catch { event = {}; }
const paths = [];
(function walk(value, key = "") {
  if (typeof value === "string") { if (/path/i.test(key)) paths.push(value); return; }
  if (Array.isArray(value)) { for (const v of value) walk(v, key); return; }
  if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) walk(v, /path/i.test(k) ? k : key || k);
})(event.tool_input ?? {});
const rel = paths.map((p) => path.relative(root, path.resolve(root, p)).split(path.sep).join("/"));
const hit = rel.filter((p) => WATCHED.some((re) => re.test(p)));
mkdirSync(".artifacts/kiro", {recursive: true});
const log = (entry) => appendFileSync(".artifacts/kiro/showdown-guard-access-hook.log",
  JSON.stringify({at: new Date().toISOString(), event: event.hook_event_name ?? null, tool: event.tool_name ?? null, session: event.session_id ?? null, paths: rel, ...entry}) + "\n");

if (!hit.length) {
  log({result: "skipped"});
  console.log(`Showdown Guard access check skipped: ${rel.join(", ") || "no path"} is not the Showdown screen or presenter.`);
  process.exit(0);
}
const run = (cmd, args) => spawnSync(cmd, args, {encoding: "utf8", timeout: 150000});
const build = run("node", ["scripts/build-graybox.mjs"]);
const check = build.status === 0 ? run("npx", ["-y", "-p", "playwright-core@1.64.1", "node", "scripts/browser-showdown-guard-access-check.mjs",
  "dist/cowboys-vs-wizards-board-duel.html", "--browser", "chrome", "--out", ".artifacts/kiro/showdown-guard-access"]) : null;
const output = `${build.stdout}${build.stderr}${check?.stdout ?? ""}${check?.stderr ?? ""}`.trim();
const passed = build.status === 0 && check?.status === 0;
log({result: passed ? "passed" : "failed", watched: hit, summary: output.split("\n").filter((l) => /^(not ok|PASS|FAIL)/.test(l))});
if (passed) { console.log(`Showdown Guard access check passed after editing ${hit.join(", ")}.\n${output}`); process.exit(0); }
console.error(`Showdown Guard access check FAILED after editing ${hit.join(", ")}:\n${output}`);
process.exit(1);
