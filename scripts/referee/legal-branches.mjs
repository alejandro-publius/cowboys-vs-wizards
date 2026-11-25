#!/usr/bin/env node
// Legal-action and one-ply branch agreement: the production Showdown engine against the frozen,
// independently written Python referee (proof/referee/referee.py).
//
// prove.mjs compares the one input a corpus duel sends at each position. This script asks both
// sides about every well-formed action at every position those duels reach. It compares each
// verdict and, when both sides accept, the state after the action.
//
//   node scripts/referee/legal-branches.mjs                              frozen 2,500-duel corpus
//   node scripts/referee/legal-branches.mjs --seed-start N --count M     M corpus duels from seed N
//   options: --limit N      only the first N duels
//            --workers N    referee processes (default: up to 4)
//            --details N    full-state diffs kept per disagreement class (default 12)
//            --out FILE     JSON report (default .artifacts/referee/legal-branches-<corpus>.json)
//
// Method:
//   1. Fail closed (exit 2) unless proof/referee, the rulebook, the card CSV and adapter.mjs match
//      proof/referee/freeze.json. For the frozen corpus, corpus.mjs, its recipe and, on a full run,
//      the regenerated input digest must also match. The engine is deliberately not pinned. The
//      point is to check this checkout's engine, and its file digests are recorded.
//   2. A duel keeps only the inputs the engine accepts. The corpus's deliberate invalid probes are
//      dropped, and a rejected input changes no engine state. Both sides replay that same input, and
//      the normalized state at every position is compared ("main line").
//   3. At every unfinished position, candidateActions() lists every action the boundary schema
//      allows for the cards in the active hand and the three fixed slots. It is built from the
//      schema, not from the engine's legalActions. legalActions is checked to be a subset of it.
//      It includes the two wire forms SCHEMA.md accepts besides the canonical one (FORMS). For
//      every such candidate, the referee's verdict and state must equal those for its canonical
//      counterpart. Any difference is a reported problem.
//   4. The engine judges each candidate through engine.mjs applyInput, and its state goes through
//      adapter.mjs's normalizer. The trap tracker is replayed exactly from the trap changes that
//      led to the position. The referee judges each candidate through branch-oracle.py, which
//      calls the frozen referee's own Duel.apply on a copy of its own state, as Duel.run does.
//      Branches are compared only up to a duel's first main-line difference.
//   5. classify() names each disagreement with one of CLASS_LEGEND's classes, or reports it as
//      unexplained.
//
// Known classes (docs/evidence/kiro-referee-disagreement-triage.md). Each is counted, never hidden.
//   C1  Hellfire cast with no enemy troops: the engine refuses it and the referee accepts it
//       (SCHEMA.md R10). This is an open gameplay question for Fable (issue 143); the script takes
//       no position on it.
//   C2  A later copy of a card in hand: the engine lists only the first copy of each name
//       (engine.mjs header). Counted only if both sides accept the same action with the first copy
//       and reach the same state.
//   C3  Tributes listed out of slot order: the engine sorts them (engine.mjs canonicalAction), and
//       the referee discards them in listed order (R6). Counted only if the engine's state equals
//       its state for the sorted list and both sides accept the sorted list with equal states. The
//       referee's state must also be exactly its state for the sorted list with those tributes'
//       discards (each troop, then its gear) in the listed order (listedOrderView). Every such
//       branch is checked by digest, not a sample. The sorted-list state is the engine's when its
//       digest equals the referee's. For C2+C3 it is the referee's own full state, requested up
//       front (laterCopySortedSummons) because the engine refuses later copies.
//   F1, F2  A wire form engine.mjs does not take (FORMS). Counted only if the referee's verdict and
//       state equal those for the canonical counterpart, and both sides agree on that counterpart.
//       If the counterpart is itself C2, the class is F1+C2 or F2+C2. C2+C3 is likewise C3 whose
//       sorted counterpart is C2.
// Exit: 0 complete with no unexplained disagreement. 1 an unexplained disagreement, a main-line
// difference, an oracle crash or self-check failure, or an incomplete run. 2 a precondition failed.
import {spawn, spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import {fileURLToPath} from "node:url";
import {parseArgs} from "node:util";
import {legalActions} from "../../src/game/showdown/rules.js";
import {refereeNormalizer} from "./adapter.mjs";
import * as corpus from "./corpus.mjs";
import {applyInput as engineApplyInput, canonicalAction, decodeInstance, initialState} from "./engine.mjs";
import {canonicalJson, freezeSources, hashFile, hashTree, oracleSkip, proofPaths, sha256} from "./prove.mjs";

export const REPORT_SCHEMA = "referee-legal-branches/1";
const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const PATHS = proofPaths(ROOT);
const ORACLE_SCRIPT = path.join(ROOT, "scripts/referee/branch-oracle.py");
const ENGINE_FILES = ["src/game/showdown/rules.js", "src/game/showdown/cards.js", "src/game/card-specs.generated.js", "scripts/referee/engine.mjs"];
const IN_FLIGHT_PER_WORKER = 4;
export const CLASS_LEGEND = Object.freeze({
  C1: "Hellfire with no enemy troops: engine refuses, referee accepts (SCHEMA.md R10; open for Fable, issue 143)",
  C2: "later copy of a card in hand: engine refuses, referee accepts; the first copy agrees",
  C3: "tributes out of slot order: the referee's state is its slot-order state with those discards in listed order (R6); the engine sorts",
  "C2+C3": "C3 on a later copy whose slot-order counterpart is C2",
  F1: "summon without a tributes field: the referee reads [] with the same verdict and state; engine.mjs needs the field",
  "F1+C2": "F1 on a later copy whose canonical counterpart is C2",
  F2: "spell with slot as the alias for target: the referee's verdict and state match target; engine.mjs takes only target",
  "F2+C2": "F2 on a later copy whose canonical counterpart is C2",
  unexplained: "any other disagreement",
});
export const CLASSES = Object.freeze(Object.keys(CLASS_LEGEND));

// --- Candidates: the boundary schema, not the engine's legal list ----------------------------------

export const SLOTS = Object.freeze([0, 1, 2]); // rulebook 3.3: three troop slots per side
const subsets = (items) => items.reduce((all, item) => all.concat(all.map((s) => [...s, item])), [[]]);
// Every ascending tribute list, plus each two-slot list reversed, so a listed order can be observed.
export const TRIBUTE_LISTS = Object.freeze([
  ...subsets(SLOTS),
  ...subsets(SLOTS).filter((s) => s.length === 2).map((s) => [...s].reverse()),
].map((list) => Object.freeze(list)));

// SCHEMA.md "Actions" accepts these wire forms besides the one engine.mjs canonicalAction takes.
// canonicalForm(action) -> {form, action: canonical counterpart}, or null for a canonical action.
export const FORMS = Object.freeze({
  F1: "summon without tributes (\"A missing field means []\")",
  F2: "spell with slot, alone or with an equal target (\"slot is accepted as an alias. If both are given they must match.\")",
});

export function canonicalForm(action) {
  if (action.type === "summon" && !Object.hasOwn(action, "tributes")) return {form: "F1", action: {...action, tributes: []}};
  if (action.type !== "spell" || !Object.hasOwn(action, "slot")) return null;
  const {slot, ...rest} = action;
  if (Object.hasOwn(action, "target") && action.target !== slot) return null; // malformed in the schema too
  return {form: "F2", action: {...rest, target: slot}};
}

export function candidateActions(state) {
  const out = [];
  for (const cardId of state.sides[state.active].hand) {
    const {kind} = decodeInstance(cardId);
    if (kind === "troop") {
      for (const tributes of TRIBUTE_LISTS) out.push({type: "summon", cardId, tributes: [...tributes]});
      out.push({type: "summon", cardId}); // F1
    } else if (kind === "spell") {
      out.push({type: "spell", cardId});
      for (const target of SLOTS) out.push({type: "spell", cardId, target});
      for (const slot of SLOTS) out.push({type: "spell", cardId, slot}, {type: "spell", cardId, target: slot, slot}); // F2
    } else if (kind === "gear") for (const slot of SLOTS) out.push({type: "gear", cardId, slot});
    else if (kind === "location") out.push({type: "location", cardId});
    else if (kind === "trap") out.push({type: "set", cardId});
    else throw new Error(`${cardId}: no action shape for card kind ${kind}`);
  }
  for (const slot of SLOTS) for (const target of [...SLOTS, "base"]) out.push({type: "attack", slot, target});
  for (const slot of SLOTS) out.push({type: "cover", slot});
  out.push({type: "end"});
  return out;
}

// --- Engine side ---------------------------------------------------------------------------------

// The adapter's trap tracker sees only (side, trap list, turn), and a call with an unchanged list
// changes nothing. Replaying the positions where a trap list changed therefore rebuilds it exactly.
const trapShell = (state) => ({turn: state.turn, result: null, location: null, sides: Object.fromEntries(
  ["cowboy", "wizard"].map((side) => [side, {base: 0, hand: [], deck: [], discard: [], board: [], traps: [...state.sides[side].traps]}]))});
const trapKey = (state) => JSON.stringify([state.sides.cowboy.traps, state.sides.wizard.traps]);

function primedNormalizer(shells) {
  const normalize = refereeNormalizer();
  for (const shell of shells) normalize(shell);
  return normalize;
}

const stateHash = (view) => sha256(canonicalJson(view));

export function engineSide(duel, {applyInput = engineApplyInput} = {}) {
  let state = initialState(duel);
  const normalize = refereeNormalizer();
  const kept = [];
  const positions = [];
  const shells = [];
  let lastTraps = null;
  const stats = {legalListed: 0, legalOutsideUniverse: 0, acceptedSetNotLegal: 0, primedMismatch: 0};
  const visit = (k) => {
    const traps = trapKey(state);
    if (traps !== lastTraps) { shells.push(trapShell(state)); lastTraps = traps; }
    const position = {k, turn: state.turn, state, mainHash: stateHash(normalize(state)), primeUpTo: shells.length};
    if (!state.result) {
      const prime = () => primedNormalizer(shells.slice(0, position.primeUpTo));
      if (stateHash(prime()(state)) !== position.mainHash) stats.primedMismatch++;
      const candidates = candidateActions(state);
      const keys = new Set(candidates.map(canonicalJson));
      const legal = legalActions(state);
      stats.legalListed += legal.length;
      for (const action of legal) if (!keys.has(canonicalJson(action))) stats.legalOutsideUniverse++;
      const verdicts = candidates.map((action) => {
        const applied = applyInput(state, action);
        return applied.accepted ? [true, stateHash(prime()(applied.state))] : [false, null];
      });
      // The engine accepts exactly its legal list, once inputs are put in its canonical form.
      const legalKeys = new Set(legal.map(canonicalJson));
      const acceptedKeys = new Set(candidates.filter((_, j) => verdicts[j][0]).map((action) => canonicalJson(canonicalAction(action).action)));
      if (acceptedKeys.size !== legalKeys.size || [...acceptedKeys].some((key) => !legalKeys.has(key))) stats.acceptedSetNotLegal++;
      Object.assign(position, {candidates, verdicts});
    }
    positions.push(position);
  };
  visit(0);
  for (const input of duel.actions) {
    const applied = applyInput(state, input);
    if (!applied.accepted) continue;
    kept.push(input);
    state = applied.state;
    visit(kept.length);
  }
  return {duel: {...duel, actions: kept}, positions, shells, stats};
}

function engineBranchView(eng, k, action, applyInput) {
  const position = eng.positions[k];
  const applied = applyInput(position.state, action);
  return applied.accepted ? primedNormalizer(eng.shells.slice(0, position.primeUpTo))(applied.state) : null;
}

// Candidates whose full referee state C2+C3 needs: a later copy's summon with two or more tributes
// in slot order. The engine refuses later copies, so only the referee has that state.
export function laterCopySortedSummons(eng) {
  const wanted = [];
  for (const p of eng.positions) {
    if (!p.candidates) continue;
    p.candidates.forEach((action, j) => {
      if (action.type !== "summon" || !Array.isArray(action.tributes) || action.tributes.length < 2) return;
      if (canonicalJson(action.tributes) !== canonicalJson(ascending(action.tributes))) return;
      if (firstCopy(p.state, action.cardId) !== action.cardId) wanted.push([p.k, j]);
    });
  }
  return wanted;
}

// --- Classification ------------------------------------------------------------------------------

const HELLFIRE = /^wizard-hellfire-\d+$/;
const firstCopy = (state, cardId) => {
  const name = decodeInstance(cardId).name;
  return state.sides[state.active].hand.find((id) => decodeInstance(id).name === name);
};
const ascending = (slots) => [...slots].sort((a, b) => a - b);
const bothAcceptSameState = (other) => other.engine[0] === true && other.referee[0] === true && other.engine[1] === other.referee[2];

// R6 as the only permitted C3 difference. sortedView is a normalized state after the summon with
// its tributes in slot order. preState is the engine state before it, and listed is the input
// order. The tributed troops, each followed by its gear, must sit as one block in the summoning
// side's discard. The result puts that block in listed order and changes nothing else. Returns
// null when the block is missing or out of place, so the caller fails closed.
export function listedOrderView(sortedView, preState, listed) {
  const side = preState.active;
  const board = preState.sides[side].board;
  if (!listed.length || new Set(listed).size !== listed.length || !listed.every((slot) => board[slot])) return null;
  const ids = (slots) => slots.flatMap((slot) => [board[slot].cardId, ...board[slot].gear]);
  const sortedIds = ids(ascending(listed));
  const listedIds = ids(listed);
  const discard = sortedView?.players?.[side]?.discard;
  if (!Array.isArray(discard)) return null;
  const at = discard.indexOf(sortedIds[0]);
  if (at < 0 || canonicalJson(discard.slice(at, at + sortedIds.length)) !== canonicalJson(sortedIds)) return null;
  const expected = structuredClone(sortedView);
  expected.players[side].discard = [...discard.slice(0, at), ...listedIds, ...discard.slice(at + sortedIds.length)];
  return expected;
}

// engine: [accepted, stateHash]; referee: [accepted, error, stateHash];
// lookup(action) -> {engine, referee} for another candidate at the same position, or null;
// listedOrder(sortedAction, listed) -> the referee digest R6 permits for `listed`, derived from the
// referee's own state for sortedAction (listedOrderView), or null. Without it, C3 is never named.
export function classify({state, action, engine, referee, lookup, listedOrder = () => null}) {
  const form = canonicalForm(action);
  if (form) {
    // F1/F2: engine.mjs refuses the wire form. The referee must give it exactly the verdict, error
    // and state of the canonical counterpart, and both sides must agree on that counterpart.
    if (engine[0] !== false || referee[0] !== true) return "unexplained";
    const other = lookup(form.action);
    if (!other || canonicalJson(other.referee) !== canonicalJson(referee)) return "unexplained";
    if (bothAcceptSameState(other)) return form.form;
    const inner = classify({state, action: form.action, engine: other.engine, referee: other.referee, lookup, listedOrder});
    return inner === "C2" ? `${form.form}+C2` : "unexplained";
  }
  const enemy = state.sides[state.active === "cowboy" ? "wizard" : "cowboy"];
  if (action.type === "spell" && HELLFIRE.test(action.cardId) && action.target === undefined
    && !enemy.board.some(Boolean) && engine[0] === false && referee[0] === true) return "C1";
  if (action.cardId === undefined) return "unexplained";
  const first = firstCopy(state, action.cardId);
  const later = first !== undefined && first !== action.cardId;
  if (action.type === "summon" && Array.isArray(action.tributes)) {
    const sortedAction = {...action, tributes: ascending(action.tributes)};
    if (canonicalJson(sortedAction) !== canonicalJson(action)) {
      // C3 (and C2+C3): the referee's state must be its slot-order state with only the tribute
      // block reordered. The engine sorts, so its state must equal its slot-order state (C3), or it
      // refuses the later copy whose slot-order counterpart is C2 (C2+C3).
      const other = lookup(sortedAction);
      if (!other || referee[0] !== true) return "unexplained";
      const expected = listedOrder(sortedAction, action.tributes);
      if (expected === null || expected !== referee[2]) return "unexplained";
      if (!later) return engine[0] === true && engine[1] === other.engine[1] && bothAcceptSameState(other) ? "C3" : "unexplained";
      const inner = classify({state, action: sortedAction, engine: other.engine, referee: other.referee, lookup, listedOrder});
      return engine[0] === false && inner === "C2" ? "C2+C3" : "unexplained";
    }
  }
  if (!later) return "unexplained";
  const other = lookup({...action, cardId: first});
  return other && bothAcceptSameState(other) && engine[0] === false && referee[0] === true ? "C2" : "unexplained";
}

// --- Referee side --------------------------------------------------------------------------------

class Oracle {
  constructor({python, referee}) {
    this.child = spawn(python, ["-u", ORACLE_SCRIPT, referee], {cwd: ROOT, stdio: ["pipe", "pipe", "pipe"]});
    this.waiting = [];
    this.stderr = "";
    this.child.stderr.on("data", (d) => { this.stderr = (this.stderr + d).slice(-4000); });
    this.child.stdin.on("error", () => {});
    this.exited = new Promise((resolve) => {
      this.child.on("error", (e) => resolve({error: e.message}));
      this.child.on("close", (code, signal) => resolve({code, signal}));
    });
    readline.createInterface({input: this.child.stdout, crlfDelay: Infinity}).on("line", (line) => {
      const waiter = this.waiting.shift();
      if (!waiter) return;
      try { waiter.resolve(JSON.parse(line)); } catch { waiter.reject(new Error(`oracle printed non-JSON: ${line.slice(0, 120)}`)); }
    });
    this.exited.then((exit) => {
      for (const waiter of this.waiting.splice(0)) {
        waiter.reject(new Error(`oracle exited (${exit.error ?? exit.signal ?? exit.code}) ${this.stderr.trim().slice(-300)}`));
      }
    });
  }

  get busy() { return this.waiting.length; }

  ask(request) {
    return new Promise((resolve, reject) => {
      this.waiting.push({resolve, reject});
      this.child.stdin.write(`${JSON.stringify(request)}\n`);
    });
  }

  close() {
    this.child.stdin.end();
    return this.exited;
  }
}

// --- Comparison ----------------------------------------------------------------------------------

function diffPairs(engine, referee, at = "$", out = [], limit = 8) {
  if (out.length >= limit || canonicalJson(engine) === canonicalJson(referee)) return out;
  const objects = engine && referee && typeof engine === "object" && typeof referee === "object" && Array.isArray(engine) === Array.isArray(referee);
  if (!objects || (Array.isArray(engine) && engine.length !== referee.length)) {
    out.push({path: at, engine, referee});
    return out;
  }
  for (const key of [...new Set([...Object.keys(engine), ...Object.keys(referee)])].sort()) {
    diffPairs(engine[key], referee[key], Array.isArray(engine) ? `${at}[${key}]` : `${at}.${key}`, out, limit);
  }
  return out;
}

// A deterministic uniform sample: the `size` items with the smallest digest of (duel, position,
// candidate), listed in duel order. It does not depend on which referee process answered first.
function sampler(size) {
  let items = [];
  const byKey = (a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
  const byDuel = (a, b) => a.duel - b.duel || a.position - b.position || a.candidateIndex - b.candidateIndex;
  return {
    offer(item) {
      items.push({...item, key: sha256(`${item.duel}:${item.position}:${item.candidateIndex}`)});
      if (items.length > 4 * size + 16) items = items.sort(byKey).slice(0, size);
    },
    get items() { return items.sort(byKey).slice(0, size).sort(byDuel).map(({key, ...item}) => item); },
  };
}

// Differing paths over the diffed samples of one class, with slot and list indices folded.
const pathPatterns = (samples) => samples.reduce((counts, s) => {
  for (const d of s.differences ?? []) {
    const pattern = d.path.replace(/\[\d+\]/g, "[]");
    counts[pattern] = (counts[pattern] ?? 0) + 1;
  }
  return counts;
}, {});

function newTotals(details) {
  return {
    duels: 0,
    main: {positions: 0, actions: 0, agreedPositions: 0, divergedDuels: 0},
    engine: {legalListed: 0, legalOutsideUniverse: 0, acceptedSetNotLegal: 0, primedMismatch: 0},
    branch: {positions: 0, excludedPositions: 0, candidates: 0, engineAccepted: 0, refereeAccepted: 0,
      bothAcceptedSameState: 0, bothRejected: 0, disagreements: 0, byType: {},
      byKind: {"accepted-by-engine-only": 0, "accepted-by-referee-only": 0, "different-state": 0},
      byClass: Object.fromEntries(CLASSES.map((c) => [c, 0])), byClassAndKind: {},
      byForm: Object.fromEntries(Object.keys(FORMS).map((f) => [f, {candidates: 0, engineAccepted: 0, refereeAccepted: 0,
        refereeSameAsCanonical: 0, refereeDiffersFromCanonical: 0}]))},
    oracle: {runDisagrees: 0, crashes: 0},
    samples: Object.fromEntries(CLASSES.map((c) => [c, sampler(details)])),
    mainSamples: sampler(details),
    crashSamples: sampler(details),
    formSamples: sampler(details),
    stateDuels: new Map(),
  };
}

function judge(t, index, original, eng, response, errors, {applyInput, expectListed}) {
  if (response.error) return void errors.push(`duel ${index} (seed ${original.seed}): oracle error: ${response.error}`);
  if (response.id !== index || response.main?.length !== eng.positions.length) {
    return void errors.push(`duel ${index} (seed ${original.seed}): oracle answered for another input`);
  }
  t.duels++;
  for (const key of Object.keys(t.engine)) t.engine[key] += eng.stats[key];
  if (!response.runAgrees) t.oracle.runDisagrees++;
  let diverged = null;
  for (let k = 0; k < eng.positions.length && diverged === null; k++) {
    if ((k > 0 && response.mainAccepted[k - 1] !== true) || response.main[k] !== eng.positions[k].mainHash) diverged = k;
  }
  t.main.positions += eng.positions.length;
  t.main.actions += eng.duel.actions.length;
  t.main.agreedPositions += diverged ?? eng.positions.length;
  if (diverged !== null) {
    t.main.divergedDuels++;
    t.mainSamples.offer({duel: index, seed: original.seed, position: diverged, candidateIndex: 0, turn: eng.positions[diverged].turn,
      action: diverged > 0 ? eng.duel.actions[diverged - 1] : null, refereeAccepted: diverged > 0 ? response.mainAccepted[diverged - 1] : null});
  }
  const rows = new Map(response.verdicts);
  const fullStates = new Map((response.full ?? []).map(([k, j, state]) => [`${k}:${j}`, state]));
  for (const p of eng.positions) {
    if (!p.candidates) continue;
    if (diverged !== null && p.k >= diverged) { t.branch.excludedPositions++; continue; }
    const row = rows.get(p.k);
    if (!row || row.length !== p.candidates.length) { errors.push(`duel ${index} position ${p.k}: oracle verdict row is missing or short`); continue; }
    t.branch.positions++;
    const byKey = new Map(p.candidates.map((candidate, at) => [canonicalJson(candidate), at]));
    const lookup = (other) => {
      const at = byKey.get(canonicalJson(other));
      return at === undefined ? null : {engine: p.verdicts[at], referee: row[at]};
    };
    // The referee's own state for another candidate: its full state from the oracle, or the
    // engine's state when the two digests are equal. Either must hash to the referee's digest.
    const refereeView = (other) => {
      const at = byKey.get(canonicalJson(other));
      if (at === undefined || row[at][0] !== true) return null;
      const view = fullStates.get(`${p.k}:${at}`)
        ?? (p.verdicts[at][0] === true && p.verdicts[at][1] === row[at][2] ? engineBranchView(eng, p.k, other, applyInput) : null);
      return view && stateHash(view) === row[at][2] ? view : null;
    };
    const listedOrder = (sortedAction, listed) => {
      const expected = expectListed(refereeView(sortedAction), p.state, listed);
      return expected && stateHash(expected);
    };
    p.candidates.forEach((action, j) => {
      const engine = p.verdicts[j];
      const referee = row[j];
      const type = (t.branch.byType[action.type] ??= {candidates: 0, engineAccepted: 0, refereeAccepted: 0, agree: 0, disagree: 0});
      type.candidates++; t.branch.candidates++;
      if (engine[0]) { type.engineAccepted++; t.branch.engineAccepted++; }
      if (referee[0] === true) { type.refereeAccepted++; t.branch.refereeAccepted++; }
      const form = canonicalForm(action);
      if (form) {
        const f = t.branch.byForm[form.form];
        f.candidates++;
        if (engine[0]) f.engineAccepted++;
        if (referee[0] === true) f.refereeAccepted++;
        const canonical = lookup(form.action);
        if (canonical && canonicalJson(canonical.referee) === canonicalJson(referee)) f.refereeSameAsCanonical++;
        else {
          f.refereeDiffersFromCanonical++;
          t.formSamples.offer({duel: index, seed: original.seed, position: p.k, candidateIndex: j, turn: p.turn, action,
            canonical: form.action, referee, refereeForCanonical: canonical?.referee ?? null});
        }
      }
      if (referee[0] !== true && referee[0] !== false) {
        t.oracle.crashes++;
        t.crashSamples.offer({duel: index, seed: original.seed, position: p.k, candidateIndex: j, turn: p.turn, action, error: referee[1]});
        return;
      }
      if (engine[0] === referee[0] && (!engine[0] || engine[1] === referee[2])) {
        type.agree++;
        if (engine[0]) t.branch.bothAcceptedSameState++; else t.branch.bothRejected++;
        return;
      }
      type.disagree++; t.branch.disagreements++;
      const kind = engine[0] !== referee[0] ? (engine[0] ? "accepted-by-engine-only" : "accepted-by-referee-only") : "different-state";
      const cls = classify({state: p.state, action, engine, referee, lookup, listedOrder});
      t.branch.byKind[kind]++;
      t.branch.byClass[cls]++;
      const ck = (t.branch.byClassAndKind[cls] ??= {});
      ck[kind] = (ck[kind] ?? 0) + 1;
      t.samples[cls].offer({duel: index, seed: original.seed, position: p.k, candidateIndex: j, turn: p.turn, active: p.state.active,
        action, kind, engineAccepted: engine[0], refereeAccepted: referee[0], refereeError: referee[1]});
      if (kind === "different-state") t.stateDuels.set(index, original);
    });
  }
}

function makeOracles(count, python) {
  return Array.from({length: count}, () => new Oracle({python, referee: PATHS.referee}));
}

async function closeOracles(oracles, errors) {
  for (const exit of await Promise.all(oracles.map((o) => o.close()))) {
    if (exit.error) errors.push(`could not start the oracle: ${exit.error}`);
    else if (exit.code !== 0) errors.push(`oracle exited with ${exit.signal ?? exit.code}`);
  }
}

// Full referee states for the kept different-state samples, diffed against the engine's states.
async function stateDetails(t, samplesByClass, {python, applyInput, errors}) {
  const wanted = new Map();
  for (const cls of CLASSES) for (const s of samplesByClass[cls]) {
    if (s.kind !== "different-state") continue;
    if (!wanted.has(s.duel)) wanted.set(s.duel, []);
    wanted.get(s.duel).push(s);
  }
  if (!wanted.size) return;
  const [oracle] = makeOracles(1, python);
  try {
    for (const [index, samples] of wanted) {
      const eng = engineSide(t.stateDuels.get(index), {applyInput});
      const probe = eng.positions.filter((p) => p.candidates).map((p) => [p.k, p.candidates]);
      const response = await oracle.ask({id: index, duel: eng.duel, probe, full: samples.map((s) => [s.position, s.candidateIndex])});
      if (response.error) { errors.push(`details for duel ${index}: ${response.error}`); continue; }
      const states = new Map(response.full.map(([k, j, state]) => [`${k}:${j}`, state]));
      for (const s of samples) {
        const referee = states.get(`${s.position}:${s.candidateIndex}`);
        const engine = engineBranchView(eng, s.position, eng.positions[s.position].candidates[s.candidateIndex], applyInput);
        s.differences = diffPairs(engine, referee);
      }
    }
  } finally {
    await closeOracles([oracle], errors);
  }
}

// duels: iterable of corpus duel inputs. Returns {totals, errors, inputsSha256, strippedSha256}.
// applyInput and expectListed (default listedOrderView) are replaced only by negative controls.
export async function compareLegalBranches({duels, limit = Infinity, workers = 1, details = 12,
  python = process.env.REFEREE_PYTHON || "python3", applyInput = engineApplyInput, expectListed = listedOrderView, log = () => {}} = {}) {
  const t = newTotals(details);
  const errors = [];
  const inputs = createHash("sha256");
  const stripped = createHash("sha256");
  const seeds = [];
  const oracles = makeOracles(workers, python);
  const inflight = new Set();
  let index = 0;
  try {
    for (const duel of duels) {
      if (index >= limit) break;
      const i = index++;
      inputs.update(`${canonicalJson(duel)}\n`);
      seeds.push(duel.seed);
      const eng = engineSide(duel, {applyInput});
      stripped.update(`${canonicalJson(eng.duel)}\n`);
      const probe = eng.positions.filter((p) => p.candidates).map((p) => [p.k, p.candidates]);
      const full = laterCopySortedSummons(eng);
      const oracle = oracles.reduce((a, b) => (b.busy < a.busy ? b : a));
      const job = oracle.ask({id: i, duel: eng.duel, probe, ...(full.length ? {full} : {})})
        .then((response) => judge(t, i, duel, eng, response, errors, {applyInput, expectListed}), (e) => errors.push(`duel ${i} (seed ${duel.seed}): ${e.message}`))
        .finally(() => inflight.delete(job));
      inflight.add(job);
      while (inflight.size >= workers * IN_FLIGHT_PER_WORKER) await Promise.race(inflight);
      if (index % 250 === 0) log(`  ${index} duels sent, ${t.duels} judged, ${t.branch.candidates} candidates compared`);
    }
    await Promise.all(inflight);
  } finally {
    await closeOracles(oracles, errors);
  }
  if (t.duels !== index) errors.push(`${index - t.duels} of ${index} duels were not judged`);
  const samples = Object.fromEntries(CLASSES.map((c) => [c, t.samples[c].items]));
  await stateDetails(t, samples, {python, applyInput, errors});
  return {totals: t, errors, sent: index, seeds, samples, mainSamples: t.mainSamples.items, crashSamples: t.crashSamples.items,
    formSamples: t.formSamples.items, inputsSha256: inputs.digest("hex"), strippedSha256: stripped.digest("hex")};
}

// --- Preconditions and report --------------------------------------------------------------------

export function preconditions({frozen}) {
  const freeze = JSON.parse(fs.readFileSync(PATHS.freeze, "utf8"));
  const failed = [];
  if (hashTree(PATHS.oracleDir, oracleSkip) !== freeze.referee?.treeSha256) failed.push("proof/referee differs from freeze.json");
  for (const [name, source] of Object.entries(freezeSources(ROOT))) {
    if (canonicalJson(freeze[name] ?? null) !== canonicalJson(source)) failed.push(`${name} (${source.path}) differs from freeze.json`);
  }
  if (frozen) {
    if (hashFile(PATHS.corpus) !== freeze.corpus?.sha256) failed.push("scripts/referee/corpus.mjs differs from freeze.json");
    if (canonicalJson(corpus.recipe({quick: false})) !== canonicalJson(freeze.recipe)) failed.push("corpus recipe differs from freeze.json");
  }
  return {freeze, failed};
}

function gitHead() {
  const r = spawnSync("git", ["rev-parse", "HEAD"], {cwd: ROOT, encoding: "utf8"});
  return r.status === 0 ? r.stdout.trim() : null;
}

export function buildReport({run, recipe, corpusName, freeze, limit, startedAt, finishedAt}) {
  const t = run.totals;
  const full = limit === Infinity;
  const inputsMatchFreeze = corpusName === "frozen" && full ? run.inputsSha256 === freeze.inputs.sha256 : null;
  const unexplained = t.branch.byClass.unexplained;
  const formDiffers = Object.values(t.branch.byForm).reduce((sum, f) => sum + f.refereeDiffersFromCanonical, 0);
  const problems = [
    ...(formDiffers ? [`${formDiffers} wire-form candidate(s) where the referee differs from the canonical form`] : []),
    ...run.errors,
    ...(inputsMatchFreeze === false ? ["regenerated frozen corpus differs from freeze.json inputs.sha256"] : []),
    ...(t.main.divergedDuels ? [`${t.main.divergedDuels} duel(s) differ on the main line`] : []),
    ...(unexplained ? [`${unexplained} unexplained disagreement(s)`] : []),
    ...(t.oracle.crashes ? [`${t.oracle.crashes} oracle crash(es)`] : []),
    ...(t.oracle.runDisagrees ? [`${t.oracle.runDisagrees} oracle self-check failure(s) against Duel.run`] : []),
    ...(t.engine.legalOutsideUniverse ? [`${t.engine.legalOutsideUniverse} engine legal action(s) outside the candidate list`] : []),
    ...(t.engine.acceptedSetNotLegal ? [`${t.engine.acceptedSetNotLegal} position(s) where the engine's accepted set differs from legalActions`] : []),
    ...(t.engine.primedMismatch ? [`${t.engine.primedMismatch} position(s) where the replayed trap tracker differs`] : []),
  ];
  const sortedSeeds = [...run.seeds].sort((a, b) => a - b);
  return {
    schema: REPORT_SCHEMA,
    label: "Legal-action and one-ply branch agreement with the frozen independent referee. Not a release receipt; no proof receipt is written.",
    status: inputsMatchFreeze === false ? "precondition-failed" : problems.length ? "fail" : "pass",
    problems,
    startedAt, finishedAt,
    head: gitHead(),
    sources: {
      refereeTreeSha256: freeze.referee.treeSha256,
      adapterSha256: freeze.adapter.sha256,
      corpusSha256: hashFile(PATHS.corpus),
      engine: Object.fromEntries(ENGINE_FILES.map((file) => [file, hashFile(path.join(ROOT, file))])),
    },
    corpus: {name: corpusName, recipe, limit: full ? null : limit, duels: run.sent,
      seeds: {first: sortedSeeds[0] ?? null, last: sortedSeeds.at(-1) ?? null, distinct: new Set(sortedSeeds).size},
      inputsSha256: run.inputsSha256, inputsMatchFreeze, keptInputsSha256: run.strippedSha256},
    mainLine: {...t.main, differenceSamples: run.mainSamples},
    engine: t.engine,
    branches: {...t.branch, refereeCrashes: t.oracle.crashes, refereeRunSelfCheckFailures: t.oracle.runDisagrees},
    differencePathsInDiffedSamples: Object.fromEntries(CLASSES.map((c) => [c, pathPatterns(run.samples[c])])),
    samples: run.samples,
    crashSamples: run.crashSamples,
    formDifferenceSamples: run.formSamples,
  };
}

function summary(report, log) {
  const b = report.branches;
  const m = report.mainLine;
  log(`legal-branches ${report.status}: ${report.corpus.name} corpus, ${report.corpus.duels} duels, seeds ${report.corpus.seeds.first}-${report.corpus.seeds.last}`);
  log(`  main line: ${m.agreedPositions}/${m.positions} positions agree over ${m.actions} engine-accepted inputs; ${m.divergedDuels} duel(s) differ`);
  log(`  branches: ${b.candidates} candidates at ${b.positions} positions (${b.excludedPositions} excluded after a main-line difference)`);
  log(`    engine accepted ${b.engineAccepted}, referee accepted ${b.refereeAccepted}, both accepted with equal state ${b.bothAcceptedSameState}, both rejected ${b.bothRejected}`);
  log(`    disagreements ${b.disagreements}: ${CLASSES.map((c) => `${c} ${b.byClass[c]}`).join(", ")}`);
  log(`    by kind: ${Object.entries(b.byKind).map(([k, v]) => `${k} ${v}`).join(", ")}`);
  for (const [form, f] of Object.entries(b.byForm)) {
    log(`    ${form} wire form: ${f.candidates} candidates, engine accepted ${f.engineAccepted}, referee accepted ${f.refereeAccepted}, referee same as canonical ${f.refereeSameAsCanonical}, differs ${f.refereeDiffersFromCanonical}`);
  }
  for (const [cls, patterns] of Object.entries(report.differencePathsInDiffedSamples)) {
    const diffed = report.samples[cls].filter((s) => s.differences).length;
    if (diffed) log(`    ${cls} state diffs in ${diffed} sampled branch(es): ${Object.entries(patterns).map(([p, n]) => `${p} x${n}`).join(", ")}`);
  }
  log(`  engine self-checks: legal actions listed ${report.engine.legalListed}, outside candidates ${report.engine.legalOutsideUniverse}, accepted-set/legal-list mismatches ${report.engine.acceptedSetNotLegal}, trap-tracker mismatches ${report.engine.primedMismatch}`);
  log(`  elapsed ${((Date.parse(report.finishedAt) - Date.parse(report.startedAt)) / 1000).toFixed(1)} s`);
  log(`  referee: crashes ${b.refereeCrashes}, Duel.run self-check failures ${b.refereeRunSelfCheckFailures}`);
  if (report.corpus.inputsMatchFreeze !== null) log(`  frozen input digest matches freeze.json: ${report.corpus.inputsMatchFreeze}`);
  for (const problem of report.problems) log(`  problem: ${problem}`);
}

const USAGE = "usage: node scripts/referee/legal-branches.mjs [--seed-start N --count M] [--limit N] [--workers N] [--details N] [--out FILE]";

function integer(name, text, min = 0) {
  const value = Number(text);
  if (!Number.isInteger(value) || value < min) throw new Error(`--${name} needs an integer of at least ${min}, got ${JSON.stringify(text)}`);
  return value;
}

async function main(argv) {
  let options;
  try {
    const {values} = parseArgs({args: argv, options: {
      "seed-start": {type: "string"}, count: {type: "string"}, limit: {type: "string"},
      workers: {type: "string"}, details: {type: "string"}, out: {type: "string"},
    }});
    if ((values["seed-start"] === undefined) !== (values.count === undefined)) throw new Error("--seed-start and --count go together");
    options = {
      seedStart: values["seed-start"] === undefined ? null : integer("seed-start", values["seed-start"]),
      count: values.count === undefined ? null : integer("count", values.count, 1),
      limit: values.limit === undefined ? Infinity : integer("limit", values.limit, 1),
      workers: values.workers === undefined ? Math.max(1, Math.min(4, os.availableParallelism() - 1)) : integer("workers", values.workers, 1),
      details: values.details === undefined ? 12 : integer("details", values.details),
      out: values.out,
    };
  } catch (e) {
    console.error(`${e.message}\n${USAGE}`);
    return 2;
  }
  const frozen = options.seedStart === null;
  const corpusName = frozen ? "frozen" : `seeds-${options.seedStart}`;
  const {freeze, failed} = preconditions({frozen});
  if (failed.length) {
    console.log(`legal-branches precondition-failed: ${failed.join("; ")}`);
    return 2;
  }
  const recipe = frozen ? corpus.recipe({quick: false}) : {...corpus.recipe({quick: false}), name: corpusName, count: options.count, minMoves: 0, seedStart: options.seedStart};
  const startedAt = new Date().toISOString();
  console.log(`legal-branches: ${corpusName} corpus, ${options.workers} referee process(es)`);
  const run = await compareLegalBranches({duels: corpus.duels(recipe), limit: options.limit, workers: options.workers, details: options.details, log: console.log});
  const report = buildReport({run, recipe, corpusName, freeze, limit: options.limit, startedAt, finishedAt: new Date().toISOString()});
  const out = options.out ?? path.join(ROOT, ".artifacts/referee", `legal-branches-${corpusName}${options.limit === Infinity ? "" : `-limit${options.limit}`}.json`);
  fs.mkdirSync(path.dirname(out), {recursive: true});
  fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  summary(report, console.log);
  console.log(`  report: ${path.relative(process.cwd(), out)}`);
  return report.status === "pass" ? 0 : report.status === "precondition-failed" ? 2 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; },
    (error) => { console.error(`legal-branches error: ${error.stack ?? error.message}`); process.exitCode = 1; });
}
