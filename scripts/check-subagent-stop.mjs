// SubagentStop / Stop receipt integrity guard for `.kiro/hooks/subagent-stop-receipt-guard.json` (JCS-3, JCS-4).
// Verifies that every checked-in Night Shift review bundle (`night-review/bundle@1`) passes cryptographic seal
// verification and that `reports/properties/latest.json` has zero rejected entries. Never re-enters on active stop hooks.
import {existsSync, readdirSync, readFileSync} from "node:fs";
import {join, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {bundleSealIntact} from "./night-review.mjs";
import { canonicalPhase, resolvePhase } from "./saloon-activity.mjs";
import {PROPERTY_RECEIPT, auditPropertyReceipt} from "./scorecard.mjs";

export const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

const SHA40 = /^[0-9a-f]{40}$/;

function auditPropertyEntriesShallowSafe(rawReceipt, root) {
  const full = auditPropertyReceipt(rawReceipt, root);
  const isShallow = existsSync(join(root, ".git/shallow"));
  if (!isShallow || full.rejected.length !== 1 || full.rejected[0]?.reason !== "commit is not a commit in this repository") {
    return full;
  }
  // In a shallow clone (e.g. CI fetch-depth: 1), verify 40-hex commit format and audit every entry directly.
  if (rawReceipt?.schema !== "cvw-property-receipt/1" || !SHA40.test(rawReceipt?.commit ?? "")) {
    return full;
  }
  const passed = new Map();
  const rejected = [];
  for (const p of Array.isArray(rawReceipt.properties) ? rawReceipt.properties : []) {
    const id = typeof p?.id === "string" ? p.id.trim() : "";
    const file = typeof p?.file === "string" ? p.file : "";
    const fileOk = /^[\w./-]+\.(?:m?js|cjs|ts)$/.test(file) && !file.split("/").includes("..")
      && existsSync(join(root, file)) && /["']fast-check["']/.test(readFileSync(join(root, file), "utf8"));
    const problem = !id ? "no id" : p.status !== "passed" ? `status ${JSON.stringify(p?.status ?? null)}`
      : !(Number.isSafeInteger(p.numRuns) && p.numRuns >= 1) ? "no executed runs"
      : !fileOk ? `${file || "no file"} is not a fast-check test in this checkout`
      : passed.has(id) ? "duplicate id" : null;
    if (problem) rejected.push({id: id || null, reason: problem});
    else passed.set(id, {file, numRuns: p.numRuns});
  }
  return {passed, rejected};
}

export function auditRepoReceipts(root = ROOT) {
  const evidenceBase = join(root, "docs/evidence");
  let sealedBundles = 0;
  const tamperedBundles = [];
  if (existsSync(evidenceBase)) {
    for (const entry of readdirSync(evidenceBase, {recursive: true})) {
      if (!/(^|[\\/])bundle\.json$/.test(String(entry))) continue;
      const relPath = `docs/evidence/${String(entry).split("\\").join("/")}`;
      let parsed;
      try {
        parsed = JSON.parse(readFileSync(join(root, relPath), "utf8"));
      } catch {
        tamperedBundles.push(`${relPath}: invalid JSON`);
        continue;
      }
      if (parsed?.schema !== "night-review/bundle@1") continue;
      if (bundleSealIntact(parsed)) sealedBundles += 1;
      else tamperedBundles.push(`${relPath}: broken bundleSha256 seal`);
    }
  }

  const propFile = join(root, PROPERTY_RECEIPT);
  let propertyPassed = 0;
  let propertyRejected = [];
  if (existsSync(propFile)) {
    let rawReceipt;
    try {
      rawReceipt = JSON.parse(readFileSync(propFile, "utf8"));
    } catch {
      rawReceipt = null;
    }
    const audited = auditPropertyEntriesShallowSafe(rawReceipt, root);
    propertyPassed = audited.passed.size;
    propertyRejected = audited.rejected;
  }

  const ok = tamperedBundles.length === 0 && propertyRejected.length === 0 && sealedBundles > 0;
  return {
    ok,
    sealedBundles,
    tamperedBundles,
    propertyPassed,
    propertyRejected,
  };
}

export function runStopGuard({stdinText = "", configuredTrigger = "Stop", env = process.env, root = ROOT} = {}) {
  if (env.SUBAGENT_GUARD_ACTIVE === "1") {
    return {skipped: true, code: 0, output: ""};
  }
  let event = {};
  if (stdinText.trim()) {
    try { event = JSON.parse(stdinText); } catch { event = {}; }
  }
  if (event?.stop_hook_active === true) {
    return {skipped: true, code: 0, output: ""};
  }
  const phase = resolvePhase(event, configuredTrigger) ?? canonicalPhase(configuredTrigger) ?? "Stop";
  const report = auditRepoReceipts(root);
  const summary = {
    guard: "subagent-stop-receipt-guard",
    phase,
    deliveredEvent: event?.hook_event_name ?? event?.hookEventName ?? configuredTrigger,
    ok: report.ok,
    sealedBundles: report.sealedBundles,
    tamperedCount: report.tamperedBundles.length,
    propertyPassed: report.propertyPassed,
    propertyRejectedCount: report.propertyRejected.length,
  };
  return {
    skipped: false,
    code: report.ok ? 0 : 1,
    output: JSON.stringify(summary),
    summary,
    report,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let stdinText = "";
  try { stdinText = readFileSync(0, "utf8"); } catch { stdinText = ""; }
  const res = runStopGuard({stdinText, configuredTrigger: process.argv[2] ?? "Stop"});
  if (!res.skipped && res.output) {
    if (res.code === 0) console.log(res.output);
    else console.error(res.output);
  }
  process.exitCode = res.code;
}
