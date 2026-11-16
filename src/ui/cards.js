// Orb Duel card overlay: match details, the Wizard's card backs, lanes, the
// Cowboy hand and deck pile, prompts and the result, drawn from cardModel()
// data (src/ui/card-model.js). Card fronts are plain text and labelled
// temporary. The deck piles and the Wizard hand show the approved card back
// through the CSS custom property --card-back, which scripts/build.mjs fills
// from assets/cards/card-back.png. Every control is a native button and
// clicks are delegated to `handlers`; nothing here touches the Engine.
//
// mountCards(root, handlers) -> {render(model)}
// handlers: onCard(cardId), onSlot(side, slot), onConfirm(), onCancel(),
//   onSkip(), onEndPhase(), onRestart(), onReplaySeed(text)
// render() sets root.dataset.status to the controller status.

const ACTIONS = {confirm: "onConfirm", cancel: "onCancel", skip: "onSkip", "end-phase": "onEndPhase", restart: "onRestart"};

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

function cardButton(card, enabled, inFlight) {
  const tier = card.kind === "spell" ? "Spell" : `Troop · ${card.stars} star${card.stars === 1 ? "" : "s"}`;
  return el("button", {type: "button", class: inFlight ? "card-front in-flight" : "card-front", "data-card-id": card.cardId, "aria-pressed": String(card.selected), disabled: !enabled},
    el("span", {class: "card-name"}, card.name),
    el("span", {class: "card-tier"}, tier),
    card.kind === "spell" ? null : el("span", {class: "card-stats"}, `Health ${card.health} · Attack ${card.attack}`),
    el("small", {class: "card-temp"}, card.label));
}

function slotButton(side, slot, troop, clickable, chosen) {
  const owner = side === "cowboy" ? "Your" : "Wizard";
  const contents = troop ? `${troop.name}, ${troop.health} of ${troop.max} health` : "empty";
  return el("button", {type: "button", class: "match-slot", "data-side": side, "data-slot": slot, disabled: !clickable,
    "aria-pressed": chosen ? "true" : null, "aria-label": `${owner} lane ${slot + 1}: ${contents}`},
  troop ? `${troop.name} ${troop.health}/${troop.max}` : "Empty");
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

export function mountCards(root, handlers = {}) {
  const call = (name, ...args) => handlers[name]?.(...args);

  const round = el("span"), phase = el("span", {class: "match-phase"});
  const seedText = el("code"), seedKind = el("span", {class: "match-muted"});
  const seedInput = el("input", {type: "text", inputmode: "numeric", autocomplete: "off", spellcheck: "false",
    placeholder: "Seed", "aria-label": "Seed to replay"});
  const seedForm = el("form", {class: "match-seed"}, seedInput, el("button", {type: "submit"}, "Replay"));
  const restart = el("button", {type: "button", "data-action": "restart"}, "Restart");
  const wizardDeck = pile("Wizard deck");
  const wizardHand = el("div", {class: "match-backs", role: "img"});
  const wizardBase = el("span", {class: "match-base"});
  const top = el("div", {class: "match-top"},
    el("section", {class: "match-panel match-details", "aria-label": "Match details"},
      el("p", {}, round, " · ", phase),
      el("div", {class: "match-line"}, el("span", {}, "Seed ", seedText, " ", seedKind), seedForm, restart)),
    el("section", {class: "match-panel match-opponent", "aria-label": "Wizard hand and deck"},
      el("span", {class: "match-side"}, "Wizard"), wizardDeck.node, wizardHand, wizardBase));

  const prompt = el("p", {class: "match-prompt", role: "status"});
  const message = el("p", {class: "match-message", role: "alert"});
  const lanes = el("div", {class: "match-lanes", role: "group", "aria-label": "Lanes"});
  const hand = el("div", {class: "match-hand", role: "group", "aria-label": "Your hand"});
  const cowboyDeck = pile("Your deck");
  const cowboyBase = el("span", {class: "match-base"});
  const buttons = {
    confirm: el("button", {type: "button", "data-action": "confirm"}, "Confirm"),
    cancel: el("button", {type: "button", "data-action": "cancel"}, "Cancel"),
    skip: el("button", {type: "button", "data-action": "skip"}, "Skip move"),
    endPhase: el("button", {type: "button", "data-action": "end-phase"}, "End phase"),
  };
  const bottom = el("div", {class: "match-bottom"}, prompt, message,
    el("div", {class: "match-row"}, lanes, hand,
      el("div", {class: "match-own"}, cowboyDeck.node, cowboyBase),
      el("div", {class: "match-buttons"}, ...Object.values(buttons))));

  const resultTitle = el("h2"), resultText = el("p");
  const resultRestart = el("button", {type: "button", "data-action": "restart"}, "Restart");
  const result = el("section", {class: "match-result", "aria-label": "Match result", hidden: true},
    el("div", {class: "match-panel"}, resultTitle, resultText, resultRestart));

  root.replaceChildren(top, bottom, result);

  // Transient card animations: a copy of the confirmed troop card flying from
  // its hand position to the chosen lane's indicator, and a drawn Cowboy card
  // flying from the deck pile to its hand position while the Presenter plays
  // the draw (model.draw).
  let model = null;
  let flight = null; // {cardId, node, animation}
  let drawFlight = null; // {key, handIndex, node, animation, turn}
  let drawKey = null; // model.draw.key of the latest draw seen, so each draw flies once

  const moving = (cardId, index) => cardId === flight?.cardId || index === drawFlight?.handIndex;
  const reducedMotion = () => typeof root.animate !== "function" || matchMedia("(prefers-reduced-motion: reduce)").matches;

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
    const target = lanes.querySelector(`[data-side="cowboy"][data-slot="${slot}"]`);
    if (!source || !target) return null;
    return {cardId, source, from: source.getBoundingClientRect(), to: target.getBoundingClientRect()};
  }

  function launch({cardId, source, from, to}) {
    if (reducedMotion()) return;
    if (!from.width || !from.height || !to.width) return;
    clearFlight();
    const node = el("div", {class: "card-front card-flight", "aria-hidden": "true"}, ...Array.from(source.childNodes, (child) => child.cloneNode(true)));
    Object.assign(node.style, {left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`});
    root.append(node);
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const animation = node.animate([
      {transform: "translate(0,0) scale(1.06)", opacity: 1},
      {transform: `translate(${dx * 0.08}px,${dy * 0.08 - 18}px) scale(1.1) rotate(-2deg)`, opacity: 1, offset: 0.2},
      {transform: `translate(${dx}px,${dy}px) scale(.3) rotate(3deg)`, opacity: 0.9, offset: 0.9},
      {transform: `translate(${dx}px,${dy}px) scale(.25)`, opacity: 0},
    ], {duration: 520, easing: "cubic-bezier(.4,0,.2,1)"});
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
    if (cardId) call("onCard", cardId);
    else if (side) call("onSlot", side, Number(slot));
    else if (action === "confirm") {
      const geometry = summonGeometry();
      const outcome = call("onConfirm");
      if (geometry && outcome?.ok && model.status !== "error") launch(geometry);
    } else if (ACTIONS[action]) {
      if (action === "restart" || action === "cancel") clearFlight();
      if (action === "restart") clearDraw();
      call(ACTIONS[action]);
    }
  });
  seedForm.addEventListener("submit", (event) => {
    event.preventDefault();
    clearFlight();
    clearDraw();
    call("onReplaySeed", seedInput.value.trim());
  });

  function render(next) {
    model = next;
    // Idle (mode switch), error, a refusal message or another match end the flight.
    if (flight && (model.status === "idle" || model.status === "error" || model.message || model.round === null)) clearFlight();
    // A draw flight lasts only while the Presenter plays that draw: restart,
    // mode switch, error and the end of its pause all end it.
    if (drawFlight && model.draw?.key !== drawFlight.key) clearDraw();
    root.dataset.status = model.status;
    setText(round, model.round === null ? "No round" : `Round ${model.round}`);
    setText(phase, model.phase);
    setText(seedText, model.seed.text);
    setText(seedKind, model.seed.value === null ? "" : model.seed.pinned ? "(pinned)" : "(generated)");

    wizardDeck.set(model.wizard.deckCount);
    const held = model.wizard.handCount ?? 0;
    if (wizardHand.childElementCount !== held) wizardHand.replaceChildren(...Array.from({length: held}, back));
    wizardHand.setAttribute("aria-label", `Wizard hand: ${cards(model.wizard.handCount)}`);
    setText(wizardBase, `Base ${shown(model.wizard.baseOrbs)}/5`);
    const newDraw = model.draw && model.draw.key !== drawKey ? model.draw : null;
    const drawOrigin = newDraw ? cowboyDeck.top().getBoundingClientRect() : null;
    cowboyDeck.set(model.cowboy.deckCount);
    setText(cowboyBase, `Base ${shown(model.cowboy.baseOrbs)}/5`);

    setText(prompt, model.prompt);
    setText(message, model.message);
    message.hidden = !model.message;

    const refocus = focusedKey(root);
    lanes.replaceChildren(...model.lanes.flatMap(({lane, cowboy, wizard}) => [
      slotButton("wizard", lane, wizard, model.slots.wizard.includes(lane), false),
      slotButton("cowboy", lane, cowboy, model.slots.cowboy.includes(lane), model.tributes.includes(lane)),
    ]));
    hand.replaceChildren(...model.cowboy.hand.map((card, index) => cardButton(card, model.buttons.hand, moving(card.cardId, index))));
    if (refocus) root.querySelector(refocus)?.focus();
    // Launched after the hand is rebuilt, so it aims at the new card's place.
    if (newDraw) {
      drawKey = newDraw.key;
      launchDraw(newDraw, drawOrigin);
    }

    for (const [name, button] of Object.entries(buttons)) button.disabled = !model.buttons[name];
    restart.disabled = resultRestart.disabled = !model.buttons.restart;

    result.hidden = model.result === null;
    if (model.result) {
      setText(resultTitle, model.result.label);
      setText(resultText, resultDetail(model.result));
      result.dataset.outcome = model.result.outcome;
    }
  }

  return {render};
}
