// Play one clash using the production rules, with a pre-clash drift for the Captured Wraith.
import { CARDS } from "../../src/game/cards.js";
import { createMatch } from "../../src/game/state.js";
import { shiftDestinations, shiftTroop } from "../../src/game/lanes.js";
import { resolveClash, resultAfterClash } from "../../src/game/clash.js";

const WRAITH = "cowboy-captured-wraith-1";
const WRAITH_LANE = 1;
const troop = (cardId) => ({ cardId, health: CARDS[cardId].health });

const POSITIONS = {
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
  const state = setup(position);
  const events = [];
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

function why(position, choice) {
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
let position = "raid";
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
  const lane = (side, i) => `<div class="lane">${cardHtml(side, state.sides[side].board[i], side === "cowboy" && state.sides[side].board[i]?.cardId === WRAITH)}</div>`;
  const base = (side, label) => `<div class="base ${side}">${label} Base ${orbs(state.sides[side].baseOrbs, 5)}</div>`;
  const row = (side) => [0, 1, 2].map((i) => lane(side, i)).join("");
  const labels = [1, 2, 3].map((i) => `<div class="lane-heading">Lane ${i}</div>`).join("");
  $("board").innerHTML = base("wizard", "Wizard") + labels + row("wizard") + row("cowboy") + base("cowboy", "Your");
}

function render() {
  const state = setup(position);
  renderBoard(state);
  $("goal").textContent = POSITIONS[position].goal;
  const [destination] = shiftDestinations(state.sides.cowboy.board, WRAITH_LANE);
  $("drift").textContent = `Drift to lane ${destination + 1}`;
  $("hold").disabled = $("drift").disabled = false;
  $("outcome").innerHTML = "The Wizard has committed. The drift happens before attacks.";
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
  const v = verdict(result);
  const av = verdict(alt.result);
  $("outcome").innerHTML = `<strong class="${v.cls}">${v.text}</strong>
    <ul>${describe(events).map((line) => `<li>${line}</li>`).join("")}</ul>
    <p><b>Why:</b> ${why(position, choice)}</p>
    <p><b>Other choice (${other}):</b> ${av.text}</p>`;
}

for (const b of document.querySelectorAll("[data-position]")) {
  b.addEventListener("click", () => { position = b.dataset.position; render(); });
}
$("hold").addEventListener("click", () => choose("hold"));
$("drift").addEventListener("click", () => choose("drift"));
$("reset").addEventListener("click", render);
render();
