// Turns the one fresh confirmation result into one reproducible player replay (witness.json).
// Input is exactly one file: the fresh.json written by scripts/field-trial-confirm.mjs. It must be a sealed,
// passing record (pass === true) whose base, pinned inputs, change, protocol and both confirm blocks check out.
// Search: the record's two confirm ranges in order, ascending seed, then cowboy/wizard start. The first match whose
// winner flips and whose event logs have a comparable first divergence is the witness; the search stops there.
// Every field comes from the two engines built by scripts/field-trial-engine.mjs and their real applied.events;
// nothing is hand-authored and no bot command is reconstructed.
//   node scripts/field-trial-witness.mjs           read .artifacts/contest-balance/field-trial/fresh.json,
//                                                  write .artifacts/contest-balance/field-trial/witness.json
//   node scripts/field-trial-witness.mjs --verify  recompute from docs/evidence/night-shift-repair/{fresh,witness}.json
import {existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {play} from "./billy-replay-engine.mjs";
import {EVIDENCE, INPUT_PATHS, OUTPUT, PROTOCOL_PATH, protocolProblems, sealIntact} from "./field-trial-confirm.mjs";
import {openTrialEngine, playTrial} from "./field-trial-engine.mjs";
import {canonical, sha256} from "./night-review.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FRESH = OUTPUT;
const WITNESS_OUT = join(dirname(OUTPUT), "witness.json");
const COMMITTED_FRESH = EVIDENCE;
const COMMITTED_WITNESS = join(dirname(EVIDENCE), "witness.json");
const KIND = "night-shift-repair/fresh-confirmation";
const FIELDS = ["attack", "health", "stars"];
const STARTS = ["cowboy", "wizard"];
const WINDOW = 4;
const OBJECT_ID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const SHA = /^[0-9a-f]{64}$/;

class Problem extends Error {}
const check = (ok, message) => { if (!ok) throw new Problem(message); };
const plain = value => value !== null && typeof value === "object" && !Array.isArray(value);
const same = (a, b) => canonical(a) === canonical(b);
const sameKeys = (value, keys) => plain(value) && same(Object.keys(value).sort(), [...keys].sort());
const clone = value => JSON.parse(JSON.stringify(value));

function readJson(rel, what) {
  const path = join(root, rel);
  check(existsSync(path), `${what} not found: ${rel}`);
  const text = readFileSync(path, "utf8");
  try { return {value: JSON.parse(text), text}; } catch { throw new Problem(`${what} is not valid JSON: ${rel}`); }
}

// The current protocol, checked by the confirm script's own rules.
function loadProtocol() {
  const {value, text} = readJson(PROTOCOL_PATH, "protocol");
  const problems = protocolProblems(value);
  check(!problems.length, `${PROTOCOL_PATH}: ${problems.join("; ")}`);
  return {protocol: {scout: value.scout, confirm: value.confirm}, protocolSha256: sha256(text)};
}

// Throws unless the record is the sealed, passing fresh confirmation of one change at one base, under today's protocol.
function checkFresh(fresh, {protocol, protocolSha256}, rel) {
  const say = message => `${rel}: ${message}`;
  check(plain(fresh), say("not a JSON object"));
  check(fresh.schema === 1 && fresh.kind === KIND, say("not a fresh confirmation record (schema 1)"));
  check(SHA.test(fresh.recordSha256 ?? "") && sealIntact(fresh), say("recordSha256 does not match the record's contents"));
  check(fresh.pass === true, say(`pass is ${JSON.stringify(fresh.pass)}, not true; a rejected confirmation has no witness`));
  check(Array.isArray(fresh.reasons) && fresh.reasons.length === 0, say("a passing record must list no reasons"));
  check(fresh.applied === false, say("the record reports an applied change"));
  check(OBJECT_ID.test(fresh.base ?? ""), say("base is not a full commit ID"));
  check(sameKeys(fresh.inputs, INPUT_PATHS), say(`inputs must name exactly ${INPUT_PATHS.join(", ")}`));
  for (const path of INPUT_PATHS) check(OBJECT_ID.test(fresh.inputs[path] ?? ""), say(`inputs[${path}] is not a git object ID`));
  const change = fresh.change;
  check(sameKeys(change, ["card", "field", "from", "to"]), say("change must be exactly {card, field, from, to}"));
  check(typeof change.card === "string" && FIELDS.includes(change.field), say("change names no troop card and stat"));
  check(Number.isSafeInteger(change.from) && Number.isSafeInteger(change.to) && change.from !== change.to, say("change must move one whole number"));
  check(same(fresh.protocol, protocol), say(`protocol differs from ${PROTOCOL_PATH}`));
  check(fresh.protocolSha256 === protocolSha256, say(`protocolSha256 differs from ${PROTOCOL_PATH}`));
  check(Array.isArray(fresh.blocks) && fresh.blocks.length === protocol.confirm.length, say(`expected ${protocol.confirm.length} confirm blocks`));
  protocol.confirm.forEach((range, i) => {
    const block = fresh.blocks[i], id = `confirm-${i + 1}`;
    check(plain(block) && block.id === id, say(`blocks[${i}] is not ${id}`));
    check(same(block.seeds, {first: range.first, last: range.first + range.deals - 1, deals: range.deals}), say(`${id} seeds differ from protocol confirm[${i}]`));
    check(block.gamesPerArm === 2 * range.deals, say(`${id} does not cover both starts of every seed`));
    check(block.pass === true && Array.isArray(block.reasons) && block.reasons.length === 0, say(`${id} did not pass`));
    check(SHA.test(block.pairedSha256 ?? ""), say(`${id} has no paired-games hash`));
  });
  return protocol.confirm;
}

// ---- plain-language events ----

const opponent = side => (side === "cowboy" ? "wizard" : side === "wizard" ? "cowboy" : undefined);
const Side = side => (typeof side === "string" && side ? side[0].toUpperCase() + side.slice(1) : "The other side");
// "cowboy-mounted-billy-1" -> "Mounted Billy": the card ID without its faction prefix and copy number.
function cardName(id) {
  if (id === "base") return "the Base";
  if (typeof id !== "string" || !id) return "a card";
  const words = id.replace(/-\d+$/, "").replace(/^(?:cowboy|wizard)-/, "").split("-").filter(Boolean);
  return words.map(w => w[0].toUpperCase() + w.slice(1)).join(" ") || id;
}
const troop = (side, id) => `${Side(side)}'s ${cardName(id)}`;
const orbWord = n => `${n} orb${n === 1 ? "" : "s"}`;

// Orbs on every troop and Base just before one bot action, updated as that action's events report new values.
function tallyOf(before) {
  const troops = new Map(), bases = {};
  for (const side of STARTS) {
    const s = before?.sides?.[side];
    if (typeof s?.base === "number") bases[side] = s.base;
    for (const t of Array.isArray(s?.board) ? s.board : []) if (t && typeof t.health === "number") troops.set(t.cardId, t.health);
  }
  return {troops, bases};
}

function troopOrbs(tally, id, after) {
  if (typeof after !== "number") return "";
  const before = tally.troops.get(id);
  tally.troops.set(id, after);
  const change = typeof before === "number" && before !== after ? `${before}→${orbWord(after)}` : `${orbWord(after)} left`;
  return `${cardName(id)} ${change}${after === 0 ? ", defeated" : ""}`;
}

function baseLoss(tally, side, n) {
  const before = tally.bases[side];
  if (typeof before !== "number") return `the ${Side(side)} Base loses ${orbWord(n)}`;
  const after = Math.max(0, before - n);
  tally.bases[side] = after;
  return `the ${Side(side)} Base loses ${orbWord(n)} (${before}→${after})`;
}

const FIELD_WORDS = {type: "event", side: "side", cardId: "card", target: "target", targetLeft: "target orbs left", attackerLeft: "attacker orbs left",
  baseDamage: "Base damage", hitBack: "hit back", covered: "target in cover", left: "orbs left", stopped: "attack stopped", stunned: "stunned",
  count: "troops swept", turn: "turn"};
const fieldWords = key => FIELD_WORDS[key] ?? key.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
function valueWords(key, value) {
  if (value === undefined || value === null) return "none";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if ((key === "cardId" || key === "target") && typeof value === "string") return cardName(value);
  if (key === "side" && typeof value === "string") return Side(value);
  if (typeof value === "number" || typeof value === "string") return String(value);
  return "other details";
}

// One sentence for one real engine event. Unknown event types fall back to their scalar fields in words.
function describe(event, tally) {
  const {type, side, cardId, target} = event;
  const foe = opponent(side);
  const sentence = (head, parts) => [head, parts.filter(Boolean).join("; ")].filter(Boolean).join(": ");
  switch (type) {
    case "draw": return `${Side(side)} draws a card`;
    case "burn": return `${Side(side)}'s hand is full, so ${cardName(cardId)} is discarded`;
    case "fatigue": return `${Side(side)}'s deck is empty, so ${baseLoss(tally, side, 1)}`;
    case "tribute": return `${Side(side)} tributes ${cardName(cardId)}`;
    case "summon": return `${Side(side)} summons ${cardName(cardId)}`;
    case "raise": return `${Side(side)} raises ${cardName(cardId)} with 1 orb`;
    case "gear": return `${Side(side)} gives ${cardName(target)} ${cardName(cardId)}`;
    case "location": return `${Side(side)} plays ${cardName(cardId)}`;
    case "set": return `${Side(side)} sets a trap`;
    case "cover": return `${troop(side, cardId)} takes cover`;
    case "turn": return `Turn ${event.turn} begins for ${Side(side)}`;
    case "spell":
      return event.stunned ? `${Side(side)} casts ${cardName(cardId)} on ${troop(foe, target)}: stunned`
        : sentence(`${Side(side)} casts ${cardName(cardId)} on ${troop(foe, target)}`, [troopOrbs(tally, target, event.left)]);
    case "trap":
      return sentence(`${Side(side)}'s ${cardName(cardId)} springs on ${troop(foe, target)}`,
        [troopOrbs(tally, target, event.left), event.stopped ? "the attack never lands" : ""]);
    case "laststand":
      return sentence(`${troop(side, cardId)} makes a Last Stand against ${troop(foe, target)}`, [troopOrbs(tally, target, event.left)]);
    case "sweep":
      return `${troop(side, cardId)} sweeps ${event.count === 1 ? "1 other troop" : `${event.count} other troops`} for 1 orb each`;
    case "attack": {
      const damage = typeof event.baseDamage === "number" && event.baseDamage > 0 ? event.baseDamage : 0;
      if (target === "base") return sentence(`${troop(side, cardId)} strikes the ${Side(foe)} Base`, [damage ? baseLoss(tally, foe, damage) : "no damage"]);
      const hit = typeof event.hitBack === "number" && event.hitBack > 0;
      const attackerBefore = tally.troops.get(cardId);
      return sentence(`${troop(side, cardId)} attacks ${troop(foe, target)}${event.covered ? " in cover" : ""}`, [
        troopOrbs(tally, target, event.targetLeft),
        hit ? `${cardName(target)} hits back for ${event.hitBack}` : "",
        hit || (typeof event.attackerLeft === "number" && event.attackerLeft !== attackerBefore) ? troopOrbs(tally, cardId, event.attackerLeft) : "",
        damage ? baseLoss(tally, foe, damage) : "",
      ]);
    }
    default: {
      const details = Object.keys(event).filter(k => !["type", "side"].includes(k) && event[k] !== null && typeof event[k] !== "object")
        .map(k => `${fieldWords(k)} ${valueWords(k, event[k])}`);
      return sentence(`${Side(side)}: ${typeof type === "string" ? type : "event"}`, [details.join(", ")]);
    }
  }
}

// What differs between the two versions' events at the first change, in words.
function changedFields(a, b) {
  const keys = [...new Set([...Object.keys(a.event), ...Object.keys(b.event)])].sort()
    .filter(k => canonical(a.event[k] ?? null) !== canonical(b.event[k] ?? null))
    .map(k => `${fieldWords(k)} ${valueWords(k, a.event[k])} → ${valueWords(k, b.event[k])}`);
  if (a.turn !== b.turn) keys.unshift(`turn ${a.turn} → ${b.turn}`);
  return keys;
}

function divergence(x, y, k) {
  const turns = x.turn === y.turn ? `On turn ${x.turn}` : `On turn ${x.turn} (baseline) / ${y.turn} (candidate)`;
  const changed = changedFields(x, y);
  return `${turns}, after ${k} identical event${k === 1 ? "" : "s"}, the versions first differ. Baseline: ${x.label}. Candidate: ${y.label}.` +
    (changed.length ? ` Changed: ${changed.join("; ")}.` : "");
}

// ---- replay and search ----

// One traced duel through the same play() that playTrial uses. The engine calls back (before, applied) per bot
// action; applied.events are the real events. An action argument, if an engine ever passes one, is kept as given.
function trace(rules, seed, first) {
  const rows = [];
  const result = play(rules, seed, first, (before, applied, action) => {
    check(plain(before) && Array.isArray(applied?.events), `seed ${seed} ${first}: engine step without a before state and applied.events`);
    const tally = tallyOf(before);
    for (const event of applied.events) {
      check(plain(event), `seed ${seed} ${first}: engine event is not an object`);
      const row = {turn: before.turn, event: clone(event), label: describe(event, tally)};
      if (action !== undefined) {
        try { row.action = clone(action); } catch { /* not serialisable; omit */ }
      }
      rows.push(row);
    }
  });
  return {rows, result};
}

const key = row => canonical([row.turn, row.event]);
const narrate = row => ({turn: row.turn, side: row.event.side ?? null, type: row.event.type ?? null, label: row.label});

function sideOf(trace, k) {
  const start = Math.max(0, k - 1);
  const row = trace.rows[k];
  const firstChange = {index: k, turn: row.turn, label: row.label, event: row.event};
  if (row.action !== undefined) firstChange.action = row.action;
  return {winner: trace.result.winner, endTurn: trace.result.endTurn, events: trace.rows.slice(start, start + WINDOW).map(narrate), firstChange};
}

function search(base, candidate, ranges, fresh) {
  for (const {first: low, deals} of ranges) {
    for (let seed = low; seed < low + deals; seed++) {
      for (const first of STARTS) {
        const a = playTrial(base, seed, first), b = playTrial(candidate, seed, first);
        if (a.winner === b.winner) continue;
        const pair = [trace(base, seed, first), trace(candidate, seed, first)];
        check(same(pair.map(t => t.result), [a, b]), `seed ${seed} ${first}: traced play differs from untraced play`);
        const [x, y] = pair.map(t => t.rows);
        const k = x.findIndex((row, i) => i >= y.length || key(row) !== key(y[i]));
        if (k < 0 || k >= y.length) continue; // one log is a prefix of the other: no event to compare
        return {
          schema: 1,
          base: fresh.base,
          fresh: fresh.recordSha256,
          inputs: fresh.inputs,
          change: fresh.change,
          seed,
          first,
          turn: x[k].turn,
          matchedEvents: k,
          divergence: divergence(x[k], y[k], k),
          baseline: sideOf(pair[0], k),
          candidate: sideOf(pair[1], k),
        };
      }
    }
  }
  return null;
}

async function build(fresh, ranges) {
  const scratch = mkdtempSync(join(tmpdir(), "field-trial-witness-"));
  try {
    const base = await openTrialEngine(join(scratch, "baseline"), fresh.base, null, fresh.inputs);
    const candidate = await openTrialEngine(join(scratch, "candidate"), fresh.base, {...fresh.change}, fresh.inputs);
    for (const engine of [base, candidate]) check(same(engine.inputs, fresh.inputs), "engine inputs differ from fresh.inputs");
    const witness = search(base.rules, candidate.rules, ranges, fresh);
    return witness && clone(witness);
  } finally {
    rmSync(scratch, {recursive: true, force: true});
  }
}

const describeRanges = ranges => ranges.map(r => `${r.first}..${r.first + r.deals - 1}`).join(", ");
const summary = w => `seed ${w.seed}, ${w.first} first, ${w.matchedEvents} matching events, first change on turn ${w.turn}; ` +
  `winner ${w.baseline.winner} → ${w.candidate.winner}.\n  ${w.divergence}`;

async function generate() {
  const current = loadProtocol();
  const {value: fresh} = readJson(FRESH, "fresh confirmation");
  const ranges = checkFresh(fresh, current, FRESH);
  const witness = await build(fresh, ranges);
  if (!witness) {
    console.log(`No eligible witness: no match in ${describeRanges(ranges)} (both starts) flipped its winner with a comparable first divergence. ${WITNESS_OUT} not written.`);
    return 1;
  }
  writeFileSync(join(root, WITNESS_OUT), JSON.stringify(witness, null, 2) + "\n");
  console.log(`From ${FRESH}: ${summary(witness)}\n  Wrote ${WITNESS_OUT}.`);
  return 0;
}

async function verify() {
  const current = loadProtocol();
  const {value: fresh} = readJson(COMMITTED_FRESH, "committed fresh confirmation");
  const {value: committed} = readJson(COMMITTED_WITNESS, "committed witness");
  const ranges = checkFresh(fresh, current, COMMITTED_FRESH);
  check(plain(committed), `${COMMITTED_WITNESS} is not a JSON object`);
  check(committed.base === fresh.base, "witness.base differs from fresh.base");
  check(committed.fresh === fresh.recordSha256, "witness.fresh differs from fresh.recordSha256");
  check(same(committed.inputs, fresh.inputs), "witness.inputs differ from fresh.inputs");
  check(same(committed.change, fresh.change), "witness.change differs from fresh.change");
  const witness = await build(fresh, ranges);
  check(witness, `No eligible witness reproduces from ${COMMITTED_FRESH}`);
  const differing = [...new Set([...Object.keys(committed), ...Object.keys(witness)])].filter(k => !same(committed[k], witness[k]));
  check(!differing.length, `${COMMITTED_WITNESS} differs from the recomputed first eligible match in: ${differing.join(", ")}`);
  console.log(`Verified witness: ${summary(witness)}`);
  return 0;
}

const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== "--verify")) {
  console.error("Usage: node scripts/field-trial-witness.mjs [--verify]");
  process.exitCode = 2;
} else {
  try {
    process.exitCode = await (args.length ? verify() : generate());
  } catch (error) {
    console.error(error instanceof Problem ? error.message : error.stack ?? String(error));
    process.exitCode = 1;
  }
}
