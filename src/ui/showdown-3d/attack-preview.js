import { TYPES } from "../../game/showdown/cards.js";
import { applyAction, createShowdown, legalActions, opponent } from "../../game/showdown/rules.js";
import { viewFor } from "../../game/showdown/contract.js";
import { presentEvent } from "../../game/showdown/presenter.js";
import { SPELL_STUDIES } from "./spell-studies.js";

export function attackPreviews(id) {
  if (id === "cowboy-bear-trap") return [["survive", "Watch a survivor"], ["defeat", "Watch a defeat"]];
  if (id === "wizard-hex") return [["cancel", "Watch Hex"]];
  if (TYPES[id]?.kind === "location") return [["field", "Watch the field"]];
  if (id === "wizard-hellfire") return [["cast", "Watch Hellfire"]];
  if (id === "cowboy-lasso") return [["cast", "Watch Lasso"]];
  if (id === "cowboy-deadeye") return [["cast", "Watch Deadeye"]];
  if (id === "cowboy-six-shooter") return [["equip", "Watch Six-Shooter"]];
  if (id === "wizard-singularity") {
    return [["sheriffs", "Against three Sheriffs"], ["graveyard", "Against Skeleton and Dragon"], ["targeted", "Watch one target"]];
  }
  if (id === "wizard-wizard") {
    return [["attack", "Rune Cannon"], ...Object.entries(SPELL_STUDIES).map(([mode, study]) => [mode, study.label])];
  }
  if (id === "cowboy-sheriff") return [["attack", "Watch attack"], ["last-call", "Last Call"]];
  const card = TYPES[id];
  if (card?.kind !== "troop") return [];
  if (card.attack === 0) return [["guard", "Watch Guard"]];
  let label = "Watch attack";
  if (card.keys.includes("sweep")) label = "Watch Sweep";
  else if (id === "cowboy-dynamiter") label = "Watch Dynamite";
  const options = [["attack", label]];
  if (card.keys.includes("ride")) options.push(["ride", "Watch Ride"]);
  if (card.keys.includes("laststand")) options.push(["laststand", "Watch Last Stand"]);
  if (card.keys.includes("guard")) options.push(["guard", "Watch Guard"]);
  if (id === "cowboy-ranger") options.push(["scout", "Watch Scout"]);
  return options;
}

export function attackExample(id, mode) {
  if (!attackPreviews(id).some(([key]) => key === mode)) return null;
  if (TYPES[id].kind === "trap") return trapExample(id, mode);
  if (TYPES[id].kind === "location") return locationExample(id);
  if (id === "wizard-hellfire") return hellfireExample();
  if (id === "cowboy-lasso")
    return spellExample(id, { cowboy: [{ type: "cowboy-sheriff" }], wizard: [{ type: "wizard-wizard" }] });
  if (id === "cowboy-deadeye")
    return spellExample(id, { cowboy: [{ type: "cowboy-ranger" }], wizard: [{ type: "wizard-wizard" }] });
  if (mode === "equip" || mode === "scout") return cowboySupportExample(id, mode);
  if (id === "wizard-singularity") {
    if (mode === "targeted") return spellExample(id, { wizard: [{ type: "wizard-wizard" }], cowboy: [{ type: "cowboy-sheriff" }] }, 0);
    return singularityExample(mode);
  }
  const card = TYPES[id];
  const side = card.side;
  const enemy = opponent(side);
  const defender = side === "cowboy" ? "wizard-skeleton" : "cowboy-sheriff";
  const returning = mode === "guard" || mode === "laststand";
  const lastCall = id === "cowboy-sheriff" && mode === "last-call";
  const wizardDuel = ["cowboy-billy", "cowboy-gatling-crew"].includes(id) || lastCall || mode === "guard" && side === "cowboy";
  const other = [{ type: wizardDuel ? "wizard-wizard" : defender }];
  if (mode === "guard") other.push({ type: side === "cowboy" ? "wizard-headless-horseman" : "cowboy-billy" });
  if (mode === "attack" && card.keys.includes("sweep"))
    other.push(
      { type: side === "cowboy" ? "wizard-skeleton" : "cowboy-billy" },
      { type: side === "cowboy" ? "wizard-headless-horseman" : "cowboy-dynamiter" },
    );
  const first = returning ? enemy : side;
  const allies = [{ type: id }];
  if (mode === "guard" && side === "cowboy") allies.push({ type: "cowboy-sheriff" });
  const state = createShowdown(7, { first, opening: { [side]: allies, [enemy]: other } });
  state.turn = 5;
  const action = legalActions(state).find(
    (each) => each.type === "attack" && each.slot === 0 && each.target === (mode === "ride" ? "base" : 0),
  );
  const { state: after, events } = applyAction(state, action);
  const before = viewFor(state, side),
    end = viewFor(after, side);
  const summary =
    (mode === "guard" ? `Guard makes enemies attack ${card.name} first. ` : "") +
    events.map((event) => presentEvent(event)).join(" ");
  const step = { before, after: end, events };
  if (id === "wizard-wizard" && SPELL_STUDIES[mode]) step.spellStudy = mode;
  if (lastCall) step.lastCall = true;
  return { before, end, trace: [step], summary };
}

function resolvedExample(state, action, viewer) {
  const {state: after, events} = applyAction(state, action);
  const before = viewFor(state, viewer), end = viewFor(after, viewer);
  return {before, end, trace: [{before, after: end, events}], summary: events.map(event => presentEvent(event)).join(" ")};
}

function cowboySupportExample(id, mode) {
  const state = createShowdown(7, { first: "cowboy", opening: {
    cowboy: [{ type: "cowboy-sheriff" }],
    wizard: [{ type: "wizard-skeleton" }],
  } });
  state.turn = 5;
  const cardId = id + "-71";
  state.sides.cowboy.hand[0] = cardId;
  const type = mode === "equip" ? "gear" : "summon";
  const action = legalActions(state).find(each => each.type === type && each.cardId === cardId);
  return resolvedExample(state, action, "cowboy");
}

function trapExample(id, mode) {
  const owner = TYPES[id].side, attacker = opponent(owner);
  const troop = id === "wizard-hex" ? {type: "cowboy-sheriff"}
    : {type: "wizard-skeleton", health: mode === "defeat" ? 2 : 3};
  const state = createShowdown(7, {first: attacker, opening: {[attacker]: [troop]}});
  state.turn = 5;
  state.sides[owner].traps.push(id + "-71");
  const attack = legalActions(state).find(action => action.type === "attack" && action.target === "base");
  return resolvedExample(state, attack, attacker);
}

function locationExample(id) {
  const side = TYPES[id].side;
  const state = createShowdown(7, {first: side, opening: {
    cowboy: [{type: "cowboy-captured-wraith"}, {type: "cowboy-sheriff"}],
    wizard: [{type: "wizard-bone-wall"}, {type: "wizard-wizard"}],
  }});
  state.turn = 5;
  const cardId = id + "-71";
  state.sides[side].hand[0] = cardId;
  const action = legalActions(state).find(action => action.type === "location" && action.cardId === cardId);
  return resolvedExample(state, action, side);
}

function hellfireExample() {
  return spellExample("wizard-hellfire", {
    wizard: [{ type: "wizard-wizard" }],
    cowboy: [{ type: "cowboy-sheriff" }, { type: "cowboy-mounted-billy" }, { type: "cowboy-gatling-crew" }],
  });
}

function spellExample(id, opening, target) {
  const { side } = TYPES[id];
  const state = createShowdown(7, { first: side, opening });
  state.turn = 5;
  const cardId = id + "-71";
  state.sides[side].hand[0] = cardId;
  const action = legalActions(state).find((each) => each.type === "spell" && each.cardId === cardId && (target === undefined || each.target === target));
  const { state: after, events } = applyAction(state, action);
  const before = viewFor(state, side), end = viewFor(after, side);
  return { before, end, trace: [{ before, after: end, events }], summary: events.map((event) => presentEvent(event)).join(" ") };
}

// Use the existing lawful area attack to drive the proposed spell's gallery replay.
function singularityExample(mode) {
  const sheriffs = mode === "sheriffs";
  const side = sheriffs ? "wizard" : "cowboy";
  const enemy = opponent(side);
  const targets = sheriffs
    ? Array.from({length: 3}, () => ({type: "cowboy-sheriff"}))
    : [{type: "wizard-skeleton", health: 1}, {type: "wizard-dragon"}];
  const start = createShowdown(7, {
    first: side,
    opening: {[side]: [{type: "wizard-wizard"}], [enemy]: targets},
  });
  start.turn = 5;
  // Opening fixtures normally contain one boss. This replay needs three distinct copies.
  start.sides[enemy].board.forEach((troop, slot) => {
    if (troop) troop.cardId = `${targets[slot].type}-${31 + slot}`;
  });
  const caster = start.sides[side].board[0].cardId;
  const effect = "wizard-hellfire-71";
  const spell = "wizard-singularity-71";
  start.sides[side].hand[0] = effect;
  const attack = legalActions(start).find((action) => action.type === "spell" && action.cardId === effect);
  const {state: after, events} = applyAction(start, attack);
  start.sides[side].hand[0] = spell;
  after.sides[side].discard[0] = spell;
  const before = viewFor(start, side);
  const end = viewFor(after, side);
  return {
    before, end,
    trace: [{before, after: end, events: events.map((event) => ({...event, cardId: spell, caster, areaVortex: true}))}],
    summary: sheriffs ? "Each Sheriff loses one orb."
      : "Skeleton is defeated. The Graveyard Dragon loses one orb and holds its ground.",
  };
}
