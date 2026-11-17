// Issue #108: pure, DOM-free half of the local-only trap placeholder lab.
// app.js draws this with native buttons; tests/experiments/trap-placeholder.test.js
// drives it in Node. Nothing here adds a rule: actions come from the existing
// legalActions, the controller and scheduler are the shipped ones, and the
// trap behavior is the frozen A + X prototype behind createMatch(seed, { traps: true }).
//
// SYNTHETIC: each side gets one anonymous test-fixture trap in its opening
// hand (as in tests/match/trap-selection.test.js, #106). The fixtures exist
// only in this module. They are not cards, not deck entries, not balance and
// not production content. The shipped game keeps traps off.
import { CARDS, SIDES } from "../../src/game/cards.js";
import { createMatch } from "../../src/game/state.js";
import { applyAction } from "../../src/game/actions.js";
import { legalActions } from "../../src/game/legal.js";
import { publicEvents, publicState } from "../../src/game/view.js";
import { chooseAction } from "../../src/game/cpu.js";
import { createController } from "../../src/match/controller.js";

export const VIEWER = "cowboy";
export const FIXTURE_TRAPS = Object.freeze({ cowboy: "lab-fixture-trap-c", wizard: "lab-fixture-trap-w" });
const FIXTURE_NAME = "Placeholder trap (test fixture)";

// CARDS unchanged plus the two fixtures, as the controller seam requires.
export const LAB_CARDS = Object.freeze({
  ...CARDS,
  ...Object.fromEntries(
    SIDES.map((side) => [FIXTURE_TRAPS[side], Object.freeze({ id: FIXTURE_TRAPS[side], side, kind: "trap", name: FIXTURE_NAME })]),
  ),
});
export const LAB_OPTIONS = Object.freeze({ cards: LAB_CARDS });

// The real rules with the trap flag on and a fixture trap in each opening
// hand. `events()` is the Cowboy's projection (publicEvents) of every
// accepted action's events, so the log never holds a Wizard trap ID before
// it springs. Full state stays inside the controller.
export function createLabEngine() {
  let log = [];
  const engine = Object.freeze({
    createMatch(seed) {
      log = [];
      const state = createMatch(seed, { traps: true });
      for (const side of SIDES) state.sides[side].hand.push(FIXTURE_TRAPS[side]);
      return state;
    },
    applyAction(state, action) {
      const result = applyAction(state, action, LAB_OPTIONS);
      if (result.ok) log.push(...publicEvents(result.events, VIEWER));
      return result;
    },
    legalActions: (state, side) => legalActions(state, side, LAB_OPTIONS),
    publicState,
  });
  return { engine, events: () => structuredClone(log) };
}

// Full Presenter renderer interface with no drawing. Durations are fixed
// numbers so the scheduler paces playback; they are not animation evidence.
export const PLACEHOLDER_TIMES = Object.freeze({ impact: 120, end: 240 });
export function createPlaceholderRenderer() {
  const cue = () => ({ ...PLACEHOLDER_TIMES });
  const end = () => ({ end: PLACEHOLDER_TIMES.end });
  const noop = () => {};
  return {
    reset: noop,
    clear: noop,
    setTroopOrbs: noop,
    setBaseOrbs: noop,
    summon: cue,
    attack: cue,
    spell: cue,
    remove: end,
    move: end,
    clashReady: noop,
  };
}

// The lab: one controller (Cowboy human, Wizard CPU) on the injected scheduler.
export function createLab({ scheduler, renderer = createPlaceholderRenderer(), onChange, cpuDelay = 600 } = {}) {
  const { engine, events } = createLabEngine();
  const controller = createController({
    engine,
    chooseCpuAction: (view) => chooseAction(view, LAB_OPTIONS),
    scheduler,
    renderer,
    cards: LAB_CARDS,
    cpuDelay,
    onChange,
  });
  return { controller, events };
}

export const cardName = (cardId) => LAB_CARDS[cardId]?.name ?? "Unknown card";
const lane = (slot) => `lane ${slot + 1}`;

// Developer command list: the viewer's legal summon and spell entries, each
// with a label from the existing catalog. Trap sets go through selection.
export function commandList(view) {
  if (!view || view.result || view.activeSide !== view.viewer) return [];
  return legalActions(view, view.viewer, LAB_OPTIONS)
    .filter((action) => action.type === "summon" || action.type === "spell")
    .map((action) => ({ label: actionLabel(action), action }));
}

export function actionLabel(action) {
  if (action.type === "summon") {
    const tribute = action.tributes.length ? `, sacrificing ${action.tributes.map(lane).join(" and ")}` : "";
    return `Summon ${cardName(action.cardId)} to ${lane(action.slot)}${tribute}`;
  }
  if (action.type === "spell") {
    const move = action.destination === undefined ? "" : `, moving it to ${lane(action.destination)}`;
    return `Cast ${cardName(action.cardId)} on enemy ${lane(action.target)}${move}`;
  }
  if (action.type === "set-trap") return `Set ${cardName(action.cardId)}`;
  return "End phase";
}

const who = (side) => (side === VIEWER ? "Cowboy" : "Wizard");

// One readable line per public event.
export function eventLine(event) {
  switch (event.type) {
    case "round-start":
      return `Round ${event.round} starts.`;
    case "phase-start":
      return `${who(event.side)} phase starts.`;
    case "phase-end":
      return `${who(event.side)} ends the phase.`;
    case "draw":
      return `${who(event.side)} draws a card.`;
    case "summon":
      return `${who(event.side)} summons ${cardName(event.cardId)} to ${lane(event.slot)}.`;
    case "spell":
      return `${who(event.caster)} casts ${event.spell} on ${cardName(event.target.cardId)} in ${lane(event.target.slot)} (health ${event.before} to ${event.after}).`;
    case "trap-set":
      return event.cardId ? `${who(event.side)} sets ${cardName(event.cardId)} face-down.` : `${who(event.side)} sets a face-down trap.`;
    case "trap-trigger":
      return `${who(event.side)} trap springs: ${cardName(event.target.cardId)} in ${lane(event.target.slot)} loses its attack (${event.cancelled}) this clash.`;
    case "clash":
      return `Clash, round ${event.round}.`;
    case "damage": {
      const target = event.target.kind === "base" ? `${who(event.target.side)} base` : cardName(event.target.cardId);
      return `${cardName(event.attacker.cardId)} hits ${target} for ${event.amount} (${event.before} to ${event.after}).`;
    }
    case "defeat":
      return `${who(event.side)} ${cardName(event.cardId)} in ${lane(event.slot)} is defeated.`;
    case "result":
      return event.result.winner === null ? `Result: draw (${event.result.reason}).` : `Result: ${who(event.result.winner)} wins (${event.result.reason}).`;
    default:
      return event.type;
  }
}

// Trap zone text (contract section 7 placeholders) from the public view only.
export function trapText(view, side) {
  const trap = view.sides[side].trap;
  if (side !== view.viewer) return trap ? "Enemy trap: set (face-down)" : "Enemy trap: none";
  if (!trap) return "Trap zone: empty";
  const armed = trap.setRound < view.round;
  return `${cardName(trap.cardId)}. ${armed ? "Trap armed. It springs at the next clash if the enemy has a troop." : "Trap set. It springs from next round."}`;
}
