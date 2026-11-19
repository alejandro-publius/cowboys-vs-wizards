// Screen for the Showdown rules prototype. You are the Cowboys; the Wizards plan each turn in rules.js.
import {EFFECTS, KEYWORDS, cardOf, tributes} from "./cards.js";
import {applyAction, attackOutcome, canAttack, createShowdown, legalActions, playTurn} from "./rules.js";

const $ = (id) => document.getElementById(id);
const name = (cardId) => cardOf(cardId).name;
const orbs = (now, max) => `<span class="orbs" role="img" aria-label="${now} of ${max} orbs">${"●".repeat(now)}<span class="lost">${"○".repeat(Math.max(0, max - now))}</span></span>`;
const who = (side) => (side === "cowboy" ? "Your" : "Enemy");
// The same marks as the graybox card frames: troop, spell, trap.
const MARK = {troop: "●", spell: "✦", trap: "▲"};
const typeLine = (card) => `<span class="type">${MARK[card.kind]} ${card.kind === "troop" ? `Troop · ${card.tag}` : card.kind === "spell" ? "Spell" : "Trap"}</span>`;
const keywords = (card) => (card.keys ?? []).map((key) => `<span class="key" title="${KEYWORDS[key][1]}">${KEYWORDS[key][0]}</span>`).join(" ");

let seed = Number(new URLSearchParams(location.search).get("seed") ?? 690);
let state;
let lines; // log lines, oldest first
// What the player is in the middle of: nothing, a card (with tributes picked so far), or an attacker.
let pick;

function say(events) {
  for (const e of events) {
    const base = e.side === "cowboy" ? "the Wizard Base" : "your Base";
    if (e.type === "turn") lines.push({turn: `Turn ${e.turn}: ${e.side === "cowboy" ? "you" : "the Wizards"}`});
    else if (e.type === "tribute") lines.push({text: `${who(e.side)} ${name(e.cardId)} was paid as tribute.`});
    else if (e.type === "summon") lines.push({text: `${who(e.side)} ${name(e.cardId)} arrived.`});
    else if (e.type === "raise") lines.push({text: `Raise: ${who(e.side).toLowerCase()} ${name(e.cardId)} returned from the graveyard with 1 orb.`});
    else if (e.type === "set") lines.push({text: e.side === "cowboy" ? "You set a trap face down." : "The Wizards set a card face down."});
    else if (e.type === "burn") lines.push({text: `${who(e.side)} hand was full: ${name(e.cardId)} was discarded.`});
    else if (e.type === "fatigue") lines.push({text: `${who(e.side)} deck is empty: ${e.side === "cowboy" ? "your Base" : "the Wizard Base"} lost 1 orb.`});
    else if (e.type === "spell") lines.push({text: `${who(e.side)} ${name(e.cardId)} hit ${name(e.target)}: ${e.stunned ? "stunned for its next turn" : e.left === 0 ? "defeated" : `${e.left} orbs left`}.`});
    else if (e.type === "trap") lines.push({text: `Trap! ${who(e.side)} ${name(e.cardId)} caught ${name(e.target)}: ${cardOf(e.cardId).effect === "hex" ? "its attack was cancelled" : e.left === 0 ? "defeated before it struck" : `it dropped to ${e.left} and attacked anyway`}.`});
    else if (e.type === "laststand") lines.push({text: `Last Stand: ${name(e.cardId)} took an orb off ${name(e.target)}${e.left === 0 ? ", defeating it" : ""}.`});
    else if (e.type === "sweep") lines.push({text: `Sweep: ${name(e.cardId)} also hit ${e.count} other troop${e.count > 1 ? "s" : ""} for 1.`});
    else if (e.type === "attack") {
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
    const played = playTurn(state);
    state = played.state;
    say(played.events);
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
const playsOf = (cardId) => legal().filter((a) => a.cardId && name(a.cardId) === name(cardId));

function clickCard(cardId) {
  const options = playsOf(cardId);
  // A trap, an untargeted spell or a free troop has one way to be played.
  if (options.length === 1 && options[0].target === undefined && !options[0].tributes?.length) return act(options[0]);
  pick = cardOf(cardId).kind === "spell" ? {card: cardId} : {card: cardId, tributes: []};
  render();
}

function clickOwn(slot) {
  if (pick?.tributes) {
    const paid = pick.tributes.includes(slot) ? pick.tributes.filter((s) => s !== slot) : [...pick.tributes, slot].sort();
    const done = playsOf(pick.card).find((a) => a.tributes.join() === paid.join());
    if (done) return act(done);
    pick = {...pick, tributes: paid};
  } else if (canAttack(state, state.sides.cowboy.board[slot])) pick = {attacker: slot};
  render();
}

function clickEnemy(target) {
  if (pick?.attacker !== undefined) return act({type: "attack", slot: pick.attacker, target});
  const cast = pick?.card && playsOf(pick.card).find((a) => a.target === target);
  if (cast) act(cast);
}

// What an attack from the picked troop would do to this target, in words. Face-down traps are not counted.
function preview(target) {
  const o = attackOutcome(state, pick.attacker, target);
  if (target === "base") return `<span class="note good">${state.sides.wizard.board.some(Boolean) ? "Ride past: " : ""}Hit the Base for ${o.baseDamage}</span>`;
  if (o.targetLeft === 0) return `<span class="note good">Defeated${o.baseDamage ? `, ${o.baseDamage} through to the Base` : ""}</span>`;
  return `<span class="note ${o.attackerLeft === 0 ? "warn" : ""}">Survives on ${o.targetLeft} and hits back: yours ${o.attackerLeft === 0 ? "is defeated" : `drops to ${o.attackerLeft}`}</span>`;
}

function render() {
  const mine = state.active === "cowboy" && !state.result;
  const attacking = pick?.attacker !== undefined;
  const casting = Boolean(pick?.card) && cardOf(pick.card).kind === "spell";
  // Enemy troops and Base the current pick may be aimed at.
  const aims = new Set(!mine ? [] : attacking ? legal().filter((a) => a.type === "attack" && a.slot === pick.attacker).map((a) => a.target)
    : casting ? playsOf(pick.card).map((a) => a.target) : []);
  const row = (side) => {
    const s = state.sides[side];
    const own = side === "cowboy";
    const baseOpen = !own && aims.has("base");
    const traps = own ? (s.traps.length ? `Set: ${s.traps.map(name).join(", ")}` : "No trap set") : s.traps.length ? `${s.traps.length} card${s.traps.length > 1 ? "s" : ""} face down` : "Nothing face down";
    const base = `<button type="button" class="base ${side}${baseOpen ? " can" : ""}" ${baseOpen ? 'data-enemy="base"' : "disabled"}>
      <strong>${own ? "Your" : "Wizard"} Base</strong>${orbs(s.base, 5)}
      <span class="note">Hand ${s.hand.length} · Deck ${s.deck.length} · Graveyard ${s.discard.length}</span>
      <span class="note">▲ ${traps}</span>${baseOpen ? preview("base") : ""}</button>`;
    const slots = s.board.map((troop, slot) => {
      if (!troop) return `<button type="button" class="slot ${side}" disabled><span class="note">empty</span></button>`;
      const card = cardOf(troop.cardId);
      let cls = "", data = "disabled", note = troop.stunned ? "Stunned" : "";
      if (own && mine) {
        const tribute = pick?.tributes && playsOf(pick.card).some((a) => a.tributes.includes(slot));
        const ready = canAttack(state, troop);
        if (tribute) { cls = pick.tributes.includes(slot) ? " chosen" : " can"; data = `data-own="${slot}"`; note = "Tribute"; }
        else if (!pick && ready) { cls = " can"; data = `data-own="${slot}"`; note = "Can attack"; }
        else if (pick?.attacker === slot) { cls = " pick"; note = "Attacking: choose a target"; }
        else if (troop.attacked) note = "Has attacked";
        else if (!ready && !troop.stunned && card.attack > 0 && state.turn > 1) note = "Rests this turn";
      } else if (!own && aims.has(slot)) {
        cls = " can"; data = `data-enemy="${slot}"`;
        if (casting) note = cardOf(pick.card).effect === "tie" ? "Would be stunned" : troop.health === 1 ? "Would be defeated" : `Would drop to ${troop.health - 1}`;
      }
      return `<button type="button" class="slot ${side}${cls}" ${data}><strong>${card.name}</strong>${typeLine(card)}
        ${card.attack} attack ${orbs(troop.health, card.health)} ${keywords(card)}${note ? `<span class="note">${note}</span>` : ""}${!own && attacking && aims.has(slot) ? preview(slot) : ""}</button>`;
    }).join("");
    return `<div class="side">${base}${slots}</div>`;
  };
  $("board").innerHTML = row("wizard") + row("cowboy");

  const playable = new Set(legal().filter((a) => a.cardId).map((a) => name(a.cardId)));
  $("hand").innerHTML = state.sides.cowboy.hand.map((cardId) => {
    const card = cardOf(cardId);
    const cost = tributes(cardId);
    const body = card.kind === "troop"
      ? `${card.attack} attack · ${card.health} orbs ${keywords(card)}<span class="note">${cost === 0 ? "Free" : `${cost} tribute${cost > 1 ? "s" : ""}, attacks at once`}</span>`
      : `<span class="note">${EFFECTS[card.effect].text}</span>`;
    const on = mine && playable.has(card.name);
    return `<button type="button" class="card cowboy ${card.kind}${pick?.card === cardId ? " pick" : on ? " can" : ""}" data-card="${cardId}" ${on ? "" : "disabled"}>
      <strong>${card.name}</strong>${typeLine(card)}${body}</button>`;
  }).join("");

  const r = state.result;
  $("status").innerHTML = r
    ? `<span class="result ${r.winner === "cowboy" ? "good" : "warn"}">${r.winner === "cowboy" ? "You win: the Wizard Base fell." : r.winner === "wizard" ? "You lose: your Base fell." : "Draw."}</span>`
    : `Turn ${state.turn} · your turn · seed ${seed}`;
  const guarded = state.sides.wizard.board.some((troop) => troop && cardOf(troop.cardId).keys.includes("guard"));
  $("prompt").textContent = r ? "" : pick?.tributes ? `Choose ${tributes(pick.card)} of your troops to pay for ${name(pick.card)}.`
    : casting ? `Choose an enemy troop for ${name(pick.card)}.`
    : attacking ? (guarded ? "A Guard stands in the way: attack it first." : aims.has("base") && aims.size === 1 ? "No enemy troops: strike the Base." : "Choose what to attack.")
    : state.attacking ? "Attack with your other troops, or end the turn."
    : state.turn === 1 ? "Play your cards. Nobody attacks on the opening turn." : "Play a card, pick a troop to attack with, or end the turn.";
  $("end").disabled = !mine;
  $("cancel").hidden = !pick;
  $("log").innerHTML = lines.map((l) => (l.turn ? `<li class="turn">${l.turn}</li>` : `<li>${l.text}</li>`)).join("");
  $("log").scrollTop = $("log").scrollHeight;
  for (const side of ["cowboy", "wizard"]) {
    $(`${side}-graveyard`).textContent = state.sides[side].discard.map(name).join(", ") || "empty";
  }
}

$("keywords").innerHTML = Object.values(KEYWORDS).map(([word, rule]) => `<li><strong>${word}.</strong> ${rule}</li>`).join("");
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
