// Native Kiro command hook (Stop, optional PostToolUse). Reads the event JSON
// on stdin and appends one sanitized receipt line to an ignored file.
// It never writes tracked files and always exits 0 so it cannot block a turn.
import {readFileSync, mkdirSync, appendFileSync, existsSync, realpathSync} from "node:fs";
import path from "node:path";
import {RECEIPT_DIR, RECEIPT_FILE, buildRecord, parseReceipts} from "./contest-usage-lib.mjs";

const root = realpathSync(process.cwd());
const real = (p) => { try { return realpathSync(path.resolve(root, p)); } catch { return null; } };

function main() {
  let event = null;
  try { event = JSON.parse(readFileSync(0, "utf8")); } catch { event = null; }
  const file = path.join(root, RECEIPT_FILE);
  const prior = existsSync(file) ? parseReceipts(readFileSync(file, "utf8")) : [];
  const record = buildRecord(event, prior, {
    now: Date.now(),
    root,
    envSession: process.env.KIRO_SESSION_ID ? process.env.KIRO_SESSION_ID : null,
    cwdReal: real,
  });
  if (!record) {
    process.stdout.write("contest-usage: skipped-duplicate\n");
    return;
  }
  mkdirSync(path.join(root, RECEIPT_DIR), {recursive: true});
  appendFileSync(file, JSON.stringify(record) + "\n");
  process.stdout.write(`contest-usage: ${record.actions.join(",")} ${record.id}\n`);
}

try { main(); } catch (error) {
  process.stderr.write(`contest-usage: error ${String(error?.code ?? "unknown")}\n`);
}
process.exitCode = 0;
