// PostFileSave command hook for .kiro/hooks/check-outrider-gate.json (K-011). stdin is the hook event JSON.
// Runs `node scripts/outrider-gate.mjs --check --ledger` and appends one receipt line to
// .artifacts/outrider-gate-hook/receipts.jsonl (ignored by git), so a native trigger is distinguishable from a
// manual run: a manual run has no session_id or hook_event_name. Exits with the gate's exit code.
import {appendFileSync, mkdirSync, readFileSync, realpathSync} from "node:fs";
import {spawnSync} from "node:child_process";
import path from "node:path";

const root = realpathSync(process.cwd());
let event = null;
try { event = JSON.parse(readFileSync(0, "utf8")); } catch { /* manual run or malformed */ }
const file = typeof event?.file_path === "string" ? path.relative(root, path.resolve(root, event.file_path)).split(path.sep).join("/") : null;
const gate = spawnSync(process.execPath, ["scripts/outrider-gate.mjs", "--check", "--ledger"], {cwd: root, encoding: "utf8"});
const receipt = {at: new Date().toISOString(), session_id: event?.session_id ?? null, hook_event_name: event?.hook_event_name ?? null,
  file, status: gate.status === 0 ? "passed" : "failed", exit: gate.status, output: `${gate.stdout}${gate.stderr}`.slice(-1500)};
mkdirSync(path.join(root, ".artifacts/outrider-gate-hook"), {recursive: true});
appendFileSync(path.join(root, ".artifacts/outrider-gate-hook/receipts.jsonl"), `${JSON.stringify(receipt)}\n`);
process.stdout.write(`outrider-gate-hook: ${receipt.status}${file ? ` (${file})` : ""}\n${gate.stdout}`);
process.stderr.write(gate.stderr);
process.exitCode = gate.status ?? 1;
