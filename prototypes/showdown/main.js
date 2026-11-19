// Screen for the Showdown rules prototype. You are the Cowboys; the Wizards plan each turn in rules.js.
import {CARDS, tributeCost} from "../../src/game/cards.js";
import {applyAction, attackOutcome, canAttack, createShowdown, legalActions, planTurn} from "./rules.js";

const $ = (id) => document.getElementById(id);
const name = (cardId) => CARDS[cardId].name;
const orbs = (now, max) => `<span class="orbs" role="img" aria-label="${now} of ${max} orbs">${"●".repeat(now)}<span class="lost">${"○".repeat(Math.max(0, max - now))}</span></span>`;
const who = (side) => (side === "cowboy" ? "Your" : "Enemy");

let seed = Number(new URLSearchParams(location.search).get("seed") ?? 690);
let state;
let lines; // log lines, oldest first
// What the player is in the middle of: nothing, a card (with tributes picked so far), or an attacker.
let pick;

function say(events) {
  for (const e of events) {
    if (e.type === "turn") lines.push({turn: `Turn ${e.turn}: ${e.side === "cowboy" ? "you" : "the Wizards"}`});
    else if (e.type === "tribute") lines.push({text: `${who(e.side)} ${name(e.cardId)} was paid as tribute.`});
    else if (e.type === "summon") lines.push({text: `${who(e.side)} ${name(e.cardId)} arrived.`});
    else if (e.type === "spell") lines.push({text: `${who(e.side)} ${name(e.cardId)} hit ${name(e.target)}: ${e.left === 0 ? "defeated" : `${e.left} orbs left`}.`});
    else if (e.type === "attack") {
      const base = e.side === "cowboy" ? "the Wizard Base" : "your Base";
      if (e.target === "base") lines.push({text: `${who(e.side)} ${name(e.cardId)} struck ${base} for ${e.baseDamage}.`});
      else {
        const result = e.targetLeft === 0
          ? `defeated it${e.baseDamage ? `, and ${e.baseDamage} went through to ${base}` : ""}`
          : `left it on ${e.targetLeft}, and it hit back${e.attackerLeft === 0 ? `, defeating ${name(e.cardId)}` : ""}`;
        lines.push({text: `${who(e.side)} ${name(e.cardId)} attacked ${name(e.target)} and ${result}.`});
      }
    }
  }
}

// The Wizards take their whole turn at once.
function wizardsPlay() {
  while (!state.result && state.active === "wizard") {
    for (const step of planTurn(state)) {
      const next = applyAction(state, step);
      state = next.state;
      say(next.events);
      if (state.result) break;
    }
  }
}

function act(action) {
  const applied = applyAction(state, action);
  state = applied.state;
  say(applied.events);
  pick = null;
  wizardsPlay();
  render();
}

function start(newSeed) {
  seed = newSeed;
  state = createShowdown(seed);
  lines = [{turn: `Turn 1: ${state.active === "cowboy" ? "you" : "the Wizards"}`}];
  pick = null;
  wizardsPlay();
  render();
}

const legal = () => legalActions(state);
const summonsFor = (cardId) => legal().filter((a) => a.type === "summon" && name(a.cardId) === name(cardId));

function clickCard(cardId) {
  const card = CARDS[cardId];
  if (card.kind === "spell") pick = {card: cardId};
  else {
    const options = summonsFor(cardId);
    if (tributeCost(card.stars) === 0) return act(options[0]);
    pick = {card: cardId, tributes: []};
  }
  render();
}

function clickOwn(slot) {
  if (pick?.tributes) {
    const tributes = pick.tributes.includes(slot) ? pick.tributes.filter((s) => s !== slot) : [...pick.tributes, slot].sort();
    const done = summonsFor(pick.card).find((a) => a.tributes.join() === tributes.join());
    if (done) return act(done);
    pick = {...pick, tributes};
  } else if (canAttack(state, state.sides.cowboy.board[slot])) pick = {attacker: slot};
  render();
}

function clickEnemy(target) {
  if (pick?.attacker !== undefined) return act({type: "attack", slot: pick.attacker, target});
  if (pick?.card && CARDS[pick.card].kind === "spell") {
    const cast = legal().find((a) => a.type === "spell" && name(a.cardId) === name(pick.card) && a.target === target);
    if (cast) act(cast);
  }
}

// What an attack from the picked troop would do to this target, in words.
function preview(target) {
  const o = attackOutcome(state, pick.attacker, target);
  if (target === "base") return `<span class="note good">Hit the Base for ${o.baseDamage}</span>`;
  if (o.targetLeft === 0) return `<span class="note good">Defeated${o.baseDamage ? `, ${o.baseDamage} through to the Base` : ""}</span>`;
  return `<span class="note ${o.attackerLeft === 0 ? "warn" : ""}">Survives on ${o.targetLeft} and hits back: yours ${o.attackerLeft === 0 ? "is defeated" : `drops to ${o.attackerLeft}`}</span>`;
}

function render() {
  const mine = state.active === "cowboy" && !state.result;
  const attacking = pick?.attacker !== undefined;
  const casting = Boolean(pick?.card) && CARDS[pick.card].kind === "spell";
  const enemyTroops = state.sides.wizard.board.some(Boolean);
  const row = (side) => {
    const s = state.sides[side];
    const own = side === "cowboy";
    const baseOpen = !own && attacking && !enemyTroops;
    const base = `<button type="button" class="base ${side}${baseOpen ? " can" : ""}" ${baseOpen ? 'data-enemy="base"' : "disabled"}>
      <strong>${own ? "Your" : "Wizard"} Base</strong>${orbs(s.base, 5)}
      <span class="note">Hand ${s.hand.length} · Deck ${s.deck.length}</span>${baseOpen ? preview("base") : ""}</button>`;
    const slots = s.board.map((troop, slot) => {
      if (!troop) return `<button type="button" class="slot ${side}" disabled><span class="note">empty</span></button>`;
      const card = CARDS[troop.cardId];
      let cls = "", data = "disabled", note = "";
      if (own && mine) {
        const tribute = pick?.tributes && summonsFor(pick.card).some((a) => a.tributes.includes(slot));
        const ready = canAttack(state, troop);
        if (tribute) { cls = pick.tributes.includes(slot) ? " chosen" : " can"; data = `data-own="${slot}"`; note = "Tribute"; }
        else if (!pick && ready) { cls = " can"; data = `data-own="${slot}"`; note = "Can attack"; }
        else if (pick?.attacker === slot) { cls = " pick"; note = "Attacking: choose a target"; }
        else if (troop.attacked) note = "Has attacked";
        else if (!ready && state.turn > 1) note = "Rests this turn";
      } else if (!own && mine && (attacking || casting)) {
        cls = " can"; data = `data-enemy="${slot}"`;
        note = attacking ? "" : troop.health === 1 ? "Would be defeated" : `Would drop to ${troop.health - 1}`;
      }
      return `<button type="button" class="slot ${side}${cls}" ${data}><strong>${card.name}</strong>
        ${card.attack} attack ${orbs(troop.health, card.health)}${note ? `<span class="note">${note}</span>` : ""}${!own && attacking && mine ? preview(slot) : ""}</button>`;
    }).join("");
    return `<div class="side">${base}${slots}</div>`;
  };
  $("board").innerHTML = row("wizard") + row("cowboy");

  const playable = new Set(legal().filter((a) => a.type !== "attack" && a.type !== "end").map((a) => name(a.cardId)));
  $("hand").innerHTML = state.sides.cowboy.hand.map((cardId) => {
    const card = CARDS[cardId];
    const cost = card.kind === "spell" ? "Spell: removes one orb" : tributeCost(card.stars) === 0 ? "Free" : `${tributeCost(card.stars)} tribute${tributeCost(card.stars) > 1 ? "s" : ""}, attacks at once`;
    const stats = card.kind === "spell" ? "" : `${card.attack} attack · ${card.health} orbs`;
    const on = mine && playable.has(card.name);
    return `<button type="button" class="card cowboy${pick?.card === cardId ? " pick" : on ? " can" : ""}" data-card="${cardId}" ${on ? "" : "disabled"}>
      <strong>${card.name}</strong>${stats}<span class="note">${cost}</span></button>`;
  }).join("");

  const r = state.result;
  $("status").innerHTML = r
    ? `<span class="result ${r.winner === "cowboy" ? "good" : "warn"}">${r.winner === "cowboy" ? "You win: the Wizard Base fell." : r.winner === "wizard" ? "You lose: your Base fell." : "Draw."}</span>`
    : `Turn ${state.turn} · your turn · seed ${seed}`;
  $("prompt").textContent = r ? "" : pick?.tributes ? `Choose ${tributeCost(CARDS[pick.card].stars)} of your troops to pay for ${name(pick.card)}.`
    : casting ? `Choose an enemy troop for ${name(pick.card)}.`
    : attacking ? (enemyTroops ? "Choose the enemy troop to attack." : "No enemy troops: strike the Base.")
    : state.attacking ? "Attack with your other troops, or end the turn."
    : state.turn === 1 ? "Summon a troop. Nobody attacks on the opening turn." : "Play a card, pick a troop to attack with, or end the turn.";
  $("end").disabled = !mine;
  $("cancel").hidden = !pick;
  $("log").innerHTML = lines.map((l) => (l.turn ? `<li class="turn">${l.turn}</li>` : `<li>${l.text}</li>`)).join("");
  $("log").scrollTop = $("log").scrollHeight;
}

document.addEventListener("click", (event) => {
  const b = event.target.closest("button");
  if (!b || b.disabled) return;
  if (b.dataset.card) clickCard(b.dataset.card);
  else if (b.dataset.own) clickOwn(Number(b.dataset.own));
  else if (b.dataset.enemy) clickEnemy(b.dataset.enemy === "base" ? "base" : Number(b.dataset.enemy));
});
$("end").addEventListener("click", () => act({type: "end"}));
$("cancel").addEventListener("click", () => { pick = null; render(); });
$("again").addEventListener("click", () => start(seed));
$("fresh").addEventListener("click", () => start(Math.floor(Math.random() * 100000)));
start(seed);
