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
  const variant = ` Scenario ${SCENARIO_LABELS[active.scenario]}. Wizard CPU: ${active.cpuLevel}.${pending}`;
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
// A changed select only updates the status note; the match is untouched until Start.
for (const id of ["scenario", "cpu-level"]) $(id).addEventListener("change", () => render());
$("confirm").addEventListener("click", act(() => controller().input({ type: "confirm" })));
$("skip").addEventListener("click", act(() => controller().input({ type: "skip" })));
$("cancel").addEventListener("click", act(() => controller().input({ type: "cancel" })));
$("end-phase").addEventListener("click", act(() => controller().endPhase()));
$("show-log").addEventListener("change", () => renderLog());
addEventListener("pagehide", () => session.leave());

function loop(now) {
  scheduler.tick(now);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
render();
session.start($("seed").value.trim(), wanted());
