// MCP server (newline-delimited JSON-RPC over stdio) for reviewing the Orb Duel Chrome replay
// receipt and the board character GLBs (earlier lane build and its 3D assets), for playing
// one seat of a Showdown Trail duel in memory (showdown.mjs), and for replaying a recorded
// Showdown proof against the current Showdown engine fingerprint. It reads only fixed files under
// this repo: no arbitrary paths, writes, network, shell or database.
import {createHash} from "node:crypto";
import {readFileSync, realpathSync} from "node:fs";
import {join} from "node:path";
import {createInterface} from "node:readline";
import {fileURLToPath} from "node:url";
import {parseGlb} from "./glb.mjs";
import {createTable, engineFingerprint, inspectShowdownReceipt, loadEngine} from "./showdown.mjs";

const VERSION = "1.3.0";

// Project binding: with PLUGIN_DATA set, only PLUGIN_DATA/project.json (written by setup.mjs)
// names the project. Never inferred. Without PLUGIN_DATA (workspace MCP), the source checkout.
let root = null;
let unavailable = null;
if (process.env.PLUGIN_DATA) {
  try {
    const bound = JSON.parse(readFileSync(join(process.env.PLUGIN_DATA, "project.json"), "utf8")).projectRoot;
    if (typeof bound !== "string" || !bound) throw new Error("projectRoot missing");
    root = realpathSync(bound) + "/";
  } catch {
    unavailable = "Orb Duel project is not bound: PLUGIN_DATA/project.json is absent or invalid. Run `node setup.mjs <projectRoot> <PLUGIN_DATA>` from the plugin folder.";
  }
} else root = fileURLToPath(new URL("../../../", import.meta.url));
const TARGETS = {
  standalone: {receipt: ".artifacts/kiro/replay/browser-run.json", page: "dist/cowboys-vs-wizards-board-duel.html"},
  web: {receipt: ".artifacts/kiro/web-replay/browser-run.json", page: "dist/web/index.html"},
  // Seed 60 Mounted Billy showdown on the same standalone build. Its receipt must also
  // share the build hash with the seed-0 standalone receipt (companion).
  showcase: {receipt: ".artifacts/kiro/showcase/browser-run.json", page: "dist/cowboys-vs-wizards-board-duel.html", steps: 4, seed: 60, companion: "standalone"},
};
const REQUIRED_STEPS = 8;
// Board characters only, mapped to fixed repo paths. Input never becomes a path.
const CHARACTERS = Object.fromEntries(["billy", "mounted-billy", "sheriff", "wizard", "dragon", "skeleton"].map((name) => [name, `assets/models/${name}.glb`]));

function readFixed(rel) {
  if (!root) return {error: "unavailable"};
  try {
    return {bytes: readFileSync(root + rel)};
  } catch (error) {
    return {error: error.code === "ENOENT" ? "absent" : `unreadable (${error.code ?? "error"})`};
  }
}

function inspect(target) {
  if (unavailable) return {target, verdict: "unavailable", reasons: [unavailable]};
  const {receipt: RECEIPT, page: PAGE, steps: required = REQUIRED_STEPS, seed: requiredSeed, companion} = TARGETS[target];
  // A page-hash receipt for the earlier lane duel build. It is never Showdown gameplay proof.
  const out = {target, kind: "lane-duel-chrome-replay", showdownProof: false, receiptPath: RECEIPT, pagePath: PAGE};
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
  if (observed !== required) reasons.push(`${observed} of ${required} steps observed`);
  if (steps.length !== required) reasons.push(`receipt lists ${steps.length} steps`);
  if (requiredSeed !== undefined && receipt.seed !== requiredSeed) reasons.push(`receipt seed is ${JSON.stringify(receipt.seed ?? null)}, required ${requiredSeed}`);
  let companionHash = null;
  let companionStale = false;
  if (companion) {
    const other = readFixed(TARGETS[companion].receipt);
    try {
      const page = other.bytes ? JSON.parse(other.bytes.toString("utf8")).page : null;
      companionHash = page && typeof page.sha256 === "string" ? page.sha256 : null;
    } catch { /* reported below */ }
    if (!companionHash) reasons.push(`${companion} receipt ${other.error ?? "has no page.sha256"}; cannot confirm the same build`);
    else if (companionHash !== hash) { companionStale = true; reasons.push(`receipt hash differs from the ${companion} receipt hash`); }
  }
  if (errors.length) reasons.push(`${errors.length} console error(s)`);
  if (receipt.error) reasons.push("receipt records a run error");

  let verdict = "pass";
  if (!out.currentBuild.sha256) verdict = "fail";
  else if (!matches || companionStale) verdict = "stale";
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
      ...(companion && {companion: {target: companion, receiptPath: TARGETS[companion].receipt, sha256: companionHash, sameBuild: companionHash === hash}}),
      coversCurrentBuild: matches,
      stepsObserved: observed,
      stepsRequired: required,
      pendingSteps: steps.filter((each) => !each || each.state !== "observed").map((each) => each && each.id),
      consoleErrorCount: errors.length,
      screenshots: Array.isArray(receipt.screenshots) ? receipt.screenshots : [],
    },
  };
}

// Identity and inventory of one character GLB, from the same parseGlb the audit script uses.
function inspectCharacter(model) {
  if (unavailable) return {isError: true, body: {model, error: unavailable}};
  const path = CHARACTERS[model];
  const file = readFixed(path);
  if (file.error) return {isError: true, body: {model, path, error: `model asset ${file.error}`}};
  try {
    const glb = parseGlb(file.bytes);
    return {body: {
      model, path, sha256: createHash("sha256").update(file.bytes).digest("hex"), bytes: glb.bytes,
      meshes: glb.meshes, vertices: glb.vertices, triangles: glb.triangles, unknown: glb.unknown,
      skins: glb.skins, joints: glb.joints, clips: glb.clips, extensions: glb.extensions,
    }};
  } catch (error) {
    return {isError: true, body: {model, path, error: `invalid GLB: ${error.message}`}};
  }
}

const TOOL = {
  name: "inspect_duel_replay",
  description: "Check a fixed Chrome replay receipt against its current built Orb Duel page. Optional target: standalone (default, seed-0 eight steps), web, or showcase (seed 60, four steps, same standalone build).",
  inputSchema: {
    type: "object",
    properties: {target: {type: "string", enum: Object.keys(TARGETS), default: "standalone"}},
    additionalProperties: false,
  },
};

const CHARACTER_TOOL = {
  name: "inspect_character_asset",
  description: `Report SHA-256, bytes, triangles and skin/joint/clip inventory of one board character GLB. Required model: ${Object.keys(CHARACTERS).join(", ")}.`,
  inputSchema: {
    type: "object",
    properties: {model: {type: "string", enum: Object.keys(CHARACTERS)}},
    required: ["model"],
    additionalProperties: false,
  },
};

// Showdown seat play. The bot and rules run in this process; the agent gets only the seat's view.
// SHOWDOWN_MCP_DEBUG_SEED fixes the deal for a reproducible proof run. No tool input sets it.
const SHOWDOWN_DUELS = ["boot-hill", "raven-roost", "bone-fence", "imp-hollow", "hexed-mile", "dragons-roost"];
let table = null;
async function showdownTable() {
  if (unavailable) throw new Error(unavailable);
  if (!table) {
    const debug = process.env.SHOWDOWN_MCP_DEBUG_SEED;
    if (debug !== undefined && !/^\d+$/.test(debug)) throw new Error("SHOWDOWN_MCP_DEBUG_SEED must be a whole number");
    table = createTable(await loadEngine(root), {fingerprint: engineFingerprint(root),
      ...(debug !== undefined && {seedSource: () => Number(debug) >>> 0})});
  }
  return table;
}
const SHOWDOWN_TOOLS = [
  {name: "start_showdown_duel",
    description: "Start a Showdown Trail duel with you as the Cowboys against the game's own bot. Returns an opaque session, a revision, your seat's view, numbered legal intents and a commitment to the hidden deal seed. Optional duel: a Trail id (default boot-hill).",
    inputSchema: {type: "object", properties: {duel: {type: "string", enum: SHOWDOWN_DUELS, default: "boot-hill"}}, additionalProperties: false}},
  {name: "observe_showdown",
    description: "Read the Cowboy seat's current view and legal intents for a session. Wizard hand, traps and both deck orders are counts only; the seed is revealed in `proof` only after the duel ends.",
    inputSchema: {type: "object", properties: {session: {type: "string"}}, required: ["session"], additionalProperties: false}},
  {name: "act_showdown",
    description: "Apply one listed intent by number at the current revision. The bot then plays its turns. Returns the public events and the new observation; a stale revision or unlisted intent is refused.",
    inputSchema: {type: "object", properties: {session: {type: "string"}, revision: {type: "string"}, intent: {type: "integer", minimum: 0}}, required: ["session", "revision", "intent"], additionalProperties: false}},
];
// Recorded Showdown proofs, mapped to fixed project paths. Input never becomes a path.
const SHOWDOWN_RECEIPTS = {
  "installed-power-boot-hill": "docs/evidence/showdown-installed-power/boot-hill-receipt.json",
  "mcp-boot-hill": "docs/evidence/kiro-showdown-mcp-boot-hill.json",
};
const RECEIPT_TOOL = {
  name: "inspect_showdown_receipt",
  description: `Replay one recorded Showdown seat proof on this project's Showdown engine and compare the engine fingerprint it was played on. Verdict pass, stale, unbound, rejected, malformed or absent. Not a Chrome replay. Optional receipt: ${Object.keys(SHOWDOWN_RECEIPTS).join(", ")} (default installed-power-boot-hill).`,
  inputSchema: {type: "object", properties: {receipt: {type: "string", enum: Object.keys(SHOWDOWN_RECEIPTS), default: "installed-power-boot-hill"}}, additionalProperties: false},
};
async function showdownReceipt(id) {
  const base = {receiptId: id, receiptPath: SHOWDOWN_RECEIPTS[id], kind: "showdown-gameplay-proof"};
  if (unavailable) return {...base, verdict: "unavailable", reasons: [unavailable]};
  const file = readFixed(SHOWDOWN_RECEIPTS[id]);
  if (file.error) return {...base, verdict: file.error === "absent" ? "absent" : "malformed", reasons: [`receipt ${file.error}`]};
  let receipt;
  try { receipt = JSON.parse(file.bytes.toString("utf8")); } catch { return {...base, verdict: "malformed", reasons: ["receipt is not valid JSON"]}; }
  let engine, current;
  try { engine = await loadEngine(root); current = engineFingerprint(root); } catch (error) {
    return {...base, verdict: "unavailable", reasons: [`Showdown engine not found in the bound project: ${error.message}`]};
  }
  return {...base, receiptSha256: createHash("sha256").update(file.bytes).digest("hex"), ...inspectShowdownReceipt(engine, current, receipt)};
}

const SHOWDOWN_KEYS = {start_showdown_duel: ["duel"], observe_showdown: ["session"], act_showdown: ["session", "revision", "intent"]};

async function showdownCall(name, args) {
  const play = await showdownTable();
  if (name === "start_showdown_duel") return play.start(args.duel ?? "boot-hill");
  if (name === "observe_showdown") return play.observe(args.session);
  return play.act(args.session, args.revision, args.intent);
}

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
        serverInfo: {name: "orb-duel-review", version: VERSION},
      });
    case "ping":
      return reply(msg.id, {});
    case "tools/list":
      return reply(msg.id, {tools: [TOOL, CHARACTER_TOOL, ...SHOWDOWN_TOOLS, RECEIPT_TOOL]});
    case "tools/call": {
      const params = msg.params;
      if (Object.hasOwn(SHOWDOWN_KEYS, params?.name ?? "")) {
        const args = params.arguments ?? {};
        if (typeof args !== "object" || args === null || Array.isArray(args)) return fail(msg.id, -32602, `${params.name} takes an object`);
        const allowed = SHOWDOWN_KEYS[params.name];
        if (Object.keys(args).some((key) => !allowed.includes(key))) return fail(msg.id, -32602, `Only ${allowed.join(", ")} accepted`);
        if (args.duel !== undefined && !SHOWDOWN_DUELS.includes(args.duel)) return fail(msg.id, -32602, `duel must be one of: ${SHOWDOWN_DUELS.join(", ")}`);
        if (params.name !== "start_showdown_duel" && typeof args.session !== "string") return fail(msg.id, -32602, "session must be a string");
        if (params.name === "act_showdown" && (typeof args.revision !== "string" || !Number.isInteger(args.intent))) return fail(msg.id, -32602, "revision must be a string and intent an integer");
        return showdownCall(params.name, args).then(
          (body) => reply(msg.id, {content: [{type: "text", text: JSON.stringify(body)}], ...(body.error && {isError: true})}),
          (error) => reply(msg.id, {content: [{type: "text", text: JSON.stringify({error: error.message})}], isError: true}));
      }
      if (params?.name === RECEIPT_TOOL.name) {
        const args = params.arguments ?? {};
        if (typeof args !== "object" || args === null || Array.isArray(args)) return fail(msg.id, -32602, "inspect_showdown_receipt takes an object");
        if (Object.keys(args).some((key) => key !== "receipt")) return fail(msg.id, -32602, "Only the receipt input is accepted");
        const id = args.receipt ?? "installed-power-boot-hill";
        if (typeof id !== "string" || !Object.hasOwn(SHOWDOWN_RECEIPTS, id)) return fail(msg.id, -32602, `receipt must be one of: ${Object.keys(SHOWDOWN_RECEIPTS).join(", ")}`);
        return showdownReceipt(id).then((body) => reply(msg.id, {content: [{type: "text", text: JSON.stringify(body, null, 2)}]}),
          (error) => reply(msg.id, {content: [{type: "text", text: JSON.stringify({error: error.message})}], isError: true}));
      }
      if (params?.name === CHARACTER_TOOL.name) {
        const args = params.arguments;
        if (typeof args !== "object" || args === null || Array.isArray(args)) return fail(msg.id, -32602, "inspect_character_asset takes an object");
        if (Object.keys(args).some((key) => key !== "model")) return fail(msg.id, -32602, "Only the model input is accepted");
        if (typeof args.model !== "string" || !Object.hasOwn(CHARACTERS, args.model)) return fail(msg.id, -32602, `model must be one of: ${Object.keys(CHARACTERS).join(", ")}`);
        const {isError, body} = inspectCharacter(args.model);
        return reply(msg.id, {content: [{type: "text", text: JSON.stringify(body, null, 2)}], ...(isError && {isError})});
      }
      if (!params || params.name !== TOOL.name) return fail(msg.id, -32602, "Unknown tool");
      const args = params.arguments ?? {};
      if (typeof args !== "object" || args === null || Array.isArray(args)) return fail(msg.id, -32602, "inspect_duel_replay takes an object");
      if (Object.keys(args).some((key) => key !== "target")) return fail(msg.id, -32602, "Only the target input is accepted");
      const target = args.target === undefined ? "standalone" : args.target;
      if (typeof target !== "string" || !Object.hasOwn(TARGETS, target)) return fail(msg.id, -32602, `target must be one of: ${Object.keys(TARGETS).join(", ")}`);
      return reply(msg.id, {content: [{type: "text", text: JSON.stringify(inspect(target), null, 2)}]});
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
