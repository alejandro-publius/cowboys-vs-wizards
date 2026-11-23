// Billy balance gate: checks the committed Billy seat audit (docs/evidence/billy-seat-audit) against the
// Night Shift balance contract (.kiro/specs/night-shift-balance-contract/requirements.md, NSB-1 and NSB-2).
//
//   node scripts/billy-balance-gate.mjs --arm baseline|candidate
//
// It first re-derives every count, transition and block of result.json from outcomes.csv.gz with the current
// summarizeRows and the frozen protocol, and stops if anything is missing or differs. Only then does it read the
// current contract and decide the chosen arm. The verdict is an observation on recorded games: nothing is applied,
// deployed or changed. Suitable as a Stop hook.
// Exit status: 0 PASS, 2 red (reasons on stderr), 1 unusable input or evidence (never green).
import {deepStrictEqual} from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync, statSync} from "node:fs";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {gunzipSync} from "node:zlib";
import {evaluateBalanceRequirements, loadBalanceContract} from "./showdown-balance-contract.mjs";
import {HEADER, summarizeRows, validateProtocol} from "./billy-seat-audit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
export const EVIDENCE_DIR = resolve(HERE, "../docs/evidence/billy-seat-audit");
export const ARMS = Object.freeze(["baseline", "candidate"]);
export const EXIT = Object.freeze({pass: 0, invalid: 1, red: 2});
const MAX_JSON_BYTES = 1 << 20;
// Longest possible row: uint32 seed, longest seat and winner names, two safe-integer turns, commas and LF.
const MAX_ROW_BYTES = 10 + 6 * 3 + 16 * 2 + 6;
const MEANING = Object.freeze({
  pass: "Measured match shares meet NSB-1 and NSB-2. Ready for Fable/Alex review only; not applied to any card or release.",
  red: "Do not forward this candidate.",
});

export class EvidenceError extends Error {}
const sha256 = data => createHash("sha256").update(data).digest("hex");
const fmt = value => String(Number(value.toFixed(4)));

function readBounded(path, maxBytes, label) {
  let info;
  try { info = statSync(path); } catch (error) { throw new EvidenceError(`${label} is missing (${path}): ${error.code ?? error.message}`); }
  if (!info.isFile()) throw new EvidenceError(`${label} is not a regular file (${path})`);
  if (info.size > maxBytes) throw new EvidenceError(`${label} is ${info.size} bytes, over the ${maxBytes}-byte bound`);
  return readFileSync(path);
}

function parseJson(bytes, label) {
  try { return JSON.parse(new TextDecoder("utf-8", {fatal: true}).decode(bytes)); }
  catch (error) { throw new EvidenceError(`${label} is not valid UTF-8 JSON: ${error.message}`); }
}

// First differing path between two JSON values, or null.
function difference(a, b, path) {
  if (Object.is(a, b)) return null;
  if (!a || !b || typeof a !== "object" || typeof b !== "object" || Array.isArray(a) !== Array.isArray(b)) return path;
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (!(key in a) || !(key in b)) return `${path}.${key}`;
    const found = difference(a[key], b[key], `${path}.${key}`);
    if (found) return found;
  }
  return null;
}

// Reads and fully re-derives the committed evidence. Returns the verified protocol, result and hashes; throws EvidenceError otherwise.
export function verifyEvidence(dir = EVIDENCE_DIR) {
  const protocolBytes = readBounded(join(dir, "protocol.json"), MAX_JSON_BYTES, "protocol.json");
  const protocol = parseJson(protocolBytes, "protocol.json");
  try { validateProtocol(protocol); } catch (error) { throw new EvidenceError(`protocol.json: ${error.message}`); }
  const protocolSha256 = sha256(protocolBytes);

  const maxCsvBytes = HEADER.length + 1 + protocol.deals * protocol.seats.length * MAX_ROW_BYTES;
  const gz = readBounded(join(dir, "outcomes.csv.gz"), maxCsvBytes, "outcomes.csv.gz");
  let csvBytes;
  try { csvBytes = gunzipSync(gz, {maxOutputLength: maxCsvBytes}); }
  catch (error) { throw new EvidenceError(`outcomes.csv.gz does not decompress within ${maxCsvBytes} bytes: ${error.message}`); }
  let csv;
  try { csv = new TextDecoder("utf-8", {fatal: true}).decode(csvBytes); }
  catch { throw new EvidenceError("outcomes.csv is not valid UTF-8"); }

  const recorded = parseJson(readBounded(join(dir, "result.json"), MAX_JSON_BYTES, "result.json"), "result.json");
  if (!recorded || typeof recorded !== "object" || Array.isArray(recorded)) throw new EvidenceError("result.json is not a JSON object");
  if (recorded.protocolSha256 !== protocolSha256) throw new EvidenceError(`result.json names protocol SHA-256 ${recorded.protocolSha256}, but protocol.json hashes to ${protocolSha256}`);
  const csvSha256 = sha256(csvBytes);
  if (recorded.csvSha256 !== csvSha256) throw new EvidenceError(`result.json names CSV SHA-256 ${recorded.csvSha256}, but outcomes.csv hashes to ${csvSha256}`);

  let derived;
  try { derived = summarizeRows(csv, protocol, protocolSha256); }
  catch (error) { throw new EvidenceError(`outcomes.csv: ${error.message}`); }
  const differs = difference(derived, recorded, "result");
  if (differs) throw new EvidenceError(`result.json differs from the result re-derived from outcomes.csv at ${differs}`);
  try { deepStrictEqual(derived, recorded); } catch { throw new EvidenceError("result.json differs from the result re-derived from outcomes.csv"); }
  return {protocol, result: derived, protocolSha256, csvSha256, gzSha256: sha256(gz)};
}

// Faction shares and first-seat distance for one arm, in percent and percentage points. Draws count for neither faction.
export function armObservations(result, protocol, arm) {
  let games = 0, cowboy = 0, wizard = 0, first = 0;
  for (const seat of protocol.seats) {
    const cell = result.byFirst[seat];
    games += cell.gamesPerArm;
    cowboy += cell[arm].cowboy;
    wizard += cell[arm].wizard;
    first += cell[arm][seat];
  }
  if (!(games > 0)) throw new EvidenceError(`no games recorded for the ${arm} arm`);
  const firstSharePct = (100 * first) / games;
  return {games, cowboyShare: (100 * cowboy) / games, wizardShare: (100 * wizard) / games, firstSharePct, seatSkew: Math.abs(firstSharePct - 50)};
}

function checkPolicy(policy) {
  const band = policy?.band;
  if (!Array.isArray(band) || band.length !== 2 || !band.every(Number.isFinite) || band[0] > band[1]) throw new EvidenceError("balance contract has no usable NSB-1 band");
  if (!Number.isFinite(policy.seatTolerancePp)) throw new EvidenceError("balance contract has no usable NSB-2 tolerance");
  return policy;
}

// The decision for one arm. Pure apart from reading the evidence directory; throws EvidenceError on unusable input.
export function runGate({arm, policy, evidenceDir = EVIDENCE_DIR} = {}) {
  if (!ARMS.includes(arm)) throw new EvidenceError(`arm must be ${ARMS.join(" or ")}`);
  const evidence = verifyEvidence(evidenceDir);
  // The contract is read only after the evidence has been verified.
  if (policy === undefined) policy = loadBalanceContract();
  checkPolicy(policy);
  const observed = armObservations(evidence.result, evidence.protocol, arm);
  const baseline = arm === "baseline" ? observed : armObservations(evidence.result, evidence.protocol, "baseline");
  const outcomes = evaluateBalanceRequirements(policy, {cowboyShare: observed.cowboyShare, wizardShare: observed.wizardShare,
    seatSkew: observed.seatSkew, baselineSeatSkew: baseline.seatSkew});
  const passOf = id => {
    const found = Array.isArray(outcomes) ? outcomes.filter(o => o?.id === id) : [];
    if (found.length !== 1 || typeof found[0].pass !== "boolean") throw new EvidenceError(`balance contract returned no single boolean outcome for ${id}`);
    return found[0].pass;
  };
  const [low, high] = policy.band, tol = policy.seatTolerancePp, seatLimit = baseline.seatSkew + tol;
  const requirements = [
    {id: "NSB-1", pass: passOf("NSB-1"), actual: {cowboyShare: observed.cowboyShare, wizardShare: observed.wizardShare}, allowed: {band: [low, high]},
      line: `Cowboy ${fmt(observed.cowboyShare)}%, Wizard ${fmt(observed.wizardShare)}%; allowed ${fmt(low)}% to ${fmt(high)}% inclusive`},
    {id: "NSB-2", pass: passOf("NSB-2"), actual: {seatSkew: observed.seatSkew, baselineSeatSkew: baseline.seatSkew}, allowed: {maxSeatSkew: seatLimit},
      line: `first-seat distance from 50% ${fmt(observed.seatSkew)} pp (baseline ${fmt(baseline.seatSkew)} pp); allowed at most ${fmt(seatLimit)} pp (+${fmt(tol)})`},
  ];
  const reasons = [];
  for (const [label, key] of [["Cowboy", "cowboyShare"], ["Wizard", "wizardShare"]]) {
    if (!requirements[0].pass && !(observed[key] >= low && observed[key] <= high)) reasons.push(`NSB-1: ${label} share ${observed[key].toFixed(2)}% is outside ${low}-${high}%`);
  }
  if (!requirements[0].pass && !reasons.length) reasons.push("NSB-1: faction shares did not pass the contract");
  if (!requirements[1].pass) reasons.push(`NSB-2: first-seat skew grew ${baseline.seatSkew.toFixed(2)} -> ${observed.seatSkew.toFixed(2)} pp (tolerance ${tol})`);
  const pass = requirements.every(r => r.pass);
  return {arm, attack: evidence.protocol[arm], pass, verdict: pass ? "PASS" : "RED", reasons, meaning: pass ? MEANING.pass : MEANING.red,
    requirements, observed, evidence: {protocolSha256: evidence.protocolSha256, csvSha256: evidence.csvSha256, gzSha256: evidence.gzSha256, totalDuels: evidence.result.totalDuels}};
}

export function report(gate) {
  return [
    `Billy balance gate, ${gate.arm} arm (Billy attack ${gate.attack}): observation on recorded games; nothing deployed.`,
    `Evidence re-derived: ${gate.evidence.totalDuels} duels match result.json (protocol SHA-256 ${gate.evidence.protocolSha256}, CSV SHA-256 ${gate.evidence.csvSha256}).`,
    ...gate.requirements.map(r => `${r.id} ${r.pass ? "PASS" : "RED"}: ${r.line}`),
    `Overall ${gate.verdict}. ${gate.meaning}`,
  ].join("\n");
}

export function main(argv, {policy, evidenceDir} = {}) {
  if (argv.length !== 2 || argv[0] !== "--arm" || !ARMS.includes(argv[1])) {
    console.error("Usage: node scripts/billy-balance-gate.mjs --arm baseline|candidate");
    return EXIT.invalid;
  }
  let gate;
  try { gate = runGate({arm: argv[1], policy, evidenceDir}); }
  catch (error) {
    console.error(`billy-balance-gate: not decided, unusable input or evidence: ${error.message}`);
    return EXIT.invalid;
  }
  console.log(report(gate));
  if (gate.pass) return EXIT.pass;
  console.error(`billy-balance-gate: RED for the ${gate.arm} arm (observation; nothing deployed): ${gate.reasons.join("; ")}`);
  return EXIT.red;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (error) {
    console.error(`billy-balance-gate: ${error.message}`);
    process.exitCode = EXIT.invalid;
  }
}
