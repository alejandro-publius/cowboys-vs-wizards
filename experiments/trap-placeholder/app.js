// DOM half of the local-only trap placeholder lab (#108). Reads only the
// controller's public surface (view, displayed, options, status, message)
// and the Cowboy-projected event log; every action goes through
// controller.input, controller.submit or controller.endPhase.
import { createScheduler } from "../../src/match/scheduler.js";
import { MAX_ROUNDS, SLOT_COUNT } from "../../src/game/state.js";
import { LAB_CARDS, VIEWER, cardName, commandList, createLab, eventLine, trapText } from "./lab.js";

const ENEMY = "wizard";
const $ = (id) => document.getElementById(id);
const orbs = (n, max) => "\u25cf".repeat(Math.max(0, n)) + "\u25cb".repeat(Math.max(0, max - n));

const scheduler = createScheduler();
scheduler.tick(performance.now());
const { controller, events } = createLab({ scheduler, onChange: () => render() });

// Lanes are created once and updated in place so focus survives a redraw.
const lanes = {};
for (const side of [ENEMY, VIEWER]) {
  lanes[side] = [];
  for (let slot = 0; slot < SLOT_COUNT; slot++) {
    const button = document.createElement("button");
    button.type = "button";
    button.addEventListener("click", () => controller.input({ type: "slot", side, slot }));
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
  const card = LAB_CARDS[troop.cardId];
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
function renderLog() {
  const all = events();
  const list = $("log");
  if (all.length < logShown) {
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
  const status = controller.status();
  const view = controller.view();
  const shown = status === "idle" ? null : (controller.displayed() ?? view);
  const options = controller.options();
  const accepting = status === "accepting_input";

  const result = view?.result ? ` Result: ${view.result.outcome} (${view.result.reason}).` : "";
  $("status").textContent = view && status !== "idle"
    ? `Status: ${status}. Seed ${controller.seed()}. Round ${view.round} of ${MAX_ROUNDS}. Phase: ${view.activeSide === VIEWER ? "Cowboy" : "Wizard"}.${result} ${controller.message() ?? ""}`
    : `Status: ${status}. ${controller.message() ?? "Enter a seed and start."}`;

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
      const card = LAB_CARDS[cardId];
      const stats = card.kind === "troop" ? ` (${card.stars} stars, attack ${card.attack}, health ${card.health})` : ` (${card.kind})`;
      return {
        key: `${cardId}-${index}`,
        label: `${cardName(cardId)}${stats}`,
        disabled: !accepting || !options.playableCardIds.includes(cardId),
        pressed: options?.cardId === cardId,
        onClick: () => controller.input({ type: "card", cardId }),
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
    (accepting ? commandList(view) : []).map(({ label, action }, index) => ({
      key: `${index}-${label}`,
      label,
      disabled: false,
      onClick: () => controller.submit(action),
    })),
    "li",
  );
  renderLog();
}

$("seed-form").addEventListener("submit", (event) => {
  event.preventDefault();
  controller.start($("seed").value.trim());
});
$("restart").addEventListener("click", () => controller.restart());
$("leave").addEventListener("click", () => controller.leave());
$("confirm").addEventListener("click", () => controller.input({ type: "confirm" }));
$("skip").addEventListener("click", () => controller.input({ type: "skip" }));
$("cancel").addEventListener("click", () => controller.input({ type: "cancel" }));
$("end-phase").addEventListener("click", () => controller.endPhase());
$("show-log").addEventListener("change", () => renderLog());
addEventListener("pagehide", () => controller.leave());

function loop(now) {
  scheduler.tick(now);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
render();
controller.start($("seed").value.trim());
