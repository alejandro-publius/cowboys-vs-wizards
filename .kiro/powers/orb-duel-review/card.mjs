// Card proposal review (.kiro/specs/duel-card-pipeline R5): one exact stat change to one card spec,
// checked by the project's own Showdown smoke sample, seeds 0-99 from both openers (R5.5,
// `node scripts/showdown-smoke.mjs --from 0 --count 100`, here with --json).
// Record a receipt in the bound project (refuses unless the spec shows the proposal and the generated
// catalog matches the specs by `node scripts/sync-card-specs.mjs --check`, R3.2):
//   node card.mjs --record <projectRoot> <card> "<proposal>"
// Inspect (MCP inspect_card_review): reruns the same sample CLI in a child Node process (fixed
// arguments, no shell) on the bound project and accepts the receipt only if the card, proposal, spec
// bytes, the sample's import closure (saved as its canonical fingerprint) and the whole sample equal
// it. `measured` follows R5.5.
import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import {mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import {closureFingerprint, engineFingerprint} from "./showdown.mjs";

export const KIND = "showdown-card-review";
export const SCHEMA = "orb-duel-review/card-review@1";
export const RECEIPT = ".artifacts/kiro/card-review/receipt.json";
export const SMOKE = "scripts/showdown-smoke.mjs";
export const SAMPLE_ARGS = Object.freeze([SMOKE, "--from", "0", "--count", "100", "--json"]);
export const SYNC_CHECK = Object.freeze(["scripts/sync-card-specs.mjs", "--check"]);
export const CARD_RULE = /^[a-z][a-z0-9-]{0,31}$/;
const CARD_DIR = ".kiro/specs/duel-card-pipeline/cards/";
const SCOPE = "Showdown smoke sample (seeds 0-99, each from both openers, level-2 bot, even-match decks) replayed on the bound project. An estimate for those conditions only: not a balance verdict, not approval of the change, and nothing about clarity or fun.";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const tail = (text) => String(text ?? "").trim().split("\n").slice(-4).join(" | ").slice(0, 600);

// R5.3: exactly `review existing`, or one `<field> = <whole number>` for stars, health, attack or copies.
export function parseProposal(text) {
  if (text === "review existing") return {kind: "review"};
  const match = typeof text === "string" ? /^(stars|health|attack|copies) = (0|[1-9][0-9]{0,2})$/.exec(text) : null;
  return match ? {kind: "stat", field: match[1], value: Number(match[2])} : null;
}

// R5.2: the key becomes a path only after the pattern check; a missing spec throws.
function readSpec(root, card) {
  if (typeof card !== "string" || !CARD_RULE.test(card)) throw new Error(`card key must match ${CARD_RULE}`);
  const path = `${CARD_DIR}${card}.json`;
  const bytes = readFileSync(join(root, path));
  return {path, sha256: sha(bytes), spec: JSON.parse(bytes)};
}

// R5.5 on the sample's entry for the card. Copies come from the even-match decks, never the spec.
export function measurement(proposal, entry) {
  if (proposal.kind === "review") return {measured: false, reasons: ["review existing proposes no change, so there is nothing to measure"]};
  const reasons = [];
  if (!entry) reasons.push("the card is not in the Showdown catalog the sample read");
  else {
    if (proposal.field === "copies") reasons.push("deck copies come from the even-match decks (src/game/showdown/cards.js DECKS), so a copies proposal is never measured by this sample");
    else if (entry.engineStats?.[proposal.field] !== proposal.value) {
      reasons.push(`the engine played ${proposal.field} ${JSON.stringify(entry.engineStats?.[proposal.field] ?? null)}, not the proposed ${proposal.value}`);
    }
    if (entry.status === "in-deck-unobserved") reasons.push("in the sampled decks but never played: no measured coverage");
    else if (entry.status === "outside-sample") reasons.push("outside the sampled even-match decks: no measured coverage");
  }
  return {measured: reasons.length === 0, reasons};
}

function runNode(root, args) {
  return spawnSync(process.execPath, args, {cwd: root, encoding: "utf8", env: {PATH: process.env.PATH ?? ""}, maxBuffer: 64 << 20, timeout: 300_000});
}

// The sample from the project's own CLI. `text` is its stdout line, byte for byte.
function runSample(root) {
  const run = runNode(root, SAMPLE_ARGS);
  if (run.status !== 0) return {error: `node ${SAMPLE_ARGS.join(" ")} exited ${run.status ?? run.signal}: ${tail(run.stderr || run.stdout)}`};
  const text = run.stdout.trim();
  try { return {text, report: JSON.parse(text)}; } catch { return {error: "the sample CLI did not print one JSON report"}; }
}

const changed = (recorded, current) => [...new Set([...Object.keys(recorded ?? {}), ...Object.keys(current)])].filter((path) => recorded?.[path] !== current[path]).sort();

export function recordCardReview(root, card, text) {
  const proposal = parseProposal(text);
  if (!proposal) throw new Error("proposal must be `review existing` or one `<stars|health|attack|copies> = <whole number>`");
  const spec = readSpec(root, card);
  if (proposal.kind === "stat" && spec.spec[proposal.field] !== proposal.value) {
    throw new Error(`${spec.path} shows ${proposal.field} ${JSON.stringify(spec.spec[proposal.field] ?? null)}, not the proposed ${proposal.value}: apply the proposal to the spec first`);
  }
  const sync = runNode(root, SYNC_CHECK);
  if (sync.status !== 0) throw new Error(`node ${SYNC_CHECK.join(" ")} exited ${sync.status ?? sync.signal}: the generated catalog does not match the card specs; run sh scripts/check-card-specs.sh`);
  const closure = engineFingerprint(root, [SMOKE]);
  const sample = runSample(root);
  if (sample.error) throw new Error(sample.error);
  if (engineFingerprint(root, [SMOKE]).sha256 !== closure.sha256 || readSpec(root, card).sha256 !== spec.sha256) throw new Error("the project changed while the sample ran; record again");
  const receipt = {schema: SCHEMA, card, proposal: text, spec: {path: spec.path, sha256: spec.sha256},
    checks: [{command: `node ${SYNC_CHECK.join(" ")}`, exit: 0}, {command: `node ${SAMPLE_ARGS.join(" ")}`, exit: 0}],
    closure, sample: sample.report};
  const file = join(root, RECEIPT);
  mkdirSync(dirname(file), {recursive: true});
  const temporary = `${file}.${process.pid}.tmp`;
  try {
    writeFileSync(temporary, JSON.stringify(receipt, null, 2) + "\n", {flag: "wx"});
    renameSync(temporary, file);
  } finally { rmSync(temporary, {force: true}); }
  const {measured, reasons: pending} = measurement(proposal, sample.report.cards[card]);
  return {receipt, entry: sample.report.cards[card] ?? null, measured, pending};
}

// Verdict on the recorded receipt for this card and proposal, against the bound project now.
// pass: same card, proposal, spec bytes and sample closure, and the rerun sample equals the receipt.
// stale: the spec or the sample's code closure changed since recording. rejected: another card or
// proposal, a spec that does not show the proposal, or a sample the rerun does not reproduce.
// malformed: not a receipt of this schema, or a saved closure that is not the canonical fingerprint
// of its own file map (aggregate, count or order disagree), which `--record` never writes.
export function inspectCardReview(root, card, text) {
  const proposal = parseProposal(text);
  const out = {kind: KIND, scope: SCOPE, receiptPath: RECEIPT, card, proposal: text};
  const none = (verdict, reasons) => ({...out, verdict, reasons, measured: false, pending: [`receipt verdict is ${verdict}`]});
  if (!proposal || typeof card !== "string" || !CARD_RULE.test(card)) return none("rejected", ["the card key or proposal is not valid (duel-card-pipeline R5.2, R5.3)"]);
  let bytes;
  try { bytes = readFileSync(join(root, RECEIPT)); } catch (error) {
    return none(error.code === "ENOENT" ? "absent" : "malformed", [error.code === "ENOENT" ? `no receipt: run node card.mjs --record <projectRoot> ${card} "${text}"` : `receipt unreadable (${error.code ?? "error"})`]);
  }
  out.receiptSha256 = sha(bytes);
  let receipt;
  try { receipt = JSON.parse(bytes); } catch { return none("malformed", ["receipt is not valid JSON"]); }
  const shape = receipt && receipt.schema === SCHEMA && typeof receipt.card === "string" && typeof receipt.proposal === "string"
    && typeof receipt.spec?.sha256 === "string" && typeof receipt.closure?.sha256 === "string" && receipt.closure.files && typeof receipt.closure.files === "object"
    && receipt.sample && typeof receipt.sample === "object" && !Array.isArray(receipt.sample);
  if (!shape) return none("malformed", [`receipt is not a ${SCHEMA} record with card, proposal, spec, closure and sample`]);
  // The stale check below compares per-file hashes, so the aggregate must be derived from them.
  const canonical = closureFingerprint(receipt.closure.files);
  const incoherent = [...new Set([...Object.keys(receipt.closure), ...Object.keys(canonical)])]
    .filter((key) => JSON.stringify(receipt.closure[key]) !== JSON.stringify(canonical[key]));
  if (incoherent.length) return none("malformed", [`the receipt's closure is not the canonical fingerprint of its own file map (differs in: ${incoherent.join(", ")}); record again`]);
  if (receipt.card !== card || receipt.proposal !== text) {
    return none("rejected", [`receipt records ${JSON.stringify(receipt.card)} with ${JSON.stringify(receipt.proposal)}, not this card and proposal`]);
  }

  let spec, closure;
  try { spec = readSpec(root, card); closure = engineFingerprint(root, [SMOKE]); } catch (error) {
    return none("unavailable", [`the bound project cannot be checked: ${error.message}`]);
  }
  const changedFiles = changed(receipt.closure.files, closure.files);
  if (receipt.spec.sha256 !== spec.sha256) changedFiles.unshift(spec.path);
  out.spec = {path: spec.path, sha256: spec.sha256, recorded: receipt.spec.sha256, value: proposal.kind === "stat" ? spec.spec[proposal.field] ?? null : null};
  out.closure = {current: closure.sha256, recorded: receipt.closure.sha256, fileCount: closure.fileCount, changedFiles};
  if (changedFiles.length) return none("stale", [`${changedFiles.length} file(s) changed since the receipt was recorded: ${changedFiles.join(", ")}; record again`]);
  if (proposal.kind === "stat" && spec.spec[proposal.field] !== proposal.value) {
    return none("rejected", [`${spec.path} shows ${proposal.field} ${JSON.stringify(spec.spec[proposal.field] ?? null)}, not the proposed ${proposal.value}`]);
  }

  const fresh = runSample(root);
  if (fresh.error) return none("unavailable", [fresh.error]);
  if (engineFingerprint(root, [SMOKE]).sha256 !== closure.sha256 || readSpec(root, card).sha256 !== spec.sha256) {
    return none("unavailable", ["the project changed while the sample ran; inspect again"]);
  }
  const entry = fresh.report.cards?.[card] ?? null;
  out.sample = {command: `node ${SAMPLE_ARGS.join(" ")}`, seeds: fresh.report.seeds, results: fresh.report.results, recordsSha256: fresh.report.recordsSha256,
    card: entry && {status: entry.status, gamesPlayed: entry.gamesPlayed, plays: entry.plays, copies: entry.copies, engineStats: entry.engineStats ?? null}};
  if (JSON.stringify(receipt.sample) !== fresh.text) {
    const keys = [...new Set([...Object.keys(receipt.sample), ...Object.keys(fresh.report)])]
      .filter((key) => JSON.stringify(receipt.sample[key]) !== JSON.stringify(fresh.report[key]));
    return none("rejected", [`the rerun sample differs from the receipt in: ${keys.join(", ") || "formatting"}`]);
  }
  const {measured, reasons: pending} = measurement(proposal, entry);
  return {...out, verdict: "pass", reasons: [], measured, pending};
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv[2] === "--record") {
  const [rootArg, card, text, ...extra] = process.argv.slice(3);
  if (!rootArg || !card || text === undefined || extra.length) {
    console.error('usage: node card.mjs --record <projectRoot> <card> "<review existing | stars|health|attack|copies = N>"');
    process.exit(2);
  }
  try {
    const done = recordCardReview(realpathSync(rootArg) + "/", card, text);
    const entry = done.entry;
    console.log(`recorded ${RECEIPT}: ${card} "${text}", closure ${done.receipt.closure.sha256} (${done.receipt.closure.fileCount} files), spec ${done.receipt.spec.sha256}`);
    console.log(`  sample: ${done.receipt.sample.results.games} games; ${card} ${entry ? `${entry.status}, played in ${entry.gamesPlayed} games, engine ${JSON.stringify(entry.engineStats ?? null)}` : "not in the catalog"}`);
    console.log(`  measured: ${done.measured}${done.pending.length ? ` (pending: ${done.pending.join("; ")})` : ""}`);
  } catch (error) {
    console.error(`card review not recorded: ${error.message}`);
    process.exit(1);
  }
}
