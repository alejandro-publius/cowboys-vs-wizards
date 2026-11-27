import {EFFECTS, cardOf} from "../game/showdown/cards.js";
import {applyAction, createShowdown} from "../game/showdown/rules.js";

// Seed 0 deals all three cards in time to reach the witness on turn two with ordinary decks.
export function dealHellfire() {
  let state = createShowdown(0, {first: "cowboy"});
  for (const action of [
    {type: "summon", cardId: "cowboy-sheriff-3", tributes: []},
    {type: "end"},
    {type: "summon", cardId: "wizard-skeleton-4", tributes: []},
  ]) state = applyAction(state, action).state;
  return state;
}

const troopFace = (side, type) => `<li class="forge-troop"><span class="forge-troop-art" data-painting="${type}" aria-hidden="true"></span><span class="forge-troop-state" id="forge-${side}-state" data-${side}></span><span class="forge-orbs" aria-hidden="true"></span></li>`;
const moveFace = (value, wording) => `<div class="forge-move"><span class="forge-spell" data-painting="wizard-hellfire" aria-hidden="true"></span><button type="button" value="${value}">${wording}</button></div>`;

export const hellfireHtml = `<section class="forge-hellfire" aria-labelledby="forge-hellfire-title">
  <h4 id="forge-hellfire-title">Who gets burned by Hellfire?</h4>
  <div class="forge-play">
    <div data-readings>
      <p>As the Wizards, predict who loses an orb.</p>
      <div class="sd-row">
        ${moveFace("all", "Remove 1 orb from every troop.")}
        ${moveFace("enemy", EFFECTS.hellfire.text)}
      </div>
    </div>
    <div data-result hidden>
      <p data-verdict tabindex="-1" aria-describedby="forge-cowboy-state forge-wizard-state"></p>
      <button type="button" data-retry>Replay the same board</button>
    </div>
  </div>
  <div class="forge-scene">
    <ul class="forge-board" aria-label="Troops on the board">
      ${troopFace("cowboy", "cowboy-sheriff")}
      ${troopFace("wizard", "wizard-skeleton")}
    </ul>
  </div>
</section>`;

export function mountHellfire(host, portrait) {
  const board = dealHellfire();
  const sheriff = board.sides.cowboy.board[0], skeleton = board.sides.wizard.board[0];
  const ally = cardOf(skeleton.cardId).name;
  const readings = host.querySelector("[data-readings]"), result = host.querySelector("[data-result]");
  const verdict = result.querySelector("[data-verdict]");
  const choices = [...readings.querySelectorAll("button")];
  if (typeof portrait === "function") {
    for (const slot of host.querySelectorAll("[data-painting]")) {
      const image = portrait(slot.dataset.painting);
      if (image) slot.append(image);
    }
  }
  let alternate;
  function showTroops(after) {
    for (const [side, faction] of [["cowboy", "Cowboys"], ["wizard", "Wizards"]]) {
      const troop = board.sides[side].board[0];
      const left = after ? after.sides[side].board[0]?.health ?? 0 : troop.health;
      const orbs = after ? `${troop.health} → ${left} orbs` : `${troop.health} orbs`;
      const label = host.querySelector(`[data-${side}]`);
      label.textContent = `${faction} · ${cardOf(troop.cardId).name} · ${orbs}`;
      const face = label.parentElement;
      if (face) {
        face.toggleAttribute("data-hit", left < troop.health);
        face.querySelector(".forge-orbs").innerHTML = "<i></i>".repeat(left) + "<i data-spent></i>".repeat(troop.health - left);
      }
    }
  }
  showTroops();

  for (const choice of choices) choice.addEventListener("click", () => {
    const {state} = applyAction(board, {type: "spell", cardId: "wizard-hellfire-1"});
    const enemyLeft = state.sides.cowboy.board[0]?.health ?? 0;
    const allyLeft = state.sides.wizard.board[0]?.health ?? 0;
    const allTroops = choice.value === "all";
    const allyPrediction = allTroops ? skeleton.health - 1 : skeleton.health;
    const matches = enemyLeft === sheriff.health - 1 && allyLeft === allyPrediction;
    showTroops(state);
    verdict.textContent = `“${allTroops ? "Every troop" : "Every enemy troop"}” ${matches ? "matches this cast" : "fails on this board"}. It predicts ${allyPrediction} orbs for your ${ally}.`;
    alternate = choices.find((button) => button !== choice);
    readings.hidden = true;
    result.hidden = false;
    verdict.focus();
  });
  result.querySelector("[data-retry]").addEventListener("click", () => {
    showTroops();
    result.hidden = true;
    readings.hidden = false;
    alternate.focus();
  });
}
