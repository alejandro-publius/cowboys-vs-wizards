// The Showdown duel in the graybox (issue 143 slice 1). Adapted from the reference screen in
// prototypes/showdown/main.js, solo only. Everything drawn comes from session.view() (viewFor),
// session.legal() (legalActions for this seat) and presentEvent text. The full state never
// reaches this module, and no Wizard hand, trap or deck card id is written into the page.
import {EFFECTS, KEYWORDS, RARITY, TYPES, cardOf, has, tributes, typeOf} from "../game/showdown/cards.js";
import {presentEvent} from "../game/showdown/presenter.js";
import {TRAP_SLOTS, attackOf, attackOutcome, canAttack, opponent} from "../game/showdown/rules.js";
import {createShowdownSession} from "../match/showdown-session.js";
import {createCuePlayer, cuesFor} from "./showdown-cues.js";
import {FRAMES} from "./card-frames.js";

const name = (cardId) => cardOf(cardId).name;
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const orbs = (now, max) => `<span class="sd-orbs" role="img" aria-label="${now} of ${Math.max(now, max)} orbs">${"●".repeat(now)}<span class="sd-lost">${"○".repeat(Math.max(0, max - now))}</span></span>`;
// Troop, spell and trap use the pull request 139 frames; gear and location add the reference screen's marks.
const FRAME = {...FRAMES, gear: {mark: "◆", line: "Gear"}, location: {mark: "■", line: "Location"}};
const typeLine = (card) => `<span class="sd-type">${FRAME[card.kind].mark} ${card.kind === "troop" ? `Troop · ${card.tag}` : FRAME[card.kind].line} · ${RARITY[card.rarity][0]}</span>`;
const keywords = (card) => (card.keys ?? []).map((key) => `<span class="sd-key" title="${KEYWORDS[key][1]}">${KEYWORDS[key][0]}</span>`).join(" ");
function costLine(type) {
  const cost = tributes(`${type}-1`);
  if (cost) return `Cost: ${cost} of your troops, sent to the graveyard. Attacks the turn it arrives.`;
  return TYPES[type].keys.includes("quickdraw") ? "Cost: none." : "Cost: none. Rests the turn it arrives.";
}
function face(type, extra = "") {
  const card = TYPES[type];
  const rules = card.kind !== "troop" ? EFFECTS[card.effect].text : "";
  return `<strong>${card.name}</strong>${typeLine(card)}${card.kind === "troop" ? `${card.attack} attack · ${plural(card.health, "orb")} ${keywords(card)}` : ""}
    ${rules ? `<span class="sd-note">${rules}</span>` : ""}${card.kind === "troop" ? `<span class="sd-note">${costLine(type)}</span>` : ""}${extra}`;
}

const TEMPLATE = `
  <header><h1>Showdown</h1><button id="sd-home" type="button">Main menu</button></header>
  <p id="sd-lesson"></p>
  <p id="sd-status" role="status"></p>
  <p id="sd-feedback" aria-live="polite"></p>
  <p id="sd-cue" aria-hidden="true"></p>
  <div id="sd-result"></div>
  <p id="sd-location" class="sd-note"></p>
  <section id="sd-board" aria-label="Board"></section>
  <p id="sd-prompt"></p>
  <div class="sd-row" id="sd-actions">
    <button type="button" id="sd-end">End turn</button>
    <button type="button" id="sd-cover" hidden>Take cover</button>
    <button type="button" id="sd-cancel" hidden>Cancel</button>
    <button type="button" id="sd-restart">Restart this duel</button>
  </div>
  <section id="sd-hand" aria-label="Your hand"></section>
  <section aria-label="What happened"><h2>What happened</h2><ol id="sd-log"></ol></section>
  <section aria-label="Graveyards"><h2>Graveyards</h2>
    <p class="sd-note">Cowboys: <span id="sd-cowboy-graveyard"></span></p>
    <p class="sd-note">Wizards: <span id="sd-wizard-graveyard"></span></p>
  </section>
  <section aria-label="Keywords"><h2>Keywords</h2><ul id="sd-keywords"></ul></section>`;

// cueOptions go to createCuePlayer (showdown-cues.js); only a check sets them, to shorten the step.
export function mountShowdown(root, {onHome, cueOptions}) {
  root.innerHTML = TEMPLATE;
  const $ = (id) => root.querySelector(`#${id}`);
  let session, duel, seed, lines, latest, pick;
  const cues = createCuePlayer(root, cueOptions);

  // Logs a batch of events and returns its placeholder cues, each tied to its log line.
  function record(events, before) {
    latest = events.map((event) => presentEvent(event));
    const first = lines.length;
    for (const [i, event] of events.entries()) lines.push({turn: event.type === "turn", text: latest[i]});
    const batch = cuesFor(events, before, session.view()).map((cue) => ({...cue, line: first + cue.index}));
    for (const cue of batch) lines[cue.line].cue = cue.kind;
    return batch;
  }
  function start(nextDuel, nextSeed) {
    [duel, seed] = [nextDuel, nextSeed];
    session = createShowdownSession({seed, duel});
    lines = [{turn: true, text: `Turn 1: the ${session.view().first === "cowboy" ? "Cowboys" : "Wizards"}.`}];
    latest = [];
    pick = null;
    cues.clear();
    const batch = record(session.opening, null);
    render();
    cues.play(batch);
  }
  function act(action) {
    pick = null;
    const before = session.view();
    const batch = record(session.act(action), before);
    render();
    cues.play(batch);
  }
  const playsOf = (cardId) => session.legal().filter((a) => a.cardId && name(a.cardId) === name(cardId));

  function clickCard(cardId) {
    const options = playsOf(cardId);
    if (!options.length) return;
    // A trap, a location, an untargeted spell or a free troop has one way to be played.
    if (options.length === 1 && options[0].target === undefined && options[0].slot === undefined && !options[0].tributes?.length) return act(options[0]);
    pick = cardOf(cardId).kind === "troop" ? {card: cardId, tributes: []} : {card: cardId};
    render();
  }
  function clickOwn(slot) {
    if (pick?.tributes) {
      const paid = pick.tributes.includes(slot) ? pick.tributes.filter((s) => s !== slot) : [...pick.tributes, slot].sort();
      const done = playsOf(pick.card).find((a) => a.tributes.join() === paid.join());
      if (done) return act(done);
      pick = {...pick, tributes: paid};
    } else if (pick?.card) {
      const gear = playsOf(pick.card).find((a) => a.type === "gear" && a.slot === slot);
      if (gear) return act(gear);
    } else if (session.legal().some((a) => (a.type === "attack" || a.type === "cover") && a.slot === slot)) pick = {troop: slot};
    render();
  }
  function clickEnemy(target) {
    const options = session.legal();
    const chosen = pick?.troop !== undefined ? options.find((a) => a.type === "attack" && a.slot === pick.troop && a.target === target)
      : pick?.card ? playsOf(pick.card).find((a) => a.target === target) : null;
    if (chosen) act(chosen);
  }

  // Why a card in hand cannot be played now, read from this seat's view.
  function blocked(view, cardId) {
    const card = cardOf(cardId);
    const mine = view.sides[session.seat];
    if (view.attacking) return "No more cards this turn: a troop has acted.";
    if (card.kind === "troop") {
      if (view.summonUsed) return "One troop a turn.";
      const cost = tributes(cardId);
      return mine.board.filter(Boolean).length < cost ? `Needs ${plural(cost, "troop")} of yours to pay with.` : "Your board is full.";
    }
    if (card.kind === "trap") return view.setUsed ? "One trap a turn." : mine.traps.length >= TRAP_SLOTS ? "Both trap slots are full." : "Not now.";
    if (view.castUsed) return "One spell, gear or location a turn.";
    return card.kind === "location" ? "Already the location." : card.kind === "gear" ? "No troop to carry it." : "No target.";
  }

  // What an attack would do, computed on the public view: face-down traps are not counted.
  function preview(view, target) {
    const o = attackOutcome(view, pick.troop, target);
    const foe = view.sides[opponent(session.seat)];
    if (target === "base") return `<span class="sd-note sd-good">${foe.board.some(Boolean) ? "Ride past: " : ""}Hit the Base for ${o.baseDamage}</span>`;
    const lastStand = o.targetLeft === 0 && has(foe.board[target].cardId, "laststand") ? ". Its Last Stand costs yours 1 orb" : "";
    if (o.targetLeft === 0) return `<span class="sd-note sd-good">Defeated${o.baseDamage ? `, ${o.baseDamage} through to the Base` : foe.board[target].cover ? ", nothing reaches the Base" : ""}${lastStand}</span>`;
    if (foe.board[target].cover) return `<span class="sd-note">Survives on ${o.targetLeft}. It is in cover and does not hit back.</span>`;
    if (attackOf(view, foe.board[target]) === 0) return `<span class="sd-note">Survives on ${o.targetLeft}. It has no attack, so yours is unharmed.</span>`;
    return `<span class="sd-note ${o.attackerLeft === 0 ? "sd-warn" : ""}">Survives on ${o.targetLeft} and hits back: yours ${o.attackerLeft === 0 ? "is defeated" : `drops to ${o.attackerLeft}`}</span>`;
  }

  function render() {
    const view = session.view();
    const own = session.seat, foe = opponent(own);
    const options = session.legal();
    const mine = options.length > 0;
    const attacking = pick?.troop !== undefined;
    const kind = pick?.card ? cardOf(pick.card).kind : null;
    const aims = new Set(attacking ? options.filter((a) => a.type === "attack" && a.slot === pick.troop).map((a) => a.target)
      : kind === "spell" ? playsOf(pick.card).map((a) => a.target) : []);
    const carriers = new Set(kind === "gear" ? playsOf(pick.card).map((a) => a.slot) : []);

    const row = (side) => {
      const s = view.sides[side];
      const isOwn = side === own;
      const baseOpen = !isOwn && aims.has("base");
      const traps = isOwn ? (s.traps.length ? `Set: ${s.traps.map(name).join(", ")}` : "No trap set") : s.trapCount ? `${plural(s.trapCount, "card")} face down` : "Nothing face down";
      // The other seat's hand is card backs (the deck back's .card-back element) and a count, never faces.
      const backs = isOwn ? "" : `<span class="sd-backs" role="img" aria-label="Wizard hand: ${plural(s.handCount, "card")}, face down">${'<span class="card-back" aria-hidden="true"></span>'.repeat(s.handCount)}</span>`;
      const base = `<button type="button" class="sd-base ${side}${baseOpen ? " sd-can" : ""}" ${baseOpen ? 'data-enemy="base"' : "disabled"} data-base="${side}">
        <strong>${isOwn ? "Your" : "Wizard"} Base</strong>${orbs(s.base, s.baseMax)}
        <span class="sd-note">Hand ${s.handCount} · Deck ${s.deckCount} · Graveyard ${s.discard.length}</span>${backs}
        <span class="sd-note">▲ ${traps}</span>${baseOpen ? preview(view, "base") : ""}</button>`;
      const slots = s.board.map((troop, slot) => {
        if (!troop) return `<button type="button" class="sd-slot ${side}" data-slot="${side}-${slot}" disabled><span class="sd-note">empty</span></button>`;
        const card = cardOf(troop.cardId);
        let cls = "", data = "disabled", note = troop.cover ? "In cover" : troop.stunned ? "Stunned" : "";
        if (isOwn && mine) {
          const tribute = pick?.tributes && playsOf(pick.card).some((a) => a.tributes.includes(slot));
          const ready = canAttack(view, troop);
          const actable = options.some((a) => (a.type === "attack" || a.type === "cover") && a.slot === slot);
          if (tribute) { cls = pick.tributes.includes(slot) ? " sd-chosen" : " sd-can"; data = `data-own="${slot}"`; note = "Tribute"; }
          else if (carriers.has(slot)) { cls = " sd-can"; data = `data-own="${slot}"`; note = "Give it the gear"; }
          else if (pick?.troop === slot) { cls = " sd-pick"; note = ready ? "Choose a target, or take cover" : "It can take cover"; }
          else if (!pick && actable) { cls = " sd-can"; data = `data-own="${slot}"`; note = ready ? "Can attack" : "Can take cover"; }
          else if (troop.arrived === view.turn && !ready && !troop.attacked) note = note || "Rests the turn it arrives";
          else if (troop.attacked && !troop.cover) note = "Has attacked";
        } else if (!isOwn && aims.has(slot)) {
          cls = " sd-can"; data = `data-enemy="${slot}"`;
          if (kind === "spell") note = cardOf(pick.card).effect === "tie" ? "Would be stunned" : troop.health === 1 ? "Would be defeated" : `Would drop to ${troop.health - 1}`;
        }
        const attack = attackOf(view, troop);
        return `<button type="button" class="sd-slot ${side}${cls}" data-frame="troop" data-slot="${side}-${slot}" ${data}><strong>${card.name}</strong><span class="sd-type">${FRAME.troop.mark} Troop · ${card.tag}</span>
          ${attack} attack${attack !== card.attack ? ` (+${attack - card.attack})` : ""} ${orbs(troop.health, card.health)} ${keywords(card)}
          ${troop.gear.length ? `<span class="sd-note">◆ ${troop.gear.map(name).join(", ")}</span>` : ""}${note ? `<span class="sd-note">${note}</span>` : ""}${!isOwn && attacking && aims.has(slot) ? preview(view, slot) : ""}</button>`;
      }).join("");
      return `<div class="sd-side" data-side="${side}">${base}${slots}</div>`;
    };
    $("sd-board").innerHTML = row(foe) + row(own);
    const landing = view.arrivals.map((due) => `${TYPES[due.type].name} lands at the start of turn ${Math.max(due.turn, view.turn + (view.active === due.side ? 2 : 1))}.`).join(" ");
    $("sd-location").textContent = landing + (landing && view.location ? " " : "") + (view.location ? `■ Location: ${name(view.location.cardId)}. ${EFFECTS[cardOf(view.location.cardId).effect].text.replace("Location. ", "")}` : "");

    const playable = new Set(options.filter((a) => a.cardId).map((a) => name(a.cardId)));
    $("sd-hand").innerHTML = view.sides[own].hand.map((cardId) => {
      const card = cardOf(cardId);
      const on = playable.has(card.name);
      return `<button type="button" class="sd-card ${card.side} ${card.rarity}${pick?.card === cardId ? " sd-pick" : on ? " sd-can" : ""}" data-frame="${card.kind}" data-card="${cardId}" ${on ? "" : "disabled"}>
        ${face(typeOf(cardId), mine && !on ? `<span class="sd-note sd-warn">${blocked(view, cardId)}</span>` : "")}</button>`;
    }).join("");

    const r = view.result;
    const verdict = !r ? "" : r.winner === null ? "Draw." : r.winner === own ? "You win: the Wizard Base fell." : "You lose: your Base fell.";
    $("sd-status").innerHTML = r ? `<span class="sd-result ${r.winner === own ? "sd-good" : "sd-warn"}">${verdict}</span>`
      : `${duel.name} · turn ${view.turn} · ${view.active === own ? "your turn" : "the Wizards' turn"}`;
    $("sd-feedback").textContent = latest.length ? `Last: ${latest.join(" ")}` : "";
    // Slice 1 keeps no progress, so a result offers the duel again and the way back, and pays nothing.
    $("sd-result").innerHTML = r ? `<div class="sd-row"><button type="button" id="sd-again">${r.winner === own ? "Play Boot Hill again" : "Rematch"}</button>
      <button type="button" id="sd-menu">Main menu</button></div>` : "";

    const canCover = attacking && options.some((a) => a.type === "cover" && a.slot === pick.troop);
    const guarded = view.sides[foe].board.some((troop) => troop && has(troop.cardId, "guard"));
    $("sd-prompt").textContent = r ? "" : pick?.tributes ? `Choose ${tributes(pick.card)} of your troops to send to the graveyard as payment for ${name(pick.card)}.`
      : kind === "gear" ? `Choose one of your troops to carry ${name(pick.card)}.`
      : kind === "spell" ? `Choose an enemy troop for ${name(pick.card)}.`
      : attacking ? `${aims.size === 0 ? "This troop cannot attack now." : guarded ? "A Guard stands in the way: attack it first." : aims.has("base") && aims.size === 1 ? "No enemy troops: strike the Base." : "Choose what to attack."}${
        canCover ? " Or take cover: until your next turn it keeps extra damage off your Base, but it will not hit back." : ""}`
      : view.attacking ? "No more cards this turn. Act with your other troops, or end the turn."
      : view.turn === 1 ? "Play your cards: one troop a turn. Nobody attacks on the opening turn."
      : "First play cards (one troop, one other card). Then act with your troops. Once a troop acts, no more cards this turn.";
    $("sd-end").hidden = Boolean(r);
    $("sd-end").disabled = !options.some((a) => a.type === "end");
    $("sd-cover").hidden = !canCover;
    $("sd-cancel").hidden = !pick;
    $("sd-restart").hidden = Boolean(r);
    $("sd-lesson").textContent = duel.lesson;
    $("sd-log").innerHTML = lines.map((l, i) => `<li data-line="${i}"${l.cue ? ` data-cue-kind="${l.cue}"` : ""}${l.turn ? ' class="sd-turn"' : ""}>${l.text}</li>`).join("");
    $("sd-log").scrollTop = $("sd-log").scrollHeight;
    for (const side of ["cowboy", "wizard"]) $(`sd-${side}-graveyard`).textContent = view.sides[side].discard.map(name).join(", ") || "empty";
    // Keywords from the duel's two public deck lists, so the list never depends on a hidden card.
    const inPlay = new Set(Object.values(duel.options.decks).flatMap((counts) => Object.keys(counts)).flatMap((type) => TYPES[type].keys ?? []));
    $("sd-keywords").innerHTML = Object.entries(KEYWORDS).filter(([key]) => inPlay.has(key)).map(([, [word, rule]]) => `<li><strong>${word}.</strong> ${rule}</li>`).join("")
      || "<li>No keywords in this duel.</li>";
    cues.paint();
  }

  root.addEventListener("click", (event) => {
    const b = event.target.closest("button");
    if (!b || b.disabled || !session) return;
    const d = b.dataset;
    if (d.card) clickCard(d.card);
    else if (d.own) clickOwn(Number(d.own));
    else if (d.enemy) clickEnemy(d.enemy === "base" ? "base" : Number(d.enemy));
    else if (b.id === "sd-end") act({type: "end"});
    else if (b.id === "sd-cover" && pick?.troop !== undefined) act(session.legal().find((a) => a.type === "cover" && a.slot === pick.troop));
    else if (b.id === "sd-cancel") { pick = null; render(); }
    else if (b.id === "sd-restart") start(duel, seed);
    else if (b.id === "sd-again") start(duel, freshSeed());
    else if (b.id === "sd-home" || b.id === "sd-menu") { cues.clear(); onHome(); }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && pick && !root.hidden) { pick = null; render(); }
  });
  return {start};
}

export const freshSeed = () => Math.floor(Math.random() * 100000);
