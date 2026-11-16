// Runs one seeded match between two bots and prints a compact trace built from
// the engine's events. Usage:
//   node scripts/play-match.mjs --seed 14 [--cowboy cpu|random] [--wizard cpu|random]
// Also exports the match runner used by scripts/simulate-matches.mjs.
import { parseArgs } from "node:util";
import { CARDS, SIDES } from "../src/game/cards.js";
import { createMatch, MAX_ROUNDS, RULES_VERSION } from "../src/game/state.js";
import { applyAction } from "../src/game/actions.js";
import { legalActions } from "../src/game/legal.js";
import { publicState } from "../src/game/view.js";
import { chooseAction } from "../src/game/cpu.js";

// Nine rounds, two sides, at most summon + spell + end-phase each.
export const MAX_STEPS = MAX_ROUNDS * SIDES.length * 3;
export const BOT_KINDS = ["cpu", "random"];

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A bot is a function from that side's public view to one legal action.
// "random" picks uniformly among legal actions with its own generator derived
// from the match seed and the side, so a run is reproducible.
export function makeBot(kind, seed, side) {
  if (kind === "cpu") return chooseAction;
  const random = mulberry32((seed * 2 + SIDES.indexOf(side)) ^ 0x5eed);
  return (view) => {
    const actions = legalActions(view, view.viewer);
    return actions[Math.floor(random() * actions.length)];
  };
}

// Plays `seed` to its result. Bots only ever receive publicState for their own
// side. Throws if a bot's action is rejected or the step bound is reached.
// An experiment may pass its own `opening` state in place of the seeded deal.
export function playMatch(seed, bots, opening = createMatch(seed)) {
  let state = opening;
  const log = [];
  while (!state.result) {
    if (log.length >= MAX_STEPS) throw new Error(`seed ${seed}: no result after ${MAX_STEPS} actions`);
    const { round, activeSide: side } = state;
    const action = bots[side](publicState(state, side));
    const applied = applyAction(state, action);
    if (!applied.ok) throw new Error(`seed ${seed}: ${side} bot's action was rejected (${applied.reason})`);
    state = applied.state;
    log.push({ round, side, action, events: applied.events, state });
  }
  return { opening, state, log };
}

const name = (cardId) => CARDS[cardId].name;
const names = (ids) => ids.map(name).join(", ");
const boardText = (board) => board.map((troop) => (troop ? `${name(troop.cardId)} ${troop.health}` : "-")).join(" | ");

function actionText(events) {
  const [first] = events;
  if (first.type === "summon") {
    const paid = first.tributes.length ? ` (tribute lanes ${first.tributes.join(",")})` : "";
    return `summon ${name(first.cardId)} -> lane ${first.slot}${paid}`;
  }
  if (first.type === "spell") {
    const moved = first.destination === undefined ? "" : `, moved to lane ${first.destination}`;
    const defeated = events.some((event) => event.type === "defeat") ? ", defeated" : "";
    return `cast ${first.spell} on ${name(first.target.cardId)} lane ${first.target.slot}: ${first.before}->${first.after}${moved}${defeated}`;
  }
  return "end-phase";
}

function clashLines(round, events, state) {
  const hits = events
    .filter((event) => event.type === "damage")
    .map(({ lane, attacker, target, before, after }) => {
      const hit = target.kind === "base" ? `${target.side} base` : name(target.cardId);
      return `L${lane} ${name(attacker.cardId)}>${hit} ${before}->${after}`;
    });
  const defeats = events.filter((event) => event.type === "defeat").map((event) => `${name(event.cardId)} (${event.side} L${event.slot})`);
  const after = SIDES.map((side) => `${side} base ${state.sides[side].baseOrbs} [${boardText(state.sides[side].board)}]`);
  return [
    `R${round} clash   ${hits.join("; ") || "no attacks"}${defeats.length ? `; defeated: ${defeats.join(", ")}` : ""}`,
    `R${round} after   ${after.join("   ")}`,
  ];
}

export function traceLines(seed, kinds, dealt) {
  const bots = Object.fromEntries(SIDES.map((side) => [side, makeBot(kinds[side], seed, side)]));
  const { opening, state, log } = playMatch(seed, bots, dealt);
  const lines = [
    `seed ${seed}  rules ${RULES_VERSION}  ${SIDES.map((side) => `${side}=${kinds[side]}`).join(" ")}  starts: ${opening.startingSide}`,
    ...SIDES.map((side) => `opening hand ${side}: ${names(opening.sides[side].hand)}`),
  ];
  for (const entry of log) {
    lines.push(`R${entry.round} ${entry.side.padEnd(7)} ${actionText(entry.events)}`);
    if (entry.events.some((event) => event.type === "clash")) lines.push(...clashLines(entry.round, entry.events, entry.state));
  }
  const { winner, reason, round } = state.result;
  lines.push(`result: ${winner ? `${winner} wins` : "draw"} (${reason}) in round ${round} after ${log.length} actions`);
  return lines;
}

// Shared by both scripts: null unless `text` is a plain non-negative integer.
export function wholeNumber(text) {
  return /^\d+$/.test(text ?? "") && Number.isSafeInteger(Number(text)) ? Number(text) : null;
}

if (import.meta.main) {
  const usage = "usage: node scripts/play-match.mjs --seed <integer >= 0> [--cowboy cpu|random] [--wizard cpu|random]";
  let values;
  try {
    ({ values } = parseArgs({
      options: { seed: { type: "string" }, cowboy: { type: "string", default: "cpu" }, wizard: { type: "string", default: "cpu" } },
    }));
  } catch (error) {
    console.error(`${error.message}\n${usage}`);
    process.exit(2);
  }
  const seed = wholeNumber(values.seed);
  if (seed === null || !SIDES.every((side) => BOT_KINDS.includes(values[side]))) {
    console.error(usage);
    process.exit(2);
  }
  console.log(traceLines(seed, values).join("\n"));
}
