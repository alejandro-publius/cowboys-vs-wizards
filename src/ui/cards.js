// Orb Duel card overlay: match details, the Wizard's card backs, lanes, the
// Cowboy hand and deck pile, prompts and the result, drawn from cardModel()
// data (src/ui/card-model.js). The approved illustrated faces are restored. The deck piles and the Wizard hand show the approved card back
// through the CSS custom property --card-back, which scripts/build.mjs fills
// from assets/cards/card-back.png. Every control is a native button and
// clicks are delegated to `handlers`; nothing here touches the Engine.
//
// mountCards(root, handlers) -> {render(model)}
// handlers: onCard(cardId), onSlot(side, slot), onConfirm(), onCancel(),
//   onSkip(), onEndPhase(), onRestart(), onReplaySeed(text),
//   summonTarget(slot) -> {left, top, width, height} screen rect of the Cowboy
//   board tile for a summon flight, or null to fall back to the lane button
// render() sets root.dataset.status to the controller status.

import {createCardBody, describeCard} from "./card-art.js";
import {CARDS, tributeCost} from "../game/cards.js";

const ACTIONS = {confirm: "onConfirm", cancel: "onCancel", skip: "onSkip", "end-phase": "onEndPhase", restart: "onRestart"};
// Public catalog: the first copy of each of the eight card names.
const catalog = Object.values(CARDS).filter((card, i, all) => all.findIndex((each) => each.name === card.name) === i);
const catalogId = (card) => catalog.find((each) => each.name === card.name).id;

function el(tag, attributes = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (value === false || value === null || value === undefined) continue;
    if (key === "class") node.className = value;
    else node.setAttribute(key, value === true ? "" : String(value));
  }
  node.append(...children.filter((child) => child !== null && child !== undefined && child !== false));
  return node;
}

function setText(node, text) {
  if (node.textContent !== text) node.textContent = text;
}

const cards = (n) => (n === null ? "none" : `${n} card${n === 1 ? "" : "s"}`);
const shown = (n) => (n === null ? "–" : String(n));
const back = () => el("span", {class: "card-back", "aria-hidden": "true"});

function pile(name) {
  const count = el("span", {class: "match-count"});
  // Up to three stacked backs, so a deck looks thicker than a nearly empty one.
  const node = el("div", {class: "match-pile", role: "img"}, back(), back(), back(), count);
  return {
    node,
    top: () => node.children[Number(node.dataset.layers ?? 1) - 1],
    set(n) {
      setText(count, shown(n));
      node.setAttribute("aria-label", `${name}: ${cards(n)}`);
      node.dataset.layers = String(Math.min(3, Math.max(1, Math.ceil((n ?? 0) / 4))));
      node.classList.toggle("empty", !n);
    },
  };
}

function plainCard(card) {
  const troop = card.kind === "troop";
  const cost = troop ? tributeCost(card.stars) : 0;
  return [
    el("strong", {class: "plain-card-name"}, card.name),
    el("span", {class: "plain-card-stats"}, troop ? `${card.attack} attack · ${card.health} life` : "Removes one enemy orb"),
    el("small", {class: "plain-card-cost"}, troop ? (cost ? `${cost} tribute${cost === 1 ? "" : "s"}` : "Free summon") : "Spell"),
  ];
}

function orbs(current, capacity) {
  return el("span", {class: "plain-orbs", "aria-hidden": "true"}, ...Array.from({length: capacity}, (_, index) =>
    el("span", {class: index < current ? "filled" : ""}),
  ));
}

function setBase(node, count, plain) {
  const label = `Base ${shown(count)}/5`;
  if (plain) node.replaceChildren(label, orbs(count, 5));
  else setText(node, label);
}

function cardButton(card, enabled, inFlight, plain) {
  // Plain hand only: an unplayable card shows why, and the text describes its button.
  const reason = plain && card.blockedReason ? card.blockedReason : null;
  const reasonId = reason ? `hand-reason-${card.cardId}` : null;
  return el("button", {
    type: "button",
    class: "card-front card-stage" + (inFlight ? " in-flight" : ""),
    "data-card-id": card.cardId,
    "data-playable": card.playable,
    "aria-label": describeCard(card) + (card.playable ? ", playable now" : ""),
    "aria-describedby": reasonId,
    "aria-pressed": String(card.selected),
    disabled: !enabled,
  }, ...(plain ? plainCard(card) : [createCardBody(card)]),
  reason ? el("small", {class: "plain-card-reason", id: reasonId}, reason) : null);
}
function slotButton(side, slot, troop, clickable, chosen, plain, forecast) {
  const owner = side === "cowboy" ? "Your" : "Wizard";
  const contents = troop ? `${troop.name}, ${troop.health} of ${troop.max} health` : "empty";
  const face = plain
    ? [el("small", {}, `Lane ${slot + 1}`), el("strong", {}, troop?.name ?? "Empty"),
      troop ? orbs(troop.health, troop.max) : null,
      forecast ? el("small", {class: "plain-forecast"}, forecast) : null]
    : [troop ? `${troop.name} ${troop.health}/${troop.max}` : "Empty"];
  return el("button", {type: "button", class: "match-slot", "data-side": side, "data-slot": slot, disabled: !clickable,
    "aria-pressed": chosen ? "true" : null,
    "aria-label": `${owner} lane ${slot + 1}: ${contents}${forecast ? `. Clash preview: ${forecast}` : ""}`}, ...face);
}

function resultDetail({outcome, reason, round}) {
  if (reason === "base-destroyed") return outcome === "draw" ? `Both Bases fell in round ${round}.` : `A Base fell in round ${round}.`;
  if (reason === "round-limit") {
    return outcome === "draw" ? `Round ${round} ended with the Bases level.` : `Round ${round} ended; more Base orbs wins.`;
  }
  return "";
}

// The CSS selector of the hand card or lane slot that has focus, so a render
// that rebuilds the lists can give focus back.
function focusedKey(root) {
  const active = document.activeElement;
  if (!active || !root.contains(active)) return null;
  if (active.dataset.cardId) return `[data-card-id="${CSS.escape(active.dataset.cardId)}"]`;
  if (active.dataset.side) return `[data-side="${active.dataset.side}"][data-slot="${active.dataset.slot}"]`;
  return null;
}

export function mountCards(root, handlers = {}, {plain = false} = {}) {
  const call = (name, ...args) => handlers[name]?.(...args);

  const round = el("span"), phase = el("span", {class: "match-phase"});
  const seedText = el("code"), seedKind = el("span", {class: "match-muted"});
  const seedInput = el("input", {type: "text", inputmode: "numeric", autocomplete: "off", spellcheck: "false",
    placeholder: "Seed", "aria-label": "Seed to replay"});
  const seedForm = el("form", {class: "match-seed"}, seedInput, el("button", {type: "submit"}, "Replay"));
  const restart = el("button", {type: "button", "data-action": "restart"}, "Restart");
  const wizardDeck = pile("Wizard deck");
  const wizardHand = el("div", {class: "match-backs", role: "img"});
  const wizardBase = el("span", {class: plain ? "match-base" : "match-base sr-only"});
  const menu = el("dialog", {class:"match-details duel-dialog","aria-label":"Duel menu"},
    el("div",{class:"dialog-heading"},el("h2",{},"Cowboys vs. Wizards"),el("button",{type:"button","data-action":"close-menu","aria-label":"Close menu"},"×")),
    el("p",{},round," · ",phase),
    el("div",{class:"match-line"},el("span",{},"Seed ",seedText," ",seedKind),seedForm,restart),
    el("p",{class:"match-muted"},`Pick a card, choose a ${plain ? "highlighted lane" : "lit tile"}, then summon. Stars set the tribute cost. Each orb is one life.`));
  const menuButton=el("button",{class:"arena-menu",type:"button","data-action":"menu","aria-label":"Open duel menu"},"☰");
  const summary = plain ? el("p", {class: "plain-match-summary"}) : null;
  const top=el("div",{class:"match-top"},menuButton,menu,
    summary,
    el("section",{class:"match-opponent","aria-label":"Wizard hand, deck, and The Gateway"},
      wizardDeck.node,wizardHand,wizardBase));

  const prompt = el("p", {class: "match-prompt", role: "status"});
  const message = el("p", {class: "match-message", role: "alert"});
  const lanes = el("div", {class: "match-lanes", role: "group", "aria-label": "Lanes"});
  const hand = el("div", {class: "match-hand", role: "group", "aria-label": "Your hand"});
  const cowboyDeck = pile("Your deck");
  const cowboyBase = el("span", {class:plain ? "match-base" : "match-base sr-only"});
  const buttons = {
    confirm: el("button", {type: "button", "data-action": "confirm"}, "Confirm"),
    cancel: el("button", {type: "button", "data-action": "cancel"}, "Cancel"),
    skip: el("button", {type: "button", "data-action": "skip"}, "Skip move"),
    endPhase: el("button", {type: "button", "data-action": "end-phase"}, "End phase"),
  };
  const selectionActions=el("div",{class:"match-buttons selection-actions"},buttons.confirm,buttons.cancel,buttons.skip);
  const selectionPanel=el("div",{class:"selection-panel",hidden:true},
    prompt,
    selectionActions);
  const handCount=el("span",{class:"hand-count"});
  const viewArt=el("button",{class:"view-art",type:"button","data-action":"view-art"},"Card art");
  const bottom=el("div",{class:"match-bottom"},selectionPanel,message,
    el("div",{class:"hand-heading"},handCount,viewArt),hand);
  const own=el("section",{class:"match-own","aria-label":"Your deck and The Saloon"},cowboyDeck.node,cowboyBase);
  const phaseRound=el("small"),phaseLabel=el("strong");
  buttons.endPhase.replaceChildren(phaseRound,phaseLabel);
  const forecastBases = el("span", {class: "clash-forecast-bases"});
  const forecastLosses = el("p");
  const forecastTiming = el("p", {class: "match-muted"});
  const forecastPass = el("p");
  const forecast = plain ? el("div", {class: "clash-forecast", role: "status", hidden: true},
    el("p", {}, el("strong", {}, "Next clash"), forecastBases),
    forecastLosses, forecastTiming, forecastPass) : null;
  const phaseControl=el("div",{class:"match-buttons phase-control"},forecast,buttons.endPhase);
  const viewerCard=el("div",{class:"card-preview card-stage"});
  const viewerTitle=el("h2",{},"Card art");
  const viewerNote=el("p",{class:"viewer-note"});
  const viewer=el("dialog",{class:"duel-dialog card-viewer","aria-label":"Card art"},
    el("div",{class:"dialog-heading"},viewerTitle,el("button",{type:"button","data-action":"close-art","aria-label":"Close card art"},"×")),
    el("div",{class:"art-choices"},...["cowboy","wizard"].flatMap(side=>[
      el("b",{},side==="cowboy"?"Cowboys":"Wizards"),
      ...catalog.filter(card=>card.side===side).map(card=>el("button",{type:"button","data-art":card.id,"aria-pressed":"false"},card.name))])),
    viewerCard,viewerNote,el("button",{type:"button","data-action":"flip-art"},"Flip card"));
  function showArt(card) {
    viewerCard.replaceChildren(createCardBody(card));
    viewerCard.classList.remove("is-flipped");
    for(const choice of viewer.querySelectorAll("[data-art]"))choice.setAttribute("aria-pressed",String(choice.dataset.art===catalogId(card)));
    setText(viewerTitle,card.name);
    setText(viewerNote,describeCard(card));
    if(!viewer.open)viewer.showModal();
  }
  viewerCard.addEventListener("pointermove",event=>{
    if(document.documentElement.classList.contains("reduce-card-motion")||matchMedia("(prefers-reduced-motion: reduce)").matches)return;
    const r=viewerCard.getBoundingClientRect();
    viewerCard.style.setProperty("--yaw",((event.clientX-r.left)/r.width-.5)*28+"deg");
    viewerCard.style.setProperty("--pitch",(0.5-(event.clientY-r.top)/r.height)*18+"deg");
  });
  viewerCard.addEventListener("pointerleave",()=>{
    viewerCard.style.removeProperty("--yaw");viewerCard.style.removeProperty("--pitch");
  });

  const resultTitle = el("h2"), resultText = el("p");
  const resultRestart = el("button", {type: "button", "data-action": "restart"}, "Restart");
  const result = el("section", {class: "match-result", "aria-label": "Match result", hidden: true},
    resultTitle, resultText, resultRestart);

  viewArt.hidden = plain;
  root.replaceChildren(top,own,lanes,phaseControl,bottom,...(plain ? [] : [viewer]),result);

  // Transient card animations: a copy of the confirmed troop card flying from
  // its hand position to the chosen lane's indicator, and a drawn Cowboy card
  // flying from the deck pile to its hand position while the Presenter plays
  // the draw (model.draw).
  let model = null;
  // Opt-in clash log (?log=1): made on the first render that carries one, so
  // the default page gains no element. A polite live region, latest clash only.
  let clashLog = null; // {title, list, shown}
  let flight = null; // {cardId, node, animation}
  let drawFlight = null; // {key, handIndex, node, animation, turn}
  let drawKey = null; // model.draw.key of the latest draw seen, so each draw flies once
  // A render can take keyboard focus away: the chosen lane or the hand is
  // disabled, the card leaves the hand, or Confirm/Cancel hide with their
  // panel. `strayed` stays set until a usable control has focus again.
  let strayed = false;
  let lastCard = null; // cardId of the latest selected card, where Cancel returns focus
  const stray = () => {
    const active = document.activeElement;
    return !active || active === document.body || active.disabled || Boolean(active.closest("[hidden]"));
  };

  const moving = (cardId, index) => cardId === flight?.cardId || index === drawFlight?.handIndex;
  const reducedMotion = () => plain || document.documentElement.classList.contains("reduce-card-motion") || typeof root.animate !== "function" || matchMedia("(prefers-reduced-motion: reduce)").matches;

  function clearFlight() {
    if (!flight) return;
    const {node, animation} = flight;
    flight = null;
    animation?.cancel();
    node.remove();
    for (const card of hand.querySelectorAll(".in-flight")) {
      if (card !== hand.children[drawFlight?.handIndex]) card.classList.remove("in-flight");
    }
  }

  // Geometry and cardId+slot of the confirmed human summon, until its
  // renderer cue starts (after any tributes leave).
  let pending = null;
  function cancelSummon() {
    pending = null;
    clearFlight();
  }

  // Called when the renderer starts a summon, with its returned cue. Only the
  // pending human card and slot launches; CPU and stale summons do nothing.
  function summonStarted({side, slot, cardId}, cue) {
    const mine = pending;
    if (!mine || side !== "cowboy" || mine.cardId !== cardId || mine.slot !== slot) return;
    pending = null;
    if (cue && Number.isFinite(cue.impact) && cue.impact > 0) launch(mine, cue.impact);
  }

  function clearDraw() {
    if (!drawFlight) return;
    const {handIndex, node, animation, turn} = drawFlight;
    drawFlight = null;
    animation.cancel();
    turn.cancel();
    node.remove();
    const target = hand.children[handIndex];
    if (target && !moving(target.dataset.cardId, handIndex)) target.classList.remove("in-flight");
  }

  // Flies a card back from the deck pile to the drawn card's rendered place
  // in the hand, turning over halfway into a copy of that card's face. It
  // lands a little before the Presenter's pause ends, so the card has settled
  // before the next event; a draw that ends earlier cancels it in render().
  function launchDraw({key, handIndex, ms}, from) {
    clearDraw();
    const target = hand.children[handIndex];
    if (!target || reducedMotion() || ms <= 50) return;
    const overflow = target.getBoundingClientRect().right - hand.getBoundingClientRect().right;
    if (overflow > 0) hand.scrollLeft += overflow;
    const box = target.getBoundingClientRect();
    const width = target.offsetWidth, height = target.offsetHeight;
    if (!from.width || !from.height || !width || !height) return;
    const left = box.left + box.width / 2 - width / 2, top = box.top + box.height / 2 - height / 2;
    const face = Array.from(target.childNodes, (child) => child.cloneNode(true));
    const node = el("div", {class: "card-front card-flight card-draw", "aria-hidden": "true"}, ...face, back());
    Object.assign(node.style, {left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px`});
    root.append(node);
    const dx = from.left + from.width / 2 - (box.left + box.width / 2);
    const dy = from.top + from.height / 2 - (box.top + box.height / 2);
    const scale = from.height / height;
    const lift = (scale + 1) / 2 * 1.08;
    const timing = {duration: ms - 50, easing: "cubic-bezier(.3,.6,.3,1)", fill: "both"};
    // The turn: the card narrows to an edge at the midpoint, where the back
    // gives way to the face.
    const animation = node.animate([
      {transform: `translate(${dx}px,${dy}px) scale(${from.width / width},${scale})`},
      {transform: `translate(${dx * 0.4}px,${dy * 0.4 - 16}px) scale(0.04,${lift})`, offset: 0.5},
      {transform: "translate(0,0) scale(1)"},
    ], timing);
    const turn = node.lastChild.animate([{opacity: 1}, {opacity: 1, offset: 0.5}, {opacity: 0, offset: 0.5}, {opacity: 0}], timing);
    drawFlight = {key, handIndex, node, animation, turn};
    target.classList.add("in-flight");
    animation.onfinish = () => {
      if (drawFlight?.node === node) clearDraw();
    };
  }

  // Geometry for a confirm that can summon a troop, read before the click is
  // sent because the render that follows rebuilds the hand and lanes.
  function summonGeometry() {
    if (!model?.buttons.confirm) return null;
    const {cardId, slot} = model.selection;
    const card = model.cowboy.hand.find((each) => each.cardId === cardId);
    if (!card || card.kind !== "troop" || slot === null) return null;
    const source = hand.querySelector(`[data-card-id="${CSS.escape(cardId)}"]`);
    // Prefer the selected 3D board tile; fall back to the lane button.
    const board = handlers.summonTarget?.(slot);
    const usable = board && [board.left, board.top, board.width, board.height].every(Number.isFinite) && board.width > 0 && board.height > 0;
    const to = usable ? board : lanes.querySelector(`[data-side="cowboy"][data-slot="${slot}"]`)?.getBoundingClientRect();
    if (!source || !to) return null;
    // The hand is rebuilt before the summon starts, so keep a copy of the face.
    return {cardId, slot, faces: Array.from(source.childNodes, (child) => child.cloneNode(true)),
      from: source.getBoundingClientRect(), to};
  }

  // Launched by summonStarted() on the accepted summon's renderer cue; the
  // flight lasts until that cue's impact, where the troop lands.
  function launch({cardId, faces, from, to}, ms) {
    if (reducedMotion()) return;
    if (!from.width || !from.height || !to.width) return;
    clearFlight();
    const node = el("div", {class: "card-front card-flight", "aria-hidden": "true"}, ...faces);
    Object.assign(node.style, {left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`});
    root.append(node);
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const animation = node.animate([
      {transform: "translate(0,0) scale(1.06)", opacity: 1, easing: "ease-out"},
      {transform: `translate(${dx * 0.08}px,${dy * 0.08 - 18}px) scale(1.1) rotate(-2deg)`, opacity: 1, offset: 0.2, easing: "cubic-bezier(.4,0,.2,1)"},
      {transform: `translate(${dx}px,${dy}px) scale(.3) rotate(3deg)`, opacity: 0.9, offset: 0.9},
      {transform: `translate(${dx}px,${dy}px) scale(.25)`, opacity: 0},
    ], {duration: ms / 0.9});
    flight = {cardId, node, animation};
    hand.querySelector(`[data-card-id="${CSS.escape(cardId)}"]`)?.classList.add("in-flight");
    animation.onfinish = () => {
      if (flight?.node === node) clearFlight();
    };
  }

  root.addEventListener("click", (event) => {
    const button = event.target.closest?.("button");
    if (!button || !root.contains(button) || button.disabled || button.type === "submit") return;
    const {cardId, side, slot, action} = button.dataset;
    if(action==="menu"){menu.showModal();return;}
    if(action==="close-menu"){menu.close();return;}
    if(action==="close-art"){viewer.close();return;}
    if(action==="flip-art"){viewerCard.classList.toggle("is-flipped");return;}
    if(button.dataset.art){showArt(CARDS[button.dataset.art]);return;}
    if(action==="view-art"){
      const selected=model?.cowboy.hand.find(card=>card.selected);
      showArt(selected??catalog[0]);
      return;
    }
    if (cardId) call("onCard", cardId);
    else if (side) call("onSlot", side, Number(slot));
    else if (action === "confirm") {
      if (!plain) pending = summonGeometry();
      const outcome = call("onConfirm");
      if (!outcome?.ok || model.status === "error") pending = null;
    } else if (ACTIONS[action]) {
      if (action === "restart" || action === "cancel") cancelSummon();
      if (action === "restart") clearDraw();
      if(action==="restart")menu.close();
      call(ACTIONS[action]);
    }
  });
  seedForm.addEventListener("submit", (event) => {
    event.preventDefault();
    cancelSummon();
    clearDraw();
    call("onReplaySeed", seedInput.value.trim());
    menu.close();
  });

  function render(next) {
    model = next;
    // Idle (mode switch), error, a refusal message or another match end the flight.
    if (model.status === "idle" || model.status === "error" || model.message || model.round === null || model.result) cancelSummon();
    // A draw flight lasts only while the Presenter plays that draw: restart,
    // mode switch, error and the end of its pause all end it.
    if (drawFlight && model.draw?.key !== drawFlight.key) clearDraw();
    root.dataset.status = model.status;
    setText(round, model.round === null ? "No round" : `Round ${model.round}`);
    setText(phase, model.phase);
    setText(seedText, model.seed.text);
    setText(seedKind, model.seed.value === null ? "" : model.seed.pinned ? "(pinned)" : "(generated)");
    if (summary) setText(summary, `${round.textContent} · ${model.phase} · Seed ${model.seed.text}`);

    wizardDeck.set(model.wizard.deckCount);
    const held = model.wizard.handCount ?? 0;
    if (plain) setText(wizardHand, `Hand ${shown(model.wizard.handCount)}`);
    else if (wizardHand.childElementCount !== held) wizardHand.replaceChildren(...Array.from({length: held}, back));
    wizardHand.setAttribute("aria-label", `Wizard hand: ${cards(model.wizard.handCount)}`);
    setBase(wizardBase, model.wizard.baseOrbs, plain);
    const newDraw = !plain && model.draw && model.draw.key !== drawKey ? model.draw : null;
    const drawOrigin = newDraw ? cowboyDeck.top().getBoundingClientRect() : null;
    cowboyDeck.set(model.cowboy.deckCount);
    setBase(cowboyBase, model.cowboy.baseOrbs, plain);

    setText(handCount,"Your hand · "+model.cowboy.handCount);
    setText(phaseRound,"ROUND "+model.round);
    setText(phaseLabel,model.status==="cpu_turn"?"Wizards":model.status==="playing"?"Resolving":"End turn");
    if (forecast) {
      const nextClash = model.clashForecast;
      forecast.hidden = !nextClash;
      if (nextClash) {
        setText(forecastBases, nextClash.bases);
        setText(forecastTiming, nextClash.timing);
        setText(forecastLosses, nextClash.losses);
        setText(forecastPass, nextClash.pass);
        forecastLosses.hidden = !nextClash.losses;
        forecastPass.hidden = !nextClash.pass;
      }
    }
    const selected=model.cowboy.hand.find(card=>card.selected);
    const inPanel = selectionPanel.contains(document.activeElement);
    const selectionOn=Boolean(selected)&&model.buttons.cancel;
    // ?guide=1 only: keep the prompt visible while idle; the buttons stay hidden without a selection.
    selectionPanel.hidden=!selectionOn&&!model.guideShown;
    selectionActions.hidden=model.guideShown&&!selectionOn;
    if (selected) lastCard = selected.cardId;
    for (const [name, button] of Object.entries(buttons)) button.disabled = !model.buttons[name];
    if (selected) buttons.confirm.textContent = selected.kind === "spell" ? "Cast" : "Summon";
    setText(prompt, model.prompt);
    if (model.clashLog) {
      if (!clashLog) {
        clashLog = {title: el("strong"), list: el("ul"), shown: ""};
        root.append(el("section", {class: "match-clash-log", role: "status", "aria-live": "polite", "aria-label": "Latest clash"}, clashLog.title, clashLog.list));
      }
      const shownNow = JSON.stringify(model.clashLog);
      if (clashLog.shown !== shownNow) {
        clashLog.shown = shownNow;
        setText(clashLog.title, model.clashLog.title);
        clashLog.list.replaceChildren(...model.clashLog.lines.map((line) => el("li", {}, line)));
      }
    }
    setText(message, model.message);
    message.hidden = !model.message || (selected && model.status!=="error");

    const refocus = focusedKey(root);
    lanes.replaceChildren(...model.lanes.flatMap(({lane, cowboy, wizard}) => [
      slotButton("wizard", lane, wizard, model.slots.wizard.includes(lane), false, plain),
      slotButton("cowboy", lane, cowboy, model.slots.cowboy.includes(lane), model.tributes.includes(lane), plain,
        model.summonForecasts?.[lane]),
    ]));
    hand.replaceChildren(...model.cowboy.hand.map((card, index) => {
      const node=cardButton(card,model.buttons.hand,moving(card.cardId,index),plain);
      node.style.setProperty("--fan",index-(model.cowboy.hand.length-1)/2);
      return node;
    }));
    layout();
    if (refocus) root.querySelector(refocus)?.focus();
    // Focus lost from a board control goes to the next step: Confirm once the
    // selection is complete, else the card just cancelled, the hand, End phase.
    if (refocus || inPanel) strayed = true;
    if (strayed && stray()) {
      (!selectionPanel.hidden && model.buttons.confirm ? buttons.confirm
        : hand.querySelector(`[data-card-id="${CSS.escape(lastCard ?? "")}"]:enabled`)
          ?? hand.querySelector("button:enabled") ?? buttons.endPhase).focus();
    }
    strayed &&= stray();
    // Launched after the hand is rebuilt, so it aims at the new card's place.
    if (newDraw) {
      drawKey = newDraw.key;
      launchDraw(newDraw, drawOrigin);
    }

    restart.disabled = resultRestart.disabled = !model.buttons.restart;
    buttons.skip.hidden=!model.buttons.skip;

    result.hidden = model.result === null;
    if (model.result) {
      setText(resultTitle, model.result.label);
      setText(resultText, resultDetail(model.result));
      result.dataset.outcome = model.result.outcome;
    }
  }

  function place(node,rect) {
    if(!rect)return;
    const host=root.getBoundingClientRect();
    Object.assign(node.style,{left:rect.left-host.left+"px",top:rect.top-host.top+"px",width:rect.width+"px",height:rect.height+"px"});
  }
  function layout() {
    for(const node of lanes.children)place(node,handlers.slotTarget?.(node.dataset.side,Number(node.dataset.slot)));
    place(cowboyDeck.node,handlers.deckTarget?.("cowboy"));
    place(wizardDeck.node,handlers.deckTarget?.("wizard"));
  }
  new ResizeObserver(layout).observe(root);
  return {render,layout,summonStarted,cancelSummon};
}
