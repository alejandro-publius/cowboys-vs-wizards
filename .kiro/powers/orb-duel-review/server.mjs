// Read-only MCP server (newline-delimited JSON-RPC over stdio) for reviewing the
// Orb Duel Chrome replay receipt. It reads two fixed files under this repo and
// nothing else: no arbitrary paths, writes, network, shell or database.
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {createInterface} from "node:readline";
import {fileURLToPath} from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const RECEIPT = ".artifacts/kiro/replay/browser-run.json";
const PAGE = "dist/cowboys-vs-wizards-board-duel.html";
const REQUIRED_STEPS = 8;

function readFixed(rel) {
  try {
    return {bytes: readFileSync(root + rel)};
  } catch (error) {
    return {error: error.code === "ENOENT" ? "absent" : `unreadable (${error.code ?? "error"})`};
  }
}

function inspect() {
  const out = {receiptPath: RECEIPT, pagePath: PAGE};
  const page = readFixed(PAGE);
  if (page.bytes) {
    out.currentBuild = {bytes: page.bytes.length, sha256: createHash("sha256").update(page.bytes).digest("hex")};
  } else out.currentBuild = {error: page.error};

  const file = readFixed(RECEIPT);
  if (file.error) return {...out, verdict: file.error === "absent" ? "absent" : "malformed", reasons: [`receipt ${file.error}`]};
  let receipt;
  try {
    receipt = JSON.parse(file.bytes.toString("utf8"));
  } catch {
    return {...out, verdict: "malformed", reasons: ["receipt is not valid JSON"]};
  }
  const steps = receipt && Array.isArray(receipt.steps) ? receipt.steps : null;
  const errors = receipt && Array.isArray(receipt.consoleErrors) ? receipt.consoleErrors : null;
  const hash = receipt && receipt.page && typeof receipt.page.sha256 === "string" ? receipt.page.sha256 : null;
  const missing = [];
  if (!steps) missing.push("steps");
  if (!errors) missing.push("consoleErrors");
  if (!hash) missing.push("page.sha256");
  if (missing.length) return {...out, verdict: "malformed", reasons: [`receipt lacks a valid ${missing.join(", ")}`]};

  const observed = steps.filter((each) => each && each.state === "observed").length;
  const matches = Boolean(out.currentBuild.sha256) && hash === out.currentBuild.sha256;
  const reasons = [];
  if (!out.currentBuild.sha256) reasons.push(`current build ${out.currentBuild.error}; cannot compare`);
  else if (!matches) reasons.push("receipt hash differs from the current build (stale receipt)");
  if (observed !== REQUIRED_STEPS) reasons.push(`${observed} of ${REQUIRED_STEPS} steps observed`);
  if (steps.length !== REQUIRED_STEPS) reasons.push(`receipt lists ${steps.length} steps`);
  if (errors.length) reasons.push(`${errors.length} console error(s)`);
  if (receipt.error) reasons.push("receipt records a run error");

  let verdict = "pass";
  if (!out.currentBuild.sha256) verdict = "fail";
  else if (!matches) verdict = "stale";
  else if (reasons.length) verdict = "fail";
  return {
    ...out,
    verdict,
    reasons,
    receipt: {
      date: receipt.date ?? null,
      commit: receipt.commit ?? null,
      uncommittedChanges: receipt.uncommittedChanges ?? null,
      seed: receipt.seed ?? null,
      sha256: hash,
      coversCurrentBuild: matches,
      stepsObserved: observed,
      stepsRequired: REQUIRED_STEPS,
      pendingSteps: steps.filter((each) => !each || each.state !== "observed").map((each) => each && each.id),
      consoleErrorCount: errors.length,
      screenshots: Array.isArray(receipt.screenshots) ? receipt.screenshots : [],
    },
  };
}

const TOOL = {
  name: "inspect_duel_replay",
  description: "Check the fixed Chrome replay receipt against the current built Orb Duel page. Takes no arguments.",
  inputSchema: {type: "object", properties: {}, additionalProperties: false},
};

function reply(id, result) { process.stdout.write(JSON.stringify({jsonrpc: "2.0", id, result}) + "\n"); }
function fail(id, code, message) { process.stdout.write(JSON.stringify({jsonrpc: "2.0", id, error: {code, message}}) + "\n"); }

function handle(msg) {
  if (!msg || typeof msg !== "object" || Array.isArray(msg)) return fail(null, -32600, "Invalid request");
  if (msg.id === undefined || msg.id === null) return; // notification: no response
  switch (msg.method) {
    case "initialize":
      return reply(msg.id, {
        protocolVersion: msg.params?.protocolVersion ?? "2024-11-05",
        capabilities: {tools: {}},
        serverInfo: {name: "orb-duel-review", version: "1.0.0"},
      });
    case "ping":
      return reply(msg.id, {});
    case "tools/list":
      return reply(msg.id, {tools: [TOOL]});
    case "tools/call": {
      const params = msg.params;
      if (!params || params.name !== TOOL.name) return fail(msg.id, -32602, "Unknown tool");
      const args = params.arguments ?? {};
      if (typeof args !== "object" || Array.isArray(args) || Object.keys(args).length) return fail(msg.id, -32602, "inspect_duel_replay takes an empty object");
      return reply(msg.id, {content: [{type: "text", text: JSON.stringify(inspect(), null, 2)}]});
    }
    default:
      return fail(msg.id, -32601, "Method not found");
  }
}

createInterface({input: process.stdin}).on("line", (line) => {
  if (!line.trim()) return;
  let msg;
  try { msg = JSON.parse(line); } catch { return fail(null, -32700, "Parse error"); }
  handle(msg);
});
