// Append unrendered Stop receipts to docs/KIRO_USAGE.md. Never rewrites rows.
//   node scripts/contest-usage-render.mjs          append missing rows
//   node scripts/contest-usage-render.mjs --check  exit 1 if rows are missing
//   --receipts <file>  read another receipts file (for example a copied one)
import {readFileSync, writeFileSync, existsSync} from "node:fs";
import path from "node:path";
import {DOC_FILE, RECEIPT_FILE, parseReceipts, renderInto} from "./contest-usage-lib.mjs";

const args = process.argv.slice(2);
const check = args.includes("--check");
const at = args.indexOf("--receipts");
const receiptsPath = path.resolve(at >= 0 && args[at + 1] ? args[at + 1] : RECEIPT_FILE);
const docPath = path.resolve(DOC_FILE);

const receipts = existsSync(receiptsPath) ? parseReceipts(readFileSync(receiptsPath, "utf8")) : [];
const doc = readFileSync(docPath, "utf8");
const {text, added} = renderInto(doc, receipts);
const stops = receipts.filter((r) => r.event === "Stop").length;

if (check) {
  console.log(`contest-usage-render: ${stops} Stop receipts, ${added} not yet in ${DOC_FILE}`);
  process.exitCode = added ? 1 : 0;
} else {
  if (added) writeFileSync(docPath, text);
  console.log(`contest-usage-render: ${stops} Stop receipts, appended ${added} rows to ${DOC_FILE}`);
}
