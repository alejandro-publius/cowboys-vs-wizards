// Play one clash using the production rules, with a pre-clash drift for the Captured Wraith.
import { CARDS } from "../../src/game/cards.js";
import { createMatch } from "../../src/game/state.js";
import { shiftDestinations, shiftTroop } from "../../src/game/lanes.js";
import { resolveClash, resultAfterClash, pendingDrift } from "../../src/game/clash.js";
import { legalActions } from "../../src/game/legal.js";
import { applyAction } from "../../src/game/actions.js";
import { createHunt, HUNTS_BY_ID } from "../../src/game/bounty-hunt.js";

const WRAITH = "cowboy-captured-wraith-1";
const WRAITH_LANE = 1;
const troop = (cardId) => ({ cardId, health: CARDS[cardId].health });

const POSITIONS = {
  gallows: {
    goal: "Learn the move: the Lantern Wraith is marked to drift into lane 1. Your Base has 2 orbs.",
  },
  raid: {
    goal: "The Wizard's Base is down to 2 orbs.",
    cowboyBase: 5,
    wizardBase: 2,
  },
  lastStand: {
    goal: "Your Base has one orb left.",
    cowboyBase: 1,
    wizardBase: 5,
  },
};

// Same lanes in both positions: Wraith and Billy face a Skeleton and a Wizard;
// lane 0 is empty on both sides.
function setup(position) {
  if (position === "gallows") return createHunt(HUNTS_BY_ID.get("gallows-lantern"));
  const { cowboyBase, wizardBase } = POSITIONS[position];
  const state = createMatch(0);
  state.round = 5;
  state.sides.cowboy.baseOrbs = cowboyBase;
  state.sides.wizard.baseOrbs = wizardBase;
  state.sides.cowboy.board = [null, troop(WRAITH), troop("cowboy-billy-1")];
  state.sides.wizard.board = [null, troop("wizard-skeleton-1"), troop("wizard-wizard-1")];
  return state;
}

// Plays one clash. choice: "hold" or "drift". Returns the new state, events, result.
function play(position, choice) {
  let state = setup(position);
  const events = [];
  if (position === "gallows") {
    if (choice === "drift") {
      const ride = legalActions(state, "cowboy").find((a) => a.type === "ride-out" && a.slot === 1 && a.destination === 0);
      const applied = applyAction(state, ride);
      if (!applied.ok) throw new Error(`Ride Out rejected: ${applied.reason}`);
      state = applied.state;
      events.push(...applied.events);
    }
    resolveClash(state, (event) => events.push(event));
    return { state, events, result: resultAfterClash(state) };
  }
  if (choice === "drift") {
    const [destination] = shiftDestinations(state.sides.cowboy.board, WRAITH_LANE);
    shiftTroop(state.sides.cowboy.board, WRAITH_LANE, destination);
    events.push({ type: "drift", destination });
  }
  resolveClash(state, (event) => events.push(event));
  return { state, events, result: resultAfterClash(state) };
}

const who = (side) => (side === "cowboy" ? "Your" : "Enemy");
const name = (cardId) => CARDS[cardId].name;

function describe(events) {
  return events.flatMap((e) => {
    if (e.type === "ride-out") return [e.side === "wizard" ? `The Lantern Wraith drifted to lane ${e.destination + 1}.` : `Billy rode to lane ${e.destination + 1}.`];
    if (e.type === "drift") return [`Captured Wraith drifted to lane ${e.destination + 1}.`];
    if (e.type === "damage") {
      const hitter = `${who(e.attacker.side)} ${name(e.attacker.cardId)}`;
      const target = e.target.kind === "base" ? `${who(e.target.side)} Base` : `${who(e.target.side)} ${name(e.target.cardId)}`;
      return [`Lane ${e.lane + 1}: ${hitter} hit ${target}, ${e.before} to ${e.after}.`];
    }
    if (e.type === "defeat") return [`${who(e.side)} ${name(e.cardId)} was defeated.`];
    return [];
  });
}

function verdict(result) {
  if (!result) return { cls: "", text: "Both Bases survived the clash." };
  if (result.winner === "cowboy") return { cls: "win", text: "You win: the Wizard's Base is destroyed." };
  if (result.winner === "wizard") return { cls: "lose", text: "You lose: your Base is destroyed." };
  return { cls: "", text: "Draw: both Bases are destroyed." };
}

function huntVerdict(state, result) {
  if (result?.reason === "bounty-captured") return { cls: "win", text: "Captured: the Lantern Wraith is defeated." };
  if (state.sides.cowboy.baseOrbs === 0) return { cls: "lose", text: "You lose: your Base is destroyed." };
  if (result) return { cls: "lose", text: "The Wraith escaped." };
  return { cls: "", text: "The Wraith survived the clash." };
}

function why(position, choice) {
  if (position === "gallows") {
    return choice === "drift"
      ? "Billy was already in lane 1 when the Wraith drifted in, so they fought each other there."
      : "Lane 1 was empty, so the Wraith drifted in and faced your Base instead of Billy.";
  }
  if (position === "raid") {
    return choice === "drift"
      ? "Drifting put the Wraith's 2 attack on an undefended Base, but the Skeleton, now unblocked, hit your Base."
      : "Holding kept the Wraith blocked by the Skeleton, so the Wizard's Base took nothing and the raid stalled.";
  }
  return choice === "drift"
    ? "Drifting left the Skeleton's lane open, and it hit your last orb. Your Wraith's hit on the Wizard's Base did not matter."
    : "Holding kept the Wraith in front of the Skeleton, which absorbed the hit, so your last orb survived.";
}

const $ = (id) => document.getElementById(id);
let position = "gallows";
let played = null; // choice already made this round

function orbs(now, max) {
  return `<span class="orbs" role="img" aria-label="${now} of ${max} orbs">${"●".repeat(now)}<span class="lost">${"○".repeat(Math.max(0, max - now))}</span></span>`;
}

function cardHtml(side, t, mark) {
  if (!t) return `<div class="empty">empty</div>`;
  const card = CARDS[t.cardId];
  return `<div class="card ${side}${mark ? " mark" : ""}"><b>${card.name}</b><br>ATK ${card.attack}<br>${orbs(t.health, card.health)}</div>`;
}

function renderBoard(state) {
  const mark = position === "gallows" ? pendingDrift(state)?.destination : -1;
  const lane = (side, i) => `<div class="lane${side === "wizard" && i === mark ? " marked" : ""}">${cardHtml(side, state.sides[side].board[i], side === "cowboy" && state.sides[side].board[i]?.cardId === WRAITH)}</div>`;
  const base = (side, label) => `<div class="base ${side}">${label} Base ${orbs(state.sides[side].baseOrbs, 5)}</div>`;
  const row = (side) => [0, 1, 2].map((i) => lane(side, i)).join("");
  const labels = [1, 2, 3].map((i) => `<div class="lane-heading">Lane ${i}${i - 1 === mark ? " (marked)" : ""}</div>`).join("");
  $("board").innerHTML = base("wizard", "Wizard") + labels + row("wizard") + row("cowboy") + base("cowboy", "Your");
}

function render() {
  const state = setup(position);
  renderBoard(state);
  $("goal").textContent = POSITIONS[position].goal;
  const gallows = position === "gallows";
  $("blurb").textContent = gallows
    ? "Learn the Lantern Wraith's move by fighting it."
    : "You captured the Lantern Wraith. Its drift is a one-clash prototype power here.";
  $("drift").textContent = gallows
    ? "Ride Billy to lane 1"
    : `Drift to lane ${shiftDestinations(state.sides.cowboy.board, WRAITH_LANE)[0] + 1}`;
  $("hold").disabled = $("drift").disabled = false;
  $("outcome").innerHTML = gallows
    ? "Before the first clash, the Wraith drifts into marked lane 1 if that lane is empty. Then everything attacks."
    : "The Wizard has committed. The drift happens before attacks.";
  for (const b of document.querySelectorAll("[data-position]")) b.setAttribute("aria-pressed", String(b.dataset.position === position));
  played = null;
}

function choose(choice) {
  if (played) return;
  played = choice;
  const { state, events, result } = play(position, choice);
  renderBoard(state);
  $("hold").disabled = $("drift").disabled = true;
  const other = choice === "hold" ? "drift" : "hold";
  const alt = play(position, other);
  const gallows = position === "gallows";
  const v = gallows ? huntVerdict(state, result) : verdict(result);
  const av = gallows ? huntVerdict(alt.state, alt.result) : verdict(alt.result);
  const otherName = gallows ? (other === "drift" ? "ride Billy to lane 1" : "hold lane") : other;
  const next = gallows && result?.reason === "bounty-captured"
    ? `<p><button type="button" data-goto="raid">Use the captured Wraith</button></p>`
    : position === "raid" ? `<p><button type="button" data-goto="lastStand">Optional: try Last stand</button></p>` : "";
  $("outcome").innerHTML = `<strong class="${v.cls}">${v.text}</strong>
    <ul>${describe(events).map((line) => `<li>${line}</li>`).join("")}</ul>
    <p><b>Why:</b> ${why(position, choice)}</p>
    <p><b>Other choice (${otherName}):</b> ${av.text}</p>${next}`;
}

for (const b of document.querySelectorAll("[data-position]")) {
  b.addEventListener("click", () => { position = b.dataset.position; render(); });
}
$("outcome").addEventListener("click", (e) => {
  const go = e.target.closest("[data-goto]");
  if (go) { position = go.dataset.goto; render(); }
});
$("hold").addEventListener("click", () => choose("hold"));
$("drift").addEventListener("click", () => choose("drift"));
$("reset").addEventListener("click", render);
render();
