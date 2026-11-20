// Outrider ride decision check (K-039). Re-derives one recorded ride decision from the bound project's
// own Outrider experiment (experiments/showdown-outrider/compare.js `replay`) and compares it with a
// receipt shipped in this package (cases/). Reports the bound game commit, the built page hash and a
// replay URL only when the game itself allowlists a route for the case. Ride advice is allowed only when
// the case passes, the route exists and the receipt carries verified paired outcomes; otherwise withheld.
// Output carries the Cowboy seat's public view only: no seed, prefix, Wizard hand, traps or deck order.
// Record a receipt: node ride.mjs --record <projectRoot> <caseId>
import {createHash} from "node:crypto";
import {existsSync, readFileSync, realpathSync, writeFileSync} from "node:fs";
import {join} from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {engineFingerprint} from "./showdown.mjs";

const HERE = fileURLToPath(new URL("./", import.meta.url));
// The decision's code closure: the experiment that derives it and the game's turn-route allowlist.
export const RIDE_ENTRIES = ["experiments/showdown-outrider/compare.js", "src/match/showdown-turn.js"];
export const PAGE = "dist/cowboys-vs-wizards-board-duel.html";
// Fixed case ids mapped to package files. Input never becomes a path.
export const RIDE_CASES = {
  "outrider-ride-search": "cases/outrider-ride-search.json",
  "outrider-replay-infrastructure": "cases/outrider-replay-infrastructure.json",
};
// Searched cases (experiments/showdown-outrider/decision/, search worker): code closure and fixed data files.
const DECISION = "experiments/showdown-outrider/decision/";
export const SEARCH_ENTRIES = [`${DECISION}decision.js`, "src/match/showdown-turn.js"];
export const SEARCH_DATA = ["positions.json", "replay.json", "results/observed.json", "results/holdout-1200-1299.json"].map((f) => DECISION + f);
const entriesFor = (receipt) => (receipt.derive?.source === "search" ? SEARCH_ENTRIES : RIDE_ENTRIES);
const KIND = "showdown-ride-decision";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

// The commit checked out in `root`, read from git's files (worktrees and packed refs included). No shell.
export function gitCommit(root) {
  try {
    let gitDir = join(root, ".git");
    const dotGit = readFileSync(gitDir, "utf8").match(/^gitdir:\s*(.+)\s*$/m);
    if (dotGit) gitDir = dotGit[1];
    return resolveHead(gitDir);
  } catch (error) {
    if (error.code === "EISDIR") return resolveHead(join(root, ".git"));
    return {commit: null, ref: null, error: "no git checkout"};
  }
}
function resolveHead(gitDir) {
  const head = readFileSync(join(gitDir, "HEAD"), "utf8").trim();
  if (/^[0-9a-f]{40}$/.test(head)) return {commit: head, ref: null};
  const ref = head.replace(/^ref:\s*/, "");
  const common = existsSync(join(gitDir, "commondir")) ? join(gitDir, readFileSync(join(gitDir, "commondir"), "utf8").trim()) : gitDir;
  for (const dir of [gitDir, common]) {
    const file = join(dir, ref);
    if (existsSync(file)) return {commit: readFileSync(file, "utf8").trim(), ref};
  }
  const packed = existsSync(join(common, "packed-refs")) ? readFileSync(join(common, "packed-refs"), "utf8") : "";
  const line = packed.split("\n").find((each) => each.endsWith(` ${ref}`));
  return line ? {commit: line.split(" ")[0], ref} : {commit: null, ref, error: "ref not found"};
}

// Re-derive a searched case: fresh sessions reach the public position, then both arms are played out
// and compared with the observed results. Outcomes stay inside: only `pairedOutcomesMatch` leaves.
async function deriveSearch(root, label) {
  const read = (rel) => JSON.parse(readFileSync(join(root, rel), "utf8"));
  const decision = await import(pathToFileURL(join(root, `${DECISION}decision.js`)).href);
  const [positions, replay, observed, holdout] = SEARCH_DATA.map(read);
  const shown = positions.find((each) => each.label === label);
  const entry = replay[label];
  if (!shown || !entry || !observed[label]) return null;
  const session = decision.openAt(entry.seed, entry);
  const position = session.view();
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const legal = ["ride", "fight"].every((arm) => session.legal().some((each) => same(each, shown.choices[arm])));
  const arms = decision.playArms(entry.seed, {...entry, view: position});
  return {position, positionSha256: sha(JSON.stringify(position)), ride: shown.choices.ride, decline: shown.choices.fight, legal,
    publicMatches: same(position, shown.view), pairedOutcomesMatch: same(arms.ride, observed[label].ride) && same(arms.fight, observed[label].fight),
    cueSupported: holdout.supported === true,
    data: Object.fromEntries(SEARCH_DATA.map((rel) => [rel, sha(readFileSync(join(root, rel)))]))};
}

// Re-derive the decision point from the bound project's experiment code.
async function derive(root, seed, receipt) {
  if (receipt?.derive?.source === "search") return deriveSearch(root, receipt.derive.label);
  const compare = await import(pathToFileURL(join(root, "experiments/showdown-outrider/compare.js")).href);
  const found = compare.replay(seed);
  if (!found) return null;
  const position = found.view; // cowboyView: viewFor(state, "cowboy") plus empty hidden lists
  return {position, positionSha256: sha(JSON.stringify(position)), ride: found.ride, legal: found.legal, chosen: found.chosen};
}

export async function recordCase(root, id) {
  const caseFile = RIDE_CASES[id];
  const prior = JSON.parse(readFileSync(join(HERE, caseFile), "utf8"));
  const found = await derive(root, prior.derive.seed, prior);
  if (!found || !found.legal) throw new Error("decision does not reproduce as a legal ride");
  if (found.publicMatches === false || found.pairedOutcomesMatch === false) throw new Error("searched case does not reproduce its public position or observed results");
  const fingerprint = engineFingerprint(root, entriesFor(prior));
  const out = {...prior, recorded: {commit: gitCommit(root).commit, closure: fingerprint, ...(found.data && {data: found.data})},
    decision: {turn: found.position.turn, positionSha256: found.positionSha256, ride: found.ride,
      ...(found.decline ? {decline: found.decline} : {policyChose: found.chosen})}};
  writeFileSync(join(HERE, caseFile), JSON.stringify(out, null, 2) + "\n");
  return out;
}

// `override` replaces the packaged receipt; tests only, never a tool input.
export async function inspectRideDecision(root, id, override) {
  const base = {kind: KIND, caseId: id, casePath: RIDE_CASES[id]};
  let receipt = override;
  try { receipt ??= JSON.parse(readFileSync(join(HERE, RIDE_CASES[id]), "utf8")); } catch {
    return {...base, verdict: "absent", reasons: ["case receipt is absent or not JSON"], advice: {allowed: false, reasons: ["no case receipt"]}};
  }
  const game = gitCommit(root);
  const pageFile = join(root, PAGE);
  const build = existsSync(pageFile) ? {path: PAGE, sha256: sha(readFileSync(pageFile))} : {path: PAGE, sha256: null, error: "absent: run npm run build"};
  let current, found, turns;
  try {
    current = engineFingerprint(root, entriesFor(receipt));
    found = await derive(root, receipt.derive.seed, receipt);
    turns = (await import(pathToFileURL(join(root, "src/match/showdown-turn.js")).href)).TURNS;
  } catch (error) {
    return {...base, game, build, verdict: "unavailable", reasons: [`decision code not found in the bound project: ${error.message}`],
      advice: {allowed: false, reasons: ["the bound project cannot re-derive this decision"]}};
  }
  const recorded = receipt.recorded?.closure;
  const changedFiles = recorded ? [...new Set([...Object.keys(recorded.files), ...Object.keys(current.files)])].filter((p) => recorded.files[p] !== current.files[p]) : [];
  const reasons = [];
  let verdict = "pass";
  if (!recorded) { verdict = "malformed"; reasons.push("receipt has no recorded code closure"); }
  else if (recorded.sha256 !== current.sha256) { verdict = "stale"; reasons.push("decision code closure differs from the receipt (stale decision)"); }
  if (!found) { verdict = verdict === "pass" ? "rejected" : verdict; reasons.push("no ride is offered on re-derivation"); }
  else {
    if (!found.legal) { verdict = verdict === "pass" ? "rejected" : verdict; reasons.push("the ride is not a legal action on re-derivation"); }
    if (found.positionSha256 !== receipt.decision?.positionSha256) { verdict = verdict === "pass" ? "rejected" : verdict; reasons.push("re-derived position differs from the receipt"); }
    if (JSON.stringify(found.ride) !== JSON.stringify(receipt.decision?.ride)) { verdict = verdict === "pass" ? "rejected" : verdict; reasons.push("re-derived ride differs from the receipt"); }
    if (found.publicMatches === false) { verdict = verdict === "pass" ? "rejected" : verdict; reasons.push("fresh session position differs from positions.json"); }
    if (found.pairedOutcomesMatch === false) { verdict = verdict === "pass" ? "rejected" : verdict; reasons.push("replayed ride and decline arms differ from results/observed.json"); }
    for (const [rel, hash] of Object.entries(receipt.recorded?.data ?? {})) {
      if (found.data?.[rel] !== hash) { verdict = verdict === "pass" ? "stale" : verdict; reasons.push(`${rel} differs from the receipt (stale data)`); }
    }
  }
  const turnId = receipt.route?.turn ?? null;
  const routed = Boolean(turnId) && Object.hasOwn(turns, turnId);
  const replayUrl = routed && build.sha256 ? `${pathToFileURL(pageFile).href}?turn=${encodeURIComponent(turnId)}` : null;
  const advice = [];
  if (verdict !== "pass") advice.push(`decision verdict is ${verdict}`);
  if (!turnId) advice.push("no game route is recorded for this case: the game does not open this decision");
  else if (!routed) advice.push(`?turn=${turnId} is not allowlisted in src/match/showdown-turn.js`);
  else if (!build.sha256) advice.push("no built page to open");
  if (receipt.derive?.source === "search") {
    if (!found?.pairedOutcomesMatch) advice.push("ride and decline outcomes were not re-verified");
    if (!found?.cueSupported) advice.push("the pre-registered ride/decline cue failed its holdout test: no general reason to decline is supported");
  } else if (!receipt.evidence?.pairedOutcomes) advice.push("no verified paired outcomes (ride vs decline) exist for this position");
  return {
    ...base, scope: receipt.scope, status: receipt.status ?? null, verdict, reasons,
    game: {commit: game.commit, ref: game.ref, recordedCommit: receipt.recorded?.commit ?? null, sameCommit: game.commit === receipt.recorded?.commit},
    closure: {current: current.sha256, recorded: recorded?.sha256 ?? null, fileCount: current.fileCount, changedFiles},
    build, replayUrl,
    decision: found ? {turn: found.position.turn, positionSha256: found.positionSha256, ride: found.ride,
      ...(found.decline && {decline: found.decline}), position: found.position} : null,
    evidence: receipt.evidence ?? null,
    advice: {allowed: advice.length === 0, reasons: advice},
  };
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv[2] === "--record") {
  const [root, id] = process.argv.slice(3);
  if (!root || !Object.hasOwn(RIDE_CASES, id ?? "")) { console.error(`usage: node ride.mjs --record <projectRoot> <${Object.keys(RIDE_CASES).join("|")}>`); process.exit(1); }
  const out = await recordCase(realpathSync(root) + "/", id);
  console.log(`${id}: commit ${out.recorded.commit}, closure ${out.recorded.closure.sha256} (${out.recorded.closure.fileCount} files), position ${out.decision.positionSha256}`);
}
