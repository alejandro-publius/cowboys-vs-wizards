// Offline Stop / SubagentStop audit of the committed bundle paths and historical property receipt.
import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {join, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {bundleSealIntact} from "./night-review.mjs";
import {resolvePhase} from "./saloon-activity.mjs";
import {PROPERTY_RECEIPT, auditPropertyReceipt} from "./scorecard.mjs";

export const ROOT = fileURLToPath(new URL("..", import.meta.url));
const BUNDLE_SCHEMA = "night-review/bundle@1";

export function auditRepoReceipts(root = ROOT) {
  const git = (...args) => execFileSync("git", args, {cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"]});
  const tamperedBundles = [];
  let sealedBundles = 0;
  // Enumerate committed paths so deleting a bundle in the working tree cannot hide it.
  const tracked = git("ls-tree", "-rz", "--name-only", "HEAD", "--", "docs/evidence").split("\0");
  for (const file of tracked.filter((path) => path.endsWith("/bundle.json"))) {
    try {
      const bundle = JSON.parse(readFileSync(join(root, file), "utf8"));
      if (bundle?.schema !== BUNDLE_SCHEMA) {
        if (JSON.parse(git("show", `HEAD:${file}`))?.schema === BUNDLE_SCHEMA) {
          tamperedBundles.push(`${file}: missing Night Shift bundle schema`);
        }
      } else if (bundleSealIntact(bundle)) {
        sealedBundles += 1;
      } else {
        tamperedBundles.push(`${file}: broken bundleSha256 seal`);
      }
    } catch {
      tamperedBundles.push(`${file}: missing, unreadable or invalid JSON`);
    }
  }

  let propertyPassed = 0;
  const propertyRejected = [];
  try {
    const receipt = JSON.parse(readFileSync(join(root, PROPERTY_RECEIPT), "utf8"));
    const {passed, rejected} = auditPropertyReceipt(receipt, root);
    propertyRejected.push(...rejected);
    const verifiedFiles = new Map();
    for (const [id, {file}] of passed) {
      if (!verifiedFiles.has(file)) {
        try {
          const testedSource = git("cat-file", "blob", `${receipt.commit}:${file}`);
          verifiedFiles.set(file, /["']fast-check["']/.test(testedSource));
        } catch {
          verifiedFiles.set(file, false);
        }
      }
      if (verifiedFiles.get(file)) propertyPassed++;
      else propertyRejected.push({id, reason: `${file} is not a fast-check source at ${receipt.commit}`});
    }
    if (propertyPassed === 0 && propertyRejected.length === 0) {
      propertyRejected.push({reason: "receipt contains no property runs"});
    }
  } catch {
    propertyRejected.push({reason: "receipt is missing, unreadable or invalid JSON"});
  }

  return {
    ok: sealedBundles > 0 && tamperedBundles.length === 0 && propertyRejected.length === 0,
    sealedBundles, tamperedBundles, propertyPassed, propertyRejected,
  };
}

export function runStopGuard({stdinText = "", configuredTrigger = "Stop", env = process.env, root = ROOT} = {}) {
  const skipped = {skipped: true, code: 0, output: ""};
  if (env.SUBAGENT_GUARD_ACTIVE === "1") return skipped;
  const event = stdinText.trim() ? JSON.parse(stdinText) : {};
  const phase = resolvePhase(event, configuredTrigger);
  if (event?.stop_hook_active === true || phase !== "Stop") return skipped;

  const report = auditRepoReceipts(root);
  const summary = {
    guard: "subagent-stop-receipt-guard",
    phase,
    configuredTrigger,
    deliveredEvent: event?.hook_event_name ?? event?.hookEventName ?? null,
    ok: report.ok,
    sealedBundles: report.sealedBundles,
    tamperedCount: report.tamperedBundles.length,
    propertyPassed: report.propertyPassed,
    propertyRejectedCount: report.propertyRejected.length,
  };
  if (!report.ok) {
    summary.problems = [
      ...report.tamperedBundles,
      ...new Set(report.propertyRejected.map(({reason}) => `${PROPERTY_RECEIPT}: ${reason}`)),
    ];
    if (report.sealedBundles === 0) summary.problems.push("no intact Night Shift bundles found");
  }
  return {skipped: false, code: report.ok ? 0 : 1, output: JSON.stringify(summary), summary, report};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const stdinText = process.stdin.isTTY ? "" : readFileSync(0, "utf8");
    const result = runStopGuard({stdinText, configuredTrigger: process.argv[2]});
    if (result.output) {
      (result.code === 0 ? process.stdout : process.stderr).write(result.output + "\n");
    }
    process.exitCode = result.code;
  } catch (error) {
    console.error(`Receipt guard failed: ${error.message}`);
    process.exitCode = 1;
  }
}
