// DOM half of the local-only trap placeholder lab (#108). Reads only the
// controller's public surface (view, displayed, options, status, message)
// and the Cowboy-projected event log; every action goes through
// controller.input, controller.submit or controller.endPhase.
// Issue #116: the scenario and Wizard CPU selects apply only on Start (the
// seed form submit). Restart keeps the active scenario, level and seed.
import { createScheduler } from "../../src/match/scheduler.js";
import { MAX_ROUNDS, SLOT_COUNT } from "../../src/game/state.js";
import { VIEWER, cardName, commandList, createLabSession, eventLine, trapText } from "./lab.js";
import { SCENARIO_LABELS } from "./scenarios.js";
import { createPlaytestReport, reportFileName } from "./playtest-report.js";
import { CATEGORIES, pickSeeds } from "../trap-playtest-kit/seeds.js";

const ENEMY = "wizard";
const $ = (id) => document.getElementById(id);
const orbs = (n, max) => "\u25cf".repeat(Math.max(0, n)) + "\u25cb".repeat(Math.max(0, max - n));

const scheduler = createScheduler();
scheduler.tick(performance.now());
const wanted = () => ({ scenario: $("scenario").value, cpuLevel: $("cpu-level").value });
const session = createLabSession({ scheduler, onChange: () => render(), settings: wanted() });
// The active lab's controller; a Start with changed settings replaces it.
const controller = () => session.lab().controller;
const events = () => session.lab().events();

// Issue #110: an accepted action disables every control while it plays, so a
// keyboard user's focus drops to the page. `keyed` remembers the control that
// a keyboard press (click with detail 0) used for such an action; the next
// accepting_input render puts focus back on it, or on the first playable hand
// card, or on End phase. Nothing is restored after a mouse action, after any
// pointer press, or when the user has moved focus to another usable control.
let keyed = null;
const usable = (node) => node instanceof HTMLButtonElement && node.isConnected && !node.disabled && node.getClientRects().length > 0;
function act(run) {
  return (event) => {
    run();
    const target = event.currentTarget;
    keyed = event.detail === 0 && controller().status() !== "accepting_input" ? { id: target.id, key: target.dataset.key } : null;
  };
}
addEventListener("pointerdown", () => (keyed = null), true);
function restoreFocus(status) {
  if (!keyed || status === "playing" || status === "submitting" || status === "cpu_turn") return;
  const want = keyed;
  keyed = null;
  const active = document.activeElement;
  if (status !== "accepting_input" || (active && active !== document.body && active.isConnected && !active.disabled)) return;
  const match = want.id ? $(want.id) : [...document.querySelectorAll("#hand button, #commands button")].find((b) => b.dataset.key === want.key);
  const target = [match, ...$("hand").querySelectorAll("button"), $("end-phase")].find(usable);
  target?.focus();
}

// Lanes are created once and updated in place so focus survives a redraw.
const lanes = {};
for (const side of [ENEMY, VIEWER]) {
  lanes[side] = [];
  for (let slot = 0; slot < SLOT_COUNT; slot++) {
    const button = document.createElement("button");
    button.type = "button";
    button.addEventListener("click", act(() => controller().input({ type: "slot", side, slot })));
    $(`${side}-lanes`).append(button);
    lanes[side].push(button);
  }
}

// Replaces a list's buttons, keeping focus on the button with the same key.
function fillButtons(container, items, wrap) {
  const focused = container.contains(document.activeElement) ? document.activeElement.dataset.key : null;
  container.replaceChildren();
  for (const { key, label, disabled, pressed, onClick } of items) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.key = key;
    button.textContent = label;
    button.disabled = disabled;
    if (pressed !== undefined) button.setAttribute("aria-pressed", String(pressed));
    button.addEventListener("click", onClick);
    if (wrap) {
      const item = document.createElement(wrap);
      item.append(button);
      container.append(item);
    } else container.append(button);
    if (key === focused && !disabled) button.focus();
  }
}

function laneText(side, slot, troop) {
  const owner = side === VIEWER ? "Your" : "Enemy";
  if (!troop) return `${owner} lane ${slot + 1}: empty`;
  const card = session.lab().cards[troop.cardId];
  return `${owner} lane ${slot + 1}: ${card.name}\nHealth ${troop.health} of ${card.health} ${orbs(troop.health, card.health)}\nAttack ${card.attack}`;
}

function sideInfo(view, side) {
  const s = view.sides[side];
  const text = `Base life orbs ${s.baseOrbs} of 5 ${orbs(s.baseOrbs, 5)}. Deck ${s.deckCount}, hand ${s.handCount}, discard ${s.discard.length}.`;
  if (side !== VIEWER) return text;
  const a = view.allowances[side];
  return `${text} Summon used: ${a.summonUsed ? "yes" : "no"}. Spell or trap used: ${a.castUsed ? `yes (${a.tactical ?? "spell"})` : "no"}.`;
}

let logShown = 0;
let logGeneration = session.generation();
function renderLog() {
  const all = events();
  const list = $("log");
  if (all.length < logShown || logGeneration !== session.generation()) {
    logGeneration = session.generation();
    list.replaceChildren();
    logShown = 0;
  }
  for (const event of all.slice(logShown)) {
    const item = document.createElement("li");
    item.textContent = eventLine(event);
    list.append(item);
  }
  logShown = all.length;
  list.hidden = !$("show-log").checked;
}

function render() {
  const status = controller().status();
  const view = controller().view();
  const shown = status === "idle" ? null : (controller().displayed() ?? view);
  const options = controller().options();
  const accepting = status === "accepting_input";

  const result = view?.result ? ` Result: ${view.result.outcome} (${view.result.reason}).` : "";
  const active = session.settings();
  const pick = wanted();
  const pending = pick.scenario !== active.scenario || pick.cpuLevel !== active.cpuLevel ? " Settings changed: they apply on Start." : "";
  // Issue #122: a seed typed or prepared in the field is pending too.
  const typed = $("seed").value.trim();
  const seedPending = view && status !== "idle" && validSeed(typed) && Number(typed) !== controller().seed() ? ` Seed field ${Number(typed)} applies on Start.` : "";
  const variant = ` Scenario ${SCENARIO_LABELS[active.scenario]}. Wizard CPU: ${active.cpuLevel}.${pending}${seedPending}`;
  $("status").textContent = view && status !== "idle"
    ? `Status: ${status}. Seed ${controller().seed()}. Round ${view.round} of ${MAX_ROUNDS}. Phase: ${view.activeSide === VIEWER ? "Cowboy" : "Wizard"}.${result}${variant} ${controller().message() ?? ""}`
    : `Status: ${status}.${variant} ${controller().message() ?? "Enter a seed and start."}`;

  for (const side of [ENEMY, VIEWER]) {
    $(`${side}-info`).textContent = shown ? sideInfo(shown, side) : "";
    $(`${side}-trap`).textContent = shown ? trapText(shown, side) : "";
    const clickable = side === VIEWER ? options?.ownSlots : options?.enemySlots;
    lanes[side].forEach((button, slot) => {
      button.textContent = shown ? laneText(side, slot, shown.sides[side].board[slot]) : `Lane ${slot + 1}`;
      button.disabled = !accepting || !clickable?.includes(slot);
      if (side === VIEWER) button.setAttribute("aria-pressed", String(Boolean(options?.tributes.includes(slot))));
    });
  }

  const hand = (status !== "idle" && view?.sides[VIEWER].hand) || [];
  fillButtons(
    $("hand"),
    hand.map((cardId, index) => {
      const card = session.lab().cards[cardId];
      const stats = card.kind === "troop" ? ` (${card.stars} stars, attack ${card.attack}, health ${card.health})` : ` (${card.kind})`;
      return {
        key: `${cardId}-${index}`,
        label: `${cardName(cardId)}${stats}`,
        disabled: !accepting || !options.playableCardIds.includes(cardId),
        pressed: options?.cardId === cardId,
        onClick: act(() => controller().input({ type: "card", cardId })),
      };
    }),
  );

  $("prompt").textContent = options?.prompt ?? "";
  $("confirm").disabled = !accepting || !options?.canConfirm;
  $("skip").disabled = !accepting || !options?.canSkip;
  $("cancel").disabled = !accepting || !options?.canCancel;
  $("end-phase").disabled = !accepting;
  $("restart").disabled = view === null;

  fillButtons(
    $("commands"),
    (accepting ? commandList(view, session.lab().cards) : []).map(({ label, action }, index) => ({
      key: `${index}-${label}`,
      label,
      disabled: false,
      onClick: act(() => controller().submit(action)),
    })),
    "li",
  );
  renderLog();
  restoreFocus(status);
}

$("seed-form").addEventListener("submit", (event) => {
  event.preventDefault();
  session.start($("seed").value.trim(), wanted());
});
$("restart").addEventListener("click", () => session.restart());
$("leave").addEventListener("click", () => session.leave());
// A changed select or seed field only updates the status note; the match is untouched until Start.
for (const id of ["scenario", "cpu-level", "seed"]) $(id).addEventListener("change", () => render());
$("confirm").addEventListener("click", act(() => controller().input({ type: "confirm" })));
$("skip").addEventListener("click", act(() => controller().input({ type: "skip" })));
$("cancel").addEventListener("click", act(() => controller().input({ type: "cancel" })));
$("end-phase").addEventListener("click", act(() => controller().endPhase()));
$("show-log").addEventListener("change", () => renderLog());
addEventListener("pagehide", () => session.leave());

// Issue #118: local playtest report. Built only on an explicit export click
// from the current session's public data and the typed notes; downloaded as
// a Blob, never sent or stored. Notes are never cleared automatically.
const NOTE_INPUTS = { spellVersusTrap: "note-spell-trap", armingClarity: "note-arming", pacing: "note-pacing", freeform: "note-freeform" };
function currentReport() {
  const c = controller();
  const notes = Object.fromEntries(Object.entries(NOTE_INPUTS).map(([field, id]) => [field, $(id).value]));
  return createPlaytestReport({
    ...session.settings(),
    seed: c.seed(),
    seedPinned: c.seedPinned(),
    status: c.status(),
    view: c.view(),
    events: events(),
    cards: session.lab().cards,
    notes,
    includeEvents: $("export-events").checked,
  });
}
$("export-report").addEventListener("click", () => {
  const report = currentReport();
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2) + "\n"], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = reportFileName(report);
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  $("export-status").textContent = `Downloaded ${link.download} (${report.metrics.publicEvents} public events${report.match ? "" : ", no current match"}).`;
});
$("clear-notes").addEventListener("click", () => {
  for (const id of Object.values(NOTE_INPUTS)) $(id).value = "";
  $("export-status").textContent = "Notes cleared.";
});

// Issue #122: guided trial seeds. The options come from pickSeeds() in the
// browser-safe #120 kit at load; no seed is written here. Choosing an option
// only updates #trial-detail. The two Prepare buttons only write the seed,
// scenario and CPU fields and redraw the status; they never call session.start,
// restart or leave, never move focus, and never clear or export notes.
// Only Cowboy positions are shown; the Wizard's order and trap stay hidden.
// Same rule as the controller's seed parser (hoisted: render() uses it).
function validSeed(text) {
  return /^\d+$/.test(text) && Number(text) <= 4294967295;
}
const where = (position, round) => `position ${position} (${round === 1 ? "opening hand" : `drawn at round ${round} start if the match is still going`})`;
const firstSide = (side) => (side === "cowboy" ? "Cowboy" : "Wizard");
const trials = new Map();
try {
  const plan = pickSeeds();
  for (const pick of plan.picks) {
    const category = CATEGORIES.find((c) => c.id === pick.category);
    if (pick.seed === null) {
      trials.set(category.id, null);
      continue;
    }
    const also = pick.matches.filter((id) => id !== category.id);
    const late = pick.trapRound >= 8 ? ` Round ${pick.trapRound} is reached only if neither base falls first, so the trap may never be drawn.` : "";
    trials.set(category.id, {
      scenario: "T1",
      seed: pick.seed,
      label: `${category.id}: seed ${pick.seed}, ${firstSide(pick.startingSide)} first. ${category.meaning}`,
      detail: `Category ${category.id} (${category.rule}). Seed ${pick.seed}, ${firstSide(pick.startingSide)} first. Your synthetic trap: ${where(pick.trap, pick.trapRound)}. Your spell: ${where(pick.spell, pick.spellRound)}.${also.length ? ` Also matches ${also.join(", ")}.` : ""}${late}`,
    });
  }
  if (plan.t2) {
    trials.set("T2", {
      scenario: "T2",
      seed: plan.t2.seed,
      label: `T2 (optional, double trap): seed ${plan.t2.seed}, ${firstSide(plan.t2.startingSide)} first`,
      detail: `Optional T2 example. Seed ${plan.t2.seed}, ${firstSide(plan.t2.startingSide)} first. Both your synthetic traps at positions ${plan.t2.traps.join(" and ")} (opening hand) and no spell. One trap zone per side, so this tests a duplicate trap, not a spell-or-trap choice.`,
    });
  }
} catch (error) {
  trials.clear();
  $("trial-detail").textContent = `Guided trials unavailable: ${error.message}`;
}
for (const [value, trial] of trials) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = trial ? trial.label : `${value}: no seed in the scanned range`;
  option.disabled = !trial;
  $("trial-pick").append(option);
}
$("trial-pick").addEventListener("change", () => {
  const trial = trials.get($("trial-pick").value);
  $("trial-detail").textContent = trial ? trial.detail : "Choosing a category changes nothing until you press Prepare.";
});
function prepare(fields, text) {
  const before = { seed: $("seed").value.trim(), ...wanted() };
  $("seed").value = fields.seed;
  $("scenario").value = fields.scenario;
  $("cpu-level").value = "normal";
  const same = before.seed === fields.seed && before.scenario === fields.scenario && before.cpuLevel === "normal";
  $("trial-status").textContent = `${text} Nothing started${controller().view() ? ": the current match is unchanged" : ""}.${same ? " The form already held these values." : ""} Press Start.`;
  render();
}
$("prepare-trial").addEventListener("click", () => {
  const value = $("trial-pick").value;
  const trial = trials.get(value);
  if (!trial) {
    $("trial-status").textContent = "Choose a category first. Nothing prepared.";
    return;
  }
  prepare({ seed: String(trial.seed), scenario: trial.scenario }, `Prepared ${value}: seed ${trial.seed}, scenario ${trial.scenario}, Wizard CPU normal.`);
});
$("prepare-base").addEventListener("click", () => {
  const typed = $("seed").value.trim();
  if (!validSeed(typed)) {
    $("trial-status").textContent = `The seed field must hold a whole number from 0 to 4294967295. Nothing prepared.`;
    return;
  }
  prepare(
    { seed: typed, scenario: "BASE" },
    `Prepared paired BASE: seed ${Number(typed)} (from the seed field), scenario BASE (traps off), Wizard CPU normal. If you just played T1 at this seed, export that report first, then press Clear notes if you want empty notes; neither happens for you.`,
  );
});

function loop(now) {
  scheduler.tick(now);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
render();
session.start($("seed").value.trim(), wanted());
