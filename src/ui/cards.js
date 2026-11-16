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
  const node = el("div", {class: "match-pile", role: "img"}, back(), count);
  return {
    node,
    set(n) {
      setText(count, shown(n));
      node.setAttribute("aria-label", `${name}: ${cards(n)}`);
      node.classList.toggle("empty", !n);
    },
  };
}

function cardButton(card, enabled) {
  const tier = card.kind === "spell" ? "Spell" : `Troop · ${card.stars} star${card.stars === 1 ? "" : "s"}`;
  return el("button", {type: "button", class: "card-front", "data-card-id": card.cardId, "aria-pressed": String(card.selected), disabled: !enabled},
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

  root.addEventListener("click", (event) => {
    const button = event.target.closest?.("button");
    if (!button || !root.contains(button) || button.disabled || button.type === "submit") return;
    const {cardId, side, slot, action} = button.dataset;
    if (cardId) call("onCard", cardId);
    else if (side) call("onSlot", side, Number(slot));
    else if (ACTIONS[action]) call(ACTIONS[action]);
  });
  seedForm.addEventListener("submit", (event) => {
    event.preventDefault();
    call("onReplaySeed", seedInput.value.trim());
  });

  function render(model) {
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
    hand.replaceChildren(...model.cowboy.hand.map((card) => cardButton(card, model.buttons.hand)));
    if (refocus) root.querySelector(refocus)?.focus();

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
