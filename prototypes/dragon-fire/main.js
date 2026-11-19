// Play one clash on a dragonFire match; the engine applies Dragon Fire.
import { CARDS } from "../../src/game/cards.js";
import { createMatch } from "../../src/game/state.js";
import { resolveClash, resultAfterClash } from "../../src/game/clash.js";
import { legalActions } from "../../src/game/legal.js";
import { applyAction } from "../../src/game/actions.js";

const DRAGON = "cowboy-captured-dragon-1";
const DEADEYE = "cowboy-deadeye-1";
const HOLD_CARD = "cowboy-sheriff-3";
const troop = (cardId, health) => ({ cardId, health });

// Both boards put you second in the round: the Wizard has acted, your turn ends with the clash.
const POSITIONS = {
  burnThrough: {
    goal: "The Wizard's Base is down to 2 orbs. Your Base has 3.",
    cowboyBase: 3,
    wizardBase: 2,
    wizard: [troop("wizard-skeleton-1", 1), troop("wizard-wizard-1", 4), troop("wizard-skeleton-2", 3)],
  },
  lastStand: {
    goal: "Your Base has one orb left. The Wizard's Base has 5.",
    cowboyBase: 1,
    wizardBase: 5,
    wizard: [troop("wizard-skeleton-1", 3), troop("wizard-wizard-1", 4), troop("wizard-skeleton-2", 3)],
  },
  // Burn Through's board, but the lane-1 Skeleton is on 2 orbs and the hand adds Deadeye.
  setUpTheBurn: {
    goal: "The Wizard's Base is down to 2 orbs. Your Base has 3. The Wizard's lane 1 Skeleton has 2 orbs left.",
    cowboyBase: 3,
    wizardBase: 2,
    deadeye: true,
    wizard: [troop("wizard-skeleton-1", 2), troop("wizard-wizard-1", 4), troop("wizard-skeleton-2", 3)],
  },
};

// slot: lane the card lands in (0-based). tribute: lane (0-based) of the Sheriff paid, or null.
const CHOICES = {
  lane1: { card: DRAGON, slot: 0, tribute: 0, label: "Dragon into lane 1" },
  lane2: { card: DRAGON, slot: 1, tribute: 1, label: "Dragon into lane 2" },
  lane3: { card: DRAGON, slot: 2, tribute: 0, label: "Dragon into lane 3" },
  hold: { card: HOLD_CARD, slot: 2, tribute: null, label: "Hold: Sheriff into lane 3" },
};

function setup(position) {
  const p = POSITIONS[position];
  const state = createMatch(0, { dragonFire: true });
  state.round = 5;
  state.startingSide = "wizard";
  state.activeSide = "cowboy";
  state.allowances.wizard.summonUsed = true;
  state.sides.cowboy.baseOrbs = p.cowboyBase;
  state.sides.wizard.baseOrbs = p.wizardBase;
  state.sides.cowboy.hand = p.deadeye ? [DRAGON, HOLD_CARD, DEADEYE] : [DRAGON, HOLD_CARD];
  state.sides.cowboy.board = [troop("cowboy-sheriff-1", 2), troop("cowboy-sheriff-2", 3), null];
  state.sides.wizard.board = p.wizard.map((t) => ({ ...t }));
  return state;
}

const sameTributes = (a, b) => a.length === b.length && a.every((slot, i) => slot === b[i]);

function summon(position, choice) {
  const c = CHOICES[choice];
  const state = setup(position);
  const tributes = c.tribute === null ? [] : [c.tribute];
  const action = legalActions(state, "cowboy").find(
    (a) => a.type === "summon" && a.cardId === c.card && a.slot === c.slot && sameTributes(a.tributes, tributes),
  );
  if (!action) throw new Error(`${c.label} is not a legal summon`);
  const applied = applyAction(state, action);
  if (!applied.ok) throw new Error(`Summon rejected: ${applied.reason}`);
  return applied.state;
}

// Resolve an optional shot and the clash for the summoned troop.
function play(position, choice, shot = null, summoned = summon(position, choice)) {
  let state = structuredClone(summoned);
  const events = [];
  if (shot !== null) {
    const cast = legalActions(state, "cowboy").find((a) => a.type === "spell" && a.cardId === DEADEYE && a.target === shot);
    if (!cast) throw new Error(`Deadeye on Wizard lane ${shot + 1} is not legal`);
    const shotResult = applyAction(state, cast);
    if (!shotResult.ok) throw new Error(`Deadeye rejected: ${shotResult.reason}`);
    state = structuredClone(shotResult.state);
    events.push(...shotResult.events.filter((e) => e.type === "spell" || e.type === "defeat"));
  }
  const openLanes = [0, 1, 2].filter((i) => !state.sides.cowboy.board[i] && state.sides.wizard.board[i]);
  // Blocker's health just before the clash, for the Dragon's lane.
  const dragonLane = state.sides.cowboy.board.findIndex((t) => t?.cardId === DRAGON);
  const blocker = dragonLane >= 0 ? state.sides.wizard.board[dragonLane] : null;
  const blockerBefore = blocker ? { cardId: blocker.cardId, health: blocker.health } : null;

  // Same board with the rule switched off, resolved on a scratch copy.
  const scratch = structuredClone(state);
  scratch.dragonFire = { ...scratch.dragonFire, enabled: false };

  resolveClash(state, (event) => events.push(event));

  // The engine reports Dragon Fire as a damage event marked fire:true.
  let fire = null;
  let withoutFire = null;
  const burn = events.find((e) => e.type === "damage" && e.fire === true);
  if (burn) {
    resolveClash(scratch, () => {});
    withoutFire = { result: resultAfterClash(scratch), cowboyBase: scratch.sides.cowboy.baseOrbs, wizardBase: scratch.sides.wizard.baseOrbs };
    fire = { lane: burn.lane, excess: burn.amount, before: burn.before, after: burn.after };
  }
  return { state, events, result: resultAfterClash(state), fire, withoutFire, blockerBefore, dragonLane, openLanes };
}

const who = (side) => (side === "cowboy" ? "Your" : "Enemy");
const name = (cardId) => CARDS[cardId].name;

function describe(events) {
  return events.flatMap((e) => {
    if (e.type === "spell") return [{ text: `Deadeye hit Enemy ${name(e.target.cardId)} in lane ${e.target.slot + 1}, ${e.before} to ${e.after}.` }];
    if (e.type === "damage" && e.fire) return [{ text: `Dragon Fire burned through: ${e.target.side === "cowboy" ? "Your" : "Wizard"} Base ${e.before} to ${e.after}.`, fire: true }];
    if (e.type === "damage") {
      const hitter = `${who(e.attacker.side)} ${name(e.attacker.cardId)}`;
      const target = e.target.kind === "base" ? `${who(e.target.side)} Base` : `${who(e.target.side)} ${name(e.target.cardId)}`;
      return [{ text: `Lane ${e.lane + 1}: ${hitter} hit ${target}, ${e.before} to ${e.after}.` }];
    }
    if (e.type === "defeat") return [{ text: `${who(e.side)} ${name(e.cardId)} was defeated.` }];
    return [];
  });
}

function verdict(result) {
  if (!result) return { cls: "", text: "Both Bases survived the clash." };
  if (result.winner === "cowboy") return { cls: "win", text: "You win: the Wizard's Base is destroyed." };
  if (result.winner === "wizard") return { cls: "lose", text: "You lose: your Base is destroyed." };
  return { cls: "", text: "Draw: both Bases are destroyed." };
}

const orbWord = (n) => `${n} orb${n === 1 ? "" : "s"}`;

function why(out, choice, shot = null) {
  const lines = [];
  if (shot !== null) lines.push(`Deadeye hit the Wizard troop in lane ${shot + 1}.`);
  else if (POSITIONS[position].deadeye) lines.push("You did not cast Deadeye.");
  if (choice !== "hold") {
    const lane = out.dragonLane + 1;
    if (!out.blockerBefore) lines.push(`Lane ${lane} had no blocker, so the Dragon hit the Wizard Base directly.`);
    else {
      const b = name(out.blockerBefore.cardId);
      const h = out.blockerBefore.health;
      const atk = CARDS[DRAGON].attack;
      lines.push(out.fire
        ? `The ${b} in lane ${lane} had ${orbWord(h)} left, so the Dragon's ${atk} attack used ${h} and ${out.fire.excess} burned through.`
        : `The ${b} in lane ${lane} had ${orbWord(h)} left, enough to absorb the Dragon's whole ${atk} attack, so nothing burned through.`);
    }
  }
  if (out.openLanes.length) {
    const open = out.openLanes.map((i) => `lane ${i + 1}`).join(" and ");
    lines.push(`Your ${open} had no blocker, so the Wizard's troop there hit your Base.`);
  } else {
    lines.push("Every Wizard attacker was blocked, so nothing reached your Base.");
  }
  return lines.join(" ");
}

const $ = (id) => document.getElementById(id);
let position = "burnThrough";
let played = false;
let pending = null;

function orbs(now, max) {
  return `<span class="orbs" role="img" aria-label="${now} of ${max} orbs">${"●".repeat(now)}<span class="lost">${"○".repeat(Math.max(0, max - now))}</span></span>`;
}

function cardHtml(side, t, mark) {
  if (!t) return `<div class="empty">empty</div>`;
  const card = CARDS[t.cardId];
  return `<div class="card ${side}${mark ? " mark" : ""}"><b>${card.name}</b><br>ATK ${card.attack}<br>${orbs(t.health, card.health)}</div>`;
}

function renderBoard(state) {
  const lane = (side, i) => `<div class="lane">${cardHtml(side, state.sides[side].board[i], state.sides[side].board[i]?.cardId === DRAGON)}</div>`;
  const base = (side, label) => `<div class="base ${side}">${label} Base ${orbs(state.sides[side].baseOrbs, 5)}</div>`;
  const row = (side) => [0, 1, 2].map((i) => lane(side, i)).join("");
  const labels = [1, 2, 3].map((i) => `<div class="lane-heading">Lane ${i}</div>`).join("");
  $("board").innerHTML = base("wizard", "Wizard") + labels + row("wizard") + row("cowboy") + base("cowboy", "Your");
}

function tributeText(c, board) {
  return c.tribute === null ? "No tribute" : `Tribute: ${name(board[c.tribute].cardId)} in lane ${c.tribute + 1}`;
}

function render() {
  const state = setup(position);
  renderBoard(state);
  $("goal").textContent = POSITIONS[position].goal;
  $("blurb").textContent = "Captured Dragon: when its attack is more than its blocker has orbs left, the rest burns through to the Wizard Base. The Wizard has acted; your choice ends your turn and the clash resolves.";
  $("hand").innerHTML = `Your hand: Captured Dragon (ATK ${CARDS[DRAGON].attack}, ${orbWord(CARDS[DRAGON].health)}; costs one Sheriff tribute), Sheriff (no tribute)${POSITIONS[position].deadeye ? ", Deadeye (spell: removes 1 orb from a Wizard troop; optional)" : ""}.`;
  $("shot").hidden = true;
  $("end-turn").hidden = true;
  $("shot-none").checked = true;
  for (const r of document.querySelectorAll("[name=shot]")) r.disabled = false;
  for (const b of document.querySelectorAll("[data-choice]")) {
    const c = CHOICES[b.dataset.choice];
    b.innerHTML = `${c.label}<small>${tributeText(c, state.sides.cowboy.board)}</small>`;
    b.disabled = false;
  }
  $("outcome").textContent = POSITIONS[position].deadeye
    ? "Choose a troop to summon."
    : "Choose a play. The clash resolves when you do.";
  for (const b of document.querySelectorAll("[data-position]")) b.setAttribute("aria-pressed", String(b.dataset.position === position));
  played = false;
  pending = null;
}

function finish(choice, summoned) {
  if (played) return;
  played = true;
  $("end-turn").hidden = true;
  const checked = document.querySelector("[name=shot]:checked").value;
  const shot = POSITIONS[position].deadeye && checked !== "none" ? Number(checked) : null;
  const out = play(position, choice, shot, summoned);
  renderBoard(out.state);
  for (const b of document.querySelectorAll("[data-choice]")) b.disabled = true;
  for (const r of document.querySelectorAll("[name=shot]")) r.disabled = true;
  const v = verdict(out.result);
  const lines = describe(out.events).map((l) => `<li${l.fire ? ' class="fire"' : ""}>${l.text}</li>`).join("");
  let noFire = "";
  if (out.withoutFire) {
    const w = verdict(out.withoutFire.result);
    noFire = `<p><b>Without Dragon Fire (same move, same board):</b> ${w.text} Wizard Base ${out.withoutFire.wizardBase}, your Base ${out.withoutFire.cowboyBase}.</p>`;
  }
  const shotLabel = (s) => (s === null ? "no shot" : `Deadeye on Wizard lane ${s + 1}`);
  const others = (POSITIONS[position].deadeye
    ? [null, 0, 1, 2].filter((s) => s !== shot).map((s) => [`${CHOICES[choice].label}, ${shotLabel(s)}`, play(position, choice, s)])
    : Object.keys(CHOICES).filter((k) => k !== choice).map((k) => [CHOICES[k].label, play(position, k)])
  ).map(([label, o]) => `<li>${label}: ${verdict(o.result).text}${o.fire ? " (Dragon Fire)" : ""}</li>`).join("");
  $("outcome").innerHTML = `<strong class="${v.cls}">${v.text}</strong>
    <p><b>Your play:</b> ${CHOICES[choice].label}${POSITIONS[position].deadeye ? `, ${shotLabel(shot)}` : ""}. ${tributeText(CHOICES[choice], setup(position).sides.cowboy.board)}.</p>
    <ul>${lines}</ul>${noFire}
    <p><b>Why:</b> ${why(out, choice, shot)}</p>
    <p><b>Other choices:</b></p><ul>${others}</ul>
    ${position === "burnThrough" ? `<p><button type="button" data-goto="lastStand">Try Last stand</button></p>` : ""}`;
}

function choose(choice) {
  if (!POSITIONS[position].deadeye) {
    finish(choice);
    return;
  }
  if (pending || played) return;
  const state = summon(position, choice);
  pending = { choice, state };
  renderBoard(state);
  for (const button of document.querySelectorAll("[data-choice]")) button.disabled = true;
  $("hand").textContent = "Deadeye is ready. Choose a target or end the turn without a shot.";
  $("shot").hidden = false;
  $("end-turn").hidden = false;
  $("outcome").textContent = "Your troop is in position. End the turn to resolve the clash.";
  $("shot-none").focus();
}

$("end-turn").addEventListener("click", () => {
  if (pending) finish(pending.choice, pending.state);
});
for (const b of document.querySelectorAll("[data-position]")) {
  b.addEventListener("click", () => { position = b.dataset.position; render(); });
}
for (const b of document.querySelectorAll("[data-choice]")) b.addEventListener("click", () => choose(b.dataset.choice));
$("outcome").addEventListener("click", (e) => {
  const go = e.target.closest("[data-goto]");
  if (go) { position = go.dataset.goto; render(); }
});
$("reset").addEventListener("click", render);
render();
