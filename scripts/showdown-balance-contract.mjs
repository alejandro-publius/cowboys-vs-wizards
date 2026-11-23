// Night Shift balance contract: reads the NSB-1 band and the NSB-2 first-seat tolerance from
// .kiro/specs/night-shift-balance-contract/requirements.md and evaluates measured shares against them.
// Only the small grammar documented in that file is accepted; anything else fails closed.
import {readFileSync} from "node:fs";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

export const CONTRACT_PATH = ".kiro/specs/night-shift-balance-contract/requirements.md";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export class BalanceContractError extends Error {}

const NUM = "(\\d+(?:\\.\\d+)?)";
const TEMPLATES = Object.freeze({
  "NSB-1": new RegExp(`^- NSB-1: Each faction['’]s win share SHALL be within ${NUM}% to ${NUM}%, inclusive\\.$`),
  "NSB-2": new RegExp(`^- NSB-2: The opening player['’]s absolute win-share distance from 50% SHALL grow by at most ${NUM} percentage points? versus the baseline\\.$`),
});
// A list item that starts with an identifier, or any line using the modal verb, is normative.
const NORMATIVE = /^\s*[-*+]\s+[A-Za-z][A-Za-z0-9]*-\d+\s*:|\bSHALL\b/;

const finite = (v) => typeof v === "number" && Number.isFinite(v);
const percent = (v) => finite(v) && v >= 0 && v <= 100;

// Problems with a {band, seatTolerancePp} policy; empty when it is usable.
export function contractProblems(policy) {
  const band = policy?.band, problems = [];
  if (!Array.isArray(band) || band.length !== 2 || !band.every(percent)) problems.push(`NSB-1 bounds must be two finite percents from 0 to 100, got ${JSON.stringify(band)}`);
  else if (band[0] > band[1]) problems.push(`NSB-1 bounds are inverted: ${band[0]}% to ${band[1]}%`);
  if (!percent(policy?.seatTolerancePp)) problems.push(`NSB-2 tolerance must be a finite percent from 0 to 100, got ${JSON.stringify(policy?.seatTolerancePp)}`);
  return problems;
}

export function parseBalanceContract(markdown) {
  if (typeof markdown !== "string") throw new BalanceContractError("balance requirements are malformed:\n  - expected markdown text");
  const found = {}, problems = [];
  markdown.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trimEnd(), at = `line ${i + 1}`;
    if (!NORMATIVE.test(line)) return;
    const id = /^- (NSB-[12]):/.exec(line)?.[1];
    const match = id && TEMPLATES[id].exec(line);
    if (!match) return problems.push(`${at}: unsupported normative line: ${line.trim().slice(0, 160)}`);
    if (found[id]) return problems.push(`${at}: duplicate ${id} (first on line ${found[id].line})`);
    found[id] = {line: i + 1, values: match.slice(1).map(Number)};
  });
  for (const id of Object.keys(TEMPLATES)) if (!found[id]) problems.push(`missing ${id}`);
  const contract = problems.length ? null : {band: found["NSB-1"].values, seatTolerancePp: found["NSB-2"].values[0]};
  if (contract) problems.push(...contractProblems(contract));
  if (problems.length) throw new BalanceContractError(`balance requirements are malformed:\n  - ${problems.join("\n  - ")}`);
  return Object.freeze({band: Object.freeze(contract.band), seatTolerancePp: contract.seatTolerancePp});
}

export function loadBalanceContract(file = join(ROOT, CONTRACT_PATH)) {
  let text;
  try { text = readFileSync(file, "utf8"); } catch (error) { throw new BalanceContractError(`balance requirements could not be read (${file}): ${error.message}`); }
  return parseBalanceContract(text);
}

// Inclusive band check; non-finite values or bounds never pass.
export const inBand = (value, band) => finite(value) && finite(band?.[0]) && finite(band?.[1]) && value >= band[0] && value <= band[1];

// Observations in percent units; seatSkew is abs(firstSharePct - 50). `measured` is false when an observation is missing.
export function evaluateBalanceRequirements(policy, {cowboyShare, wizardShare, seatSkew, baselineSeatSkew} = {}) {
  const tolerance = policy?.seatTolerancePp, seatMeasured = finite(seatSkew) && finite(baselineSeatSkew);
  return [
    {id: "NSB-1", pass: inBand(cowboyShare, policy?.band) && inBand(wizardShare, policy?.band),
      measured: finite(cowboyShare) && finite(wizardShare), cowboyShare, wizardShare, band: policy?.band},
    {id: "NSB-2", pass: seatMeasured && finite(tolerance) && seatSkew <= baselineSeatSkew + tolerance,
      measured: seatMeasured, seatSkew, baselineSeatSkew, seatTolerancePp: tolerance},
  ];
}
