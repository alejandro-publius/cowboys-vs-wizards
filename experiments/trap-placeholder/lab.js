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
//
// Issue #116 adds developer-only scenarios (scenarios.js: BASE, T1, T2 beside
// the default FIXTURE) and a Wizard CPU level, both chosen on the page and
// applied on Start through createLabSession.
import { CARDS, SIDES } from "../../src/game/cards.js";
import { createMatch } from "../../src/game/state.js";
import { applyAction } from "../../src/game/actions.js";
import { legalActions } from "../../src/game/legal.js";
import { publicEvents, publicState } from "../../src/game/view.js";
import { CPU_LEVELS, cpuFor } from "../../src/game/cpu.js";
import { createController } from "../../src/match/controller.js";
import { DECK_TRAP_CARDS, DECK_TRAP_CATALOG, DEFAULT_SCENARIO, SCENARIOS, openingFor } from "./scenarios.js";

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

// Issue #116: the catalog each scenario passes to the controller, legalActions,
// applyAction and the CPU chooser. BASE uses the shipped CARDS itself.
export const SCENARIO_CARDS = Object.freeze({ FIXTURE: LAB_CARDS, BASE: CARDS, T1: DECK_TRAP_CATALOG, T2: DECK_TRAP_CATALOG });
export const DEFAULT_CPU_LEVEL = "normal";
export { CPU_LEVELS, SCENARIOS, DEFAULT_SCENARIO };

// Valid settings or a thrown RangeError; nothing falls back silently.
export function labSettings({ scenario = DEFAULT_SCENARIO, cpuLevel = DEFAULT_CPU_LEVEL } = {}) {
  if (!SCENARIOS.includes(scenario)) throw new RangeError(`unknown scenario ${scenario}`);
  if (!CPU_LEVELS.includes(cpuLevel)) throw new RangeError(`unknown CPU level ${cpuLevel}`);
  return Object.freeze({ scenario, cpuLevel });
}

// The real rules for one scenario. FIXTURE (the default, #108): trap flag on
// and a fixture trap in each opening hand. BASE, T1, T2: openingFor() from
// scenarios.js. `events()` is the Cowboy's projection (publicEvents) of every
// accepted action's events, so the log never holds a Wizard trap ID before
// it springs. Full state stays inside the controller.
export function createLabEngine(scenario = DEFAULT_SCENARIO) {
  const options = Object.freeze({ cards: SCENARIO_CARDS[labSettings({ scenario }).scenario] });
  let log = [];
  const engine = Object.freeze({
    createMatch(seed) {
      log = [];
      if (scenario !== "FIXTURE") return openingFor(seed, scenario);
      const state = createMatch(seed, { traps: true });
      for (const side of SIDES) state.sides[side].hand.push(FIXTURE_TRAPS[side]);
      return state;
    },
    applyAction(state, action) {
      const result = applyAction(state, action, options);
      if (result.ok) log.push(...publicEvents(result.events, VIEWER));
      return result;
    },
    legalActions: (state, side) => legalActions(state, side, options),
    publicState,
  });
  return { engine, options, events: () => structuredClone(log) };
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
// The Wizard chooses with cpuFor(cpuLevel)(publicState, { cards }); "normal"
// is the unchanged chooseAction the #108 lab used.
export function createLab({ scheduler, renderer = createPlaceholderRenderer(), onChange, cpuDelay = 600, scenario, cpuLevel } = {}) {
  const settings = labSettings({ scenario, cpuLevel });
  const { engine, options, events } = createLabEngine(settings.scenario);
  const choose = cpuFor(settings.cpuLevel);
  const controller = createController({
    engine,
    chooseCpuAction: (view) => choose(view, options),
    scheduler,
    renderer,
    cards: options.cards,
    cpuDelay,
    onChange,
  });
  return { controller, events, settings, cards: options.cards };
}

// Same rule as the controller's seed parser, so a refused seed never replaces a match.
const validSeed = (seed) => typeof seed === "string" ? /^\d+$/.test(seed) && Number(seed) <= 4294967295 : Number.isInteger(seed) && seed >= 0 && seed <= 4294967295;

// Issue #116: the page's one active lab plus the settings that apply on Start.
// start(seed, settings) with unchanged settings is controller.start(seed),
// exactly as before. With changed settings it marks the old lab stale (its
// onChange is dropped from then on), calls its controller.leave() (scheduler
// epoch advance: no queued CPU step, timer or playback survives), builds a
// fresh lab with an empty log and starts it. An invalid seed goes to the
// current controller, which keeps its match and reports the seed message.
// restart() keeps the active scenario, CPU level and pinned seed.
export function createLabSession({ scheduler, renderer = createPlaceholderRenderer(), onChange, cpuDelay = 600, settings } = {}) {
  let generation = 0;
  let active = null;
  function open(next) {
    const mine = ++generation;
    active?.controller.leave();
    active = createLab({ scheduler, renderer, cpuDelay, ...next, onChange: () => mine === generation && onChange?.() });
  }
  open(labSettings(settings));
  const same = (a, b) => a.scenario === b.scenario && a.cpuLevel === b.cpuLevel;
  return {
    lab: () => active,
    generation: () => generation,
    settings: () => active.settings,
    start(seed, wanted) {
      const next = labSettings(wanted ?? active.settings);
      if (!same(next, active.settings) && validSeed(seed)) open(next);
      return active.controller.start(seed);
    },
    restart: () => active.controller.restart(),
    leave: () => active.controller.leave(),
  };
}

export const cardName = (cardId) => (LAB_CARDS[cardId] ?? DECK_TRAP_CARDS[cardId])?.name ?? "Unknown card";
const lane = (slot) => `lane ${slot + 1}`;

// Developer command list: the viewer's legal summon and spell entries, each
// with a label from the existing catalog. Trap sets go through selection.
export function commandList(view, cards = LAB_CARDS) {
  if (!view || view.result || view.activeSide !== view.viewer) return [];
  return legalActions(view, view.viewer, { cards })
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
// A view without a trap zone (BASE: traps off) says so instead of "empty".
export function trapText(view, side) {
  if (!Object.hasOwn(view.sides[side], "trap")) return side === view.viewer ? "Trap zone: traps not enabled in this scenario" : "Enemy trap: traps not enabled in this scenario";
  const trap = view.sides[side].trap;
  if (side !== view.viewer) return trap ? "Enemy trap: set (face-down)" : "Enemy trap: none";
  if (!trap) return "Trap zone: empty";
  const armed = trap.setRound < view.round;
  return `${cardName(trap.cardId)}. ${armed ? "Trap armed. It springs at the next clash if the enemy has a troop." : "Trap set. It springs from next round."}`;
}
